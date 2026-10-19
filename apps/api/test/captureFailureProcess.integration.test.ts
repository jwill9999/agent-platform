import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  CaptureFailureSchema,
  MonitoringStatusSchema,
  type MonitoringStatus,
} from '@agent-platform/contracts';
import { expect, it } from 'vitest';

import {
  ownCaptureChild,
  stopCaptureChild,
  type OwnedCaptureChild,
} from './support/captureFailureChild.js';

const capability = 'c'.repeat(64);
async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected owned listener');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
it('keeps real private API status available during both store failures and retains completed metadata after a clean process restart', async ({
  signal,
  onTestFinished,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'capture-api-process-'));
  const children: OwnedCaptureChild[] = [];
  onTestFinished(async () => {
    const results = await Promise.allSettled(
      children.map((child) => stopCaptureChild(child, 3000)),
    );
    const errors = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    );
    if (errors.length)
      throw new AggregateError(errors, 'Owned API close unconfirmed; fixture retained');
    await rm(root, { recursive: true, force: true });
  });
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  let child: OwnedCaptureChild | undefined;
  const post = (path: string, body: unknown = {}, token = capability, lifetime = signal) =>
    fetch(`${origin}/v1/diagnostics/monitoring/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-diagnostics-capability': token },
      body: JSON.stringify(body),
      signal: AbortSignal.any([lifetime, AbortSignal.timeout(1000)]),
    });
  async function start(check: (status: MonitoringStatus) => boolean) {
    child = ownCaptureChild(
      spawn(process.execPath, ['dist/index.js'], {
        cwd: apiRoot,
        stdio: 'ignore',
        env: {
          PATH: process.env.PATH,
          HOST: '127.0.0.1',
          PORT: String(port),
          SQLITE_PATH: join(root, 'app.sqlite'),
          DIAGNOSTICS_HOST: `127.0.0.1:${port}`,
          DIAGNOSTICS_LOCAL_CAPABILITY: capability,
          SCHEDULER_ENABLED: 'false',
          LANGCHAIN_TRACING_V2: 'false',
          LANGSMITH_TRACING: 'false',
          LANGSMITH_TRACING_V2: 'false',
        },
      }),
    );
    children.push(child);
    const startup = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
    for (let attempt = 0; attempt < 400; attempt++) {
      startup.throwIfAborted();
      if (child.completion() || child.child.exitCode !== null || child.child.signalCode !== null)
        throw new Error('Owned API exited before readiness');
      try {
        const response = await post('status', {}, capability, startup);
        if (response.status === 200) {
          const status = MonitoringStatusSchema.parse(await response.json());
          if (check(status)) return status;
        }
      } catch {
        startup.throwIfAborted();
        /* Passive readiness only; no operation is retried. */
      }
      await delay(20, undefined, { signal: startup });
    }
    throw new Error('Owned API did not reach the expected capture status');
  }
  await Promise.all(
    ['diagnostics.sqlite', 'monitoring.sqlite'].map((name) => mkdir(join(root, name))),
  );
  const failed = await start(
    (status) =>
      status.diagnostics.state === 'disabled' &&
      status.monitoring.state === 'disabled' &&
      status.failureArtifacts?.diagnostics.publication === 'stored' &&
      status.failureArtifacts.monitoring.publication === 'stored',
  );
  expect(failed.diagnostics.firstFailure).toMatchObject({
    store: 'diagnostics',
    operation: 'startup',
    cause: 'worker_reply',
  });
  expect(failed.monitoring.firstFailure).toMatchObject({
    store: 'monitoring',
    operation: 'startup',
    cause: 'worker_reply',
  });
  const firstId = failed.diagnostics.processInstanceId;
  expect(failed.monitoring.processInstanceId).toBe(firstId);
  expect((await post('status', {}, 'wrong-token')).status).toBe(403);
  const window = await post('window', {
    window: { fromMs: Date.now() - 1000, toMs: Date.now() + 1 },
  });
  expect(window.status).toBe(503);
  expect((await window.json()).error.code).toBe('MONITORING_UNAVAILABLE');
  const directory = join(root, '.capture-failures');
  expect((await readdir(directory)).sort()).toEqual(['diagnostics.json', 'monitoring.json']);
  for (const kind of ['diagnostics', 'monitoring'] as const) {
    const bytes = await readFile(join(directory, `${kind}.json`), 'utf8');
    expect(Buffer.byteLength(bytes)).toBeLessThanOrEqual(2048);
    expect(CaptureFailureSchema.parse(JSON.parse(bytes))).toEqual(failed[kind].firstFailure);
  }
  expect(JSON.stringify(failed)).not.toContain(root);
  expect(JSON.stringify(failed)).not.toContain(capability);
  expect(await stopCaptureChild(child, 3000)).toEqual({ code: 0, signal: null });
  await Promise.all(
    ['diagnostics.sqlite', 'monitoring.sqlite'].map((name) =>
      rm(join(root, name), { recursive: true }),
    ),
  );
  const restarted = await start(
    (status) =>
      status.diagnostics.state === 'ready' &&
      status.monitoring.state === 'ready' &&
      status.failureArtifacts?.diagnostics.previousFailureState === 'available' &&
      status.failureArtifacts.monitoring.previousFailureState === 'available',
  );
  expect(restarted.diagnostics.processInstanceId).not.toBe(firstId);
  expect(restarted.diagnostics.firstFailure).toBeUndefined();
  expect(restarted.monitoring.firstFailure).toBeUndefined();
  for (const kind of ['diagnostics', 'monitoring'] as const)
    expect(restarted.failureArtifacts![kind]).toEqual({
      previousFailureState: 'available',
      previousFailure: failed[kind].firstFailure,
      publication: 'idle',
    });
  await rm(directory, { recursive: true });
  const cached = await post('status');
  expect(cached.status).toBe(200);
  const cachedStatus = MonitoringStatusSchema.parse(await cached.json());
  expect(cachedStatus.failureArtifacts).toEqual(restarted.failureArtifacts);
}, 30000);
