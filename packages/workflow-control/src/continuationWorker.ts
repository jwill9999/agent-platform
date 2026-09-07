import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { z } from 'zod';

import {
  ContinuationJournal,
  continuationSignal,
  type ContinuationJob,
} from './continuationJournal.js';

export type ParentExecutionObservation =
  | { status: 'missing' | 'busy' | 'unavailable' }
  | { status: 'accepted' | 'started' | 'consumed'; executionId: string };

/** The adapter must bind every retry to job.host_execution_id, and honour the abort signal.
 * A message receipt is only accepted. started/consumed require evidence from the executing parent.
 * Consuming requires an atomic durable next action through ContinuationJournal.consume.
 */
export interface AsyncParentExecutionHost {
  observe(job: ContinuationJob, signal: AbortSignal): Promise<ParentExecutionObservation>;
  start(job: ContinuationJob, signal: AbortSignal): Promise<ParentExecutionObservation>;
}

export interface ContinuationWorkerOptions {
  pollIntervalMs: number;
  overdueThresholdMs: number;
  leaseTtlMs: number;
  hostTimeoutMs: number;
  maxAttempts: number;
  deadlineMs: number;
}

export const DEFAULT_CONTINUATION_OPTIONS: ContinuationWorkerOptions = {
  pollIntervalMs: 1_000,
  overdueThresholdMs: 30_000,
  leaseTtlMs: 30_000,
  hostTimeoutMs: 5_000,
  maxAttempts: 10,
  deadlineMs: 300_000,
};

