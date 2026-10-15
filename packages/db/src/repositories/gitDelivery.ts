import {
  GitDeliveryReceiptSchema,
  type GitDeliveryReceipt,
  type GitDeliveryState,
} from '@agent-platform/contracts';
import { and, asc, eq, isNull, lt, lte, ne, sql } from 'drizzle-orm';
import type { DrizzleDb } from '../database.js';
import { approvalRequests, gitDeliveryOperations as table } from '../schema.js';

type OperationRow = typeof table.$inferSelect;
export interface StoredGitDeliveryOperation {
  receipt: GitDeliveryReceipt;
  repositoryRoot: string;
  agentId: string | null;
  toolCallId: string | null;
  actionKey: string;
  materialJson: string;
}
function fromRow(row: OperationRow): StoredGitDeliveryOperation {
  return {
    receipt: GitDeliveryReceiptSchema.parse({
      ...JSON.parse(row.receiptJson),
      state: row.state,
      updatedAtMs: row.updatedAtMs,
      ...(row.acknowledgedAtMs === null ? {} : { acknowledgedAtMs: row.acknowledgedAtMs }),
    }),
    repositoryRoot: row.repositoryRoot,
    agentId: row.agentId,
    toolCallId: row.toolCallId,
    actionKey: row.actionKey,
    materialJson: row.materialJson,
  };
}
export function getGitDeliveryOperation(
  db: DrizzleDb,
  id: string,
): StoredGitDeliveryOperation | undefined {
  const row = db.select().from(table).where(eq(table.id, id)).get();
  return row ? fromRow(row) : undefined;
}
export function findGitDeliveryCall(
  db: DrizzleDb,
  sessionId: string,
  toolCallId: string,
): StoredGitDeliveryOperation | undefined {
  const row = db
    .select()
    .from(table)
    .where(and(eq(table.sessionId, sessionId), eq(table.toolCallId, toolCallId)))
    .get();
  return row ? fromRow(row) : undefined;
}
export function listGitDeliveryOperations(
  db: DrizzleDb,
  projectId: string,
): StoredGitDeliveryOperation[] {
  return db
    .select()
    .from(table)
    .where(eq(table.projectId, projectId))
    .orderBy(asc(table.createdAtMs))
    .all()
    .map(fromRow);
}
export function insertGitDeliveryOperation(
  db: DrizzleDb,
  operation: StoredGitDeliveryOperation,
): void {
  const { receipt } = operation;
  db.insert(table)
    .values({
      id: receipt.id,
      projectId: receipt.projectId,
      repositoryRoot: operation.repositoryRoot,
      source: receipt.source,
      sessionId: receipt.sessionId ?? null,
      agentId: operation.agentId,
      toolCallId: operation.toolCallId,
      actionKey: operation.actionKey,
      state: receipt.state,
      receiptJson: JSON.stringify(receipt),
      materialJson: operation.materialJson,
      createdAtMs: receipt.createdAtMs,
      updatedAtMs: receipt.updatedAtMs,
      expiresAtMs: receipt.expiresAtMs,
    })
    .run();
}
/** Compare-and-set; never inserts missing/pruned IDs. SQLite also permits only one executing row per repo. */
export function transitionGitDeliveryOperation(
  db: DrizzleDb,
  id: string,
  expected: GitDeliveryState,
  receipt: GitDeliveryReceipt,
  materialJson?: string,
): boolean {
  return (
    db
      .update(table)
      .set({
        state: receipt.state,
        receiptJson: JSON.stringify(receipt),
        updatedAtMs: receipt.updatedAtMs,
        acknowledgedAtMs: receipt.acknowledgedAtMs ?? null,
        ...(materialJson === undefined ? {} : { materialJson }),
      })
      .where(and(eq(table.id, id), eq(table.state, expected)))
      .run().changes === 1
  );
}
export function hasUnacknowledgedGitDelivery(
  db: DrizzleDb,
  repositoryRoot: string,
  actionKey: string,
): boolean {
  return Boolean(
    db
      .select({ id: table.id })
      .from(table)
      .where(
        and(
          eq(table.repositoryRoot, repositoryRoot),
          eq(table.actionKey, actionKey),
          eq(table.state, 'unknown'),
          isNull(table.acknowledgedAtMs),
        ),
      )
      .get(),
  );
}
export function isClosedGitDelivery(receipt: GitDeliveryReceipt): boolean {
  return (
    receipt.state !== 'prepared' &&
    receipt.state !== 'executing' &&
    (receipt.state !== 'unknown' || receipt.acknowledgedAtMs !== undefined)
  );
}
/** Called at API read/prepare/execute boundaries; only unclaimed work may expire. */
export function maintainGitDeliveryOperations(db: DrizzleDb, now: number): void {
  db.transaction((tx) => {
    tx.update(table)
      .set({ state: 'expired', updatedAtMs: now })
      .where(and(eq(table.state, 'prepared'), lte(table.expiresAtMs, now)))
      .run();
    tx.update(approvalRequests)
      .set({ status: 'expired', decidedAtMs: now })
      .where(
        and(
          eq(approvalRequests.status, 'pending'),
          sql`CASE WHEN json_valid(${approvalRequests.executionPayloadJson}) THEN json_extract(${approvalRequests.executionPayloadJson}, '$.gitDeliveryBinding.operationId') ELSE NULL END IN (SELECT id FROM git_delivery_operations WHERE state = 'expired')`,
        ),
      )
      .run();
    tx.delete(table)
      .where(
        and(
          lt(table.updatedAtMs, now - 30 * 24 * 60 * 60 * 1000),
          ne(table.state, 'prepared'),
          ne(table.state, 'executing'),
          sql`(${table.state} != 'unknown' OR ${table.acknowledgedAtMs} IS NOT NULL)`,
        ),
      )
      .run();
  });
}
/** Call once at API host startup before accepting work, never for an auxiliary DB connection. */
export function recoverGitDeliveryOperations(db: DrizzleDb, now: number): void {
  db.update(table)
    .set({ state: 'unknown', updatedAtMs: now })
    .where(eq(table.state, 'executing'))
    .run();
  maintainGitDeliveryOperations(db, now);
}
export function deleteClosedGitDeliveryOperation(db: DrizzleDb, id: string): boolean {
  return (
    db
      .delete(table)
      .where(
        and(
          eq(table.id, id),
          ne(table.state, 'prepared'),
          ne(table.state, 'executing'),
          sql`(${table.state} != 'unknown' OR ${table.acknowledgedAtMs} IS NOT NULL)`,
        ),
      )
      .run().changes === 1
  );
}
