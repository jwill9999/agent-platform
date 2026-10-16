import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createDiagnosticStore, DiagnosticStoreError } from '../src/diagnostics/store.js';
import { diagnosticStoreConformance } from './helpers/diagnosticStoreConformance.js';
import type { DiagnosticEvent, DiagnosticStore } from '@agent-platform/contracts';

const directories: string[] = [];
const stores: DiagnosticStore[] = [];
function fixture(options: { retentionDays?: number; maxEvents?: number } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'diagnostic-store-'));
  directories.push(directory);
  const path = join(directory, 'diagnostics.sqlite');
  const store = createDiagnosticStore({ path, ...options });
  stores.push(store);
  return { store, path };
}
function event(store: DiagnosticStore, overrides: Partial<DiagnosticEvent> = {}): DiagnosticEvent {
  return {
    schemaVersion: 1,
    eventId: randomUUID(),
    processInstanceId: store.health().processInstanceId,
    requestId: randomUUID(),
    phase: 'request',
    outcome: 'started',
    observedAtMs: Date.now(),
    ...overrides,
  };
}
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('SQLite diagnostic adapter conformance', () => {
  it('preserves acknowledged order, idempotence, conflict counters and clean restart', async () => {
    const { store, path } = fixture();
    await store.ready;
    expect(store.health().state).toBe('ready');
    const first = event(store);
    const second = event(store, { requestId: first.requestId, outcome: 'succeeded' });
    store.record(first);
    store.record(first);
    store.record({ ...first, outcome: 'failed' });
    store.record(second);
    await store.flush();
    const page = await store.query({ requestId: first.requestId });
    expect(page.events.map((row) => row.event.outcome)).toEqual(['started', 'succeeded']);
    expect(page.health.conflicts).toBe(1);
    expect(page.events[1]!.sequence).toBeGreaterThan(page.events[0]!.sequence);
    await store.close();
    const reopened = createDiagnosticStore({ path });
    stores.push(reopened);
    await reopened.ready;
    expect((await reopened.query({ requestId: first.requestId })).events).toEqual(page.events);
    expect(reopened.health().previousShutdownUnclean).toBe(false);
  });
  it('binds authenticated cursors to scope and a stable snapshot', async () => {
    const { store } = fixture();
    await store.ready;
    const first = event(store);
    for (let i = 0; i < 3; i++) store.record(event(store, { requestId: first.requestId }));
    await store.flush();
    const scope = { requestId: first.requestId };
    const page = await store.query(scope, { limit: 1 });
    store.record(event(store, { requestId: first.requestId }));
    await store.flush();
    const next = await store.query(scope, { cursor: page.nextCursor });
    expect(next.events).toHaveLength(2);
    expect(next.snapshotSequence).toBe(page.snapshotSequence);
    await expect(
      store.query({ requestId: randomUUID() }, { cursor: page.nextCursor }),
    ).rejects.toMatchObject({ code: 'invalid_cursor' });
    await expect(store.query(scope, { cursor: `${page.nextCursor}x` })).rejects.toBeInstanceOf(
      DiagnosticStoreError,
    );
  });
  it('prunes by age/count and reports an expired cursor with earliest retained sequence', async () => {
    const { store } = fixture({ maxEvents: 100 });
    await store.ready;
    const requestId = randomUUID();
    for (let i = 0; i < 100; i++) store.record(event(store, { requestId }));
    await store.flush();
    const page = await store.query({ requestId }, { limit: 1 });
    store.record(event(store, { requestId }));
    store.record(event(store, { requestId, observedAtMs: Date.now() - 8 * 86400000 }));
    await store.flush();
    expect((await store.query({ requestId })).events).toHaveLength(99);
    expect(store.health().pruned).toBe(3);
    await expect(store.query({ requestId }, { cursor: page.nextCursor })).rejects.toMatchObject({
      code: 'expired_history',
      earliestSequence: 3,
    });
  });
  it('bounds pending work including in-flight batches and rejects unsafe envelopes', async () => {
    const { store } = fixture();
    await store.ready;
    const requestId = randomUUID();
    expect(store.record({ ...event(store), prompt: 'canary private prompt' })).toBe(false);
    for (let i = 0; i < 300; i++) store.record(event(store, { requestId }));
    expect(store.health().pending).toBe(256);
    expect(store.health().dropped).toBe(45);
    await store.flush();
    expect((await store.query({ requestId })).events).toHaveLength(256);
    expect(store.health().pending).toBe(0);
  });
  it('retains every accepted identity across repeated batch promotion and explicit drains', async () => {
    const { store, path } = fixture();
    await store.ready;
    const requestId = randomUUID();
    const accepted: string[] = [];
    for (let burst = 0; burst < 22; burst++) {
      for (let index = 0; index < 70; index++) {
        const next = event(store, { requestId });
        expect(store.record(next)).toBe(true);
        accepted.push(next.eventId);
      }
      await store.flush();
      expect(store.health()).toMatchObject({ state: 'ready', pending: 0, dropped: 0 });
    }
    const inspect = new Database(path);
    try {
      const rows = inspect
        .prepare('SELECT event_id FROM diagnostic_events ORDER BY sequence')
        .all() as Array<{ event_id: string }>;
      expect(rows.map((row) => row.event_id)).toEqual(accepted);
      expect(rows).toHaveLength(1540);
    } finally {
      inspect.close();
    }
  });
  it('eventually counts held-writer overflow and deadline-boundary in-flight loss exactly once', async () => {
    const { store, path } = fixture();
    await store.ready;
    const lock = new Database(path);
    lock.exec('BEGIN IMMEDIATE');
    try {
      const accepted: boolean[] = [];
      for (let index = 0; index < 300; index++) accepted.push(store.record(event(store)));
      expect(accepted.filter(Boolean)).toHaveLength(256);
      expect(store.health()).toMatchObject({ pending: 256, dropped: 44, reason: 'queue_full' });
      await store.close();
      expect(store.health()).toMatchObject({
        state: 'closed',
        pending: 0,
        reason: 'shutdown_timeout',
      });
      // The unchanged 1000ms close deadline does not wait for its rejected RPC catch.
      // At return, one owned batch can still be unaccounted; that is not proof of durability.
      expect([0, 32]).toContain(300 - store.health().dropped);
      expect(store.record(event(store))).toBe(false);
      await store.flush(); // Observe the already-owned logical RPC settlement, not native I/O.
      expect(store.health().dropped).toBe(300);
      await store.close();
      expect(store.health().dropped).toBe(300);
    } finally {
      lock.exec('ROLLBACK');
      lock.close();
    }
  });
  it('does not block the main event loop on a held writer; retries once and discloses loss', async () => {
    const { store, path } = fixture();
    await store.ready;
    const lock = new Database(path);
    lock.exec('BEGIN IMMEDIATE');
    let heartbeat = 0;
    const timer = setInterval(() => heartbeat++, 5);
    try {
      store.record(event(store));
      await store.flush();
      expect(heartbeat).toBeGreaterThan(5);
      expect(store.health().dropped).toBe(1);
      expect(store.health().state).toBe('degraded');
    } finally {
      clearInterval(timer);
      lock.exec('ROLLBACK');
      lock.close();
    }
    store.record(event(store));
    await store.flush();
    expect(store.health().acknowledgedSequence).toBe(1);
  });
  it('bounds SQLite file configuration, uses private permissions and releases rollback journal', async () => {
    const { store, path } = fixture();
    await store.ready;
    store.record(event(store));
    await store.flush();
    const inspect = new Database(path);
    expect(inspect.pragma('page_size', { simple: true })).toBe(4096);
    expect(inspect.pragma('journal_mode', { simple: true })).toBe('delete');
    expect(statSync(path).size).toBeLessThanOrEqual(64 * 1024 * 1024);
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
    inspect.close();
  });
  it('disables incompatible versions and invalid configuration without throwing or changing execution DB', async () => {
    const { store, path } = fixture();
    await store.ready;
    await store.close();
    const external = new Database(path);
    external.pragma('user_version = 999');
    external.close();
    const reopened = createDiagnosticStore({ path });
    stores.push(reopened);
    await reopened.ready;
    expect(reopened.health()).toMatchObject({ state: 'disabled', reason: 'schema_incompatible' });
    expect(reopened.record(event(reopened))).toBe(false);
    const bad = createDiagnosticStore({ path, retentionDays: 0 });
    stores.push(bad);
    await bad.ready;
    expect(bad.health().reason).toBe('invalid_configuration');
  });
  it('reports uncertain coverage after an unclean previous process', async () => {
    const { store, path } = fixture();
    await store.ready;
    await store.close();
    const external = new Database(path);
    external.prepare("UPDATE diagnostic_meta SET value='1' WHERE key='open'").run();
    external.close();
    const reopened = createDiagnosticStore({ path });
    stores.push(reopened);
    await reopened.ready;
    expect(reopened.health().previousShutdownUnclean).toBe(true);
  });
  it('lists latest request observations without raw payloads', async () => {
    const { store } = fixture();
    await store.ready;
    const first = event(store);
    store.record(first);
    store.record({
      ...first,
      eventId: randomUUID(),
      outcome: 'failed',
      errorCode: 'provider_error',
    });
    await store.flush();
    const records = await store.listRecent();
    expect(records).toHaveLength(1);
    expect(records[0]!.event.outcome).toBe('failed');
  });
  it('persists final loss counters and adds losses observed before a restarted store is ready', async () => {
    const { store, path } = fixture();
    await store.ready;
    for (let i = 0; i < 5; i++) store.record({ message: 'private-canary' });
    await store.close();
    const reopened = createDiagnosticStore({ path });
    stores.push(reopened);
    for (let i = 0; i < 3; i++) reopened.record({ unknown: true });
    await reopened.ready;
    expect(reopened.health().dropped).toBe(8);
  });
  it('expires idle history before list/query even without another append or restart', async () => {
    const { store } = fixture({ retentionDays: 1 });
    await store.ready;
    const first = event(store, { observedAtMs: Date.now() - 86400000 + 1000 });
    store.record(first);
    await store.flush();
    expect((await store.query({ requestId: first.requestId })).events).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await store.listRecent()).toEqual([]);
    expect((await store.query({ requestId: first.requestId })).events).toEqual([]);
    expect(store.health().pruned).toBe(1);
  });
  it('closes under a held writer without double-counting a lost in-flight batch', async () => {
    const { store, path } = fixture();
    await store.ready;
    const lock = new Database(path);
    lock.exec('BEGIN IMMEDIATE');
    try {
      store.record(event(store));
      await store.close();
      expect(store.health()).toMatchObject({
        state: 'closed',
        pending: 0,
        dropped: 1,
        reason: 'storage_unavailable',
      });
    } finally {
      lock.exec('ROLLBACK');
      lock.close();
    }
    const reopened = createDiagnosticStore({ path });
    stores.push(reopened);
    await reopened.ready;
    expect(reopened.health().previousShutdownUnclean).toBe(true);
  });
});

diagnosticStoreConformance('SQLite worker', () => fixture().store);
