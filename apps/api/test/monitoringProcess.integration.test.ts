import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { request as httpRequest } from 'node:http';
import { MonitoringReportSchema, MonitoringStatusSchema } from '@agent-platform/contracts';
import { DEFAULT_AGENT_ID } from '@agent-platform/db';
import { expect, it } from 'vitest';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const capability = 'e'.repeat(64);
const providerModule = '../../../e2e/support/project-chat-stop/provider.mjs';
const { startStopProvider } = await import(providerModule);
async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected local test listener');
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}
async function stop(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill(signal);
  const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

it('retains recording and safe historical samples/events after an actual unclean API restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'monitoring-process-'));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const provider = await startStopProvider({ model: 'monitoring-delayed-fixture' });
  provider.enqueue({ kind: 'text', text: 'Private fixture reply not diagnostic data', hold: true });
  const chatAbort = new AbortController();
  let chatBody: Promise<string> | undefined;
  let child: ChildProcess | undefined;
  async function post(path: string, body: unknown, privateRead = true) {
    return fetch(`${origin}/v1/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(privateRead ? { 'x-diagnostics-capability': capability } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
  }
  async function status() {
    const response = await post('diagnostics/monitoring/status', {});
    expect(response.status).toBe(200);
    return MonitoringStatusSchema.parse(await response.json());
  }
  async function start() {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      SQLITE_PATH: join(dir, 'app.sqlite'),
      DIAGNOSTICS_HOST: `127.0.0.1:${port}`,
      DIAGNOSTICS_LOCAL_CAPABILITY: capability,
      DEFAULT_MODEL_PROVIDER: 'ollama',
      DEFAULT_MODEL: 'monitoring-delayed-fixture',
      OLLAMA_BASE_URL: provider.baseURL,
      AGENT_PLATFORM_COMMAND_RUNNER: 'host',
      SCHEDULER_ENABLED: 'false',
      LANGCHAIN_TRACING_V2: 'false',
      LANGSMITH_TRACING: 'false',
      LANGSMITH_TRACING_V2: 'false',
    };
    // Use the compiled API's actual SDK/control path, including in inherited test environments.
    delete env.AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT;
    delete env.AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON;
    child = spawn(process.execPath, ['dist/index.js'], {
      cwd: apiRoot,
      stdio: 'ignore',
      env,
    });
    let observed = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Test API exited before readiness');
      try {
        const ready = await status();
        if (ready.monitoring.state === 'ready' && ready.diagnostics.state === 'ready') {
          observed = true;
          break;
        }
      } catch {
        /* Retry only passive startup observations. */
      }
      await delay(20);
    }
    expect(observed).toBe(true);
  }
  try {
    await start();
    const enabled = await post('diagnostics/monitoring/preference', {
      samplingEnabled: true,
      retentionDays: 9,
    });
    expect(enabled.status).toBe(200);
    const sessionResponse = await post('sessions', { agentId: DEFAULT_AGENT_ID }, false);
    expect(sessionResponse.status).toBe(201);
    const session = (await sessionResponse.json()) as { data: { id: string } };
    const beganAtMs = Date.now() - 1000;
    chatBody = fetch(`${origin}/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: session.data.id, message: 'PRIVATE-PROMPT-CANARY' }),
      signal: chatAbort.signal,
    }).then(async (response) => {
      expect(response.status).toBe(200);
      return response.text();
    });
    // Retain rejection while the explicit model barrier is held; rethrow by awaiting below.
    void chatBody.catch(() => undefined);
    for (let attempt = 0; attempt < 200 && provider.requests.length === 0; attempt++)
      await delay(10);
    expect(provider.requests).toHaveLength(1);
    const providerReceivedAtMs = Date.now();
    // The real default 30-second sampler now observes an admitted model wait, not idle time.
    await delay(31_000);
    const heldResponse = await post('diagnostics/monitoring/window', {
      window: { fromMs: beganAtMs, toMs: Date.now() + 1 },
    });
    expect(heldResponse.status).toBe(200);
    const held = MonitoringReportSchema.parse(await heldResponse.json());
    expect(
      held.monitoring.samples.some(
        ({ sample }) =>
          sample.intervalMs >= 29_000 &&
          sample.observedAtMs >= providerReceivedAtMs &&
          sample.activeRuns === 1 &&
          (sample.admittedUnresolvedAttempts ?? 0) >= 1 &&
          (sample.sessionLockKeys ?? 0) >= 1,
      ),
    ).toBe(true);
    const providerReleasedAtMs = Date.now();
    provider.release(0);
    expect(await chatBody).toContain('Private fixture reply not diagnostic data');
    expect(provider.requests).toHaveLength(1);
    expect(provider.errors).toEqual([]);
    const window = { fromMs: beganAtMs, toMs: Date.now() + 1000 };
    const beforeResponse = await post('diagnostics/monitoring/window', { window });
    expect(beforeResponse.status).toBe(200);
    const before = MonitoringReportSchema.parse(await beforeResponse.json());
    const originalProcessId = before.monitoring.health.processInstanceId;
    expect(before.diagnostics.health.processInstanceId).toBe(originalProcessId);
    expect(
      before.monitoring.samples.every(
        ({ sample }) => sample.processInstanceId === originalProcessId,
      ),
    ).toBe(true);
    expect(
      before.diagnostics.events.every(({ event }) => event.processInstanceId === originalProcessId),
    ).toBe(true);
    expect(before.monitoring.samples.length).toBeGreaterThanOrEqual(2);
    expect(
      before.monitoring.samples.some(
        ({ sample }) => sample.intervalMs >= 29_000 && sample.cpuUserMicros !== null,
      ),
    ).toBe(true);
    for (const phase of ['model', 'request'])
      expect(
        before.diagnostics.events.some(
          ({ event }) =>
            event.phase === phase &&
            event.outcome === 'succeeded' &&
            (event.durationMs ?? 0) >= 30_000,
        ),
      ).toBe(true);
    await stop(child!, 'SIGKILL');
    await start();
    const restarted = await status();
    expect(restarted.monitoring.preference).toMatchObject({
      samplingEnabled: true,
      retentionDays: 9,
    });
    expect(restarted.monitoring.previousShutdownUnclean).toBe(true);
    expect(restarted.monitoring.processInstanceId).toBe(restarted.diagnostics.processInstanceId);
    expect(restarted.monitoring.processInstanceId).not.toBe(originalProcessId);
    const response = await post('diagnostics/monitoring/window', { window });
    expect(response.status).toBe(200);
    const after = MonitoringReportSchema.parse(await response.json());
    for (const row of before.monitoring.samples)
      expect(after.monitoring.samples).toContainEqual(row);
    expect(after.diagnostics.events).toEqual(before.diagnostics.events);
    expect(after.coverage.incomplete).toBe(true);
    expect(provider.requests).toHaveLength(1);
    expect(provider.errors).toEqual([]);
    expect(JSON.stringify(after)).not.toMatch(
      /PRIVATE-PROMPT-CANARY|Private fixture reply|no-such-monitoring-fixture/,
    );
    expect(JSON.stringify(after)).not.toContain(dir);
    expect(JSON.stringify(after)).not.toContain(capability);
    const evidencePath = process.env.MONITORING_TEST_REPORT_OUTPUT;
    if (evidencePath) {
      mkdirSync(dirname(evidencePath), { recursive: true });
      writeFileSync(evidencePath, JSON.stringify(after, null, 2) + '\n', { mode: 0o600 });
      writeFileSync(
        evidencePath + '.ground-truth.json',
        JSON.stringify(
          {
            provider:
              'controlled loopback external model double through actual SDK and compiled API',
            expectedPhase: 'model',
            expectedOutcome: 'succeeded',
            deliberatelyHeldMs: providerReleasedAtMs - providerReceivedAtMs,
            providerReceivedAtMs,
            providerReleasedAtMs,
            expectedDuringHold: {
              activeRuns: 1,
              admittedUnresolvedAttemptsAtLeast: 1,
              sessionLockKeysAtLeast: 1,
            },
            uncleanProcessRestart: true,
            actualPeriodicIntervalMs: 30_000,
            paidModelCalls: false,
          },
          null,
          2,
        ) + '\n',
        { mode: 0o600 },
      );
    }
  } finally {
    chatAbort.abort();
    provider.release(0);
    try {
      await chatBody?.catch(() => undefined);
      if (child) await stop(child);
    } finally {
      await provider.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }
}, 60_000);

