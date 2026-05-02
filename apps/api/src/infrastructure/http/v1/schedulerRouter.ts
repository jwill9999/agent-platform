import {
  ScheduledJobCreateBodySchema,
  ScheduledJobQuerySchema,
  ScheduledJobRunQuerySchema,
  ScheduledJobUpdateBodySchema,
} from '@agent-platform/contracts';
import type { DrizzleDb } from '@agent-platform/db';
import {
  createScheduledJob,
  getScheduledJob,
  getScheduledJobRun,
  listScheduledJobRunLogs,
  listScheduledJobRuns,
  listScheduledJobs,
  requestScheduledJobRunCancellation,
  ScheduledJobNotFoundError,
  ScheduledJobRunNotFoundError,
  setScheduledJobStatus,
  updateScheduledJob,
  updateScheduledJobScheduleState,
} from '@agent-platform/db';
import { createLogger } from '@agent-platform/logger';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

const log = createLogger('api:scheduler');

function queryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function integerQuery(value: unknown, fallback: number, min: number, max: number): number {
  const raw = queryValue(value);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.trunc(parsed), max));
}

function notFound(error: unknown): never {
  if (error instanceof ScheduledJobNotFoundError) {
    throw new HttpError(404, 'NOT_FOUND', 'Scheduled job not found');
  }
  if (error instanceof ScheduledJobRunNotFoundError) {
    throw new HttpError(404, 'NOT_FOUND', 'Scheduled job run not found');
  }
  throw error;
}

function parseJobQuery(query: Record<string, unknown>) {
  const result = ScheduledJobQuerySchema.safeParse({
    scope: queryValue(query.scope),
    scopeId: queryValue(query.scopeId),
    projectId: queryValue(query.projectId),
    ownerAgentId: queryValue(query.ownerAgentId),
    ownerSessionId: queryValue(query.ownerSessionId),
    executionAgentId: queryValue(query.executionAgentId),
    status: queryValue(query.status),
    scheduleType: queryValue(query.scheduleType),
    dueBeforeMs: queryValue(query.dueBeforeMs),
    limit: queryValue(query.limit),
    offset: queryValue(query.offset),
  });
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid scheduler query', result.error.flatten());
  }
  return result.data;
}

function parseRunQuery(query: Record<string, unknown>, jobId?: string) {
  const result = ScheduledJobRunQuerySchema.safeParse({
    jobId: jobId ?? queryValue(query.jobId),
    status: queryValue(query.status),
    limit: queryValue(query.limit),
    offset: queryValue(query.offset),
  });
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid run query', result.error.flatten());
  }
  return result.data;
}

export function createSchedulerRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = parseJobQuery(req.query);
      const items = listScheduledJobs(db, query);
      res.json({
        data: {
          items,
          total: items.length,
          limit: query.limit,
          offset: query.offset,
        },
      });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(ScheduledJobCreateBodySchema, req.body);
      const job = createScheduledJob(db, body);
      log.info('scheduler.job_created', { id: job.id, scope: job.scope, status: job.status });
      res.status(201).json({ data: job });
    }),
  );

  router.get(
    '/runs/:runId',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: getScheduledJobRun(db, requireParam(req.params, 'runId')) });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.post(
    '/runs/:runId/cancel',
    asyncHandler(async (req, res) => {
      try {
        const run = requestScheduledJobRunCancellation(db, requireParam(req.params, 'runId'));
        log.warn('scheduler.run_cancel_requested', { runId: run.id, jobId: run.jobId });
        res.json({ data: run });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.get(
    '/runs/:runId/logs',
    asyncHandler(async (req, res) => {
      const limit = integerQuery(req.query.limit, 100, 1, 500);
      const offset = integerQuery(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
      try {
        const run = getScheduledJobRun(db, requireParam(req.params, 'runId'));
        const items = listScheduledJobRunLogs(db, run.id, { limit, offset });
        res.json({ data: { items, total: items.length, limit, offset } });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: getScheduledJob(db, requireParam(req.params, 'id')) });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const body = parseBody(ScheduledJobUpdateBodySchema, req.body);
      try {
        const job = updateScheduledJob(db, id, body);
        log.info('scheduler.job_updated', { id, status: job.status });
        res.json({ data: job });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.post(
    '/:id/pause',
    asyncHandler(async (req, res) => {
      try {
        const job = setScheduledJobStatus(db, requireParam(req.params, 'id'), 'paused');
        log.info('scheduler.job_paused', { id: job.id });
        res.json({ data: job });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.post(
    '/:id/resume',
    asyncHandler(async (req, res) => {
      try {
        const job = setScheduledJobStatus(db, requireParam(req.params, 'id'), 'enabled');
        log.info('scheduler.job_resumed', { id: job.id });
        res.json({ data: job });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.post(
    '/:id/run',
    asyncHandler(async (req, res) => {
      try {
        const job = updateScheduledJobScheduleState(db, requireParam(req.params, 'id'), {
          status: 'enabled',
          nextRunAtMs: Date.now(),
          clearLease: true,
        });
        log.info('scheduler.job_run_requested', { id: job.id });
        res.json({ data: job });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.get(
    '/:id/runs',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      try {
        getScheduledJob(db, id);
        const query = parseRunQuery(req.query, id);
        const items = listScheduledJobRuns(db, query);
        res.json({
          data: { items, total: items.length, limit: query.limit, offset: query.offset },
        });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  return router;
}
