import type { DrizzleDb } from '@agent-platform/db';
import { loadSettings } from '@agent-platform/db';
import { Router } from 'express';

import { createAgentsRouter } from './agentsRouter.js';
import { createChatRouter } from './chatRouter.js';
import { createMcpServersRouter } from './mcpServersRouter.js';
import { createSessionsRouter } from './sessionsRouter.js';
import { createSettingsRouter } from './settingsRouter.js';
import { createSkillsRouter } from './skillsRouter.js';
import { createToolsRouter } from './toolsRouter.js';
import { createDynamicRateLimiter } from '../dynamicRateLimiter.js';

export function createV1Router(db: DrizzleDb): Router {
  const router = Router();

  const rateLimiter = createDynamicRateLimiter();

  // Hydrate rate limiter from persisted settings on startup
  const persisted = loadSettings(db);
  rateLimiter.reconfigure(persisted.rateLimits);

  router.use(rateLimiter.middleware);

  /** Single-user local stub (no auth yet). */
  router.use((_req, _res, next) => {
    next();
  });

  router.use('/skills', createSkillsRouter(db));
  router.use('/tools', createToolsRouter(db));
  router.use('/mcp-servers', createMcpServersRouter(db));
  router.use('/agents', createAgentsRouter(db));
  router.use('/sessions', createSessionsRouter(db));
  router.use('/chat', createChatRouter(db));
  router.use(
    '/settings',
    createSettingsRouter(db, (config) => rateLimiter.reconfigure(config)),
  );

  return router;
}
