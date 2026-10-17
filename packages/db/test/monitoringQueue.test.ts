import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
const control = vi.hoisted(() => ({
  workers: [] as {
    emit: (event: string, value: unknown) => void;
    messages: { id: number; type: string; input: unknown }[];
  }[],
}));
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    Worker: class extends EventEmitter {
      messages: { id: number; type: string; input: unknown }[] = [];
      constructor() {
        super();
        control.workers.push(this);
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
                preference: { samplingEnabled: true, retentionDays: 7, version: 1 },
              },
            }),
          0,
        );
      }
      postMessage(message: { id: number; type: string; input: unknown }) {
        this.messages.push(message);
      }
      unref() {
        return this;
      }
      terminate() {
        return Promise.resolve(0);
      }
    },
  };
});
import { createMonitoringStore } from '../src/monitoring/store.js';
afterEach(() => {
  vi.useRealTimers();
  control.workers.length = 0;
});
function value(processInstanceId: string) {
  return {
    schemaVersion: 1,
    sampleId: randomUUID(),
    processInstanceId,
    observedAtMs: Date.now(),
    intervalMs: 30000,
    source: 'api_process_app_volume',
    cpuUserMicros: 1,
    cpuSystemMicros: 2,
    rssBytes: 3,
    eventLoopP95Ms: 1,
    eventLoopMaxMs: 2,
    activeRuns: 0,
    admittedUnresolvedAttempts: 0,
    sessionLockKeys: 0,
    sessionLockWaiters: 0,
    appVolumeFreeBytes: null,
    unavailableMetrics: ['app_volume_disk'],
  };
}
it('counts queued plus admitted inflight samples in the fixed256bound and each lost sample exactly once', async () => {
  vi.useFakeTimers();
  const store = createMonitoringStore({ path: '/owned-worker-double' });
  await vi.advanceTimersByTimeAsync(0);
  await store.ready;
  const accepted = [];
  for (let i = 0; i < 300; i++)
    accepted.push(store.record(value(store.health().processInstanceId)));
  expect(accepted.filter(Boolean)).toHaveLength(256);
  expect(store.health()).toMatchObject({ pending: 256, dropped: 44 });
  const flushing = store.flush();
  await vi.advanceTimersByTimeAsync(0);
  const worker = control.workers[0]!;
  expect(worker.messages.filter((message) => message.type === 'append')).toHaveLength(1);
  expect((worker.messages[0]!.input as { samples: unknown[] }).samples).toHaveLength(32);
  expect(store.health().pending).toBe(256);
  expect(store.record(value(store.health().processInstanceId))).toBe(false);
  expect(store.health().dropped).toBe(45);
  await vi.advanceTimersByTimeAsync(1000);
  await flushing;
  expect(store.health()).toMatchObject({ state: 'disabled', pending: 0, dropped: 301 });
  await store.close();
  expect(store.record(value(store.health().processInstanceId))).toBe(false);
  expect(store.health().dropped).toBe(301);
});
it('does not advance durable preference or version before the worker acknowledgment', async () => {
  vi.useFakeTimers();
  const store = createMonitoringStore({ path: '/owned-worker-double' });
  await vi.advanceTimersByTimeAsync(0);
  await store.ready;
  const saving = expect(
    store.setPreference({ samplingEnabled: false, retentionDays: 90 }),
  ).rejects.toMatchObject({ code: 'unavailable' });
  await vi.advanceTimersByTimeAsync(999);
  expect(store.health().preference).toEqual({
    samplingEnabled: true,
    retentionDays: 7,
    version: 1,
  });
  await vi.advanceTimersByTimeAsync(1);
  await saving;
  expect(store.health().preference).toBeNull();
  await store.close();
});
