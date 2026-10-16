import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { createMonitoringStore } from '../src/monitoring/store.js';
import { createDiagnosticStore } from '../src/diagnostics/store.js';
import type { MonitoringSample, MonitoringStore, DiagnosticStore } from '@agent-platform/contracts';

const directories: string[] = [];
const stores: (MonitoringStore | DiagnosticStore)[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'monitoring-'));
  directories.push(directory);
  const path = join(directory, 'monitoring.sqlite');
  const store = createMonitoringStore({ path });
  stores.push(store);
  return { store, path };
}
function sample(store: MonitoringStore, observedAtMs = Date.now()): MonitoringSample {
  return {
    schemaVersion: 1,
    sampleId: randomUUID(),
    processInstanceId: store.health().processInstanceId,
    observedAtMs,
    intervalMs: 30000,
    source: 'api_process_app_volume',
    cpuUserMicros: 10,
    cpuSystemMicros: 20,
    rssBytes: 100,
    eventLoopP95Ms: 1,
    eventLoopMaxMs: 2,
    activeRuns: 1,
    admittedUnresolvedAttempts: 1,
    sessionLockKeys: 1,
    sessionLockWaiters: 0,
    appVolumeFreeBytes: null,
    unavailableMetrics: ['app_volume_disk'],
  };
}
afterEach(async () => {
  for (const store of stores.splice(0)) await store.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
it('acks retained preferences only after worker ready and keeps safe samples across clean restart', async () => {
  const { store, path } = fixture();
  expect(store.health().preference).toBeNull();
  expect(store.record(sample(store))).toBe(false);
  await store.ready;
  expect(await store.preference()).toEqual({
    samplingEnabled: false,
    retentionDays: 7,
    version: 1,
  });
  const pref = await store.setPreference({ samplingEnabled: true, retentionDays: 90 });
  expect(pref).toEqual({ samplingEnabled: true, retentionDays: 90, version: 2 });
  const observedAtMs = Date.now();
  const value = sample(store, observedAtMs);
  expect(store.record(value)).toBe(true);
  await store.flush();
  const page = await store.queryWindow({ fromMs: observedAtMs - 1, toMs: observedAtMs + 1 });
  expect(page.samples.map((row) => row.sample)).toEqual([value]);
  expect(page.health.pending).toBe(0);
  expect(page.completedCursor).toBeTruthy();
  expect(statSync(path).mode & 0o777).toBe(0o600);
  await store.close();
  const reopened = createMonitoringStore({ path });
  stores.push(reopened);
  await reopened.ready;
  expect(await reopened.preference()).toEqual(pref);
  expect(reopened.health().previousShutdownUnclean).toBe(false);
  await expect(
    reopened.queryWindow(page.window, { cursor: page.completedCursor }),
  ).rejects.toMatchObject({ code: 'invalid_cursor' });
  const db = new Database(path, { readonly: true });
  expect(db.prepare("SELECT value FROM monitoring_meta WHERE key='open'").get()).toEqual({
    value: '1',
  });
  db.close();
});
it('binds stable and completed cursors to window, HMAC, snapshot and retention generation', async () => {
  const { store } = fixture();
  await store.ready;
  await store.setPreference({ samplingEnabled: true, retentionDays: 7 });
  const now = Date.now();
  for (let i = 0; i < 3; i++) expect(store.record(sample(store, now + i))).toBe(true);
  await store.flush();
  const window = { fromMs: now - 1, toMs: now + 100 };
  const first = await store.queryWindow(window, { limit: 1 });
  store.record(sample(store, now + 4));
  await store.flush();
  const rest = await store.queryWindow(window, { cursor: first.nextCursor });
  expect(rest.samples).toHaveLength(2);
  expect(rest.snapshotSequence).toBe(first.snapshotSequence);
  const done = await store.queryWindow(window, { cursor: rest.completedCursor });
  expect(done.samples).toEqual([]);
  expect(done.completedCursor).toBe(rest.completedCursor);
  await expect(
    store.queryWindow({ ...window, fromMs: now }, { cursor: first.nextCursor }),
  ).rejects.toMatchObject({ code: 'invalid_cursor' });
  await expect(
    store.queryWindow(window, { cursor: `${rest.completedCursor}x` }),
  ).rejects.toMatchObject({ code: 'invalid_cursor' });
  store.record(sample(store, now - 8 * 86400000));
  await store.flush();
  await expect(store.queryWindow(window, { cursor: first.nextCursor })).rejects.toMatchObject({
    code: 'expired_history',
  });
});
it('retains first sample identity on conflict, rejects private payloads, and disables resources without disabling V1', async () => {
  const { store, path } = fixture();
  await store.ready;
  await store.setPreference({ samplingEnabled: true, retentionDays: 7 });
  const now = Date.now(),
    value = sample(store, now);
  store.record(value);
  store.record(value);
  store.record({ ...value, rssBytes: 999 });
  expect(store.record({ ...value, apiKey: 'CANARY' })).toBe(false);
  await store.flush();
  const page = await store.queryWindow({ fromMs: now - 1, toMs: now + 1 });
  expect(page.samples).toHaveLength(1);
  expect(page.samples[0]?.sample.rssBytes).toBe(100);
  expect(page.health.conflicts).toBe(1);
  expect(page.health.dropped).toBe(1);
  await store.setPreference({ samplingEnabled: false, retentionDays: 7 });
  expect(store.record(sample(store))).toBe(false);
  const diagnostics = createDiagnosticStore({ path: join(path, '..', 'diagnostics.sqlite') });
  stores.push(diagnostics);
  await diagnostics.ready;
  const requestId = randomUUID();
  expect(
    diagnostics.record({
      schemaVersion: 1,
      eventId: randomUUID(),
      processInstanceId: diagnostics.health().processInstanceId,
      requestId,
      phase: 'request',
      outcome: 'started',
      observedAtMs: now,
    }),
  ).toBe(true);
  await diagnostics.flush();
  expect((await diagnostics.query({ requestId })).events).toHaveLength(1);
});
it('uses the actual 25000-row cap and exposes count/age pruning and missing cadence', async () => {
  const { store, path } = fixture();
  await store.ready;
  await store.setPreference({ samplingEnabled: true, retentionDays: 90 });
  // Populate real fixed safe rows through SQLite at its real production cap, not a lowered configuration.
  const db = new Database(path);
  const insert = db.prepare(
    'INSERT INTO monitoring_events(sample_id,observed_at,content) VALUES (?,?,?)',
  );
  const now = Date.now();
  db.transaction(() => {
    for (let i = 0; i < 25001; i++) {
      const value = sample(store, now - 750030000 + i * 30000);
      insert.run(value.sampleId, value.observedAtMs, JSON.stringify(value));
    }
  })();
  db.close();
  await store.prune();
  const check = new Database(path, { readonly: true });
  expect(check.prepare('SELECT count(*) AS n FROM monitoring_events').get()).toEqual({ n: 25000 });
  check.close();
  expect(store.health().pruned).toBe(1);
  const first = await store.queryWindow({ fromMs: now - 800000000, toMs: now + 1 }, { limit: 1 });
  expect(first.coverage.historyMayBeMissing).toBe(true);
  await store.setPreference({ samplingEnabled: true, retentionDays: 1 });
  expect(store.health().pruned).toBeGreaterThan(20000);
});
it('never claims a durable default for unavailable or incompatible storage', async () => {
  const { store, path } = fixture();
  await store.ready;
  const invalid = createMonitoringStore({
    path: join(path, 'not-a-directory', 'monitoring.sqlite'),
  });
  stores.push(invalid);
  await invalid.ready;
  expect(invalid.health().preference).toBeNull();
  await expect(invalid.preference()).rejects.toThrow();
});
it('adds V1 time/session windows without changing existing scope query and prevents completed replay', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'diagnostic-window-'));
  directories.push(directory);
  const path = join(directory, 'diagnostics.sqlite');
  const store = createDiagnosticStore({ path });
  stores.push(store);
  await store.ready;
  const now = Date.now(),
    sessionId = randomUUID(),
    requestId = randomUUID();
  for (let i = 0; i < 3; i++)
    store.record({
      schemaVersion: 1,
      eventId: randomUUID(),
      processInstanceId: store.health().processInstanceId,
      requestId,
      sessionId: i === 2 ? randomUUID() : sessionId,
      observedAtMs: now + i,
      phase: 'request',
      outcome: 'started',
    });
  await store.flush();
  const window = { fromMs: now, toMs: now + 3, sessionId };
  const first = await store.queryWindow(window, { limit: 1 });
  expect(first.events).toHaveLength(1);
  const final = await store.queryWindow(window, { cursor: first.nextCursor });
  expect(final.events).toHaveLength(1);
  expect(final.events[0]?.event.sessionId).toBe(sessionId);
  expect((await store.queryWindow(window, { cursor: final.completedCursor })).events).toEqual([]);
  expect((await store.query({ requestId })).events).toHaveLength(3);
  await expect(
    store.queryWindow({ ...window, sessionId: randomUUID() }, { cursor: final.completedCursor }),
  ).rejects.toMatchObject({ code: 'invalid_cursor' });
  await store.close();
  const reopened = createDiagnosticStore({ path });
  stores.push(reopened);
  await reopened.ready;
  await expect(
    reopened.queryWindow(window, { cursor: final.completedCursor }),
  ).rejects.toMatchObject({ code: 'invalid_cursor' });
});

