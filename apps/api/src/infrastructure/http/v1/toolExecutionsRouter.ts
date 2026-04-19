import { ToolExecutionQuerySchema } from '@agent-platform/contracts';
import { queryToolExecutions, countToolExecutions } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';

export function createToolExecutionsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = ToolExecutionQuerySchema.parse(req.query);
      const data = queryToolExecutions(db, query);
      const total = countToolExecutions(db, query);
      res.json({ data, total, limit: query.limit, offset: query.offset });
    }),
  );

  return router;
}
