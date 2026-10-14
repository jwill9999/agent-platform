import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it } from 'vitest';

import {
  attemptStartupEvidenceAttachment,
  createStartupEvidence,
} from '../e2e/support/startupEvidence.js';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }),
  );
});

async function endpoint(status: number, body: string, end = true) {
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.write(body);
    if (end) response.end();
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, port: (server.address() as AddressInfo).port };
}

it('captures refused connections without retaining transport error text', async () => {
  const { server, port } = await endpoint(200, '{}');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const evidence = createStartupEvidence(port, 4321);
  expect(await evidence.probe()).toBe(false);
  expect(evidence.snapshot()).toMatchObject({
    backendPort: port,
    rendererPort: 4321,
    attempts: 1,
    transportCode: 'ECONNREFUSED',
    electronProcess: { observed: false, exitCode: null, signal: null },
  });
});

it('projects only allowlisted readiness statuses from actual HTTP503 responses', async () => {
  const canary = 'private-path-secret-environment-canary';
  const { port } = await endpoint(
    503,
    JSON.stringify({
      status: 'unhealthy',
      error: canary,
      checks: {
        database: { status: 'unhealthy', error: canary },
        disk: { status: 'healthy', details: { path: canary } },
        commandRunner: { status: 'degraded', message: canary },
        [canary]: { status: 'healthy' },
      },
      token: canary,
    }),
  );
  const evidence = createStartupEvidence(port, 4321);
  expect(await evidence.probe()).toBe(false);
  expect(evidence.snapshot()).toMatchObject({
    attempts: 1,
    httpStatus: 503,
    health: { overall: 'unhealthy', database: 'unhealthy', disk: 'healthy', runner: 'degraded' },
  });
  expect(JSON.stringify(evidence.snapshot())).not.toContain(canary);
});

it('records actual child exit before cleanup without interpreting it as readiness', async () => {
  const { port } = await endpoint(503, '{}');
  const child = spawn(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'ignore' });
  const evidence = createStartupEvidence(port, 4321);
  evidence.observeProcess(child);
  await once(child, 'exit');
  expect(await evidence.probe()).toBe(false);
  expect(evidence.snapshot().electronProcess).toEqual({
    observed: true,
    exitCode: 7,
    signal: null,
  });
});

it('bounds and discards oversized or invalid health bodies without exporting their contents', async () => {
  const { port } = await endpoint(
    200,
    JSON.stringify({ status: 'secret-status', error: 'x'.repeat(20_000) }),
  );
  const evidence = createStartupEvidence(port, 4321);
  expect(await evidence.probe()).toBe(true);
  expect(evidence.snapshot().health).toEqual({
    overall: undefined,
    database: undefined,
    disk: undefined,
    runner: undefined,
  });
  expect(JSON.stringify(evidence.snapshot())).not.toContain('secret-status');
  expect(JSON.stringify(evidence.snapshot()).length).toBeLessThan(500);
});

it('bounds a response that never completes and replaces the last observation on the next probe', async () => {
  const { port } = await endpoint(503, '{', false);
  const evidence = createStartupEvidence(port, 4321);
  expect(await evidence.probe(50)).toBe(false);
  expect(evidence.snapshot()).toMatchObject({ attempts: 1, httpStatus: 503 });
  expect(await evidence.probe(50)).toBe(false);
  expect(evidence.snapshot().attempts).toBe(2);
});

it('records only fixed observed stderr codes from an actual failed child', async () => {
  const child = spawn(
    process.execPath,
    [
      '-e',
      `console.error("private-canary /private/path code: 'ENOSPC' token: secret"); process.exit(1);`,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const evidence = createStartupEvidence(4310, 4321);
  evidence.observeProcess(child);
  await once(child, 'close');
  expect(evidence.snapshot()).toMatchObject({
    stderr: { codes: ['ENOSPC'], truncated: false },
    electronProcess: { exitCode: 1 },
  });
  const json = JSON.stringify(evidence.snapshot());
  expect(json).not.toContain('private-canary');
  expect(json).not.toContain('/private/path');
  expect(json).not.toContain('secret');
});

it('bounds stderr inspection and omits unknown codes and all raw text', async () => {
  const child = spawn(
    process.execPath,
    ['-e', `process.stderr.write("code: 'SECRET' " + 'x'.repeat(70000) + "code: 'EACCES'");`],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const evidence = createStartupEvidence(4310, 4321);
  evidence.observeProcess(child);
  await once(child, 'close');
  expect(evidence.snapshot().stderr).toEqual({ codes: [], inspectedBytes: 65536, truncated: true });
  expect(JSON.stringify(evidence.snapshot())).not.toContain('SECRET');
});

it('retains HTTP200 acceptance even when the diagnostic response body times out', async () => {
  const { port } = await endpoint(200, '{', false);
  const evidence = createStartupEvidence(port, 4321);
  expect(await evidence.probe(50)).toBe(true);
  expect(evidence.snapshot()).toMatchObject({ httpStatus: 200, attempts: 1 });
});

it('defers attachment failure until real caller resources are released without reporting success', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'startup-evidence-control-'));
  const { server } = await endpoint(200, '{}');
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  await once(child, 'spawn');
  let heartbeatCount = 0;
  const heartbeat = setInterval(() => {
    heartbeatCount++;
  }, 5);
  let attached: boolean | undefined;
  try {
    attached = await attemptStartupEvidenceAttachment(async () => {
      throw new Error('attachment unavailable');
    });
  } finally {
    child.kill('SIGTERM');
    await once(child, 'exit');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    clearInterval(heartbeat);
    rmSync(directory, { recursive: true, force: true });
  }
  const countAfterCleanup = heartbeatCount;
  await new Promise((resolve) => setTimeout(resolve, 15));
  expect(child.signalCode).toBe('SIGTERM');
  expect(server.listening).toBe(false);
  expect(existsSync(directory)).toBe(false);
  expect(heartbeatCount).toBe(countAfterCleanup);
  expect(attached).toBe(false);
  expect(await attemptStartupEvidenceAttachment(async () => {})).toBe(true);
});

