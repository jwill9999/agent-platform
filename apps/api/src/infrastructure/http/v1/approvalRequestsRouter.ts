import {
  ApprovalRequestDecisionBodySchema,
  ApprovalRequestQuerySchema,
} from '@agent-platform/contracts';
import {
  ApprovalRequestNotFoundError,
  ApprovalRequestTransitionError,
  approveApprovalRequest,
  countApprovalRequests,
  expireApprovalRequest,
  getApprovalRequest,
  listApprovalRequests,
  rejectApprovalRequest,
  type DrizzleDb,
} from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

function mapApprovalError(error: unknown): never {
  if (error instanceof ApprovalRequestNotFoundError) {
    throw new HttpError(404, 'NOT_FOUND', error.message);
  }
  if (error instanceof ApprovalRequestTransitionError) {
    throw new HttpError(409, 'INVALID_APPROVAL_TRANSITION', error.message, {
      id: error.id,
      currentStatus: error.currentStatus,
      requestedStatus: error.requestedStatus,
    });
  }
  throw error;
}

function decideAtNow(): number {
  return Date.now();
}

export function createApprovalRequestsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = ApprovalRequestQuerySchema.parse(req.query);
      const data = listApprovalRequests(db, query);
      const total = countApprovalRequests(db, query);
      res.json({ data, total, limit: query.limit, offset: query.offset });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      try {
        res.json({ data: getApprovalRequest(db, id) });
      } catch (error) {
        mapApprovalError(error);
      }
    }),
  );

  router.post(
    '/:id/approve',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const body = parseBody(ApprovalRequestDecisionBodySchema, req.body ?? {});
      try {
        res.json({ data: approveApprovalRequest(db, id, decideAtNow(), body.reason) });
      } catch (error) {
        mapApprovalError(error);
      }
    }),
  );

  router.post(
    '/:id/reject',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const body = parseBody(ApprovalRequestDecisionBodySchema, req.body ?? {});
      try {
        res.json({ data: rejectApprovalRequest(db, id, decideAtNow(), body.reason) });
      } catch (error) {
        mapApprovalError(error);
      }
    }),
  );

  router.post(
    '/:id/expire',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const body = parseBody(ApprovalRequestDecisionBodySchema, req.body ?? {});
      try {
        res.json({ data: expireApprovalRequest(db, id, decideAtNow(), body.reason) });
      } catch (error) {
        mapApprovalError(error);
      }
    }),
  );

  return router;
}
