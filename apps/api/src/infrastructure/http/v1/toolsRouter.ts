import { ToolCreateBodySchema, ToolSchema } from '@agent-platform/contracts';
import { SYSTEM_TOOLS } from '@agent-platform/harness';
import {
  createTool,
  deleteTool,
  getTool,
  listTools,
  slugify,
  upsertTool,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

const RESERVED_SYSTEM_SLUG_PREFIXES = ['sys-', 'sys_'] as const;

function listAvailableTools(db: DrizzleDb) {
  const tools = [...SYSTEM_TOOLS];
  const seenIds = new Set(SYSTEM_TOOLS.map((tool) => tool.id));
  const seenSlugs = new Set(SYSTEM_TOOLS.map((tool) => tool.slug));

  for (const tool of listTools(db)) {
    if (seenIds.has(tool.id) || seenSlugs.has(tool.slug)) continue;
    tools.push(tool);
    seenIds.add(tool.id);
    seenSlugs.add(tool.slug);
  }

  return tools;
}

function findSystemTool(idOrSlug: string) {
  return SYSTEM_TOOLS.find((tool) => tool.id === idOrSlug || tool.slug === idOrSlug);
}

function isReservedSystemSlug(slug: string): boolean {
  return RESERVED_SYSTEM_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

function resolveToolSlug(db: DrizzleDb, name: string, existingId?: string): string {
  const slug = slugify(name);
  if (!slug) {
    throw new HttpError(400, 'INVALID_TOOL_NAME', 'Tool name must produce a non-empty slug');
  }

  if (isReservedSystemSlug(slug) || findSystemTool(slug)) {
    throw new HttpError(
      409,
      'RESERVED_TOOL_SLUG',
      `Tool slug '${slug}' is reserved for system tools`,
    );
  }

  const conflictingTool = getTool(db, slug);
  if (conflictingTool && conflictingTool.id !== existingId) {
    throw new HttpError(409, 'DUPLICATE_TOOL_SLUG', `Tool slug '${slug}' is already in use`);
  }

  return slug;
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
      const systemTool = findSystemTool(idOrSlug);
      const dbTool = getTool(db, idOrSlug);
      if (systemTool && dbTool && systemTool.slug === idOrSlug && dbTool.slug === idOrSlug) {
        throw new HttpError(
          409,
          'AMBIGUOUS_TOOL_SLUG',
          `Tool slug '${idOrSlug}' conflicts with a reserved system tool slug`,
        );
      }

      const tool = systemTool ?? dbTool;
      if (!tool) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      res.json({ data: tool });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(ToolCreateBodySchema, req.body);
      resolveToolSlug(db, body.name);
      const tool = createTool(db, body);
      res.status(201).json({ data: tool });
    }),
  );

  router.put(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const existing = getTool(db, requireParam(req.params, 'idOrSlug'));
      if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Tool not found');
      const body = parseBody(ToolCreateBodySchema, req.body);
      const tool = parseBody(ToolSchema, {
        ...body,
        id: existing.id,
        slug: resolveToolSlug(db, body.name, existing.id),
      });
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
