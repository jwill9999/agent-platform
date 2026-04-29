import { SessionCreateBodySchema, SessionRecordSchema } from '@agent-platform/contracts';
import {
  createSession,
  deleteSession,
  getSession,
  listMessagesBySession,
  listSessions,
  replaceSession,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { createInProcessSessionLock, type SessionLock } from '../sessionLock.js';
import { handleSessionResume, type ChatRouterOptions } from './chatRouter.js';
import { parseBody, requireParam } from './routerUtils.js';

export function createSessionsRouter(
  db: DrizzleDb,
  options: ChatRouterOptions & { sessionLock?: SessionLock } = {},
): Router {
  const router = Router();
  const sessionLock = options.sessionLock ?? createInProcessSessionLock();

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
      const session = getSession(db, requireParam(req.params, 'id'));
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      res.json({ data: session });
    }),
  );

  router.get(
    '/:id/messages',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const session = getSession(db, id);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      const all = listMessagesBySession(db, id);
      const visible = all.filter((m) => m.role === 'user' || m.role === 'assistant');
      res.json({ data: visible });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(SessionCreateBodySchema, req.body);
      const session = createSession(db, body);
      res.status(201).json({ data: session });
    }),
  );

  router.post(
    '/:id/resume',
    asyncHandler(async (req, res) => {
      await handleSessionResume(db, options, sessionLock, req, res);
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const record = parseBody(SessionRecordSchema, req.body);
      if (record.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      replaceSession(db, record);
      res.json({ data: record });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteSession(db, requireParam(req.params, 'id'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      res.status(204).send();
    }),
  );

  return router;
}
