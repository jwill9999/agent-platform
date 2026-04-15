import { ToolSchema } from '@agent-platform/contracts';
import { deleteTool, getTool, listTools, upsertTool } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody } from './routerUtils.js';

export function createToolsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listTools(db) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const tool = getTool(db, req.params.id!);
      if (!tool) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      res.json({ data: tool });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const tool = parseBody(ToolSchema, req.body);
      upsertTool(db, tool);
      res.status(201).json({ data: tool });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const tool = parseBody(ToolSchema, req.body);
      if (tool.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      upsertTool(db, tool);
      res.json({ data: tool });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteTool(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      res.status(204).send();
    }),
  );

  return router;
}
