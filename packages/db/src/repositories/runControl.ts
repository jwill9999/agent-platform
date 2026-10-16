import {
  RunControlRecordSchema,
  type RunControlRecord,
  type RunControlReason,
  type RunControlState,
} from '@agent-platform/contracts';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleDb } from '../database.js';
import {
  controlledRuns as runs,
  runAttempts as attempts,
  runExecutions as executions,
} from '../schema.js';

export class RunControlError extends Error {
  constructor(
    public readonly code:
      | 'run_not_found'
      | 'run_conflict'
      | 'run_not_running'
      | 'run_capacity'
      | 'run_invalid_transition',
  ) {
    super(code);
    this.name = 'RunControlError';
  }
}
const activeStates = ['running', 'waiting_for_approval', 'stop_requested'];
const settledStates = ['completed', 'cancelled', 'failed'];
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SETTLED = 10_000;
const MAX_UNRESOLVED = 1_000;
const MAX_ATTEMPTS = 10_000;
function validateMetadata(id: string, nowMs: number): void {
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(id) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new RunControlError('run_invalid_transition');
  }
}

/** Synchronous only: restore the caller's busy policy even after rollback/lock failure. */
function write<T>(db: DrizzleDb, action: (tx: DrizzleDb) => T): T {
  const previous = db.get<{ timeout: number }>(sql`PRAGMA busy_timeout`)!.timeout;
  db.run(sql`PRAGMA busy_timeout = 250`);
  try {
    return db.transaction((tx) => action(tx as unknown as DrizzleDb), { behavior: 'immediate' });
  } finally {
    db.run(sql.raw(`PRAGMA busy_timeout = ${previous}`));
  }
}
function fromRow(db: DrizzleDb, row: typeof runs.$inferSelect): RunControlRecord {
  const count = db
    .select({ value: sql<number>`count(*)` })
    .from(attempts)
    .where(and(eq(attempts.runId, row.id), inArray(attempts.outcome, ['running', 'unknown'])))
    .get()!.value;
  return RunControlRecordSchema.parse({
    ...row,
    projectId: row.projectId ?? undefined,
    stopRequestedAtMs: row.stopRequestedAtMs ?? undefined,
    stopAcknowledgedAtMs: row.stopAcknowledgedAtMs ?? undefined,
    settledAtMs: row.settledAtMs ?? undefined,
    inFlight: count,
  });
}
export function getControlledRun(
  db: DrizzleDb,
  sessionId: string,
  id: string,
): RunControlRecord | undefined {
  const row = db
    .select()
    .from(runs)
    .where(and(eq(runs.id, id), eq(runs.sessionId, sessionId)))
    .get();
  return row ? fromRow(db, row) : undefined;
}
function requireRun(db: DrizzleDb, sessionId: string, id: string): RunControlRecord {
  const value = getControlledRun(db, sessionId, id);
  if (!value) throw new RunControlError('run_not_found');
  return value;
}
export function getSessionActiveRun(
  db: DrizzleDb,
  sessionId: string,
): RunControlRecord | undefined {
  const row = db
    .select()
    .from(runs)
    .where(and(eq(runs.sessionId, sessionId), inArray(runs.state, activeStates)))
    .get();
  return row ? fromRow(db, row) : undefined;
}
export function getSessionLatestRun(
  db: DrizzleDb,
  sessionId: string,
): RunControlRecord | undefined {
  const row = db
    .select()
    .from(runs)
    .where(eq(runs.sessionId, sessionId))
    .orderBy(desc(runs.createdAtMs), desc(runs.id))
    .get();
  return row ? fromRow(db, row) : undefined;
}
export function getRunForExecution(
  db: DrizzleDb,
  executionId: string,
): RunControlRecord | undefined {
  const row = db
    .select({ run: runs })
    .from(executions)
    .innerJoin(runs, eq(executions.runId, runs.id))
    .where(eq(executions.executionId, executionId))
    .get();
  return row ? fromRow(db, row.run) : undefined;
}
const approvalFence = sql`EXISTS (SELECT 1 FROM run_executions e JOIN approval_requests a ON a.run_id = e.execution_id WHERE e.run_id = controlled_runs.id AND a.resumed_at_ms IS NULL AND a.status IN ('pending', 'approved', 'rejected'))`;
function maintain(db: DrizzleDb, nowMs: number): void {
  db.delete(runs)
    .where(
      sql`${runs.settledAtMs} IS NOT NULL AND ${runs.settledAtMs} < ${nowMs - RETENTION_MS} AND NOT ${approvalFence}`,
    )
    .run();
  db.delete(runs)
    .where(
      sql`${runs.id} IN (SELECT id FROM controlled_runs WHERE settled_at_ms IS NOT NULL AND NOT ${approvalFence} ORDER BY settled_at_ms DESC, id DESC LIMIT -1 OFFSET ${MAX_SETTLED})`,
    )
    .run();
}
export function createControlledRun(
  db: DrizzleDb,
  input: {
    id: string;
    sessionId: string;
    projectId?: string;
    processInstanceId: string;
    executionId: string;
    nowMs: number;
  },
): RunControlRecord {
  validateMetadata(input.executionId, input.nowMs);
  RunControlRecordSchema.parse({
    id: input.id,
    sessionId: input.sessionId,
    projectId: input.projectId,
    processInstanceId: input.processInstanceId,
    state: 'running',
    version: 1,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
    reason: 'none',
    inFlight: 0,
  });
  return write(db, (tx) => {
    maintain(tx, input.nowMs);
    if (getSessionActiveRun(tx, input.sessionId)) throw new RunControlError('run_conflict');
    const unresolved = tx.get<{ count: number }>(
      sql`SELECT count(*) AS count FROM controlled_runs WHERE settled_at_ms IS NULL OR ${approvalFence}`,
    )!.count;
    if (unresolved >= MAX_UNRESOLVED) throw new RunControlError('run_capacity');
    tx.insert(runs)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        projectId: input.projectId,
        processInstanceId: input.processInstanceId,
        state: 'running',
        createdAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
      })
      .run();
    tx.insert(executions).values({ executionId: input.executionId, runId: input.id }).run();
    return requireRun(tx, input.sessionId, input.id);
  });
}
export function attachRunExecution(
  db: DrizzleDb,
  input: {
    runId: string;
    executionId: string;
    sessionId: string;
    nowMs: number;
  },
): RunControlRecord {
  validateMetadata(input.executionId, input.nowMs);
  return write(db, (tx) => {
    const current = requireRun(tx, input.sessionId, input.runId);
    if (current.state !== 'waiting_for_approval' || current.inFlight !== 0)
      throw new RunControlError('run_not_running');
    const executionCount = tx
      .select({ value: sql<number>`count(*)` })
      .from(executions)
      .where(eq(executions.runId, input.runId))
      .get()!.value;
    if (executionCount >= MAX_ATTEMPTS) throw new RunControlError('run_capacity');
    tx.insert(executions).values({ executionId: input.executionId, runId: input.runId }).run();
    tx.update(runs)
      .set({ state: 'running', updatedAtMs: input.nowMs, version: current.version + 1 })
      .where(eq(runs.id, current.id))
      .run();
    return requireRun(tx, input.sessionId, input.runId);
  });
}
export function requestRunStop(
  db: DrizzleDb,
  input: {
    runId: string;
    sessionId: string;
    nowMs: number;
  },
): RunControlRecord {
  return write(db, (tx) => {
    const current = requireRun(tx, input.sessionId, input.runId);
    if (
      current.stopAcknowledgedAtMs !== undefined ||
      !['running', 'waiting_for_approval'].includes(current.state)
    )
      return current;
    tx.update(runs)
      .set({
        state: 'stop_requested',
        reason: 'user_stop',
        stopRequestedAtMs: input.nowMs,
        stopAcknowledgedAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
        version: current.version + 1,
      })
      .where(eq(runs.id, current.id))
      .run();
    return requireRun(tx, input.sessionId, input.runId);
  });
}
export function beginRunAttempt(
  db: DrizzleDb,
  input: {
    id: string;
    runId: string;
    executionId: string;
    kind: 'model' | 'tool' | 'sensor' | 'setup';
    nowMs: number;
  },
): void {
  validateMetadata(input.id, input.nowMs);
  write(db, (tx) => {
    const run = getRunForExecution(tx, input.executionId);
    if (!run || run.id !== input.runId || run.state !== 'running')
      throw new RunControlError('run_not_running');
    const count = tx
      .select({ value: sql<number>`count(*)` })
      .from(attempts)
      .where(eq(attempts.runId, input.runId))
      .get()!.value;
    if (count >= MAX_ATTEMPTS) throw new RunControlError('run_capacity');
    tx.insert(attempts)
      .values({ ...input, admittedAtMs: input.nowMs, outcome: 'running' })
      .run();
    tx.update(runs)
      .set({ updatedAtMs: input.nowMs, version: run.version + 1 })
      .where(eq(runs.id, run.id))
      .run();
  });
}
export function settleRunAttempt(
  db: DrizzleDb,
  input: {
    id: string;
    runId: string;
    nowMs: number;
    outcome: 'succeeded' | 'failed' | 'unknown';
  },
): RunControlRecord {
  return write(db, (tx) => {
    const attempt = tx
      .select()
      .from(attempts)
      .where(and(eq(attempts.id, input.id), eq(attempts.runId, input.runId)))
      .get();
    const row = tx.select().from(runs).where(eq(runs.id, input.runId)).get();
    if (!attempt || !row) throw new RunControlError('run_not_found');
    if (['running', 'unknown'].includes(attempt.outcome)) {
      tx.update(attempts)
        .set({
          outcome: input.outcome,
          settledAtMs: input.outcome === 'unknown' ? null : input.nowMs,
        })
        .where(eq(attempts.id, input.id))
        .run();
      tx.update(runs)
        .set({ updatedAtMs: input.nowMs, version: row.version + 1 })
        .where(eq(runs.id, row.id))
        .run();
    }
    return requireRun(tx, row.sessionId, row.id);
  });
}
export function finishControlledRun(
  db: DrizzleDb,
  input: {
    runId: string;
    sessionId: string;
    state: RunControlState;
    reason?: RunControlReason;
    nowMs: number;
  },
): RunControlRecord {
  return write(db, (tx) => {
    const current = requireRun(tx, input.sessionId, input.runId);
    if (settledStates.includes(current.state)) return current;
    if (input.state === 'running' || input.state === 'stop_requested')
      throw new RunControlError('run_invalid_transition');
    if (current.state === 'interrupted') return current;
    if (current.state === 'outcome_unknown' && input.state === 'waiting_for_approval') {
      throw new RunControlError('run_invalid_transition');
    }
    let state = input.state;
    if (current.inFlight > 0) state = 'outcome_unknown';
    else if (
      current.stopAcknowledgedAtMs !== undefined &&
      !(state === 'failed' && input.reason === 'execution_failed')
    )
      state = 'cancelled';
    else if (state === 'cancelled') throw new RunControlError('run_invalid_transition');
    let reason =
      input.reason === undefined || (current.state === 'outcome_unknown' && input.reason === 'none')
        ? current.reason
        : input.reason;
    if (current.stopAcknowledgedAtMs !== undefined) reason = 'user_stop';
    if (state === 'failed' && input.reason === 'execution_failed') reason = 'execution_failed';
    tx.update(runs)
      .set({
        state,
        reason,
        updatedAtMs: input.nowMs,
        settledAtMs: settledStates.includes(state) ? input.nowMs : null,
        version: current.version + 1,
      })
      .where(eq(runs.id, current.id))
      .run();
    maintain(tx, input.nowMs);
    return requireRun(tx, input.sessionId, input.runId);
  });
}
export function markPreviousProcessRunsUnknown(
  db: DrizzleDb,
  processInstanceId: string,
  nowMs: number,
): number {
  return write(db, (tx) => {
    const rows = tx
      .select()
      .from(runs)
      .where(
        sql`${runs.processInstanceId} != ${processInstanceId} AND ${runs.state} IN ('running', 'waiting_for_approval', 'stop_requested')`,
      )
      .all();
    for (const row of rows) {
      const current = fromRow(tx, row);
      tx.update(runs)
        .set({
          state: current.inFlight > 0 ? 'outcome_unknown' : 'interrupted',
          reason: current.reason === 'user_stop' ? 'user_stop' : 'process_interrupted',
          updatedAtMs: nowMs,
          version: current.version + 1,
        })
        .where(eq(runs.id, row.id))
        .run();
    }
    return rows.length;
  });
}
