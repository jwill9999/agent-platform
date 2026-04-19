import type { ToolExecution, ToolExecutionQuery } from '@agent-platform/contracts';
import { ToolExecutionSchema } from '@agent-platform/contracts';
import { eq, and, desc, sql } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';

// ---------------------------------------------------------------------------
// Row ↔ Contract mappers
// ---------------------------------------------------------------------------

type ToolExecRow = typeof schema.toolExecutions.$inferSelect;

function rowToContract(row: ToolExecRow): ToolExecution {
  return ToolExecutionSchema.parse({
    id: row.id,
    toolName: row.toolName,
    agentId: row.agentId,
    sessionId: row.sessionId,
    argsJson: row.argsJson,
    resultJson: row.resultJson ?? undefined,
    riskTier: row.riskTier ?? undefined,
    status: row.status,
    startedAtMs: row.startedAtMs,
    completedAtMs: row.completedAtMs ?? undefined,
    durationMs: row.durationMs ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface ToolExecutionInsert {
  id: string;
  toolName: string;
  agentId: string;
  sessionId: string;
  argsJson: string;
  riskTier?: string;
  status: string;
  startedAtMs: number;
}

export function insertToolExecution(db: DrizzleDb, entry: ToolExecutionInsert): void {
  db.insert(schema.toolExecutions)
    .values({
      id: entry.id,
      toolName: entry.toolName,
      agentId: entry.agentId,
      sessionId: entry.sessionId,
      argsJson: entry.argsJson,
      riskTier: entry.riskTier ?? null,
      status: entry.status,
      startedAtMs: entry.startedAtMs,
    })
    .run();
}

export interface ToolExecutionComplete {
  resultJson: string;
  status: string;
  completedAtMs: number;
  durationMs: number;
}

export function completeToolExecution(
  db: DrizzleDb,
  id: string,
  data: ToolExecutionComplete,
): void {
  db.update(schema.toolExecutions)
    .set({
      resultJson: data.resultJson,
      status: data.status,
      completedAtMs: data.completedAtMs,
      durationMs: data.durationMs,
    })
    .where(eq(schema.toolExecutions.id, id))
    .run();
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export function queryToolExecutions(db: DrizzleDb, query: ToolExecutionQuery): ToolExecution[] {
  const conditions = [];
  if (query.agentId) conditions.push(eq(schema.toolExecutions.agentId, query.agentId));
  if (query.sessionId) conditions.push(eq(schema.toolExecutions.sessionId, query.sessionId));
  if (query.toolName) conditions.push(eq(schema.toolExecutions.toolName, query.toolName));
  if (query.riskTier) conditions.push(eq(schema.toolExecutions.riskTier, query.riskTier));
  if (query.status) conditions.push(eq(schema.toolExecutions.status, query.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = db
    .select()
    .from(schema.toolExecutions)
    .where(where)
    .orderBy(desc(schema.toolExecutions.startedAtMs))
    .limit(query.limit ?? 100)
    .offset(query.offset ?? 0)
    .all();

  return rows.map(rowToContract);
}

export function countToolExecutions(db: DrizzleDb, query: ToolExecutionQuery): number {
  const conditions = [];
  if (query.agentId) conditions.push(eq(schema.toolExecutions.agentId, query.agentId));
  if (query.sessionId) conditions.push(eq(schema.toolExecutions.sessionId, query.sessionId));
  if (query.toolName) conditions.push(eq(schema.toolExecutions.toolName, query.toolName));
  if (query.riskTier) conditions.push(eq(schema.toolExecutions.riskTier, query.riskTier));
  if (query.status) conditions.push(eq(schema.toolExecutions.status, query.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.toolExecutions)
    .where(where)
    .get();

  return result?.count ?? 0;
}
