import { afterEach, expect, it, vi } from 'vitest';
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    Worker: class extends EventEmitter {
      constructor() {
        super();
        setTimeout(
          () =>
            this.emit('message', {
              type: 'ready',
              stats: {
                pruned: 0,
                conflicts: 0,
                dropped: 0,
                acknowledgedSequence: 0,
                lastAcknowledgedAtMs: null,
                previousShutdownUnclean: false,
                preference: { samplingEnabled: false, retentionDays: 7, version: 1 },
              },
            }),
          0,
        );
      }
      postMessage() {
        /* Native I/O is held indefinitely. */
      }
      unref() {
        return this;
      }
      terminate() {
        return new Promise<number>(() => {});
      }
    },
  };
});
import { createMonitoringStore } from '../src/monitoring/store.js';
afterEach(() => vi.useRealTimers());
it('bounds read RPC at 200 ms and marks preferences unknown rather than faking a durable save', async () => {
  vi.useFakeTimers();
  const store = createMonitoringStore({ path: '/unused-by-owned-worker-double' });
  await vi.advanceTimersByTimeAsync(0);
  await store.ready;
  const query = expect(store.queryWindow({ fromMs: 1, toMs: 2 })).rejects.toMatchObject({
    code: 'unavailable',
  });
  await vi.advanceTimersByTimeAsync(199);
  expect(store.health().state).toBe('ready');
  await vi.advanceTimersByTimeAsync(1);
  await query;
  expect(store.health()).toMatchObject({
    state: 'disabled',
    reason: 'read_timeout',
    preference: null,
  });
  await store.close();
});
it('honors the actual two-second close bound even when worker termination never resolves', async () => {
  vi.useFakeTimers();
  const store = createMonitoringStore({ path: '/unused-by-owned-worker-double' });
  await vi.advanceTimersByTimeAsync(0);
  await store.ready;
  let done = false;
  const closing = store.close().then(() => {
    done = true;
  });
  await vi.advanceTimersByTimeAsync(1999);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await closing;
  expect(store.health()).toMatchObject({ state: 'closed', reason: 'shutdown_timeout', pending: 0 });
});
