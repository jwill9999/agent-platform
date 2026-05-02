import {
  appendScheduledJobRunLog,
  claimDueScheduledJobs,
  createScheduledJobRun,
  getScheduledJob,
  getScheduledJobRun,
  listExpiredRunningScheduledJobRuns,
  listScheduledJobRuns,
  transitionScheduledJobRun,
  updateScheduledJobScheduleState,
  type DrizzleDb,
} from '@agent-platform/db';
import type { ScheduledJobRecord, ScheduledJobRunRecord } from '@agent-platform/contracts';
import { createLogger } from '@agent-platform/logger';

const log = createLogger('api:scheduler');

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_LEASE_MS = 300_000;
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_CANCEL_POLL_MS = 250;

export type ScheduledJobTargetResult = {
  summary?: string;
};

export type ScheduledJobTargetContext = {
  db: DrizzleDb;
  job: ScheduledJobRecord;
  run: ScheduledJobRunRecord;
  signal: AbortSignal;
  log: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
    options?: { truncated?: boolean },
  ) => void;
};

export type ScheduledJobTargetExecutor = (
  context: ScheduledJobTargetContext,
) => Promise<ScheduledJobTargetResult> | ScheduledJobTargetResult;

export type SchedulerServiceOptions = {
  workerId?: string;
  pollIntervalMs?: number;
  leaseMs?: number;
  batchSize?: number;
  cancelPollMs?: number;
  nowMs?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  targetExecutor?: ScheduledJobTargetExecutor;
};

export type SchedulerService = {
  start: () => void;
  stop: () => void;
  runOnce: () => Promise<void>;
  isRunning: () => boolean;
};

function intervalFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldRetry(job: ScheduledJobRecord, run: ScheduledJobRunRecord): boolean {
  return run.attempt < job.retryPolicy.maxAttempts;
}

function nextRunAfterSuccess(job: ScheduledJobRecord, nowMs: number): number | null {
  if (job.scheduleType !== 'recurring') return null;
  if (job.intervalMs) return nowMs + job.intervalMs;
  return null;
}

function nextRunAfterFailure(job: ScheduledJobRecord, nowMs: number): number {
  return nowMs + job.retryPolicy.backoffMs;
}

function nextAttemptForJob(db: DrizzleDb, jobId: string): number {
  const runs = listScheduledJobRuns(db, { jobId, limit: 500, offset: 0 });
  return runs.reduce((max, run) => Math.max(max, run.attempt), 0) + 1;
}

async function runWithAbortSignal<T>(signal: AbortSignal, task: Promise<T>): Promise<T> {
  if (signal.aborted) throw signal.reason;

  let removeAbortListener = () => {};
  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener('abort', onAbort);
  });
  task.catch(() => {
    /* Avoid unhandled rejection if the abort wins the race first. */
  });
  try {
    return await Promise.race([task, abortPromise]);
  } finally {
    removeAbortListener();
  }
}

async function defaultTargetExecutor({
  job,
  log: appendLog,
}: ScheduledJobTargetContext): Promise<ScheduledJobTargetResult> {
  if (job.targetKind !== 'built_in_task') {
    throw new Error(`Unsupported scheduled job target kind: ${job.targetKind}`);
  }

  const task =
    typeof job.targetPayload['task'] === 'string' ? job.targetPayload['task'] : 'scheduler.noop';
  if (task !== 'scheduler.noop' && task !== 'noop') {
    throw new Error(`Unsupported built-in scheduled task: ${task}`);
  }

  appendLog('info', 'Built-in scheduler no-op task completed.', { task });
  return { summary: 'Built-in scheduler no-op task completed.' };
}

function createAbortController(
  run: ScheduledJobRunRecord,
  options: Required<Pick<SchedulerServiceOptions, 'setTimeoutFn' | 'clearTimeoutFn'>>,
  timeoutMs: number,
): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeoutId = options.setTimeoutFn(() => {
    controller.abort(new Error(`Scheduled job run timed out: ${run.id}`));
  }, timeoutMs);
  return { controller, timeoutId };
}

