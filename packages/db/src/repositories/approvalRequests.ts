import type {
  ApprovalRequest,
  ApprovalRequestQuery,
  ApprovalRequestStatus,
  RiskTier,
} from '@agent-platform/contracts';
import { ApprovalRequestSchema, redactArgs } from '@agent-platform/contracts';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';

type ApprovalRequestRow = typeof schema.approvalRequests.$inferSelect;

export class ApprovalRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Approval request not found: ${id}`);
    this.name = 'ApprovalRequestNotFoundError';
  }
}

export class ApprovalRequestTransitionError extends Error {
  constructor(
    readonly id: string,
    readonly currentStatus: ApprovalRequestStatus,
    readonly requestedStatus: ApprovalRequestStatus,
  ) {
    super(`Cannot transition approval request ${id} from ${currentStatus} to ${requestedStatus}`);
    this.name = 'ApprovalRequestTransitionError';
  }
}

function rowToContract(row: ApprovalRequestRow): ApprovalRequest {
  return ApprovalRequestSchema.parse({
    id: row.id,
    sessionId: row.sessionId,
    runId: row.runId,
    agentId: row.agentId,
    toolName: row.toolName,
    argsJson: row.argsJson,
    executionPayloadJson: row.executionPayloadJson ?? undefined,
    riskTier: row.riskTier,
    status: row.status,
    createdAtMs: row.createdAtMs,
    decidedAtMs: row.decidedAtMs ?? undefined,
    expiresAtMs: row.expiresAtMs ?? undefined,
    decisionReason: row.decisionReason ?? undefined,
  });
}

export interface ApprovalRequestCreate {
  id: string;
  sessionId: string;
  runId: string;
  agentId: string;
  toolName: string;
  args: Record<string, unknown>;
  executionPayloadJson?: string;
  riskTier: RiskTier;
  createdAtMs: number;
  expiresAtMs?: number;
}

export function createApprovalRequest(
  db: DrizzleDb,
  request: ApprovalRequestCreate,
): ApprovalRequest {
  const argsJson = JSON.stringify(redactArgs(request.args));
  db.insert(schema.approvalRequests)
    .values({
      id: request.id,
      sessionId: request.sessionId,
      runId: request.runId,
      agentId: request.agentId,
      toolName: request.toolName,
      argsJson,
      executionPayloadJson: request.executionPayloadJson ?? null,
      riskTier: request.riskTier,
      status: 'pending',
      createdAtMs: request.createdAtMs,
      expiresAtMs: request.expiresAtMs ?? null,
    })
    .run();

  return getApprovalRequest(db, request.id);
}

export function getApprovalRequest(db: DrizzleDb, id: string): ApprovalRequest {
  const row = db
    .select()
    .from(schema.approvalRequests)
    .where(eq(schema.approvalRequests.id, id))
    .get();
  if (!row) throw new ApprovalRequestNotFoundError(id);
  return rowToContract(row);
}

function buildQueryConditions(query: ApprovalRequestQuery) {
  const conditions = [];
  if (query.sessionId) conditions.push(eq(schema.approvalRequests.sessionId, query.sessionId));
  if (query.runId) conditions.push(eq(schema.approvalRequests.runId, query.runId));
  if (query.agentId) conditions.push(eq(schema.approvalRequests.agentId, query.agentId));
  if (query.toolName) conditions.push(eq(schema.approvalRequests.toolName, query.toolName));
  if (query.riskTier) conditions.push(eq(schema.approvalRequests.riskTier, query.riskTier));
  if (query.status) conditions.push(eq(schema.approvalRequests.status, query.status));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function listApprovalRequests(
  db: DrizzleDb,
  query: ApprovalRequestQuery,
): ApprovalRequest[] {
  const rows = db
    .select()
    .from(schema.approvalRequests)
    .where(buildQueryConditions(query))
    .orderBy(desc(schema.approvalRequests.createdAtMs))
    .limit(query.limit ?? 100)
    .offset(query.offset ?? 0)
    .all();

  return rows.map(rowToContract);
}

export function countApprovalRequests(db: DrizzleDb, query: ApprovalRequestQuery): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.approvalRequests)
    .where(buildQueryConditions(query))
    .get();

  return result?.count ?? 0;
}

function decideApprovalRequest(
  db: DrizzleDb,
  id: string,
  status: ApprovalRequestStatus,
  decidedAtMs: number,
  reason?: string,
): ApprovalRequest {
  const current = getApprovalRequest(db, id);

  if (current.status !== 'pending') {
    if (current.status === status) return current;
    throw new ApprovalRequestTransitionError(id, current.status, status);
  }

  db.update(schema.approvalRequests)
    .set({
      status,
      decidedAtMs,
      decisionReason: reason ?? null,
    })
    .where(eq(schema.approvalRequests.id, id))
    .run();

  return getApprovalRequest(db, id);
}

export function approveApprovalRequest(
  db: DrizzleDb,
  id: string,
  decidedAtMs: number,
  reason?: string,
): ApprovalRequest {
  return decideApprovalRequest(db, id, 'approved', decidedAtMs, reason);
}

export function rejectApprovalRequest(
  db: DrizzleDb,
  id: string,
  decidedAtMs: number,
  reason?: string,
): ApprovalRequest {
  return decideApprovalRequest(db, id, 'rejected', decidedAtMs, reason);
}

export function expireApprovalRequest(
  db: DrizzleDb,
  id: string,
  decidedAtMs: number,
  reason?: string,
): ApprovalRequest {
  return decideApprovalRequest(db, id, 'expired', decidedAtMs, reason);
}
