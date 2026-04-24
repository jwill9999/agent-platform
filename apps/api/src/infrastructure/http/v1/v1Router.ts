import type { DrizzleDb } from '@agent-platform/db';
import { loadSettings } from '@agent-platform/db';
import { createLogger } from '@agent-platform/logger';
import {
  createObservabilityPlugin,
  createObservabilityStore,
  type ObservabilityEvent,
} from '@agent-platform/plugin-observability';
import type { RegisteredPlugin } from '@agent-platform/plugin-session';
import { Router } from 'express';

import { createAgentsRouter } from './agentsRouter.js';
import { createChatRouter } from './chatRouter.js';
import { createMcpServersRouter } from './mcpServersRouter.js';
import { createModelConfigsRouter } from './modelConfigsRouter.js';
import { createSessionsRouter } from './sessionsRouter.js';
import { createSettingsRouter } from './settingsRouter.js';
import { createSkillsRouter } from './skillsRouter.js';
import { createToolsRouter } from './toolsRouter.js';
import { createToolExecutionsRouter } from './toolExecutionsRouter.js';
import { createDynamicRateLimiter } from '../dynamicRateLimiter.js';

const observabilityLog = createLogger('api:observability');

export function createV1Router(db: DrizzleDb): Router {
  const router = Router();
  const observabilityStore = createObservabilityStore();
  const globalPlugins: readonly RegisteredPlugin[] = [
    {
      id: 'plugin-observability',
      hooks: createObservabilityPlugin({
        store: observabilityStore,
        log: (event: ObservabilityEvent) => observabilityLog.info('observability.event', { event }),
      }),
    },
  ];

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
  router.use(
    '/chat',
    createChatRouter(db, {
      globalPlugins,
      observabilityStore,
    }),
  );
  router.use(
    '/settings',
    createSettingsRouter(db, (config) => rateLimiter.reconfigure(config)),
  );
  router.use('/tool-executions', createToolExecutionsRouter(db));
  router.use('/model-configs', createModelConfigsRouter(db));

  return router;
}
