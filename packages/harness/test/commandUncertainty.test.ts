import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ChildProcess, execFile } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  commandRunnerResultToOutput,
  createDockerSandboxCommandRunner,
  createHostShellCommandRunner,
  createMacosVmCommandRunner,
  type CommandRunnerRequest,
} from '../src/commandRunner.js';
import { executeQualityGateTool } from '../src/tools/qualityGateTool.js';
import { createSensorCheckNode } from '../src/nodes/sensorCheck.js';
import type { RunExecutionControl } from '../src/runControl.js';
import type { HarnessStateType } from '../src/graphState.js';

function request(cwd: string, signal?: AbortSignal): CommandRunnerRequest {
  return {
    command: 'date',
    cwd,
    env: { mode: 'explicit', variables: {} },
    workspace: { root: cwd },
    timeoutMs: 1000,
    maxOutputBytes: 1000,
    audit: { toolId: 'sys_bash' },
    signal,
  };
}

async function childFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'command-uncertainty-'));
  const ready = join(directory, 'ready');
  const release = join(directory, 'release');
  const marker = join(directory, 'late-marker');
  const child = join(directory, 'child.cjs');
  await writeFile(
    child,
    `const fs = require('node:fs'); const [ready, release, marker] = process.argv.slice(2); fs.writeFileSync(ready, 'ready'); const timer = setInterval(() => { if (fs.existsSync(release)) { fs.writeFileSync(marker, 'completed'); clearInterval(timer); process.exit(0); } }, 10); setTimeout(() => process.exit(0), 4000);`,
  );
  return {
    directory,
    ready,
    release,
    marker,
    child,
    async finish() {
      await writeFile(release, 'go');
      await vi.waitFor(() => expect(existsSync(marker)).toBe(true), {
        timeout: 3000,
        interval: 10,
      });
    },
  };
}

describe('command completion uncertainty', () => {
  it('reports unknown after killing a real shell while its descendant writes a later marker', async () => {
    const fixture = await childFixture();
    const controller = new AbortController();
    const args = [process.execPath, fixture.child, fixture.ready, fixture.release, fixture.marker]
      .map((value) => `'${value.replaceAll("'", "'\\''")}'`)
      .join(' ');
    const result = createHostShellCommandRunner().run({
      ...request(fixture.directory, controller.signal),
      timeoutMs: 10_000,
      command: `${args} >/dev/null 2>&1 & wait`,
    });
    try {
      await vi.waitFor(() => expect(existsSync(fixture.ready)).toBe(true));
      controller.abort('user_stop');
      const output = await result;
      expect(output).toMatchObject({
        status: 'outcome_unknown',
        code: 'COMMAND_OUTCOME_UNKNOWN',
        reason: 'aborted',
      });
      expect(commandRunnerResultToOutput('sys_bash', output)).toMatchObject({
        type: 'error',
        code: 'COMMAND_OUTCOME_UNKNOWN',
      });
      expect(existsSync(fixture.marker)).toBe(false);
      await fixture.finish();
      expect(await readFile(fixture.marker, 'utf8')).toBe('completed');
    } finally {
      await writeFile(fixture.release, 'go');
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('stores unknown inside the actual sensor invocation before reporting a real aborted pnpm child', async () => {
    const fixture = await childFixture();
    const controller = new AbortController();
    const settlements: unknown[] = [];
    const pnpm = join(fixture.directory, 'pnpm');
    await writeFile(
      pnpm,
      `#!${process.execPath}\nconst {spawn} = require('node:child_process'); const child = spawn(${JSON.stringify(process.execPath)}, ${JSON.stringify([fixture.child, fixture.ready, fixture.release, fixture.marker])}, {stdio:'ignore'}); child.on('exit', () => process.exit(0));`,
      { mode: 0o700 },
    );
    const control: RunExecutionControl = {
      assertActive() {},
      invoke(_kind, action) {
        return action().then((value) => {
          settlements.push(value);
          return value;
        });
      },
    };
    const pending = executeQualityGateTool(
      'sys_run_quality_gate',
      { profile: 'test', repoPath: fixture.directory, timeoutMs: 10_000 },
      {
        workspaceRoot: fixture.directory,
        pnpmBin: pnpm,
        runControl: control,
        signal: controller.signal,
      },
    );
    try {
      await vi.waitFor(() => expect(existsSync(fixture.ready)).toBe(true));
      controller.abort('user_stop');
      expect(await pending).toMatchObject({ type: 'error', code: 'COMMAND_OUTCOME_UNKNOWN' });
      expect(settlements).toEqual([expect.objectContaining({ code: 'COMMAND_OUTCOME_UNKNOWN' })]);
      expect(existsSync(fixture.marker)).toBe(false);
      await fixture.finish();
    } finally {
      await writeFile(fixture.release, 'go');
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it.each(['docker', 'macos'] as const)(
    'keeps %s callback abort/timeout uncertain without guest termination proof',
    async (kind) => {
      const directory = await mkdtemp(join(tmpdir(), 'remote-uncertainty-'));
      for (const error of [
        Object.assign(new Error('aborted'), { name: 'AbortError' }),
        Object.assign(new Error('timeout'), { killed: true, signal: 'SIGTERM' }),
      ]) {
        const execute = vi.fn((_binary, _args, _options, callback) => {
          callback(error, '', '');
          return { on() {} } as ChildProcess;
        });
        const runner =
          kind === 'docker'
            ? createDockerSandboxCommandRunner({ execFile: execute as unknown as typeof execFile })
            : createMacosVmCommandRunner({
                helperPath: '/fixture/helper',
                runtimeDir: directory,
                execFile: execute as unknown as typeof execFile,
              });
        expect(await runner.run(request(directory))).toMatchObject({
          status: 'outcome_unknown',
          code: 'COMMAND_OUTCOME_UNKNOWN',
        });
      }
      await rm(directory, { recursive: true, force: true });
    },
  );

  it('does not turn a missing quality executable into a passing gate', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'missing-command-'));
    try {
      const output = await executeQualityGateTool(
        'sys_run_quality_gate',
        { profile: 'test', repoPath: directory },
        { workspaceRoot: directory, pnpmBin: join(directory, 'missing') },
      );
      expect(output).toMatchObject({
        type: 'tool_result',
        data: { ok: false, error: { code: 'QUALITY_GATE_FAILED' }, result: { exitCode: 1 } },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('halts even an optional sensor on uncertain command completion rather than dispatching repair work', async () => {
    const node = createSensorCheckNode({
      runnerOptions: {
        qualityGateExecutor: async () => ({
          type: 'error',
          code: 'COMMAND_OUTCOME_UNKNOWN',
          message: 'Command outcome unknown.',
        }),
      },
    });
    const result = await node({
      sensorRequestedTrigger: 'on_meaningful_change',
      sensorChangedFiles: ['src/a.ts'],
      sensorAgentProfile: 'coding',
      messages: [],
      trace: [],
      limits: { timeoutMs: 1000 },
    } as unknown as HarnessStateType);
    expect(result.halted).toBe(true);
    expect(result.llmOutput).toBeNull();
    expect(result.sensorResults).toEqual([
      expect.objectContaining({ status: 'error', metadata: { code: 'COMMAND_OUTCOME_UNKNOWN' } }),
    ]);
  });
});