/** Runnable coordinator: callback signal first, independent startup/timer watchdog second. */
export class ContinuationWorker {
  readonly #owner = randomUUID();
  readonly #options: ContinuationWorkerOptions;
  #timer: ReturnType<typeof setInterval> | undefined;
  #running = false;
  #stopped = false;
  readonly #idleWaiters: Array<() => void> = [];
  readonly #signal = () => {
    void this.tick().catch(this.reportError);
  };

  constructor(
    readonly journal: ContinuationJournal,
    readonly host: AsyncParentExecutionHost,
    options: Partial<ContinuationWorkerOptions> = {},
    readonly clock: () => number = Date.now,
    readonly reportError: (error: unknown) => void = (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    },
  ) {
    this.#options = { ...DEFAULT_CONTINUATION_OPTIONS, ...options };
    for (const value of Object.values(this.#options)) {
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error('invalid continuation worker timing');
    }
    if (this.#options.hostTimeoutMs >= this.#options.leaseTtlMs) {
      throw new Error('host timeout must be shorter than the continuation lease');
    }
  }

  async start(): Promise<void> {
    if (this.#timer !== undefined) return;
    this.#stopped = false;
    continuationSignal.on('ready', this.#signal);
    this.#timer = setInterval(this.#signal, this.#options.pollIntervalMs);
    await this.tick();
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    continuationSignal.off('ready', this.#signal);
    if (this.#running) await new Promise<void>((resolve) => this.#idleWaiters.push(resolve));
  }

  async tick(): Promise<void> {
    if (this.#running || this.#stopped) return;
    this.#running = true;
    try {
      this.journal.reconcileMissingIntents(this.clock());
      this.journal.reconcileOverdue(this.clock(), this.#options.overdueThresholdMs);
      this.journal.reconcileDeadlines(this.clock(), this.#options.deadlineMs);
      // A bounded batch prevents one workspace from monopolizing the supervisor.
      for (let count = 0; count < 100; count += 1) {
        if (this.#stopped) break;
        const job = this.journal.claim(this.#owner, this.#options.leaseTtlMs, this.clock());
        if (job === undefined) break;
        await this.#reconcile(job);
      }
    } finally {
      this.#running = false;
      for (const resolve of this.#idleWaiters.splice(0)) resolve();
    }
  }

  async #reconcile(job: ContinuationJob): Promise<void> {
    const now = this.clock();
    const age = now - job.created_at_ms;
    if (age >= this.#options.overdueThresholdMs) this.journal.overdue(job, now);
    if (job.attempts > this.#options.maxAttempts || age >= this.#options.deadlineMs) {
      this.journal.block(job, 'host_resume_unavailable', now);
      return;
    }
    if (job.callback_json === null && age < this.#options.overdueThresholdMs) {
      this.journal.release(job, now + this.#options.pollIntervalMs, now, false);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error('host observation timed out')),
      this.#options.hostTimeoutMs,
    );
    try {
      const observation = await this.#withinDeadline(
        this.host.observe(job, controller.signal),
        controller.signal,
      );
      this.journal.reconcileDeadlines(this.clock(), this.#options.deadlineMs);
      this.#assertDispatchFence(job);
      const result =
        observation.status === 'missing'
          ? await this.#withinDeadline(this.host.start(job, controller.signal), controller.signal)
          : observation;
      if (result.status === 'unavailable') {
        this.journal.block(job, 'host_resume_unavailable', this.clock());
      } else if ('executionId' in result) {
        if (result.executionId !== job.host_execution_id)
          throw new Error('host execution identity mismatch');
        if (result.status === 'consumed' && this.journal.get(job.id)?.status !== 'consumed') {
          throw new Error('host claimed consumption without durable next action');
        }
        this.journal.accepted(job, this.clock());
        // Retain the lease while a parent may be running. A later watchdog adopts expired work.
      } else {
        this.journal.release(job, this.clock() + this.#options.pollIntervalMs, this.clock());
      }
    } catch (error) {
      this.reportError(error);
      // Response loss is ambiguous: retain the lease and reconcile the same execution identity.
    } finally {
      clearTimeout(timeout);
    }
  }

  #assertDispatchFence(job: ContinuationJob): void {
    const current = this.journal.get(job.id);
    if (
      current?.status === 'blocked' ||
      current?.lease_epoch !== job.lease_epoch ||
      (current?.status !== 'consumed' &&
        (current?.lease_owner !== job.lease_owner || current.lease_until_ms <= this.clock()))
    ) {
      throw new Error('continuation supervisor fence rejected before host dispatch');
    }
  }

  #withinDeadline<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      if (signal.aborted) abort();
    });
  }
}

/** Concrete autonomous local parent process. Its built-in handler only enters visible blockers
 * or preserves a validated approval wait; it cannot impersonate a Codex desktop conversation.
 */
export function createProcessParentExecutionHost(databasePath: string): AsyncParentExecutionHost {
  return {
    async observe(job) {
      const journal = new ContinuationJournal(databasePath);
      try {
        const current = journal.get(job.id);
        if (current?.status === 'consumed') {
          return { status: 'consumed', executionId: current.host_execution_id! };
        }
        if (current?.lease_epoch !== job.lease_epoch) return { status: 'unavailable' };
        if (current.status === 'started') {
          return { status: 'started', executionId: current.host_execution_id! };
        }
        return { status: 'missing' };
      } finally {
        journal.close();
      }
    },
    async start(job) {
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(new URL('./continuationProcess.js', import.meta.url)),
          databasePath,
          job.id,
          job.host_execution_id!,
          String(job.lease_epoch),
        ],
        {
          stdio: 'ignore',
          env: { PATH: process.env.PATH },
        },
      );
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
      child.unref();
      return { status: 'accepted', executionId: job.host_execution_id! };
    },
  };
}

const hostObservationSchema = z.union([
  z.object({ status: z.enum(['missing', 'busy', 'unavailable']) }).strict(),
  z
    .object({ status: z.enum(['accepted', 'started', 'consumed']), executionId: z.string().min(1) })
    .strict(),
]);

/** Async command adapter for host integrations. A host must actually start the bound parent and
 * write its start/consumption acknowledgement; merely delivering a message is not conformance.
 */
export function createCommandParentExecutionHost(
  binary: string,
  args: string[] = [],
): AsyncParentExecutionHost {
  if (!isAbsolute(binary)) throw new Error('parent host executable must be absolute');
  const invoke = async (operation: string, job: ContinuationJob, signal: AbortSignal) => {
    const result = await promisify(execFile)(binary, [...args, operation, JSON.stringify(job)], {
      signal,
      maxBuffer: 1024 * 1024,
      env: { PATH: process.env.PATH },
    });
    return hostObservationSchema.parse(JSON.parse(result.stdout));
  };
  return {
    observe: (job, signal) => invoke('observe', job, signal),
    start: (job, signal) => invoke('start', job, signal),
  };
}

export function assertDesktopHostConformance(): never {
  throw new Error(
    'host_resume_unavailable: no conformant Codex desktop execution adapter is installed; autonomous desktop progression release gate FAILED',
  );
}
