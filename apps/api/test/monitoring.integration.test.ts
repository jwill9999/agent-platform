import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { DiagnosticStore, MonitoringStore } from '@agent-platform/contracts';
import { MonitoringReportSchema } from '@agent-platform/contracts';
import {
  closeDatabase,
  createDiagnosticStore,
  createMonitoringStore,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { createMonitoringRuntime } from '../src/infrastructure/diagnostics/monitoringRuntime.js';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';

const capability = 'a'.repeat(64);
const host = '127.0.0.1:3456';
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  const results = await Promise.allSettled(
    cleanups
      .splice(0)
      .reverse()
      .map((cleanup) => cleanup()),
  );
  vi.restoreAllMocks();
  const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length) throw new AggregateError(errors, 'Monitoring cleanup failed');
});
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'monitoring-api-'));
  const { db, sqlite } = openDatabase(join(dir, 'app.sqlite'));
  runSeed(db);
  const diagnostics: DiagnosticStore = createDiagnosticStore({
    path: join(dir, 'diagnostics.sqlite'),
  });
  const monitoring: MonitoringStore = createMonitoringStore({
    path: join(dir, 'monitoring.sqlite'),
  });
  await Promise.all([diagnostics.ready, monitoring.ready]);
  const runtime = createMonitoringRuntime({
    store: monitoring,
    appDataPath: dir,
    appVersion: '1.0.0',
  });
  const app = await listenLoopback(
    createApp({
      db,
      diagnostics: {
        store: diagnostics,
        access: { host, capability },
        monitoring: { store: monitoring, runtime },
      },
    }),
  );
  await runtime.start();
  cleanups.push(async () => {
    runtime.stop();
    await closeLoopback(app);
    await Promise.all([diagnostics.close(), monitoring.close()]);
    closeDatabase(sqlite);
    rmSync(dir, { recursive: true, force: true });
  });
  const post = (path: string, body: unknown = {}) =>
    request(app)
      .post(`/v1/diagnostics/monitoring/${path}`)
      .set('Host', host)
      .set('x-diagnostics-capability', capability)
      .send(body);
  return { app, dir, diagnostics, monitoring, runtime, post };
}

