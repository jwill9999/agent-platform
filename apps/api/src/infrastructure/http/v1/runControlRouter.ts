import { Router, type Request } from 'express';
import { z } from 'zod';
import { getSession, RunControlError, type DrizzleDb } from '@agent-platform/db';
import type { RunControlService } from '../../../application/runControl/service.js';
import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

export function mapRunControlError(error: unknown): never {
  if (error instanceof RunControlError) {
    const status = error.code === 'run_not_found' ? 404 : error.code === 'run_capacity' ? 503 : 409;
    throw new HttpError(
      status,
      error.code.toUpperCase(),
      error.code === 'run_not_found'
        ? 'Run unavailable. Legacy approvals require a new request.'
        : error.code === 'run_not_running'
          ? 'This run is no longer eligible to execute.'
          : error.code === 'run_conflict'
            ? 'This session already has an active run.'
            : 'Run control is temporarily unavailable.',
    );
  }
  throw new HttpError(
    503,
    'RUN_CONTROL_UNAVAILABLE',
    'Run control could not confirm the operation. Retry the same scoped request.',
  );
}

/** Stop is a state-changing local operation; CORS alone does not prevent CSRF. */
function admitStopOrigin(req: Request): void {
  const origin = req.get('origin');
  const site = req.get('sec-fetch-site');
  if (site && site !== 'same-origin')
    throw new HttpError(403, 'STOP_ORIGIN_DENIED', 'Stop requires a trusted local request origin.');
  if (!origin) {
    // Voice/CLI and the independently checked BFF use server-to-server requests.
    // A browser metadata header without its Origin is not headless admission.
    if (site)
      throw new HttpError(
        403,
        'STOP_ORIGIN_DENIED',
        'Stop requires a trusted local request origin.',
      );
    return;
  }
  try {
    const parsed = new URL(origin);
    const expected = new URL(`${req.protocol}://${req.get('host') ?? ''}`);
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(expected.hostname) ||
      parsed.origin !== origin ||
      parsed.origin !== expected.origin ||
      parsed.username ||
      parsed.password ||
      !req.is('application/json')
    )
      throw new Error('Untrusted Stop origin');
  } catch {
    throw new HttpError(403, 'STOP_ORIGIN_DENIED', 'Stop requires a trusted local request origin.');
  }
}

export function createRunControlRouter(db: DrizzleDb, service: RunControlService): Router {
  const router = Router();
  router.param('id', (req, res, next) => {
    if (!getSession(db, requireParam(req.params, 'id')))
      throw new HttpError(404, 'NOT_FOUND', 'Session not found');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/:id/active-run',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: service.current(requireParam(req.params, 'id')) ?? null });
      } catch (error) {
        mapRunControlError(error);
      }
    }),
  );
  router.get(
    '/:id/runs/:runId',
    asyncHandler(async (req, res) => {
      const runId = z.string().uuid().parse(req.params['runId']);
      try {
        res.json({ data: service.require(requireParam(req.params, 'id'), runId) });
      } catch (error) {
        mapRunControlError(error);
      }
    }),
  );
  router.post(
    '/:id/runs/:runId/stop',
    asyncHandler(async (req, res) => {
      admitStopOrigin(req);
      parseBody(z.object({}).strict(), req.body ?? {});
      const runId = z.string().uuid().parse(req.params['runId']);
      try {
        res.json({ data: service.stop(requireParam(req.params, 'id'), runId) });
      } catch (error) {
        mapRunControlError(error);
      }
    }),
  );
  return router;
}
