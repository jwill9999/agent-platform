import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiagnosticEvent, DiagnosticStore } from '@agent-platform/contracts';

type Message = {
  id: number;
  type: string;
  input: { events?: DiagnosticEvent[]; dropped?: number };
};
type WorkerControl = {
  messages: Message[];
  accepted: DiagnosticEvent[];
  ready(): void;
  acknowledge(message: Message): void;
};
const controls = vi.hoisted(() => ({ workers: [] as WorkerControl[] }));

// This controlled worker isolates scheduling/admission, not SQLite durability or throughput.
// Real-worker persistence, held-writer and bounded-close controls remain in diagnostics.test.ts.
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    Worker: class extends EventEmitter implements WorkerControl {
      messages: Message[] = [];
      accepted: DiagnosticEvent[] = [];
      constructor() {
        super();
        controls.workers.push(this);
      }
      ready() {
        this.emit('message', { type: 'ready', stats: this.stats() });
      }
      stats() {
        return {
          pruned: 0,
          conflicts: 0,
          dropped: 0,
          acknowledgedSequence: this.accepted.length,
          lastAcknowledgedAtMs: this.accepted.length ? Date.now() : null,
          previousShutdownUnclean: false,
        };
      }
      postMessage(message: Message) {
        this.messages.push(message);
        if (message.type === 'close')
          queueMicrotask(() => this.emit('message', { id: message.id, result: null }));
      }
      acknowledge(message: Message) {
        expect(message.type).toBe('append');
        this.accepted.push(...message.input.events!);
        this.emit('message', { id: message.id, result: this.stats() });
      }
      unref() {
        return this;
      }
      async terminate() {
        return 0;
      }
    },
  };
});
import { createDiagnosticStore } from '../src/diagnostics/store.js';

const stores: DiagnosticStore[] = [];
function fixture() {
  vi.useFakeTimers();
  const store = createDiagnosticStore({ path: '/unused-controlled-scheduling.sqlite' });
  stores.push(store);
  return { store, worker: controls.workers.at(-1)! };
}
function event(store: DiagnosticStore): DiagnosticEvent {
  return {
    schemaVersion: 1,
    eventId: randomUUID(),
    processInstanceId: store.health().processInstanceId,
    requestId: randomUUID(),
    observedAtMs: Date.now(),
    phase: 'request',
    outcome: 'started',
  };
}
function appends(worker: WorkerControl) {
  return worker.messages.filter((message) => message.type === 'append');
}
afterEach(async () => {
  const closing = stores.splice(0).map((store) => store.close());
  await vi.advanceTimersByTimeAsync(1000);
  await Promise.all(closing);
  controls.workers.length = 0;
  vi.useRealTimers();
});

it('keeps the original 250ms batching delay for fewer than 32 events', async () => {
  const { store, worker } = fixture();
  worker.ready();
  await store.ready;
  for (let index = 0; index < 31; index++) expect(store.record(event(store))).toBe(true);
  await vi.advanceTimersByTimeAsync(249);
  expect(appends(worker)).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(appends(worker)).toHaveLength(1);
  expect(appends(worker)[0]!.input.events).toHaveLength(31);
  worker.acknowledge(appends(worker)[0]!);
  await vi.advanceTimersByTimeAsync(0);
  expect(store.health()).toMatchObject({ pending: 0, dropped: 0, state: 'ready' });
});

it('promotes an existing low-priority timer once when a full batch becomes ready', async () => {
  const { store, worker } = fixture();
  worker.ready();
  await store.ready;
  for (let index = 0; index < 31; index++) store.record(event(store));
  await vi.advanceTimersByTimeAsync(100);
  expect(appends(worker)).toHaveLength(0);
  store.record(event(store));
  for (let index = 0; index < 32; index++) store.record(event(store));
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(0);
  expect(appends(worker)).toHaveLength(1);
  expect(appends(worker)[0]!.input.events).toHaveLength(32);
  expect(store.health().pending).toBe(64);
  worker.acknowledge(appends(worker)[0]!);
  await vi.advanceTimersByTimeAsync(0);
  expect(appends(worker)).toHaveLength(2);
  worker.acknowledge(appends(worker)[1]!);
  await vi.advanceTimersByTimeAsync(250);
  expect(appends(worker)).toHaveLength(2);
  expect(store.health()).toMatchObject({ pending: 0, dropped: 0 });
});

it('dispatches a full pre-ready backlog promptly after the actual ready message', async () => {
  const { store, worker } = fixture();
  for (let index = 0; index < 64; index++) expect(store.record(event(store))).toBe(true);
  await vi.advanceTimersByTimeAsync(100);
  expect(appends(worker)).toHaveLength(0);
  worker.ready();
  await store.ready;
  await vi.advanceTimersByTimeAsync(0);
  expect(appends(worker)).toHaveLength(1);
  worker.acknowledge(appends(worker)[0]!);
  await vi.advanceTimersByTimeAsync(0);
  expect(appends(worker)).toHaveLength(2);
  worker.acknowledge(appends(worker)[1]!);
  await vi.advanceTimersByTimeAsync(0);
  expect(store.health()).toMatchObject({ state: 'ready', pending: 0, dropped: 0 });
});

it('keeps total pending bounded while one append owns the drain, without extra timers', async () => {
  const { store, worker } = fixture();
  worker.ready();
  await store.ready;
  for (let index = 0; index < 32; index++) store.record(event(store));
  await vi.advanceTimersByTimeAsync(0);
  for (let index = 0; index < 224; index++) expect(store.record(event(store))).toBe(true);
  expect(store.record(event(store))).toBe(false);
  expect(store.health()).toMatchObject({ pending: 256, dropped: 1, reason: 'queue_full' });
  expect(vi.getTimerCount()).toBe(1); // Only the unchanged in-flight RPC deadline.
  await vi.advanceTimersByTimeAsync(249);
  expect(appends(worker)).toHaveLength(1);
  for (let index = 0; index < 8; index++) {
    expect(appends(worker)).toHaveLength(index + 1);
    worker.acknowledge(appends(worker)[index]!);
    await vi.advanceTimersByTimeAsync(0);
  }
  expect(worker.accepted).toHaveLength(256);
  expect(store.health()).toMatchObject({ state: 'degraded', pending: 0, dropped: 1 });
  expect(vi.getTimerCount()).toBe(0);
});

it('preserves all accepted event identities under sustained 14-event request-shaped arrivals', async () => {
  const { store, worker } = fixture();
  worker.ready();
  await store.ready;
  const accepted: string[] = [];
  let acknowledged = 0;
  for (let request = 0; request < 110; request++) {
    for (let index = 0; index < 14; index++) {
      const next = event(store);
      expect(store.record(next)).toBe(true);
      accepted.push(next.eventId);
    }
    await vi.advanceTimersByTimeAsync(10);
    while (appends(worker).length > acknowledged) {
      worker.acknowledge(appends(worker)[acknowledged++]!);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(store.health().pending).toBeLessThanOrEqual(256);
  }
  await vi.advanceTimersByTimeAsync(250);
  while (appends(worker).length > acknowledged) {
    worker.acknowledge(appends(worker)[acknowledged++]!);
    await vi.advanceTimersByTimeAsync(0);
  }
  expect(accepted).toHaveLength(1540);
  expect(worker.accepted.map((item) => item.eventId)).toEqual(accepted);
  expect(appends(worker).every((message) => message.input.events!.length <= 32)).toBe(true);
  expect(store.health()).toMatchObject({ state: 'ready', pending: 0, dropped: 0 });
});