describe('private durable monitoring API', () => {
  it('keeps status/history private and readable while sampling is off, without changing V1 recording', async () => {
    const f = await fixture();
    await request(f.app)
      .post('/v1/diagnostics/monitoring/status')
      .set('Host', host)
      .send({})
      .expect(403);
    await request(f.app)
      .post('/v1/diagnostics/monitoring/status')
      .set('Host', 'other:3456')
      .set('x-diagnostics-capability', capability)
      .send({})
      .expect(403);
    await request(f.app)
      .post('/v1/diagnostics/monitoring/status')
      .set('Host', host)
      .set('x-forwarded-for', '127.0.0.1')
      .set('x-diagnostics-capability', 'b'.repeat(64))
      .send({})
      .expect(403);
    const status = await f.post('status').expect(200);
    expect(status.body.monitoring.preference.samplingEnabled).toBe(false);
    const requestId = randomUUID();
    expect(
      f.diagnostics.record({
        schemaVersion: 1,
        eventId: randomUUID(),
        processInstanceId: randomUUID(),
        requestId,
        phase: 'request',
        outcome: 'failed',
        errorCode: 'timeout',
        observedAtMs: Date.now(),
      }),
    ).toBe(true);
    const report = MonitoringReportSchema.parse(
      (
        await f
          .post('window', {
            window: { fromMs: Date.now() - 60_000, toMs: Date.now() + 60_000 },
          })
          .expect(200)
      ).body,
    );
    expect(report.diagnostics.events.some((row) => row.event.requestId === requestId)).toBe(true);
    expect(report.monitoring.samples).toEqual([]);
    expect(report.coverage.separateSnapshots).toBe(true);
  });

  it('acknowledges retained enable/retention, captures safe numeric samples, and pages stores without replay', async () => {
    const f = await fixture();
    const enabled = await f
      .post('preference', { samplingEnabled: true, retentionDays: 9 })
      .expect(200);
    expect(enabled.body.preference).toMatchObject({ samplingEnabled: true, retentionDays: 9 });
    for (
      let attempt = 0;
      attempt < 100 &&
      f.monitoring.health().pending === 0 &&
      f.monitoring.health().acknowledgedSequence === 0;
      attempt++
    )
      await delay(5);
    await f.monitoring.flush();
    expect(f.monitoring.health().acknowledgedSequence).toBeGreaterThan(0);
    const now = Date.now();
    for (let i = 0; i < 3; i++)
      f.diagnostics.record({
        schemaVersion: 1,
        eventId: randomUUID(),
        processInstanceId: randomUUID(),
        requestId: randomUUID(),
        phase: 'request',
        outcome: 'succeeded',
        observedAtMs: now,
      });
    const window = { fromMs: now - 60_000, toMs: now + 60_000 };
    const first = MonitoringReportSchema.parse(
      (await f.post('window', { window, limit: 1 }).expect(200)).body,
    );
    expect(first.monitoring.samples).toHaveLength(1);
    expect(first.monitoring.completedCursor).toBeDefined();
    expect(first.diagnostics.nextCursor).toBeDefined();
    const second = MonitoringReportSchema.parse(
      (
        await f
          .post('window', {
            window,
            limit: 1,
            monitoringCursor: first.monitoring.completedCursor,
            diagnosticCursor: first.diagnostics.nextCursor,
          })
          .expect(200)
      ).body,
    );
    expect(second.monitoring.samples).toEqual([]);
    expect(second.monitoring.snapshotSequence).toBe(first.monitoring.snapshotSequence);
    expect(second.diagnostics.events[0]?.sequence).not.toBe(first.diagnostics.events[0]?.sequence);
    const safe = JSON.stringify(first);
    expect(safe).not.toContain(f.dir);
    expect(safe).not.toContain(capability);
    await f.post('preference', { samplingEnabled: false, retentionDays: 9 }).expect(200);
    expect((await f.post('status').expect(200)).body.monitoring.preference.samplingEnabled).toBe(
      false,
    );
  });

  it('rejects malformed/private-content fields and exposes only fixed error codes for storage failure', async () => {
    const f = await fixture();
    await f.post('preference', { samplingEnabled: true, retentionDays: 91 }).expect(400);
    await f.post('status', { secret: 'sk-private-canary' }).expect(400);
    await f
      .post('window', { window: { fromMs: 1, toMs: 2 }, prompt: 'sk-private-canary' })
      .expect(400);
    vi.spyOn(f.monitoring, 'queryWindow').mockRejectedValueOnce(
      new Error('/private/path sk-private-canary rawSQL'),
    );
    const result = await f.post('window', { window: { fromMs: 1, toMs: 2 } }).expect(503);
    expect(result.body.error.code).toBe('MONITORING_UNAVAILABLE');
    expect(JSON.stringify(result.body)).not.toMatch(/canary|rawSQL|private\/path/);
    expect((await f.post('status').expect(200)).body.diagnostics.state).toBe('ready');
  });

  it('enforces one total window deadline rather than a separate budget per store', async () => {
    const f = await fixture();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realFlush = f.monitoring.flush.bind(f.monitoring);
    const queries = vi.spyOn(f.monitoring, 'queryWindow');
    vi.spyOn(f.monitoring, 'flush').mockImplementationOnce(() => held);
    const started = performance.now();
    try {
      const response = await f.post('window', { window: { fromMs: 1, toMs: 2 } }).expect(503);
      expect(response.body.error.code).toBe('MONITORING_UNAVAILABLE');
      expect(performance.now() - started).toBeLessThan(1000);
    } finally {
      release();
      await realFlush();
      await Promise.resolve();
    }
    expect(queries).not.toHaveBeenCalled();
    await f.post('status').expect(200);
  });
});
