import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CaptureFailure, DiagnosticHealth } from '@agent-platform/contracts';

const fixture = vi.hoisted(() => ({ workers: [] as unknown[], constructionFails: false }));
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    Worker: class extends EventEmitter {
      messages: Array<{ id: number; type: string }> = [];
      postFails = false;
      constructor() {
        super();
        if (fixture.constructionFails) throw new Error('private-construction');
        fixture.workers.push(this);
      }
      postMessage(message: { id: number; type: string }) {
        if (this.postFails) throw new Error('private-post');
        this.messages.push(message);
      }
      terminate() {
        return new Promise<number>(() => {});
      }
      unref() {
        return this;
      }
    },
  };
});
import { createCaptureStore } from '../src/diagnostics/captureStore.js';
import { createDiagnosticStore } from '../src/diagnostics/store.js';

type ControlledWorker = EventEmitter & {
  messages: Array<{ id: number; type: string }>;
  postFails: boolean;
};
const stats = {
  pruned: 0,
  conflicts: 0,
  dropped: 0,
  acknowledgedSequence: 0,
  lastAcknowledgedAtMs: null,
  previousShutdownUnclean: false,
};
beforeEach(() => {
  fixture.workers = [];
  fixture.constructionFails = false;
  vi.useFakeTimers();
  vi.setSystemTime(10000);
});
afterEach(() => {
  vi.useRealTimers();
});
function setup(
  options: {
    valid?: boolean;
    observer?: (failure: CaptureFailure | undefined) => void;
    deadline?: 1000 | 2000;
    kind?: 'diagnostics' | 'monitoring';
  } = {},
) {
  const health: DiagnosticHealth = {
    state: 'starting',
    reason: 'none',
    pending: 0,
    ...stats,
    processInstanceId: randomUUID(),
  };
  const observed: Array<CaptureFailure | undefined> = [];
  const store = createCaptureStore({
    health,
    storeKind: options.kind ?? 'diagnostics',
    onFirstFailure(failure) {
      observed.push(failure);
      return options.observer?.(failure);
    },
    unavailableError: 'diagnostics_unavailable',
    workerUrl: new URL('file:///owned-worker-double'),
    workerData: {},
    configurationValid: options.valid ?? true,
    parseRecord: (input: unknown) => input,
    invalidReason: 'invalid_event',
    appendInput: (events) => events,
    readCommands: ['query'],
    closeDeadlineMs: options.deadline ?? 1000,
  });
  const worker = fixture.workers.at(-1) as ControlledWorker | undefined;
  const ready = () => worker!.emit('message', { type: 'ready', stats });
  const reply = (error?: string, result: unknown = stats) => {
    const request = worker!.messages.at(-1)!;
    worker!.emit('message', { id: request.id, ...(error ? { error } : { result }) });
  };
  return { store, worker, health, observed, ready, reply };
}
it('latches startup timeout once and refuses late ready, ACK, error and exit revival', async () => {
  const f = setup();
  await vi.advanceTimersByTimeAsync(3000);
  await f.store.ready;
  expect(f.observed).toHaveLength(1);
  expect(f.health.firstFailure).toMatchObject({
    operation: 'startup',
    cause: 'timeout',
    elapsedMs: 3000,
    deadlineMs: 3000,
    observedAtMs: 13000,
  });
  f.ready();
  f.worker!.emit('message', { id: 1, result: { ...stats, acknowledgedSequence: 99 } });
  f.worker!.emit('error', new Error('private-error'));
  f.worker!.emit('exit', 7);
  expect(f.health.state).toBe('disabled');
  expect(f.health.acknowledgedSequence).toBe(0);
  expect(f.observed).toHaveLength(1);
  expect(JSON.stringify(f.observed)).not.toContain('private');
  await f.store.close();
});
it.each(['worker_error', 'worker_exit', 'worker_reply', 'worker_construction'] as const)(
  'distinguishes first %s failure without copying raw errors',
  async (cause) => {
    fixture.constructionFails = cause === 'worker_construction';
    const f = setup();
    if (cause === 'worker_error') f.worker!.emit('error', new Error('private-worker-path'));
    if (cause === 'worker_exit') f.worker!.emit('exit', 9);
    if (cause === 'worker_reply')
      f.worker!.emit('message', {
        type: 'disabled',
        reason: 'storage_unavailable',
        sql: 'private-query',
      });
    await f.store.ready;
    expect(f.health.firstFailure).toMatchObject({ operation: 'startup', cause, deadlineMs: null });
    if (cause === 'worker_exit') expect(f.health.firstFailure?.exitCode).toBe(9);
    expect(JSON.stringify(f.observed)).not.toContain('private');
    await f.store.close();
  },
);
it('reports valid configuration failures but never fabricates an invalid process UUID', async () => {
  const f = setup({ valid: false });
  await f.store.ready;
  expect(f.observed[0]).toMatchObject({
    operation: 'configuration',
    cause: 'invalid_configuration',
    deadlineMs: null,
  });
  const callback = vi.fn();
  const invalid = createDiagnosticStore({
    path: '/unused',
    processInstanceId: 'invalid-private',
    onFirstFailure: callback,
  });
  await invalid.ready;
  expect(invalid.health().firstFailure).toBeUndefined();
  expect(callback).toHaveBeenCalledExactlyOnceWith(undefined);
  await Promise.all([f.store.close(), invalid.close()]);
});
it('captures read timeout at the unchanged 200ms deadline without awaiting termination', async () => {
  const f = setup();
  f.ready();
  const read = f.store.rpc('query', {});
  const rejected = expect(read).rejects.toThrow('read_timeout');
  await vi.advanceTimersByTimeAsync(200);
  await rejected;
  expect(f.health.firstFailure).toMatchObject({
    operation: 'read',
    cause: 'timeout',
    elapsedMs: 200,
    deadlineMs: 200,
  });
  await f.store.close();
});
it.each([1000, 2000] as const)(
  'captures the unchanged %i close deadline and settles despite a never-ending observer',
  async (deadline) => {
    const f = setup({
      deadline,
      kind: deadline === 2000 ? 'monitoring' : 'diagnostics',
      observer: () => new Promise<void>(() => {}),
    });
    f.ready();
    const closing = f.store.close();
    await vi.advanceTimersByTimeAsync(deadline);
    await closing;
    expect(f.health.state).toBe('closed');
    expect(f.observed).toHaveLength(1);
    expect(f.health.firstFailure).toMatchObject({
      operation: 'close',
      cause: 'timeout',
      elapsedMs: deadline,
      deadlineMs: deadline,
    });
  },
);
it('retains the append timeout instead of the later close/worker failure', async () => {
  const f = setup();
  f.ready();
  f.store.record({ event: 1 });
  const flushing = f.store.flush();
  await vi.advanceTimersByTimeAsync(1000);
  await flushing;
  expect(f.health.firstFailure).toMatchObject({
    operation: 'append',
    cause: 'timeout',
    deadlineMs: 1000,
  });
  expect(f.health.dropped).toBe(1);
  const original = JSON.stringify(f.health.firstFailure);
  await f.store.close();
  f.worker!.emit('exit', 1);
  expect(JSON.stringify(f.health.firstFailure)).toBe(original);
  expect(f.observed).toHaveLength(1);
});
it.each(['sync', 'async'] as const)(
  'isolates %s observer failure from capture and shutdown',
  async (kind) => {
    const f = setup({
      observer() {
        if (kind === 'sync') throw new Error('private-observer');
        return Promise.reject(new Error('private-observer'));
      },
    });
    f.worker!.emit('error', new Error('private-source'));
    await f.store.ready;
    await Promise.resolve();
    await f.store.close();
    expect(f.health.firstFailure?.cause).toBe('worker_error');
    expect(f.observed).toHaveLength(1);
  },
);
it('does not fault on expected cursor rejection or an existing successful busy retry', async () => {
  const f = setup();
  f.ready();
  const read = f.store.rpc('query', {});
  f.reply('invalid_cursor');
  await expect(read).rejects.toThrow('invalid_cursor');
  f.store.record({ event: 1 });
  const flushing = f.store.flush();
  await Promise.resolve();
  f.reply('busy');
  await vi.advanceTimersByTimeAsync(250);
  f.reply(undefined, { ...stats, acknowledgedSequence: 1 });
  await flushing;
  expect(f.worker!.messages.filter((message) => message.type === 'append')).toHaveLength(2);
  expect(f.observed).toHaveLength(0);
  expect(f.health.state).toBe('ready');
  const closing = f.store.close();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.worker!.messages.at(-1)?.type).toBe('close');
  f.reply();
  await closing;
});
it('preserves startup timer clearing on the first message even when it is not ready', async () => {
  const f = setup();
  f.worker!.emit('message', { type: 'unrecognized' });
  await vi.advanceTimersByTimeAsync(3000);
  expect(f.health.state).toBe('starting');
  expect(f.observed).toHaveLength(0);
  f.worker!.emit('exit', 1);
  await f.store.ready;
  expect(f.health.firstFailure?.cause).toBe('worker_exit');
  await f.store.close();
});
it('distinguishes append reply and postMessage failures at existing terminal boundaries', async () => {
  for (const cause of ['worker_reply', 'post_message'] as const) {
    const f = setup();
    f.ready();
    f.worker!.postFails = cause === 'post_message';
    f.store.record({ event: 1 });
    const flushing = f.store.flush();
    await Promise.resolve();
    if (cause === 'worker_reply') f.reply('private-upstream-error');
    await flushing;
    expect(f.health.firstFailure).toMatchObject({ operation: 'append', cause });
    expect(JSON.stringify(f.observed)).not.toContain('private-upstream');
    await f.store.close();
  }
});
