import {
  MemoryClearBodySchema,
  MemoryQuerySchema,
  MemoryReviewBodySchema,
  MemoryUpdateBodySchema,
} from '@agent-platform/contracts';
import type { DrizzleDb } from '@agent-platform/db';
import {
  countMemories,
  deleteMemoriesByQuery,
  deleteMemory,
  getMemory,
  MemoryNotFoundError,
  queryMemories,
  updateMemory,
} from '@agent-platform/db';
import { createLogger } from '@agent-platform/logger';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

const log = createLogger('api:memories');

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

export function createMemoriesRouter(db: DrizzleDb): Router {
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
