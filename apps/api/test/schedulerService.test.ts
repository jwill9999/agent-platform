import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  closeDatabase,
  createScheduledJob,
  createScheduledJobRun,
  getScheduledJob,
  listScheduledJobRunLogs,
  listScheduledJobRuns,
  openDatabase,
  requestScheduledJobRunCancellation,
  transitionScheduledJobRun,
} from '@agent-platform/db';
import type { ScheduledJobCreateBody } from '@agent-platform/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSchedulerService,
  type ScheduledJobTargetExecutor,
} from '../src/application/scheduler/schedulerService.js';

type OpenedDatabase = ReturnType<typeof openDatabase>;

function dueJob(overrides: Partial<ScheduledJobCreateBody> = {}): ScheduledJobCreateBody {
  return {
    scope: 'global',
    name: 'Scheduler test job',
    instructions: 'Run a scheduler test job.',
    targetKind: 'built_in_task',
    targetPayload: { task: 'scheduler.noop' },
    scheduleType: 'one_off',
    runAtMs: 1_000,
    nextRunAtMs: 1_000,
    status: 'enabled',
    timeoutMs: 1_000,
    ...overrides,
  };
}

describe('scheduler service', () => {
  let opened: OpenedDatabase;
  let tmpDir: string;
  let nowMs: number;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-scheduler-service-'));
    opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    nowMs = 1_000;
  });

  afterEach(() => {
    vi.useRealTimers();
    closeDatabase(opened.sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs a due built-in job and archives one-off schedules', async () => {
    createScheduledJob(opened.db, dueJob(), { id: 'job-1', nowMs: 500 });
    const service = createSchedulerService(opened.db, {
      workerId: 'worker-1',
      nowMs: () => nowMs,
    });

    await service.runOnce();

    const [run] = listScheduledJobRuns(opened.db, { jobId: 'job-1' });
    expect(run).toMatchObject({ status: 'succeeded', attempt: 1 });
    expect(getScheduledJob(opened.db, 'job-1')).toMatchObject({
      status: 'archived',
      nextRunAtMs: undefined,
      leaseOwner: undefined,
    });
    expect(listScheduledJobRunLogs(opened.db, run!.id).map((log) => log.message)).toEqual([
      'Scheduled job run started.',
      'Built-in scheduler no-op task completed.',
      'Scheduled job run succeeded.',
    ]);
  });

  it('does not run due jobs while another worker holds a valid lease', async () => {
    createScheduledJob(opened.db, dueJob({ leaseOwner: 'other-worker', leaseExpiresAtMs: 2_000 }), {
      id: 'job-1',
      nowMs: 500,
    });
    const service = createSchedulerService(opened.db, {
      workerId: 'worker-1',
      nowMs: () => nowMs,
    });

    await service.runOnce();
    expect(listScheduledJobRuns(opened.db, { jobId: 'job-1' })).toEqual([]);

    nowMs = 2_001;
    await service.runOnce();
    expect(listScheduledJobRuns(opened.db, { jobId: 'job-1' })).toHaveLength(1);
  });

  it('applies retry backoff and succeeds on a later attempt', async () => {
    createScheduledJob(opened.db, dueJob({ retryPolicy: { maxAttempts: 2, backoffMs: 500 } }), {
      id: 'job-1',
      nowMs: 500,
    });
    let calls = 0;
    const executor: ScheduledJobTargetExecutor = () => {
      calls += 1;
      if (calls === 1) throw new Error('temporary failure');
      return { summary: 'retry passed' };
    };
    const service = createSchedulerService(opened.db, {
      workerId: 'worker-1',
      nowMs: () => nowMs,
      targetExecutor: executor,
    });

    await service.runOnce();
    expect(getScheduledJob(opened.db, 'job-1')).toMatchObject({
      status: 'enabled',
      nextRunAtMs: 1_500,
    });

    nowMs = 1_499;
    await service.runOnce();
    expect(listScheduledJobRuns(opened.db, { jobId: 'job-1' })).toHaveLength(1);

    nowMs = 1_500;
    await service.runOnce();
    expect(listScheduledJobRuns(opened.db, { jobId: 'job-1' }).map((run) => run.status)).toEqual([
      'succeeded',
      'failed',
    ]);
    expect(getScheduledJob(opened.db, 'job-1').status).toBe('archived');
  });

  it('marks timed-out jobs failed and pauses them when retries are exhausted', async () => {
    createScheduledJob(opened.db, dueJob({ timeoutMs: 10 }), { id: 'job-1', nowMs: 500 });
    const executor: ScheduledJobTargetExecutor = ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('timeout observed')), {
          once: true,
        });
      });
    const service = createSchedulerService(opened.db, {
      workerId: 'worker-1',
      nowMs: () => nowMs,
      targetExecutor: executor,
    });

    await service.runOnce();

    const [run] = listScheduledJobRuns(opened.db, { jobId: 'job-1' });
    expect(run).toMatchObject({ status: 'failed', errorCode: 'SCHEDULER_RUN_TIMEOUT' });
    expect(getScheduledJob(opened.db, 'job-1')).toMatchObject({
      status: 'paused',
      nextRunAtMs: undefined,
      leaseOwner: undefined,
    });
  });

  it('cancels a running job and clears its lease', async () => {
    createScheduledJob(opened.db, dueJob({ timeoutMs: 1_000 }), { id: 'job-1', nowMs: 500 });
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const executor: ScheduledJobTargetExecutor = ({ signal }) =>
      new Promise((_, reject) => {
        started();
        signal.addEventListener('abort', () => reject(new Error('cancel observed')), {
          once: true,
        });
      });
    const service = createSchedulerService(opened.db, {
      workerId: 'worker-1',
      nowMs: () => nowMs,
      cancelPollMs: 1,
      targetExecutor: executor,
    });

    const runPromise = service.runOnce();
    await startedPromise;
    const [running] = listScheduledJobRuns(opened.db, { jobId: 'job-1', status: 'running' });
    requestScheduledJobRunCancellation(opened.db, running!.id, nowMs);
    await runPromise;

    const [run] = listScheduledJobRuns(opened.db, { jobId: 'job-1' });
    expect(run).toMatchObject({ status: 'cancelled', errorCode: 'SCHEDULER_RUN_CANCELLED' });
    expect(getScheduledJob(opened.db, 'job-1')).toMatchObject({
      status: 'paused',
      leaseOwner: undefined,
    });
  });

  it('recovers expired running leases and schedules a retry when attempts remain', async () => {
    createScheduledJob(opened.db, dueJob({ retryPolicy: { maxAttempts: 2, backoffMs: 250 } }), {
      id: 'job-1',
      nowMs: 500,
    });
    const run = createScheduledJobRun(
      opened.db,
      {
        jobId: 'job-1',
        status: 'queued',
        attempt: 1,
        leaseOwner: 'dead-worker',
        leaseExpiresAtMs: 900,
        metadata: {},
      },
      { id: 'run-1', nowMs: 700 },
    );
    transitionScheduledJobRun(opened.db, run.id, 'running', {
      nowMs: 800,
      leaseOwner: 'dead-worker',
      leaseExpiresAtMs: 900,
    });

    const service = createSchedulerService(opened.db, {
      workerId: 'worker-1',
      nowMs: () => nowMs,
    });

    await service.runOnce();

    expect(listScheduledJobRuns(opened.db, { jobId: 'job-1' })[0]).toMatchObject({
      status: 'failed',
      errorCode: 'SCHEDULER_LEASE_EXPIRED',
    });
    expect(getScheduledJob(opened.db, 'job-1')).toMatchObject({
      status: 'enabled',
      nextRunAtMs: 1_250,
      leaseOwner: undefined,
    });
  });
});
