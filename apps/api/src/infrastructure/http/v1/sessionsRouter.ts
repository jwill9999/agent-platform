import {
  SessionCreateBodySchema,
  SessionProjectBindingBodySchema,
  SessionProjectBindingResultSchema,
  SessionRecordSchema,
} from '@agent-platform/contracts';
import type { SessionRecord } from '@agent-platform/contracts';
import {
  createSession,
  deleteSession,
  findProject,
  getAgent,
  getWorkingMemoryArtifact,
  getSession,
  listMessagesBySession,
  listSessions,
  replaceSession,
  updateSessionProject,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { createInProcessSessionLock, type SessionLock } from '../sessionLock.js';
import { handleSessionResume, type ChatRouterOptions } from './chatRouter.js';
import { parseBody, requireParam } from './routerUtils.js';
import { buildSensorDashboardResponse, coerceSensorDashboardLimit } from './sensorDashboard.js';

function reusableProjectSession(
  sessions: readonly SessionRecord[],
  projectId: string,
): SessionRecord | undefined {
  return sessions
    .filter((session) => session.mode === 'project' && session.projectId === projectId)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
}

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

  router.get(
    '/:id/working-memory',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const session = getSession(db, id);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      res.json({ data: getWorkingMemoryArtifact(db, id) ?? null });
    }),
  );

  router.get(
    '/:id/sensors',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const session = getSession(db, id);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      const agent = getAgent(db, session.agentId);
      if (!agent) throw new HttpError(404, 'NOT_FOUND', 'Session agent not found');

      res.json({
        data: buildSensorDashboardResponse({
          sessionId: id,
          agent,
          observabilityStore: options.observabilityStore,
          limit: coerceSensorDashboardLimit(req.query.limit),
        }),
      });
    }),
  );

  router.post(
    '/:id/sensors/retry',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const session = getSession(db, id);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      const agent = getAgent(db, session.agentId);
      if (!agent) throw new HttpError(404, 'NOT_FOUND', 'Session agent not found');

      res.json({
        data: buildSensorDashboardResponse({
          sessionId: id,
          agent,
          observabilityStore: options.observabilityStore,
          limit: coerceSensorDashboardLimit(req.query.limit),
        }),
      });
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
    '/project',
    asyncHandler(async (req, res) => {
      const body = parseBody(SessionProjectBindingBodySchema, req.body);
      if (!getAgent(db, body.agentId)) {
        throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      }
      if (!findProject(db, body.projectId)) {
        throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      }

      const existing = reusableProjectSession(listSessions(db, body.agentId), body.projectId);
      if (existing) {
        res.json({
          data: SessionProjectBindingResultSchema.parse({
            created: false,
            session: existing,
          }),
        });
        return;
      }

      const session = createSession(db, {
        agentId: body.agentId,
        mode: 'project',
        projectId: body.projectId,
      });
      res.status(201).json({
        data: SessionProjectBindingResultSchema.parse({
          created: true,
          session,
        }),
      });
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

  router.put(
    '/:id/project',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const body = parseBody(SessionRecordSchema.pick({ projectId: true }).partial(), req.body);
      const session = getSession(db, id);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
      if (body.projectId && !findProject(db, body.projectId)) {
        throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      }
      updateSessionProject(db, id, body.projectId ?? null);
      res.json({ data: getSession(db, id) });
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
