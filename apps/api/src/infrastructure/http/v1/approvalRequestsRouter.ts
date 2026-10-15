import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { isGitDeliveryTool, parseGitDeliveryToolAction } from '@agent-platform/harness';
import { createGitDeliveryService } from '../../../application/gitDelivery/index.js';
import {
  GitDeliveryReceiptSchema,
  type ApprovalRequest,
  type GitDeliveryReceipt,
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
  getGitDeliveryOperation,
  listApprovalRequests,
  listRetainedGitDeliveryApprovals,
  getSession,
  getAgent,
  findProject,
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

async function gitDecisionPreparation(db: DrizzleDb, id: string) {
  const approval = getApprovalRequest(db, id);
  if (!isGitDeliveryTool(approval.toolName)) return undefined;
  try {
    const payload = z
      .object({
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        args: z.record(z.string(), z.unknown()),
        gitDeliveryBinding: z.object({ operationId: z.string().uuid() }).strict(),
      })
      .strict()
      .parse(JSON.parse(approval.executionPayloadJson ?? '{}'));
    const action = parseGitDeliveryToolAction(payload.toolName, payload.args);
    const operation = getGitDeliveryOperation(db, payload.gitDeliveryBinding.operationId);
    if (
      !operation ||
      payload.toolName !== approval.toolName ||
      operation.toolCallId !== payload.toolCallId ||
      operation.receipt.source !== 'chat' ||
      operation.receipt.sessionId !== approval.sessionId ||
      operation.agentId !== approval.agentId ||
      JSON.stringify(operation.receipt.action) !== JSON.stringify(action)
    )
      throw new Error('Changed binding');
    const port = createGitDeliveryService(db).chat({
      sessionId: approval.sessionId,
      agentId: approval.agentId,
    });
    await port.get(operation.receipt.id); // Persisted actor/Project ownership only: no filesystem needed to refuse an effect.
    return {
      approval,
      cancel: (reason: 'denied' | 'cancelled') => port.cancel(operation.receipt.id, reason),
    };
  } catch {
    throw new HttpError(
      409,
      'GIT_DELIVERY_APPROVAL_INVALID',
      'Git approval no longer matches an owned prepared operation.',
    );
  }
}

function validPublicGitApproval(
  approval: ApprovalRequest,
  operation: NonNullable<ReturnType<typeof getGitDeliveryOperation>>,
): boolean {
  try {
    const payload = z
      .object({
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        args: z.record(z.string(), z.unknown()),
        gitDeliveryBinding: z.object({ operationId: z.string().uuid() }).strict(),
      })
      .strict()
      .parse(JSON.parse(approval.executionPayloadJson ?? '{}'));
    const preview = z
      .object({ gitDeliveryReceipt: GitDeliveryReceiptSchema })
      .strict()
      .parse(JSON.parse(approval.argsJson)).gitDeliveryReceipt;
    const receipt = operation.receipt;
    const immutable = (value: GitDeliveryReceipt) => ({
      id: value.id,
      projectId: value.projectId,
      sessionId: value.sessionId,
      source: value.source,
      action: value.action,
      createdAtMs: value.createdAtMs,
      expiresAtMs: value.expiresAtMs,
      review: value.review,
    });
    return (
      isGitDeliveryTool(approval.toolName) &&
      payload.toolName === approval.toolName &&
      payload.gitDeliveryBinding.operationId === receipt.id &&
      payload.toolCallId === operation.toolCallId &&
      approval.sessionId === receipt.sessionId &&
      approval.agentId === operation.agentId &&
      isDeepStrictEqual(
        parseGitDeliveryToolAction(payload.toolName, payload.args),
        receipt.action,
      ) &&
      isDeepStrictEqual(immutable(preview), immutable(receipt))
    );
  } catch {
    return false;
  }
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
    '/git-delivery',
    asyncHandler(async (req, res) => {
      const { sessionId } = z
        .object({ sessionId: z.string().min(1) })
        .strict()
        .parse(req.query);
      const session = getSession(db, sessionId);
      const project = session?.projectId ? findProject(db, session.projectId) : undefined;
      if (session && session.mode !== 'project') {
        res.json({ data: { approvals: [], recoveryReceipts: [] } });
        return;
      }
      if (
        !session ||
        session.mode !== 'project' ||
        !project ||
        project.archivedAtMs ||
        !getAgent(db, session.agentId)
      )
        throw new HttpError(
          404,
          'GIT_DELIVERY_PROJECT_UNAVAILABLE',
          'Git delivery history is unavailable for this session.',
        );
      const rows = listRetainedGitDeliveryApprovals(db, project.id, session.id, session.agentId);
      const candidates = new Map<string, Array<ApprovalRequest | undefined>>();
      for (const row of rows)
        candidates.set(row.operationId, [...(candidates.get(row.operationId) ?? []), row.approval]);
      const approvals: Array<
        Omit<ApprovalRequest, 'executionPayloadJson'> & { executionPayloadJson: null }
      > = [];
      const recoveryReceipts: GitDeliveryReceipt[] = [];
      for (const [id, matches] of candidates) {
        const operation = getGitDeliveryOperation(db, id);
        if (
          !operation ||
          operation.receipt.projectId !== project.id ||
          operation.receipt.source !== 'chat' ||
          operation.receipt.sessionId !== session.id ||
          operation.agentId !== session.agentId
        )
          continue;
        const approval = matches.length === 1 ? matches[0] : undefined;
        if (approval && validPublicGitApproval(approval, operation)) {
          // Preserve real status and timestamps; private execution authority never leaves this read.
          approvals.push({
            ...approval,
            argsJson: JSON.stringify({ gitDeliveryReceipt: operation.receipt }),
            executionPayloadJson: null,
          });
        } else recoveryReceipts.push(operation.receipt);
      }
      res.json({ data: { approvals, recoveryReceipts } });
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
        const git = await gitDecisionPreparation(db, id);
        const decision =
          git?.approval.status === 'rejected'
            ? git.approval
            : rejectApprovalRequest(db, id, decideAtNow(), body.reason);
        if (git) await git.cancel('denied');
        res.json({ data: decision });
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
        const git = await gitDecisionPreparation(db, id);
        const decision =
          git?.approval.status === 'expired'
            ? git.approval
            : expireApprovalRequest(db, id, decideAtNow(), body.reason);
        if (git) await git.cancel('cancelled');
        res.json({ data: decision });
      } catch (error) {
        mapApprovalError(error);
      }
    }),
  );

  return router;
}
