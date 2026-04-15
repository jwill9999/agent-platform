import { McpServerSchema } from '@agent-platform/contracts';
import { deleteMcpServer, getMcpServer, listMcpServers, upsertMcpServer } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody } from './routerUtils.js';

export function createMcpServersRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listMcpServers(db) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const m = getMcpServer(db, req.params.id!);
      if (!m) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.json({ data: m });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const m = parseBody(McpServerSchema, req.body);
      upsertMcpServer(db, m);
      res.status(201).json({ data: m });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const m = parseBody(McpServerSchema, req.body);
      if (m.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      upsertMcpServer(db, m);
      res.json({ data: m });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteMcpServer(db, req.params.id!);
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.status(204).send();
    }),
  );

  return router;
}
