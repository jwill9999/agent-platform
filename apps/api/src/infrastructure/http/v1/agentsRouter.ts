import { AgentSchema } from '@agent-platform/contracts';
import { deleteAgent, listAgents, loadAgentById, replaceAgent } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody } from './routerUtils.js';

export function createAgentsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listAgents(db) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const agent = loadAgentById(db, req.params.id!);
      if (!agent) throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      res.json({ data: agent });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const agent = parseBody(AgentSchema, req.body);
      replaceAgent(db, agent);
      res.status(201).json({ data: agent });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const agent = parseBody(AgentSchema, req.body);
      if (agent.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      replaceAgent(db, agent);
      res.json({ data: agent });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteAgent(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      res.status(204).send();
    }),
  );

  return router;
}
