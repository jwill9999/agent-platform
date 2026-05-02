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
import { createApprovalRequestsRouter } from './approvalRequestsRouter.js';
import { createChatRouter, type ChatRouterOptions } from './chatRouter.js';
import { createMemoriesRouter } from './memoriesRouter.js';
import { createMcpServersRouter } from './mcpServersRouter.js';
import { createModelConfigsRouter } from './modelConfigsRouter.js';
import { createProjectsRouter } from './projectsRouter.js';
import { createSessionsRouter } from './sessionsRouter.js';
import { createSettingsRouter } from './settingsRouter.js';
import { createSkillsRouter } from './skillsRouter.js';
import { createToolsRouter } from './toolsRouter.js';
import { createToolExecutionsRouter } from './toolExecutionsRouter.js';
import { createWorkspaceRouter } from './workspaceRouter.js';
import { createDynamicRateLimiter } from '../dynamicRateLimiter.js';
import { createInProcessSessionLock } from '../sessionLock.js';

const observabilityLog = createLogger('api:observability');

export type V1RouterOptions = {
  chat?: Pick<ChatRouterOptions, 'llmReasonNode' | 'disableEvaluatorNodes'>;
};

export function createV1Router(db: DrizzleDb, options: V1RouterOptions = {}): Router {
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
  const sessionLock = createInProcessSessionLock();

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
  router.use(
    '/sessions',
    createSessionsRouter(db, {
      globalPlugins,
      observabilityStore,
      sessionLock,
      ...options.chat,
    }),
  );
  router.use(
    '/chat',
    createChatRouter(db, {
      globalPlugins,
      observabilityStore,
      sessionLock,
      ...options.chat,
    }),
  );
  router.use(
    '/settings',
    createSettingsRouter(db, (config) => rateLimiter.reconfigure(config)),
  );
  router.use('/tool-executions', createToolExecutionsRouter(db));
  router.use('/approval-requests', createApprovalRequestsRouter(db));
  router.use('/model-configs', createModelConfigsRouter(db));
  router.use('/projects', createProjectsRouter(db));
  router.use('/memories', createMemoriesRouter(db, { observabilityStore }));
  router.use('/workspace', createWorkspaceRouter());

  return router;
}
