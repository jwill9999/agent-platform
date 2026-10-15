import { GitDeliveryActionSchema } from '@agent-platform/contracts';
import type { DrizzleDb } from '@agent-platform/db';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createGitDeliveryService,
  GitDeliveryError,
  type GitDeliveryServiceOptions,
} from '../../../application/gitDelivery/index.js';
import { asyncHandler } from '../../../infrastructure/http/asyncHandler.js';
import { HttpError } from '../../../infrastructure/http/httpError.js';
import { parseBody, requireParam } from '../../../infrastructure/http/v1/routerUtils.js';

const PrepareBody = z.object({ action: GitDeliveryActionSchema }).strict();
const ConfirmBody = z.object({ confirmed: z.literal(true) }).strict();
const EmptyBody = z.object({}).strict();
const OperationId = z.string().uuid();

function mapGitDeliveryError(error: unknown): never {
  if (error instanceof GitDeliveryError) {
    throw new HttpError(error.status, error.code, error.message, error.details);
  }
  // Do not forward subprocess/database/filesystem messages or private material.
  throw new HttpError(
    503,
    'GIT_DELIVERY_UNAVAILABLE',
    'Git delivery is temporarily unavailable. Inspect the operation before retrying.',
  );
}
function operationId(req: Request): string {
  return parseBody(OperationId, requireParam(req.params, 'operationId'));
}
async function respond<T>(res: Response, action: () => Promise<T>): Promise<void> {
  try {
    const data = await action();
    if (!res.destroyed) res.json({ data });
  } catch (error) {
    mapGitDeliveryError(error);
  }
}
async function withDisconnect<T>(
  req: Request,
  res: Response,
  action: (signal: AbortSignal) => Promise<T>,
): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const close = () => {
    if (!res.writableEnded) abort();
  };
  req.once('aborted', abort);
  res.once('close', close);
  if (req.aborted || res.destroyed) abort();
  try {
    await respond(res, () => action(controller.signal));
  } finally {
    req.off('aborted', abort);
    res.off('close', close);
  }
}

/** The host supplies the trusted /projects/:projectId/git/delivery route binding. */
export function createGitDeliveryRouter(
  db: DrizzleDb,
  options: GitDeliveryServiceOptions = {},
): Router {
  const router = Router({ mergeParams: true });
  const service = createGitDeliveryService(db, options);
  const panel = (req: Request) => service.panel(requireParam(req.params, 'projectId'));
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(PrepareBody, req.body);
      await withDisconnect(req, res, (signal) => panel(req).prepare(body.action, { signal }));
    }),
  );
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      parseBody(EmptyBody, req.query);
      await respond(res, async () => ({ operations: await panel(req).list() }));
    }),
  );
  router.get(
    '/index',
    asyncHandler(async (req, res) => {
      parseBody(EmptyBody, req.query);
      await withDisconnect(req, res, async (signal) => ({
        paths: await panel(req).stagedPaths({ signal }),
      }));
    }),
  );
  router.get(
    '/:operationId',
    asyncHandler(async (req, res) => {
      const id = operationId(req);
      parseBody(EmptyBody, req.query);
      await respond(res, () => panel(req).get(id));
    }),
  );
  router.post(
    '/:operationId/execute',
    asyncHandler(async (req, res) => {
      const id = operationId(req);
      const body = parseBody(ConfirmBody, req.body);
      await withDisconnect(req, res, (signal) =>
        panel(req).execute(id, { confirmed: body.confirmed, signal }),
      );
    }),
  );
  router.post(
    '/:operationId/cancel',
    asyncHandler(async (req, res) => {
      const id = operationId(req);
      parseBody(EmptyBody, req.body ?? {});
      await respond(res, () => panel(req).cancel(id));
    }),
  );
  router.post(
    '/:operationId/reconcile',
    asyncHandler(async (req, res) => {
      const id = operationId(req);
      parseBody(EmptyBody, req.body ?? {});
      await withDisconnect(req, res, (signal) => panel(req).reconcile(id, { signal }));
    }),
  );
  router.post(
    '/:operationId/acknowledge',
    asyncHandler(async (req, res) => {
      const id = operationId(req);
      const body = parseBody(ConfirmBody, req.body);
      await respond(res, () => panel(req).acknowledge(id, body));
    }),
  );
  router.delete(
    '/:operationId',
    asyncHandler(async (req, res) => {
      const id = operationId(req);
      const body = parseBody(ConfirmBody, req.body);
      await respond(res, async () => {
        await panel(req).deleteClosed(id, body);
        return { deleted: true };
      });
    }),
  );
  return router;
}
