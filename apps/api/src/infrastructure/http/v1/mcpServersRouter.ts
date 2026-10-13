import { McpServerCreateBodySchema } from '@agent-platform/contracts';
import {
  createMcpServer,
  deleteMcpServer,
  duplicateMcpServer,
  getMcpServer,
  importMcpServers,
  listMcpServers,
  McpConfigurationError,
  updateMcpServer,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';
import { z } from 'zod';

import { testMcpConnection } from '../../../application/mcp/testMcpConnection.js';
import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { requireParam } from './routerUtils.js';

/** Validation details may contain raw imported keys. Return fixed guidance only. */
function parseConfiguration<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new HttpError(
      400,
      'MCP_CONFIGURATION_INVALID',
      'Unsupported MCP configuration. Check transport, command/argument array, endpoint and credential names; remove unsupported fields.',
    );
  return parsed.data as z.output<T>;
}
function mutation<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (error instanceof McpConfigurationError)
      throw new HttpError(
        error.code === 'MCP_SECRET_KEY_UNAVAILABLE' ? 503 : 400,
        error.code,
        error.message,
      );
    throw error;
  }
}
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
      const server = getMcpServer(db, requireParam(req.params, 'idOrSlug'));
      if (!server) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.json({ data: server });
    }),
  );
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseConfiguration(McpServerCreateBodySchema, req.body);
      res.status(201).json({ data: mutation(() => createMcpServer(db, body)) });
    }),
  );
  router.post(
    '/import',
    asyncHandler(async (req, res) => {
      const body = parseConfiguration(
        z.object({ servers: z.array(McpServerCreateBodySchema).min(1).max(100) }).strict(),
        req.body,
      );
      res.status(201).json({ data: mutation(() => importMcpServers(db, body.servers)) });
    }),
  );
  router.put(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const body = parseConfiguration(McpServerCreateBodySchema, req.body);
      const updated = mutation(() =>
        updateMcpServer(db, requireParam(req.params, 'idOrSlug'), body),
      );
      if (!updated) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.json({ data: updated });
    }),
  );
  router.post(
    '/:idOrSlug/duplicate',
    asyncHandler(async (req, res) => {
      const duplicate = mutation(() =>
        duplicateMcpServer(db, requireParam(req.params, 'idOrSlug')),
      );
      if (!duplicate) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.status(201).json({ data: duplicate });
    }),
  );
  router.delete(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      if (!mutation(() => deleteMcpServer(db, requireParam(req.params, 'idOrSlug'))))
        throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      res.status(204).send();
    }),
  );
  router.post(
    '/:idOrSlug/test',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'idOrSlug');
      if (!getMcpServer(db, id)) throw new HttpError(404, 'NOT_FOUND', 'MCP server not found');
      const controller = new AbortController();
      const cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on('close', cancel);
      try {
        const result = await testMcpConnection(db, id, controller.signal);
        if (!controller.signal.aborted) res.json({ data: result });
      } finally {
        res.off('close', cancel);
      }
    }),
  );
  return router;
}
