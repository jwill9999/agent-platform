import { AgentCreateBodySchema, AgentSchema } from '@agent-platform/contracts';
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  replaceAgent,
  getModelConfig,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

export function createAgentsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listAgents(db) });
    }),
  );

  router.get(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const agent = getAgent(db, requireParam(req.params, 'idOrSlug'));
      if (!agent) throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      res.json({ data: agent });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(AgentCreateBodySchema, req.body);
      if (body.modelConfigId) {
        const cfg = getModelConfig(db, body.modelConfigId);
        if (!cfg)
          throw new HttpError(404, 'NOT_FOUND', `Model config '${body.modelConfigId}' not found`);
      }
      const agent = createAgent(db, body);
      res.status(201).json({ data: agent });
    }),
  );

  // Slug is immutable after create (stable URLs and lookups); name and other fields come from the body.
  router.put(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const existing = getAgent(db, requireParam(req.params, 'idOrSlug'));
      if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      const agent = parseBody(AgentSchema, { ...req.body, id: existing.id, slug: existing.slug });
      if (agent.modelConfigId) {
        const cfg = getModelConfig(db, agent.modelConfigId);
        if (!cfg)
          throw new HttpError(404, 'NOT_FOUND', `Model config '${agent.modelConfigId}' not found`);
      }
      replaceAgent(db, agent);
      res.json({ data: getAgent(db, existing.id) });
    }),
  );

  router.delete(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const ok = deleteAgent(db, requireParam(req.params, 'idOrSlug'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Agent not found');
      res.status(204).send();
    }),
  );

  return router;
}
