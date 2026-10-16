import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import {
  DiagnosticEventSchema,
  DiagnosticScopeSchema,
  DiagnosticWindowSchema,
  type DiagnosticWindow,
  type DiagnosticWindowPage,
  type DiagnosticEvent,
  type DiagnosticStore,
  type DiagnosticHealth,
  type DiagnosticPage,
  type DiagnosticScope,
  type DiagnosticStoredEvent,
} from '@agent-platform/contracts';

function diagnosticErrorCode(reason: string): 'invalid_cursor' | 'expired_history' | 'unavailable' {
  if (reason === 'invalid_cursor') return 'invalid_cursor';
  if (reason.startsWith('expired_history:')) return 'expired_history';
  return 'unavailable';
}

export class DiagnosticStoreError extends Error {
  readonly code: 'invalid_cursor' | 'expired_history' | 'unavailable';
  readonly earliestSequence?: number;
  constructor(reason: string) {
    const code = diagnosticErrorCode(reason);
    super(code);
    this.name = 'DiagnosticStoreError';
    this.code = code;
    if (code === 'expired_history') this.earliestSequence = Number(reason.split(':')[1]) || 0;
  }
}

export type DiagnosticStoreOptions = {
  path: string;
  retentionDays?: number;
  maxEvents?: number;
  processInstanceId?: string;
};
type Stats = Pick<
  DiagnosticHealth,
  | 'pruned'
  | 'conflicts'
  | 'dropped'
  | 'acknowledgedSequence'
  | 'lastAcknowledgedAtMs'
  | 'previousShutdownUnclean'
>;
type Reply = {
  id?: number;
  type?: string;
  stats?: Stats;
  reason?: DiagnosticHealth['reason'];
  result?: unknown;
  error?: string;
};

