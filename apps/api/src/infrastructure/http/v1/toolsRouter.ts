import { ToolCreateBodySchema, ToolSchema } from '@agent-platform/contracts';
import { SYSTEM_TOOLS } from '@agent-platform/harness';
import { createTool, deleteTool, getTool, listTools, upsertTool } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

function listAvailableTools(db: DrizzleDb) {
  return [...SYSTEM_TOOLS, ...listTools(db)];
}

function findSystemTool(idOrSlug: string) {
  return SYSTEM_TOOLS.find((tool) => tool.id === idOrSlug || tool.slug === idOrSlug);
}

export function createToolsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listAvailableTools(db) });
    }),
  );

  router.get(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const idOrSlug = requireParam(req.params, 'idOrSlug');
      const tool = findSystemTool(idOrSlug) ?? getTool(db, idOrSlug);
      if (!tool) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      res.json({ data: tool });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(ToolCreateBodySchema, req.body);
      const tool = createTool(db, body);
      res.status(201).json({ data: tool });
    }),
  );

  router.put(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const existing = getTool(db, requireParam(req.params, 'idOrSlug'));
      if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      const tool = parseBody(ToolSchema, { ...req.body, id: existing.id, slug: existing.slug });
      upsertTool(db, tool);
      res.json({ data: tool });
    }),
  );

  router.delete(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const ok = deleteTool(db, requireParam(req.params, 'idOrSlug'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      res.status(204).send();
    }),
  );

  return router;
}
