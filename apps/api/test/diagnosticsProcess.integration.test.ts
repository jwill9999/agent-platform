import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { DiagnosticReportSchema } from '@agent-platform/contracts';
import { DEFAULT_AGENT_ID } from '@agent-platform/db';
import { expect, it } from 'vitest';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const capability = 'b'.repeat(64);
async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('expected TCP socket');
  const port = address.port;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

it.each(['completed', 'approval-waiting'] as const)(
  'preserves %s history across an actual API process restart without replay',
  async (state) => {
    const dir = mkdtempSync(join(tmpdir(), 'diagnostics-process-'));
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    let child: ChildProcess | undefined;
    async function start() {
      child = spawn(process.execPath, ['dist/index.js'], {
        cwd: apiRoot,
        stdio: 'ignore',
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: String(port),
          SQLITE_PATH: join(dir, 'app.sqlite'),
          DIAGNOSTICS_HOST: `127.0.0.1:${port}`,
          DIAGNOSTICS_LOCAL_CAPABILITY: capability,
          AGENT_OPENAI_API_KEY: 'sk-local-fixture',
          AGENT_PLATFORM_COMMAND_RUNNER: 'host',
          AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: 'Known local fixture response',
          AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: JSON.stringify({
            ...(state === 'completed'
              ? {
                  name: 'sys_file_info',
                  args: { path: '/workspace/no-such-diagnostics-support-fixture' },
                }
              : {
                  name: 'sys_bash',
                  args: {
                    command: `"${process.execPath}" -e "require('node:fs').appendFileSync('${join(dir, 'must-not-replay')}', '1')"`,
                  },
                }),
          }),
          SCHEDULER_ENABLED: 'false',
          LANGCHAIN_TRACING_V2: 'false',
          LANGSMITH_TRACING: 'false',
          LANGSMITH_TRACING_V2: 'false',
        },
      });
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error('API fixture exited before readiness');
        try {
          if ((await fetch(`${origin}/health`)).ok) return;
        } catch {
          /* starting */
        }
        await delay(50);
      }
      throw new Error('API fixture did not become ready');
    }
    async function post(path: string, body: unknown, privateRead = false) {
      const response = await fetch(`${origin}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(privateRead ? { 'x-diagnostics-capability': capability } : {}),
        },
        body: JSON.stringify(body),
      });
      expect(response.status).toBeLessThan(300);
      return response;
    }
    try {
      await start();
      const session = (await (
        await post('/v1/sessions', { agentId: DEFAULT_AGENT_ID })
      ).json()) as {
        data: { id: string };
      };
      const chat = await post('/v1/chat', {
        sessionId: session.data.id,
        message: 'PRIVATE fixture prompt is not part of support history',
      });
      await chat.text();
      const before = DiagnosticReportSchema.parse(
        await (
          await post('/v1/diagnostics/report', { scope: { sessionId: session.data.id } }, true)
        ).json(),
      );
      expect(before.events.some((row) => row.event.phase === 'model')).toBe(true);
      if (state === 'completed') {
        expect(
          before.events.some((row) => row.event.phase === 'tool' && row.event.outcome === 'failed'),
        ).toBe(true);
      } else {
        expect(
          before.events.some(
            (row) => row.event.phase === 'approval' && row.event.outcome === 'waiting',
          ),
        ).toBe(true);
        expect(
          before.events.some(
            (row) => row.event.phase === 'request' && row.event.outcome === 'succeeded',
          ),
        ).toBe(false);
        expect(existsSync(join(dir, 'must-not-replay'))).toBe(false);
      }
      expect(before.coverage.pending).toBe(0);
      await stop(child!);
      await start();
      const after = DiagnosticReportSchema.parse(
        await (
          await post('/v1/diagnostics/report', { scope: { sessionId: session.data.id } }, true)
        ).json(),
      );
      expect(after.events).toEqual(before.events);
      expect(after.coverage.previousShutdownUnclean).toBe(false);
      if (state === 'approval-waiting') {
        expect(after.coverage.unfinishedPriorProcess).toBe(true);
        expect(after.summary).toContain('unknown status after restart; no replay is implied');
        expect(existsSync(join(dir, 'must-not-replay'))).toBe(false);
        await delay(100);
        const unchanged = DiagnosticReportSchema.parse(
          await (
            await post('/v1/diagnostics/report', { scope: { sessionId: session.data.id } }, true)
          ).json(),
        );
        expect(unchanged.events).toEqual(before.events);
        expect(existsSync(join(dir, 'must-not-replay'))).toBe(false);
      }
      expect(JSON.stringify(after)).not.toContain('PRIVATE fixture prompt');
      expect(JSON.stringify(after)).not.toContain(capability);
      const evidencePath = process.env.DIAGNOSTICS_TEST_REPORT_OUTPUT;
      if (evidencePath && state === 'completed') {
        mkdirSync(dirname(evidencePath), { recursive: true });
        writeFileSync(evidencePath, JSON.stringify(after, null, 2) + '\n', { mode: 0o600 });
        writeFileSync(
          evidencePath + '.ground-truth.json',
          JSON.stringify(
            {
              provider: 'deterministic model node',
              tool: 'real sys_file_info on deliberately missing workspace resource',
              expectedPhase: 'tool',
              expectedOutcome: 'failed',
              expectedErrorCode: 'tool_error',
              processRestart: true,
              paidModelCalls: false,
            },
            null,
            2,
          ) + '\n',
          { mode: 0o600 },
        );
      }
    } finally {
      if (child) await stop(child);
      rmSync(dir, { recursive: true, force: true });
    }
  },
  20000,
);
