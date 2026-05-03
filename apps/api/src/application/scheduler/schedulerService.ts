import {
  appendScheduledJobRunLog,
  claimDueScheduledJobs,
  cleanupExpiredMemories,
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

export type ScheduledJobNotificationKind =
  | 'scheduler.job_succeeded'
  | 'scheduler.job_failed'
  | 'scheduler.job_cancelled'
  | 'scheduler.job_retry_exhausted';

export type ScheduledJobNotificationEvent = {
  kind: ScheduledJobNotificationKind;
  level: 'info' | 'warn' | 'error';
  jobId: string;
  jobName: string;
  runId: string;
  runStatus: ScheduledJobRunRecord['status'];
  attempt: number;
  maxAttempts: number;
  message: string;
  atMs: number;
  summary?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type ScheduledJobTargetContext = {
  db: DrizzleDb;
  job: ScheduledJobRecord;
  run: ScheduledJobRunRecord;
  signal: AbortSignal;
  nowMs: () => number;
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
  onNotification?: (event: ScheduledJobNotificationEvent) => void | Promise<void>;
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

function stringPayload(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberPayload(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined;
}

function memoryCleanupScope(
  value: unknown,
): 'global' | 'project' | 'agent' | 'session' | undefined {
  return value === 'global' || value === 'project' || value === 'agent' || value === 'session'
    ? value
    : undefined;
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
  db,
  job,
  log: appendLog,
  nowMs,
}: ScheduledJobTargetContext): Promise<ScheduledJobTargetResult> {
  if (job.targetKind !== 'built_in_task') {
    throw new Error(`Unsupported scheduled job target kind: ${job.targetKind}`);
  }

  const task =
    typeof job.targetPayload['task'] === 'string' ? job.targetPayload['task'] : 'scheduler.noop';
  if (task === 'scheduler.noop' || task === 'noop') {
    appendLog('info', 'Built-in scheduler no-op task completed.', { task });
    return { summary: 'Built-in scheduler no-op task completed.' };
  }

  if (task === 'memory.cleanup_expired.dry_run') {
    const scope = memoryCleanupScope(job.targetPayload['scope']);
    const scopeId = stringPayload(job.targetPayload['scopeId']);
    const result = cleanupExpiredMemories(
      db,
      {
        scope,
        scopeId,
        beforeMs: numberPayload(job.targetPayload['beforeMs']),
        dryRun: true,
      },
      { nowMs: nowMs() },
    );
    const data: Record<string, unknown> = {
      task,
      scope: scope ?? 'all',
      beforeMs: result.beforeMs,
      matched: result.matched,
      deleted: result.deleted,
      dryRun: result.dryRun,
    };
    if (scopeId) data.scopeId = scopeId;
    appendLog('info', 'Expired memory cleanup dry-run completed.', {
      ...data,
    });
    return {
      summary: `Expired memory cleanup dry-run matched ${result.matched} records.`,
    };
  }

  throw new Error(`Unsupported built-in scheduled task: ${task}`);
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
  const onNotification = options.onNotification;
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

  async function emitNotification(event: ScheduledJobNotificationEvent): Promise<void> {
    appendRunLog(event.runId, event.level, `Notification: ${event.message}`, {
      notification: event,
    });
    if (!onNotification) return;
    try {
      await onNotification(event);
    } catch (error) {
      const message = errorMessage(error);
      log.warn('scheduler.notification_failed', {
        jobId: event.jobId,
        runId: event.runId,
        kind: event.kind,
        error: message,
      });
      appendRunLog(event.runId, 'warn', 'Scheduler notification hook failed.', {
        notificationKind: event.kind,
        error: message,
      });
    }
  }

  async function notifyRun(
    kind: ScheduledJobNotificationKind,
    level: ScheduledJobNotificationEvent['level'],
    job: ScheduledJobRecord,
    run: ScheduledJobRunRecord,
    message: string,
  ): Promise<void> {
    const event: ScheduledJobNotificationEvent = {
      kind,
      level,
      jobId: job.id,
      jobName: job.name,
      runId: run.id,
      runStatus: run.status,
      attempt: run.attempt,
      maxAttempts: job.retryPolicy.maxAttempts,
      message,
      atMs: nowMs(),
    };
    if (run.resultSummary) event.summary = run.resultSummary;
    if (run.errorCode) event.errorCode = run.errorCode;
    if (run.errorMessage) event.errorMessage = run.errorMessage;
    await emitNotification(event);
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
      if (!retry) {
        await notifyRun(
          'scheduler.job_retry_exhausted',
          'error',
          job,
          failed,
          'Scheduled job retries exhausted after lease recovery.',
        );
      }
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
          targetExecutor({ db, job, run, signal: controller.signal, nowMs, log: appendLog }),
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
      await notifyRun(
        'scheduler.job_succeeded',
        'info',
        job,
        run,
        'Scheduled job completed successfully.',
      );
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
        const cancelled = transitionScheduledJobRun(db, run.id, 'cancelled', {
          nowMs: nowMs(),
          errorCode: 'SCHEDULER_RUN_CANCELLED',
          errorMessage: 'Scheduled job run was cancelled.',
        });
        appendLog('warn', 'Scheduled job run cancelled.', { runId: run.id });
        await notifyRun(
          'scheduler.job_cancelled',
          'warn',
          job,
          cancelled,
          'Scheduled job run was cancelled.',
        );
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
      await notifyRun('scheduler.job_failed', 'error', job, run, 'Scheduled job run failed.');
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
        await notifyRun(
          'scheduler.job_retry_exhausted',
          'error',
          job,
          run,
          'Scheduled job retries exhausted.',
        );
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
