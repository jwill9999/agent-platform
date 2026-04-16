import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { getHealth } from '../../application/health/getHealth.js';
import { runReadinessCheck } from '../../application/health/readinessCheck.js';

/**
 * Health-check router:
 *  - GET /health       — fast liveness (for load balancers / k8s liveness probes)
 *  - GET /health/ready — deep readiness (DB, disk, subsystem verification)
 */
export function createHealthRouter(deps: {
  db: DrizzleDb | null;
  sqlitePath: string | undefined;
}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json(getHealth());
  });

  router.get('/health/ready', async (_req, res) => {
    const result = await runReadinessCheck(deps);
    const httpStatus = result.status === 'unhealthy' ? 503 : 200;
    res.status(httpStatus).json(result);
  });

  return router;
}
