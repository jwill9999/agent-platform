import { SessionCreateBodySchema, SessionRecordSchema } from '@agent-platform/contracts';
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  replaceSession,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { isSqliteConstraint, parseBody } from './routerUtils.js';

export function createSessionsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
      res.json({ data: listSessions(db, agentId) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const session = getSession(db, req.params.id!);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      res.json({ data: session });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(SessionCreateBodySchema, req.body);
      try {
        const session = createSession(db, body);
        res.status(201).json({ data: session });
      } catch (e) {
        if (isSqliteConstraint(e)) {
          throw new HttpError(409, 'CONFLICT', 'Session id already exists or foreign key failed');
        }
        throw e;
      }
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const record = parseBody(SessionRecordSchema, req.body);
      if (record.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      try {
        replaceSession(db, record);
        res.json({ data: record });
      } catch (e) {
        if (isSqliteConstraint(e)) {
          throw new HttpError(400, 'CONSTRAINT_VIOLATION', 'Invalid session update');
        }
        throw e;
      }
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteSession(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      res.status(204).send();
    }),
  );

  return router;
}
