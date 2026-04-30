import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  executeQualityGateTool,
  QUALITY_GATE_IDS,
  QUALITY_GATE_MAP,
  QUALITY_GATE_TOOLS,
} from '../src/tools/qualityGateTool.js';

function pnpmBin(): string {
  const found = ['/opt/homebrew/bin/pnpm', '/usr/local/bin/pnpm', '/usr/bin/pnpm'].find((path) =>
    existsSync(path),
  );
  if (!found) throw new Error('No fixed pnpm binary found for tests');
  return found;
}

function toolResult(output: Awaited<ReturnType<typeof executeQualityGateTool>>) {
  expect(output).not.toBeNull();
  expect(output!.type).toBe('tool_result');
  if (output!.type !== 'tool_result') throw new Error('Expected tool_result');
  return output.data;
}

describe('quality gate tool', () => {
  let workspaceRoot: string;
  let repoPath: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'quality-gate-workspace-'));
    repoPath = join(workspaceRoot, 'repo');
    await mkdir(repoPath);
    await writeFile(
      join(repoPath, 'package.json'),
      JSON.stringify(
        {
          type: 'module',
          scripts: {
            test: 'node -e "console.log(\'tests passed\')"',
            typecheck:
              'node -e "console.error(\'FAIL test/sample.test.ts:7 expected true\'); process.exit(1)"',
            lint: 'node -e "setTimeout(() => console.log(\'late\'), 1000)"',
            build: 'node -e "console.log(\'x\'.repeat(5000))"',
            'docs:lint': 'node -e "console.log(\'docs ok\')"',
          },
        },
        null,
        2,
      ),
      'utf-8',
    );
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('registers one medium-risk tool', () => {
    expect(QUALITY_GATE_TOOLS).toHaveLength(1);
    expect(QUALITY_GATE_TOOLS[0]).toMatchObject({
      id: QUALITY_GATE_IDS.runQualityGate,
      name: 'run_quality_gate',
      riskTier: 'medium',
    });
    expect(QUALITY_GATE_MAP[QUALITY_GATE_IDS.runQualityGate]).toBe('medium');
  });

  it('runs an allowed passing root profile', async () => {
    const data = toolResult(
      await executeQualityGateTool(
        QUALITY_GATE_IDS.runQualityGate,
        { profile: 'test', repoPath },
        { workspaceRoot, pnpmBin: pnpmBin() },
      ),
    );

    expect(data.ok).toBe(true);
    expect(data.result).toMatchObject({
      profile: 'test',
      exitCode: 0,
      timedOut: false,
    });
    expect(String((data.result as { stdoutTail: string }).stdoutTail)).toContain('tests passed');
    expect(data.evidence).toMatchObject({ kind: 'test', status: 'succeeded' });
  });

  it('returns structured failure details for non-zero exits', async () => {
    const data = toolResult(
      await executeQualityGateTool(
        QUALITY_GATE_IDS.runQualityGate,
        { profile: 'typecheck', repoPath },
        { workspaceRoot, pnpmBin: pnpmBin() },
      ),
    );
    const result = data.result as { exitCode: number; failures: Array<{ file?: string }> };

    expect(data.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ file: 'test/sample.test.ts' })]),
    );
    expect(data.error).toMatchObject({ code: 'QUALITY_GATE_FAILED' });
  });

  it('times out long-running allowed profiles', async () => {
    const data = toolResult(
      await executeQualityGateTool(
        QUALITY_GATE_IDS.runQualityGate,
        { profile: 'lint', repoPath, timeoutMs: 50 },
        { workspaceRoot, pnpmBin: pnpmBin() },
      ),
    );

    expect(data.ok).toBe(false);
    expect(data.result).toMatchObject({ timedOut: true, exitCode: null });
    expect(data.error).toMatchObject({ code: 'QUALITY_GATE_TIMEOUT' });
  });

  it('truncates large output tails', async () => {
    const data = toolResult(
      await executeQualityGateTool(
        QUALITY_GATE_IDS.runQualityGate,
        { profile: 'build', repoPath, maxOutputBytes: 100 },
        { workspaceRoot, pnpmBin: pnpmBin() },
      ),
    );
    const result = data.result as { stdoutTail: string; truncated: boolean };

    expect(data.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.stdoutTail.length).toBeLessThan(200);
  });

  it('denies arbitrary command-shaped input', async () => {
    const data = toolResult(
      await executeQualityGateTool(
        QUALITY_GATE_IDS.runQualityGate,
        { profile: 'test', repoPath, command: 'pnpm install' },
        { workspaceRoot, pnpmBin: pnpmBin() },
      ),
    );

    expect(data.ok).toBe(false);
    expect(data.evidence).toMatchObject({ status: 'denied' });
    expect(data.error).toMatchObject({ code: 'QUALITY_GATE_DENIED' });
  });

  it('denies packageName on unsupported profiles', async () => {
    const data = toolResult(
      await executeQualityGateTool(
        QUALITY_GATE_IDS.runQualityGate,
        { profile: 'docs', repoPath, packageName: '@agent-platform/harness' },
        { workspaceRoot, pnpmBin: pnpmBin() },
      ),
    );

    expect(data.ok).toBe(false);
    expect(String(data.message)).toContain('does not support packageName');
  });

  it('denies repositories outside the workspace', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'quality-gate-outside-'));
    try {
      const data = toolResult(
        await executeQualityGateTool(
          QUALITY_GATE_IDS.runQualityGate,
          { profile: 'test', repoPath: outside },
          { workspaceRoot, pnpmBin: pnpmBin() },
        ),
      );
      expect(data.ok).toBe(false);
      expect(String(data.message)).toContain('outside the approved workspace');
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('returns null for unknown tool IDs', async () => {
    await expect(
      executeQualityGateTool(
        'sys_unknown',
        { profile: 'test' },
        { workspaceRoot, pnpmBin: pnpmBin() },
      ),
    ).resolves.toBeNull();
  });
});
