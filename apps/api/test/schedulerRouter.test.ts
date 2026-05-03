import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  closeDatabase,
  createScheduledJob,
  createScheduledJobRun,
  listScheduledJobRunLogs,
  openDatabase,
  transitionScheduledJobRun,
} from '@agent-platform/db';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createSchedulerService } from '../src/application/scheduler/schedulerService.js';
import { createSchedulerRouter } from '../src/infrastructure/http/v1/schedulerRouter.js';

function buildTestApp(db: ReturnType<typeof openDatabase>['db']) {
  const app = express();
  app.use(express.json());
  app.use('/v1/scheduler', createSchedulerRouter(db));
  app.use(errorMiddleware);
  return app;
}

function jobBody(overrides: Record<string, unknown> = {}) {
  return {
    scope: 'global',
    name: 'Nightly scheduler check',
    instructions: 'Run a no-op check.',
    targetKind: 'built_in_task',
    targetPayload: { task: 'scheduler.noop' },
    scheduleType: 'one_off',
    runAtMs: 10_000,
    nextRunAtMs: 10_000,
    status: 'paused',
    ...overrides,
  };
}

describe('schedulerRouter', () => {
  let opened: ReturnType<typeof openDatabase>;
  let tmpDir: string;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-scheduler-api-'));
    opened = openDatabase(path.join(tmpDir, 'test.sqlite'));
    app = buildTestApp(opened.db);
  });

  afterEach(() => {
    closeDatabase(opened.sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates, lists, updates, pauses, resumes, and schedules jobs to run now', async () => {
    const created = await request(app).post('/v1/scheduler').send(jobBody()).expect(201);
    expect(created.body.data).toMatchObject({
      name: 'Nightly scheduler check',
      status: 'paused',
      nextRunAtMs: 10_000,
    });

    const id = created.body.data.id as string;
    const listed = await request(app).get('/v1/scheduler?status=paused').expect(200);
    expect(listed.body.data.items.map((job: { id: string }) => job.id)).toEqual([id]);

    const updated = await request(app)
      .put(`/v1/scheduler/${id}`)
      .send({ name: 'Updated scheduler check', metadata: { ui: 'settings' } })
      .expect(200);
    expect(updated.body.data.name).toBe('Updated scheduler check');
    expect(updated.body.data.metadata).toEqual({ ui: 'settings' });

    await request(app).post(`/v1/scheduler/${id}/resume`).send({}).expect(200);
    await request(app).post(`/v1/scheduler/${id}/pause`).send({}).expect(200);
    const runNow = await request(app).post(`/v1/scheduler/${id}/run`).send({}).expect(200);
    expect(runNow.body.data.status).toBe('enabled');
    expect(runNow.body.data.nextRunAtMs).toBeLessThanOrEqual(Date.now());
  });

  it('lists runs and logs, and requests cancellation for running runs', async () => {
    createScheduledJob(opened.db, jobBody(), { id: 'job-1', nowMs: 1_000 });
    const run = createScheduledJobRun(
      opened.db,
      { jobId: 'job-1', leaseOwner: 'worker-1', leaseExpiresAtMs: 5_000 },
      { id: 'run-1', nowMs: 2_000 },
    );
    transitionScheduledJobRun(opened.db, run.id, 'running', {
      nowMs: 2_100,
      leaseOwner: 'worker-1',
      leaseExpiresAtMs: 5_000,
    });
    listScheduledJobRunLogs(opened.db, run.id);

    const runs = await request(app).get('/v1/scheduler/job-1/runs').expect(200);
    expect(runs.body.data.items).toHaveLength(1);
    expect(runs.body.data.items[0]).toMatchObject({ id: 'run-1', status: 'running' });

    const logs = await request(app).get('/v1/scheduler/runs/run-1/logs').expect(200);
    expect(logs.body.data.items).toEqual([]);

    const cancelled = await request(app)
      .post('/v1/scheduler/runs/run-1/cancel')
      .send({})
      .expect(200);
    expect(cancelled.body.data.cancelRequestedAtMs).toEqual(expect.any(Number));
  });

  it('creates, executes, and inspects a scheduled job through API plus runner integration', async () => {
    const created = await request(app)
      .post('/v1/scheduler')
      .send(jobBody({ status: 'enabled', runAtMs: 1_000, nextRunAtMs: 1_000 }))
      .expect(201);
    const jobId = created.body.data.id as string;
    const service = createSchedulerService(opened.db, {
      workerId: 'worker-1',
      nowMs: () => 1_000,
    });

    await service.runOnce();

    const runs = await request(app).get(`/v1/scheduler/${jobId}/runs`).expect(200);
    expect(runs.body.data.items).toHaveLength(1);
    const run = runs.body.data.items[0] as { id: string; status: string; resultSummary?: string };
    expect(run).toMatchObject({
      status: 'succeeded',
      resultSummary: 'Built-in scheduler no-op task completed.',
    });

    const logs = await request(app).get(`/v1/scheduler/runs/${run.id}/logs`).expect(200);
    expect(logs.body.data.items.map((log: { message: string }) => log.message)).toContain(
      'Notification: Scheduled job completed successfully.',
    );
  });

  it('returns validation and not-found errors clearly', async () => {
    await request(app)
      .post('/v1/scheduler')
      .send(jobBody({ scheduleType: 'recurring', runAtMs: undefined, intervalMs: undefined }))
      .expect(400);

    await request(app).get('/v1/scheduler/missing').expect(404);
    await request(app).post('/v1/scheduler/runs/missing/cancel').send({}).expect(404);
  });
});
