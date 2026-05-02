import {
  MemoryClearBodySchema,
  MemoryCleanupBodySchema,
  MemoryQuerySchema,
  MemoryReviewBodySchema,
  SelfLearningEvaluateBodySchema,
  MemoryUpdateBodySchema,
} from '@agent-platform/contracts';
import type { DrizzleDb } from '@agent-platform/db';
import {
  cleanupExpiredMemories,
  countMemories,
  deleteMemoriesByQuery,
  deleteMemory,
  evaluateSelfLearning,
  getMemory,
  MemoryNotFoundError,
  queryMemories,
  updateMemory,
} from '@agent-platform/db';
import { createLogger } from '@agent-platform/logger';
import type { ObservabilityStore } from '@agent-platform/plugin-observability';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

const log = createLogger('api:memories');

export interface MemoriesRouterOptions {
  observabilityStore?: ObservabilityStore;
}

function notFound(error: unknown): never {
  if (error instanceof MemoryNotFoundError) {
    throw new HttpError(404, 'NOT_FOUND', 'Memory not found');
  }
  throw error;
}

function queryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function parseMemoryQuery(query: Record<string, unknown>) {
  const result = MemoryQuerySchema.safeParse({
    scope: queryValue(query.scope),
    scopeId: queryValue(query.scopeId),
    kind: queryValue(query.kind),
    status: queryValue(query.status),
    reviewStatus: queryValue(query.reviewStatus),
    safetyState: queryValue(query.safetyState),
    minConfidence: queryValue(query.minConfidence),
    sourceKind: queryValue(query.sourceKind),
    sourceId: queryValue(query.sourceId),
    tag: queryValue(query.tag),
    includeExpired: queryValue(query.includeExpired) === 'true',
    limit: queryValue(query.limit),
    offset: queryValue(query.offset),
  });
  if (!result.success) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid memory query', result.error.flatten());
  }
  return result.data;
}

function observedOutcomesFromStore(store: ObservabilityStore | undefined, sessionId: string) {
  return (
    store?.getErrors({ sessionId, limit: 100 }).map((record) => ({
      kind: 'observability_error' as const,
      id: record.id,
      message:
        record.event.kind === 'error'
          ? record.event.message
          : `${record.event.kind}: ${JSON.stringify(record.event)}`,
      atMs: record.timestampMs,
    })) ?? []
  );
}

export function createMemoriesRouter(db: DrizzleDb, options: MemoriesRouterOptions = {}): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = parseMemoryQuery(req.query);
      res.json({
        data: {
          items: queryMemories(db, query),
          total: countMemories(db, query),
          limit: query.limit,
          offset: query.offset,
        },
      });
    }),
  );

  router.get(
    '/export',
    asyncHandler(async (req, res) => {
      const query = parseMemoryQuery({ ...req.query, limit: queryValue(req.query.limit) ?? '500' });
      const memories = queryMemories(db, query);
      log.info('memory.exported', { count: memories.length, query });
      res.json({ data: { exportedAtMs: Date.now(), count: memories.length, memories } });
    }),
  );

  router.post(
    '/clear',
    asyncHandler(async (req, res) => {
      const body = parseBody(MemoryClearBodySchema, req.body);
      const deleted = deleteMemoriesByQuery(db, body);
      log.warn('memory.clear_scope', {
        scope: body.scope,
        scopeId: body.scopeId,
        status: body.status,
        reviewStatus: body.reviewStatus,
        safetyState: body.safetyState,
        deleted,
      });
      res.json({ data: { deleted } });
    }),
  );

  router.post(
    '/cleanup',
    asyncHandler(async (req, res) => {
      const body = parseBody(MemoryCleanupBodySchema, req.body);
      const result = cleanupExpiredMemories(db, body);
      log.warn('memory.cleanup_expired', {
        scope: body.scope,
        scopeId: body.scopeId,
        beforeMs: result.beforeMs,
        dryRun: result.dryRun,
        matched: result.matched,
        deleted: result.deleted,
      });
      res.json({ data: result });
    }),
  );

  router.post(
    '/self-learning/evaluate',
    asyncHandler(async (req, res) => {
      const body = parseBody(SelfLearningEvaluateBodySchema, req.body);
      const result = evaluateSelfLearning(db, {
        ...body,
        observedOutcomes: [
          ...body.observedOutcomes,
          ...observedOutcomesFromStore(options.observabilityStore, body.sessionId),
        ],
      });
      log.info('memory.self_learning_evaluated', {
        sessionId: body.sessionId,
        objective: result.objective,
        proposed: result.proposed,
        matchingSignals: result.metrics.before.matchingSignals,
      });
      res.status(result.proposed ? 201 : 200).json({ data: result });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: getMemory(db, requireParam(req.params, 'id')) });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const body = parseBody(MemoryUpdateBodySchema, req.body);
      try {
        const memory = updateMemory(db, id, body);
        log.info('memory.updated', { id, scope: memory.scope, scopeId: memory.scopeId });
        res.json({ data: memory });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.post(
    '/:id/review',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const body = parseBody(MemoryReviewBodySchema, req.body);
      try {
        const existing = getMemory(db, id);
        const memory = updateMemory(db, id, {
          status: body.decision,
          reviewStatus: body.decision,
          reviewedAtMs: Date.now(),
          reviewedBy: body.reviewedBy,
          metadata: {
            ...existing.metadata,
            ...(body.reason ? { reviewReason: body.reason } : {}),
          },
        });
        log.info('memory.reviewed', {
          id,
          decision: body.decision,
          scope: memory.scope,
          scopeId: memory.scopeId,
        });
        res.json({ data: memory });
      } catch (error) {
        notFound(error);
      }
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const existing = (() => {
        try {
          return getMemory(db, id);
        } catch (error) {
          notFound(error);
        }
      })();
      const ok = deleteMemory(db, id);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Memory not found');
      log.warn('memory.deleted', { id, scope: existing.scope, scopeId: existing.scopeId });
      res.status(204).send();
    }),
  );

  return router;
}
