import { McpServerCreateBodySchema, McpServerSchema } from '@agent-platform/contracts';
import {
  createMcpServer,
  deleteMcpServer,
  getMcpServer,
  listMcpServers,
  upsertMcpServer,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { openMcpSession } from '@agent-platform/mcp-adapter';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

export function createMcpServersRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listMcpServers(db) });
    }),
  );

  router.get(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const m = getMcpServer(db, requireParam(req.params, 'idOrSlug'));
      if (!m) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.json({ data: m });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(McpServerCreateBodySchema, req.body);
      const m = createMcpServer(db, body);
      res.status(201).json({ data: m });
    }),
  );

  router.put(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const existing = getMcpServer(db, requireParam(req.params, 'idOrSlug'));
      if (!existing) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      const m = parseBody(McpServerSchema, { ...req.body, id: existing.id, slug: existing.slug });
      upsertMcpServer(db, m);
      res.json({ data: m });
    }),
  );

  router.delete(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const ok = deleteMcpServer(db, requireParam(req.params, 'idOrSlug'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.status(204).send();
    }),
  );

  /**
   * POST /:idOrSlug/test — open a real MCP session, list tools, then close.
   * Returns connection status, discovered tool count, and latency.
   */
  router.post(
    '/:idOrSlug/test',
    asyncHandler(async (req, res) => {
      const m = getMcpServer(db, requireParam(req.params, 'idOrSlug'));
      if (!m) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');

      const start = Date.now();
      try {
        const session = await openMcpSession(m);
        try {
          const tools = await session.listContractTools();
          const latencyMs = Date.now() - start;
          res.json({
            data: {
              status: 'ok' as const,
              toolCount: tools.length,
              tools: tools.map((t: { name: string; description?: string }) => ({
                name: t.name,
                description: t.description,
              })),
              latencyMs,
            },
          });
        } finally {
          await session.close().catch(() => {});
        }
      } catch (e) {
        const latencyMs = Date.now() - start;
        res.json({
          data: {
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
            latencyMs,
          },
        });
      }
    }),
  );

  return router;
}
