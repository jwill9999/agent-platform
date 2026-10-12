import { randomUUID } from 'node:crypto';
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
              },
            }),
          0,
        );
      }
      postMessage() {
        /* Simulate native filesystem I/O that never acknowledges. */
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
import { createDiagnosticStore } from '../src/diagnostics/store.js';
afterEach(() => vi.useRealTimers());
it('honors the one-second shutdown deadline even when native worker termination stalls', async () => {
  vi.useFakeTimers();
  const store = createDiagnosticStore({ path: '/unused-by-worker-double' });
  await vi.advanceTimersByTimeAsync(0);
  await store.ready;
  store.record({
    schemaVersion: 1,
    eventId: randomUUID(),
    processInstanceId: store.health().processInstanceId,
    requestId: randomUUID(),
    phase: 'request',
    outcome: 'started',
    observedAtMs: Date.now(),
  });
  const closing = store.close();
  await vi.advanceTimersByTimeAsync(1000);
  await closing;
  await vi.advanceTimersByTimeAsync(10);
  expect(store.health()).toMatchObject({
    state: 'closed',
    reason: 'shutdown_timeout',
    pending: 0,
    dropped: 1,
  });
});