export function createSchedulerService(
  db: DrizzleDb,
  options: SchedulerServiceOptions = {},
): SchedulerService {
  const workerId = options.workerId ?? `api-scheduler-${process.pid}`;
  const pollIntervalMs =
    options.pollIntervalMs ??
    intervalFromEnv('SCHEDULER_POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS);
  const leaseMs = options.leaseMs ?? intervalFromEnv('SCHEDULER_LEASE_MS', DEFAULT_LEASE_MS);
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const cancelPollMs = options.cancelPollMs ?? DEFAULT_CANCEL_POLL_MS;
  const nowMs = options.nowMs ?? Date.now;
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const targetExecutor = options.targetExecutor ?? defaultTargetExecutor;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let running = false;

  function appendRunLog(
    runId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data: Record<string, unknown> = {},
    logOptions: { truncated?: boolean } = {},
  ) {
    appendScheduledJobRunLog(
      db,
      { runId, level, message, data, truncated: logOptions.truncated ?? false },
      { nowMs: nowMs() },
    );
  }

  async function recoverExpiredRuns(): Promise<void> {
    for (const run of listExpiredRunningScheduledJobRuns(db, {
      nowMs: nowMs(),
      limit: batchSize,
    })) {
      const currentNowMs = nowMs();
      const failed = transitionScheduledJobRun(db, run.id, 'failed', {
        nowMs: currentNowMs,
        errorCode: 'SCHEDULER_LEASE_EXPIRED',
        errorMessage: 'Scheduled job run lease expired before completion.',
      });
      appendRunLog(run.id, 'error', 'Scheduled job run lease expired.', {
        runId: run.id,
        leaseOwner: run.leaseOwner,
        leaseExpiresAtMs: run.leaseExpiresAtMs,
      });
      const job = getScheduledJob(db, run.jobId);
      const retry = shouldRetry(job, failed);
      const nextRunAtMs = retry ? nextRunAfterFailure(job, currentNowMs) : null;
      updateScheduledJobScheduleState(db, job.id, {
        status: retry ? 'enabled' : 'paused',
        nextRunAtMs,
        clearLease: true,
        nowMs: currentNowMs,
      });
      appendRunLog(
        run.id,
        retry ? 'warn' : 'error',
        retry ? 'Scheduled job retry scheduled.' : 'Scheduled job retries exhausted.',
        { nextRunAtMs, attempt: failed.attempt, maxAttempts: job.retryPolicy.maxAttempts },
      );
    }
  }

  async function runJob(job: ScheduledJobRecord): Promise<void> {
    const attempt = nextAttemptForJob(db, job.id);
    let run = createScheduledJobRun(
      db,
      {
        jobId: job.id,
        status: 'queued',
        attempt,
        leaseOwner: workerId,
        leaseExpiresAtMs: nowMs() + Math.max(job.timeoutMs, leaseMs),
        metadata: {},
      },
      { nowMs: nowMs() },
    );
    appendRunLog(run.id, 'info', 'Scheduled job run claimed.', {
      jobId: job.id,
      workerId,
      attempt,
      leaseExpiresAtMs: run.leaseExpiresAtMs,
    });
    run = transitionScheduledJobRun(db, run.id, 'running', {
      nowMs: nowMs(),
      leaseOwner: workerId,
      leaseExpiresAtMs: nowMs() + Math.max(job.timeoutMs, leaseMs),
    });

    const { controller, timeoutId } = createAbortController(
      run,
      { setTimeoutFn, clearTimeoutFn },
      job.timeoutMs,
    );
    const cancelIntervalId = setIntervalFn(() => {
      const latest = getScheduledJobRun(db, run.id);
      if (latest.cancelRequestedAtMs && !controller.signal.aborted) {
        controller.abort(new Error(`Scheduled job run cancelled: ${run.id}`));
      }
    }, cancelPollMs);

    const appendLog = (
      level: 'debug' | 'info' | 'warn' | 'error',
      message: string,
      data: Record<string, unknown> = {},
      logOptions: { truncated?: boolean } = {},
    ) => appendRunLog(run.id, level, message, data, logOptions);

    try {
      appendLog('info', 'Scheduled job run started.', { jobId: job.id, attempt });
      const result = await runWithAbortSignal(
        controller.signal,
        Promise.resolve(
          targetExecutor({ db, job, run, signal: controller.signal, log: appendLog }),
        ),
      );
      clearTimeoutFn(timeoutId);
      clearIntervalFn(cancelIntervalId);
      run = transitionScheduledJobRun(db, run.id, 'succeeded', {
        nowMs: nowMs(),
        resultSummary: result.summary ?? 'Scheduled job completed.',
      });
      appendLog('info', 'Scheduled job run succeeded.', {
        runId: run.id,
        resultSummary: run.resultSummary,
      });
      const nextRunAtMs = nextRunAfterSuccess(job, nowMs());
      updateScheduledJobScheduleState(db, job.id, {
        status: nextRunAtMs === null ? 'archived' : 'enabled',
        nextRunAtMs,
        clearLease: true,
        nowMs: nowMs(),
      });
    } catch (error) {
      clearTimeoutFn(timeoutId);
      clearIntervalFn(cancelIntervalId);
      const latest = getScheduledJobRun(db, run.id);
      if (latest.cancelRequestedAtMs) {
        transitionScheduledJobRun(db, run.id, 'cancelled', {
          nowMs: nowMs(),
          errorCode: 'SCHEDULER_RUN_CANCELLED',
          errorMessage: 'Scheduled job run was cancelled.',
        });
        appendLog('warn', 'Scheduled job run cancelled.', { runId: run.id });
        updateScheduledJobScheduleState(db, job.id, {
          status: 'paused',
          nextRunAtMs: null,
          clearLease: true,
          nowMs: nowMs(),
        });
        return;
      }

      const code = controller.signal.aborted ? 'SCHEDULER_RUN_TIMEOUT' : 'SCHEDULER_RUN_FAILED';
      run = transitionScheduledJobRun(db, run.id, 'failed', {
        nowMs: nowMs(),
        errorCode: code,
        errorMessage: errorMessage(error),
      });
      appendLog('error', 'Scheduled job run failed.', {
        runId: run.id,
        error: errorMessage(error),
      });
      if (shouldRetry(job, run)) {
        const nextRunAtMs = nextRunAfterFailure(job, nowMs());
        updateScheduledJobScheduleState(db, job.id, {
          status: 'enabled',
          nextRunAtMs,
          clearLease: true,
          nowMs: nowMs(),
        });
        appendLog('warn', 'Scheduled job retry scheduled.', {
          runId: run.id,
          nextRunAtMs,
          attempt: run.attempt,
          maxAttempts: job.retryPolicy.maxAttempts,
        });
      } else {
        updateScheduledJobScheduleState(db, job.id, {
          status: 'paused',
          nextRunAtMs: null,
          clearLease: true,
          nowMs: nowMs(),
        });
        appendLog('error', 'Scheduled job retries exhausted.', {
          runId: run.id,
          attempt: run.attempt,
          maxAttempts: job.retryPolicy.maxAttempts,
        });
      }
    }
  }

  async function runOnce(): Promise<void> {
    if (running) return;
    running = true;
    try {
      await recoverExpiredRuns();
      const jobs = claimDueScheduledJobs(db, {
        workerId,
        nowMs: nowMs(),
        leaseMs,
        limit: batchSize,
      });
      for (const job of jobs) {
        await runJob(job);
      }
    } catch (error) {
      log.error('scheduler.tick_failed', { error: errorMessage(error) });
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (intervalId) return;
      intervalId = setIntervalFn(() => void runOnce(), pollIntervalMs);
      intervalId.unref?.();
      void runOnce();
    },
    stop() {
      if (!intervalId) return;
      clearIntervalFn(intervalId);
      intervalId = undefined;
    },
    runOnce,
    isRunning: () => running,
  };
}