it('closes the companion worker on signal within its budget even while an HTTP request prevents server drain', async () => {
  // Resolve the native dependency through its owning workspace without CJS package exports.
  const requireDb = createRequire(resolve(apiRoot, '../../packages/db/package.json'));
  const Sqlite = requireDb('better-sqlite3') as new (
    path: string,
    options: { readonly: boolean },
  ) => {
    prepare(sql: string): { get(): unknown };
    close(): void;
  };
  const dir = mkdtempSync(join(tmpdir(), 'monitoring-shutdown-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: apiRoot,
    stdio: 'ignore',
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      SQLITE_PATH: join(dir, 'app.sqlite'),
      DIAGNOSTICS_HOST: `127.0.0.1:${port}`,
      DIAGNOSTICS_LOCAL_CAPABILITY: capability,
      SCHEDULER_ENABLED: 'false',
      LANGCHAIN_TRACING_V2: 'false',
      LANGSMITH_TRACING: 'false',
      LANGSMITH_TRACING_V2: 'false',
    },
  });
  let reader: InstanceType<typeof Sqlite> | undefined;
  let held: ReturnType<typeof httpRequest> | undefined;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/v1/diagnostics/monitoring/status`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-diagnostics-capability': capability },
          body: '{}',
          signal: AbortSignal.timeout(1000),
        });
        if (
          response.ok &&
          MonitoringStatusSchema.parse(await response.json()).monitoring.state === 'ready'
        ) {
          ready = true;
          break;
        }
      } catch {
        /* Passive startup only. */
      }
      await delay(20);
    }
    expect(ready).toBe(true);
    reader = new Sqlite(join(dir, 'monitoring.sqlite'), { readonly: true });
    expect(reader.prepare("SELECT value FROM monitoring_meta WHERE key='open'").get()).toEqual({
      value: '1',
    });
    held = httpRequest(`http://127.0.0.1:${port}/v1/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '1000',
        Expect: '100-continue',
      },
    });
    held.on('error', () => undefined);
    const accepted = once(held, 'continue');
    held.flushHeaders();
    await accepted;
    held.write('{');
    const signalledAt = performance.now();
    child.kill('SIGTERM');
    let closed = false;
    for (let attempt = 0; performance.now() - signalledAt < 2000 && attempt < 100; attempt++) {
      closed =
        (
          reader.prepare("SELECT value FROM monitoring_meta WHERE key='open'").get() as {
            value: string;
          }
        ).value === '0';
      if (closed) break;
      await delay(20);
    }
    expect(closed).toBe(true);
    expect(performance.now() - signalledAt).toBeLessThan(2000);
    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
    held.destroy();
    await stop(child);
  } finally {
    held?.destroy();
    await stop(child);
    reader?.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 15_000);