/** A bounded observational queue. No caller awaits record(), and I/O never runs on its thread. */
export function createDiagnosticStore(options: DiagnosticStoreOptions): DiagnosticStore {
  const health: DiagnosticHealth = {
    state: 'starting',
    reason: 'none',
    pending: 0,
    dropped: 0,
    conflicts: 0,
    pruned: 0,
    acknowledgedSequence: 0,
    lastAcknowledgedAtMs: null,
    processInstanceId: options.processInstanceId ?? randomUUID(),
    previousShutdownUnclean: false,
  };
  const queue: DiagnosticEvent[] = [];
  const calls = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let worker: Worker | undefined;
  let serial = 0;
  let inflight: Promise<void> | undefined;
  let accepting = true;
  let resolveReady: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let urgentFlushScheduled = false;
  function clearScheduledFlush(): void {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = undefined;
    urgentFlushScheduled = false;
  }
  const update = (stats: Stats) => {
    if (health.state === 'closed') return;
    const dropped = Math.max(stats.dropped, health.dropped);
    Object.assign(health, stats, { dropped });
    if (health.conflicts) {
      health.state = 'degraded';
      health.reason = 'conflict';
    }
  };
  function disable(reason: DiagnosticHealth['reason']): void {
    if (health.state === 'closed') return;
    health.state = 'disabled';
    health.reason = reason;
    health.dropped += queue.length;
    queue.length = 0;
    health.pending = 0;
    clearScheduledFlush();
    for (const call of calls.values()) {
      clearTimeout(call.timer);
      call.reject(new Error(reason));
    }
    calls.clear();
    resolveReady();
  }
  function rpc(type: string, input: unknown, deadline = 200): Promise<unknown> {
    if (!worker || health.state === 'disabled' || health.state === 'closed' || calls.size >= 16)
      return Promise.reject(new Error('diagnostics_unavailable'));
    const id = ++serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        calls.delete(id);
        const reason =
          type === 'query' || type === 'queryWindow' || type === 'list'
            ? 'read_timeout'
            : 'storage_unavailable';
        reject(new Error(reason));
        disable(reason);
        void worker?.terminate();
      }, deadline);
      calls.set(id, { resolve, reject, timer });
      worker!.postMessage({ id, type, input });
    });
  }
  function schedule(): void {
    // An active append already drains the remaining queue; do not create timer/waiter storms.
    if (!accepting || inflight || health.state === 'disabled' || health.state === 'closed') return;
    const urgent = queue.length >= 32;
    if (flushTimer) {
      if (!urgent || urgentFlushScheduled) return;
      clearScheduledFlush();
    }
    urgentFlushScheduled = urgent;
    flushTimer = setTimeout(
      () => {
        flushTimer = undefined;
        urgentFlushScheduled = false;
        void flush();
      },
      urgent ? 0 : 250,
    );
    flushTimer.unref();
  }
  async function flush(): Promise<void> {
    await ready;
    if (inflight) {
      await inflight;
      if (queue.length) return flush();
      return;
    }
    if (!queue.length || health.state === 'disabled' || health.state === 'closed') return;
    clearScheduledFlush();
    const batch = queue.splice(0, 32);
    inflight = (async () => {
      try {
        let result: unknown;
        try {
          result = await rpc('append', { events: batch, dropped: health.dropped }, 1000);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'busy') throw error;
          await new Promise((resolve) => setTimeout(resolve, 250));
          result = await rpc('append', { events: batch, dropped: health.dropped }, 1000);
        }
        update(result as Stats);
      } catch (error) {
        health.dropped += batch.length;
        if (health.state === 'closed') return;
        health.state = 'degraded';
        health.reason = 'storage_unavailable';
        if (!(error instanceof Error) || error.message !== 'busy')
          disable(
            error instanceof Error && error.message === 'storage_limited'
              ? 'storage_limited'
              : 'storage_unavailable',
          );
      } finally {
        health.pending = queue.length;
        inflight = undefined;
      }
    })();
    await inflight;
    if (queue.length) await flush();
  }
  const retentionDays = options.retentionDays ?? 7;
  const maxEvents = options.maxEvents ?? 10000;
  if (
    !options.path ||
    (options.processInstanceId !== undefined &&
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(options.processInstanceId)) ||
    !Number.isInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 90 ||
    !Number.isInteger(maxEvents) ||
    maxEvents < 100 ||
    maxEvents > 100000
  ) {
    disable('invalid_configuration');
  } else {
    try {
      // The compiled entry is also used by source tests; no loader or candidate script is executed.
      const workerUrl = new URL(
        import.meta.url.endsWith('.ts') ? '../../dist/diagnostics/worker.js' : './worker.js',
        import.meta.url,
      );
      worker = new Worker(workerUrl, {
        workerData: { path: options.path, retentionDays, maxEvents },
      });
      const startup = setTimeout(() => {
        disable('storage_unavailable');
        void worker?.terminate();
      }, 3000);
      worker.once('message', () => clearTimeout(startup));
      worker.on('message', (reply: Reply) => {
        if (health.state === 'closed') return;
        if (reply.type === 'ready' && reply.stats) {
          // Local pre-ready losses are additional to counters from the previous process.
          health.dropped += reply.stats.dropped;
          update(reply.stats);
          health.state = health.dropped || health.conflicts ? 'degraded' : 'ready';
          resolveReady();
          if (queue.length) schedule();
          return;
        }
        if (reply.type === 'disabled') {
          disable(reply.reason ?? 'storage_unavailable');
          return;
        }
        const call = reply.id === undefined ? undefined : calls.get(reply.id);
        if (!call) return;
        clearTimeout(call.timer);
        calls.delete(reply.id!);
        if (reply.error) call.reject(new Error(reply.error));
        else call.resolve(reply.result);
      });
      worker.on('error', () => {
        clearTimeout(startup);
        disable('storage_unavailable');
      });
      worker.on('exit', () => {
        clearTimeout(startup);
        if (accepting) disable('storage_unavailable');
      });
    } catch {
      disable('storage_unavailable');
    }
  }
  return {
    ready,
    record(input) {
      if (!accepting || health.state === 'disabled' || health.state === 'closed') return false;
      let parsed: ReturnType<typeof DiagnosticEventSchema.safeParse>;
      try {
        parsed = DiagnosticEventSchema.safeParse(input);
      } catch {
        health.dropped++;
        health.state = 'degraded';
        health.reason = 'invalid_event';
        return false;
      }
      if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data)) > 4096) {
        health.dropped++;
        health.state = 'degraded';
        health.reason = 'invalid_event';
        return false;
      }
      if (health.pending >= 256) {
        health.dropped++;
        health.state = 'degraded';
        health.reason = 'queue_full';
        return false;
      }
      queue.push(parsed.data);
      health.pending++;
      if (health.state !== 'starting') schedule();
      return true;
    },
    flush,
    async query(scope: DiagnosticScope, input = {}): Promise<DiagnosticPage> {
      const checked = DiagnosticScopeSchema.parse(scope);
      await ready;
      let page: Omit<DiagnosticPage, 'health'> & { stats: Stats };
      try {
        page = (await rpc('query', { scope: checked, ...input })) as typeof page;
      } catch (error) {
        throw new DiagnosticStoreError(error instanceof Error ? error.message : 'unavailable');
      }
      update(page.stats);
      return {
        scope: page.scope,
        events: page.events,
        snapshotSequence: page.snapshotSequence,
        earliestSequence: page.earliestSequence,
        truncated: page.truncated,
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        health: { ...health },
      };
    },
    async queryWindow(window: DiagnosticWindow, input = {}): Promise<DiagnosticWindowPage> {
      const checked = DiagnosticWindowSchema.parse(window);
      await ready;
      let page: Omit<DiagnosticWindowPage, 'health'> & { stats: Stats };
      try {
        page = (await rpc('queryWindow', { window: checked, ...input })) as typeof page;
      } catch (error) {
        throw new DiagnosticStoreError(error instanceof Error ? error.message : 'unavailable');
      }
      update(page.stats);
      const { stats, ...result } = page;
      void stats; // Worker accounting is projected into health above, never exported separately.
      return { ...result, health: { ...health } };
    },
    async listRecent(input = {}): Promise<DiagnosticStoredEvent[]> {
      await ready;
      const result = (await rpc('list', input)) as {
        events: DiagnosticStoredEvent[];
        stats: Stats;
      };
      update(result.stats);
      return result.events;
    },
    async prune() {
      await ready;
      const stats = await rpc('prune', {});
      update(stats as Stats);
    },
    health() {
      return { ...health };
    },
    async close() {
      if (!accepting) return;
      accepting = false;
      clearScheduledFlush();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let shutdownFailure: DiagnosticHealth['reason'] | undefined;
      try {
        await Promise.race([
          (async () => {
            await flush();
            if (health.state !== 'disabled') await rpc('close', { dropped: health.dropped }, 1000);
          })(),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error('shutdown_timeout')), 1000);
          }),
        ]);
      } catch (error) {
        shutdownFailure =
          error instanceof Error && error.message === 'shutdown_timeout'
            ? 'shutdown_timeout'
            : 'storage_unavailable';
        // disable counts queued events; the in-flight append accounts for its own loss once.
        disable(shutdownFailure);
      } finally {
        if (timeout) clearTimeout(timeout);
        // Thread termination can wait on native I/O; it must not extend the shutdown deadline.
        worker?.unref();
        void worker?.terminate().catch(() => {});
        health.pending = 0;
        health.state = 'closed';
        if (shutdownFailure) health.reason = shutdownFailure;
        for (const call of calls.values()) {
          clearTimeout(call.timer);
          call.reject(new Error('closed'));
        }
        calls.clear();
      }
    },
  };
}
