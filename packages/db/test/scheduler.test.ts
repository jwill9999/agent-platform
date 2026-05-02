import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import { createProject } from '../src/repositories/projects.js';
import { createSession, replaceAgent } from '../src/repositories/registry.js';
import {
  appendScheduledJobRunLog,
  createScheduledJob,
  createScheduledJobRun,
  getScheduledJob,
  listScheduledJobRunLogs,
  listScheduledJobRuns,
  listScheduledJobs,
  ScheduledJobTransitionError,
  setScheduledJobStatus,
  transitionScheduledJobRun,
  updateScheduledJob,
} from '../src/repositories/scheduler.js';

type JobInput = Parameters<typeof createScheduledJob>[1];

function baseJob(overrides: Partial<JobInput> = {}): JobInput {
  return {
    scope: 'project',
    scopeId: 'project-1',
    projectId: 'project-1',
    executionAgentId: 'agent-1',
    name: 'Nightly quality checks',
    instructions: 'Run the project quality checks and summarize failures.',
    targetKind: 'agent_turn',
    targetPayload: { prompt: 'Run quality checks' },
    scheduleType: 'recurring',
    intervalMs: 86_400_000,
    nextRunAtMs: 2_000,
    status: 'paused',
    ...overrides,
  };
}

describe('scheduler repository', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;
  let sessionId: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-scheduler-'));
    const opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    db = opened.db;
    sqlite = opened.sqlite;

    replaceAgent(db, {
      id: 'agent-1',
      slug: 'agent-1',
      name: 'Test Agent',
      systemPrompt: 'sys',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    createProject(db, { name: 'Project One' }, { id: 'project-1', nowMs: 1_000 });
    sessionId = createSession(db, { agentId: 'agent-1', projectId: 'project-1' }).id;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates, reads, updates, lists, pauses, and enables project jobs', () => {
    const created = createScheduledJob(db, baseJob({ createdFromSessionId: sessionId }), {
      id: 'job-1',
      nowMs: 1_000,
    });

    expect(created).toMatchObject({
      id: 'job-1',
      scope: 'project',
      scopeId: 'project-1',
      projectId: 'project-1',
      executionAgentId: 'agent-1',
      createdFromSessionId: sessionId,
      status: 'paused',
      nextRunAtMs: 2_000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    });
    expect(getScheduledJob(db, 'job-1')).toEqual(created);
    expect(listScheduledJobs(db, { scope: 'project', scopeId: 'project-1' })).toHaveLength(1);
    expect(listScheduledJobs(db, { projectId: 'project-1', dueBeforeMs: 2_000 })).toHaveLength(1);

    const updated = updateScheduledJob(
      db,
      'job-1',
      {
        name: 'Daily quality checks',
        description: 'Runs once per day.',
        retryPolicy: { maxAttempts: 3, backoffMs: 60_000 },
        metadata: { owner: 'platform' },
      },
      2_000,
    );
    expect(updated.name).toBe('Daily quality checks');
    expect(updated.description).toBe('Runs once per day.');
    expect(updated.retryPolicy.maxAttempts).toBe(3);
    expect(updated.metadata).toEqual({ owner: 'platform' });

    expect(setScheduledJobStatus(db, 'job-1', 'enabled', 3_000).status).toBe('enabled');
    expect(setScheduledJobStatus(db, 'job-1', 'paused', 4_000).status).toBe('paused');
  });

  it('supports global, agent, and session ownership without requiring projects', () => {
    createScheduledJob(
      db,
      baseJob({
        scope: 'global',
        scopeId: undefined,
        projectId: undefined,
        executionAgentId: undefined,
        scheduleType: 'one_off',
        intervalMs: undefined,
        runAtMs: 5_000,
        name: 'Global cleanup',
        targetKind: 'built_in_task',
      }),
      { id: 'global-job', nowMs: 1_000 },
    );
    createScheduledJob(
      db,
      baseJob({
        scope: 'agent',
        scopeId: 'agent-1',
        projectId: undefined,
        ownerAgentId: 'agent-1',
        name: 'Agent reminder',
      }),
      { id: 'agent-job', nowMs: 1_000 },
    );
    createScheduledJob(
      db,
      baseJob({
        scope: 'session',
        scopeId: sessionId,
        projectId: undefined,
        ownerSessionId: sessionId,
        name: 'Session follow-up',
      }),
      { id: 'session-job', nowMs: 1_000 },
    );

    expect(listScheduledJobs(db, { scope: 'global' }).map((job) => job.id)).toEqual(['global-job']);
    expect(listScheduledJobs(db, { ownerAgentId: 'agent-1' }).map((job) => job.id)).toEqual([
      'agent-job',
    ]);
    expect(listScheduledJobs(db, { ownerSessionId: sessionId }).map((job) => job.id)).toEqual([
      'session-job',
    ]);
  });

  it('rejects inconsistent ownership and schedule combinations', () => {
    expect(() =>
      createScheduledJob(
        db,
        baseJob({ scope: 'project', scopeId: 'project-1', projectId: undefined }),
        { id: 'bad-project' },
      ),
    ).toThrow();
    expect(() =>
      createScheduledJob(
        db,
        baseJob({
          scope: 'agent',
          scopeId: 'agent-1',
          ownerAgentId: undefined,
          projectId: undefined,
        }),
        { id: 'bad-agent' },
      ),
    ).toThrow();
    expect(() =>
      createScheduledJob(
        db,
        baseJob({
          scope: 'global',
          scopeId: undefined,
          projectId: undefined,
          scheduleType: 'recurring',
          intervalMs: undefined,
          cronExpression: undefined,
        }),
        { id: 'bad-schedule' },
      ),
    ).toThrow();
  });

  it('creates runs, enforces run transitions, updates terminal job timestamps, and logs output', () => {
    createScheduledJob(db, baseJob(), { id: 'job-1', nowMs: 1_000 });
    const run = createScheduledJobRun(
      db,
      { jobId: 'job-1', leaseOwner: 'worker-1', leaseExpiresAtMs: 2_000 },
      { id: 'run-1', nowMs: 1_500 },
    );
    expect(run).toMatchObject({
      id: 'run-1',
      jobId: 'job-1',
      status: 'queued',
      attempt: 1,
      leaseOwner: 'worker-1',
    });

    const running = transitionScheduledJobRun(db, 'run-1', 'running', {
      nowMs: 2_000,
      leaseOwner: 'worker-1',
      leaseExpiresAtMs: 3_000,
    });
    expect(running.status).toBe('running');
    expect(running.startedAtMs).toBe(2_000);

    const firstLog = appendScheduledJobRunLog(
      db,
      { runId: 'run-1', level: 'info', message: 'Started', data: { step: 1 } },
      { id: 'log-1', nowMs: 2_100 },
    );
    const secondLog = appendScheduledJobRunLog(
      db,
      { runId: 'run-1', level: 'warn', message: 'Output truncated', truncated: true },
      { id: 'log-2', nowMs: 2_200 },
    );
    expect(firstLog.sequence).toBe(0);
    expect(secondLog.sequence).toBe(1);
    expect(listScheduledJobRunLogs(db, 'run-1').map((log) => log.message)).toEqual([
      'Started',
      'Output truncated',
    ]);

    const succeeded = transitionScheduledJobRun(db, 'run-1', 'succeeded', {
      nowMs: 4_000,
      resultSummary: 'All checks passed.',
    });
    expect(succeeded).toMatchObject({
      status: 'succeeded',
      completedAtMs: 4_000,
      resultSummary: 'All checks passed.',
    });
    expect(getScheduledJob(db, 'job-1').lastRunAtMs).toBe(4_000);
    expect(listScheduledJobRuns(db, { jobId: 'job-1' })).toHaveLength(1);
    expect(() => transitionScheduledJobRun(db, 'run-1', 'running')).toThrow(
      ScheduledJobTransitionError,
    );
  });

  it('allows retrying failed runs by transitioning failed back to queued', () => {
    createScheduledJob(db, baseJob(), { id: 'job-1', nowMs: 1_000 });
    createScheduledJobRun(db, { jobId: 'job-1' }, { id: 'run-1', nowMs: 1_000 });
    transitionScheduledJobRun(db, 'run-1', 'running', { nowMs: 2_000 });
    transitionScheduledJobRun(db, 'run-1', 'failed', {
      nowMs: 3_000,
      errorCode: 'QUALITY_GATE_FAILED',
      errorMessage: 'Lint failed.',
    });

    const retried = transitionScheduledJobRun(db, 'run-1', 'queued', { nowMs: 4_000 });
    expect(retried.status).toBe('queued');
    expect(retried.completedAtMs).toBeUndefined();
    expect(retried.errorCode).toBe('QUALITY_GATE_FAILED');
  });
});