it('refuses malformed retained preference metadata without inventing or overwriting defaults', async () => {
  const { store, path } = fixture();
  await store.ready;
  await store.close();
  const db = new Database(path);
  db.prepare("UPDATE monitoring_meta SET value='not-a-number' WHERE key='retention_days'").run();
  db.close();
  const reopened = createMonitoringStore({ path });
  stores.push(reopened);
  await reopened.ready;
  expect(reopened.health()).toMatchObject({ state: 'disabled', preference: null });
  await expect(reopened.preference()).rejects.toThrow();
  const check = new Database(path, { readonly: true });
  expect(
    check.prepare("SELECT value FROM monitoring_meta WHERE key='retention_days'").get(),
  ).toEqual({ value: 'not-a-number' });
  check.close();
});

it('keeps sequence pagination but reports UTC extrema and discontinuities honestly', async () => {
  const now = Date.now();
  for (const { times, gaps } of [
    { times: [now + 100000, now + 70000], gaps: 1 },
    { times: [now + 90000, now + 90000], gaps: 1 },
    { times: [now + 70000, now + 100000], gaps: 0 },
  ]) {
    const { store } = fixture();
    await store.ready;
    await store.setPreference({ samplingEnabled: true, retentionDays: 7 });
    const values = times.map((time) => sample(store, time));
    for (const value of values) expect(store.record(value)).toBe(true);
    await store.flush();
    const window = { fromMs: now + 60000, toMs: now + 110000 };
    const first = await store.queryWindow(window, { limit: 1 });
    expect(first.coverage).toEqual({
      oldestObservedAtMs: Math.min(...times),
      newestObservedAtMs: Math.max(...times),
      gaps,
      historyMayBeMissing: gaps > 0,
    });
    const second = await store.queryWindow(window, { cursor: first.nextCursor });
    expect([...first.samples, ...second.samples].map((row) => row.sample)).toEqual(values);
    expect(second.samples[0]!.sequence).toBeGreaterThan(first.samples[0]!.sequence);
    expect(second.coverage).toEqual(first.coverage);
  }
});
it('uses UTC min/max for V1 events without mislabelling asynchronous equal or reversed event times as cadence gaps', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'diagnostic-window-clock-'));
  directories.push(directory);
  const store = createDiagnosticStore({ path: join(directory, 'diagnostics.sqlite') });
  stores.push(store);
  await store.ready;
  const now = Date.now(),
    sessionId = randomUUID(),
    requestId = randomUUID();
  const times = [now + 100000, now + 70000, now + 70000];
  for (const observedAtMs of times)
    expect(
      store.record({
        schemaVersion: 1,
        eventId: randomUUID(),
        processInstanceId: store.health().processInstanceId,
        requestId,
        sessionId,
        observedAtMs,
        phase: 'request',
        outcome: 'started',
      }),
    ).toBe(true);
  await store.flush();
  const page = await store.queryWindow({ fromMs: now + 60000, toMs: now + 110000, sessionId });
  expect(page.events.map((row) => row.event.observedAtMs)).toEqual(times);
  expect(page.coverage).toEqual({
    oldestObservedAtMs: now + 70000,
    newestObservedAtMs: now + 100000,
    gaps: 0,
    historyMayBeMissing: false,
  });
});