function phaseFixture() {
  const stderr = new PassThrough();
  const evidence = createStartupEvidence(4310, 4321);
  evidence.observeProcess({ exitCode: null, signalCode: null, stderr });
  const emit = (event: unknown) =>
    stderr.write(`AGENT_PLATFORM_STARTUP ${JSON.stringify(event)}\n`);
  return { stderr, evidence, emit };
}

it('joins fragmented safe phase records and requires explicit shutdown confirmation', () => {
  const { stderr, evidence, emit } = phaseFixture();
  expect(evidence.shutdownConfirmed()).toBe(false);
  stderr.write('AGENT_PLATFORM_STAR');
  stderr.write('TUP {"phase":"backend-ready","elapsedMs":12}\n');
  emit({ phase: 'cancel', elapsedMs: 13 });
  expect(evidence.shutdownConfirmed()).toBe(false);
  emit({ phase: 'stop-confirmed', elapsedMs: 15 });
  expect(evidence.shutdownConfirmed()).toBe(true);
  expect(evidence.snapshot().phases).toEqual([
    { phase: 'backend-ready', elapsedMs: 12 },
    { phase: 'cancel', elapsedMs: 13 },
    { phase: 'stop-confirmed', elapsedMs: 15 },
  ]);
  evidence.snapshot().phases[0]!.phase = 'mutated';
  expect(evidence.snapshot().phases[0]!.phase).toBe('backend-ready');
  emit({ phase: 'stop-failed', elapsedMs: 16 });
  expect(evidence.shutdownConfirmed()).toBe(false);
});

it('rejects extra fields, raw text, invalid phases and malformed timings', () => {
  const { stderr, evidence, emit } = phaseFixture();
  emit({ phase: 'stop-confirmed', elapsedMs: 1, error: 'secret-canary' });
  emit({ phase: 'secret-canary', elapsedMs: 1 });
  emit({ phase: 'stop-confirmed', elapsedMs: -1 });
  emit({ phase: 'stop-confirmed', elapsedMs: '1' });
  emit({ phase: 'stop-confirmed', elapsedMs: null });
  stderr.write('AGENT_PLATFORM_STARTUP {"phase":"stop-confirmed","elapsedMs":1e999}\n');
  stderr.write('prefix AGENT_PLATFORM_STARTUP {"phase":"stop-confirmed","elapsedMs":1}\n');
  stderr.write('AGENT_PLATFORM_STARTUP invalid secret-canary\n');
  expect(evidence.snapshot().phases).toEqual([]);
  expect(evidence.shutdownConfirmed()).toBe(false);
  expect(JSON.stringify(evidence.snapshot())).not.toContain('secret-canary');
});

it('discards oversized phase lines including a misleading fragmented suffix', () => {
  const { stderr, evidence, emit } = phaseFixture();
  stderr.write('x'.repeat(600));
  emit({ phase: 'stop-confirmed', elapsedMs: 1 });
  expect(evidence.shutdownConfirmed()).toBe(false);
  emit({ phase: 'cancel', elapsedMs: 2 });
  expect(evidence.snapshot().phases).toEqual([{ phase: 'cancel', elapsedMs: 2 }]);
});

it('fails shutdown confirmation closed when phase or stderr capture was truncated', () => {
  const first = phaseFixture();
  first.emit({ phase: 'stop-confirmed', elapsedMs: 0 });
  for (let index = 1; index <= 64; index++) first.emit({ phase: 'cancel', elapsedMs: index });
  expect(first.evidence.snapshot().phases).toHaveLength(64);
  expect(first.evidence.snapshot().phasesTruncated).toBe(true);
  expect(first.evidence.shutdownConfirmed()).toBe(false);
  const second = phaseFixture();
  second.emit({ phase: 'stop-confirmed', elapsedMs: 0 });
  second.stderr.write('x'.repeat(70_000));
  expect(second.evidence.snapshot().stderr.truncated).toBe(true);
  expect(second.evidence.shutdownConfirmed()).toBe(false);
});
