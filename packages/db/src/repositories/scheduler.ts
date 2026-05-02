import { randomUUID } from 'node:crypto';

import type {
  ScheduledJobCreateBody,
  ScheduledJobQuery,
  ScheduledJobRecord,
  ScheduledJobRunCreateBody,
  ScheduledJobRunLogCreateBody,
  ScheduledJobRunLogRecord,
  ScheduledJobRunQuery,
  ScheduledJobRunRecord,
  ScheduledJobRunStatus,
  ScheduledJobStatus,
  ScheduledJobUpdateBody,
} from '@agent-platform/contracts';
import {
  ScheduledJobCreateBodySchema,
  ScheduledJobQuerySchema,
  ScheduledJobRecordSchema,
  ScheduledJobRunCreateBodySchema,
  ScheduledJobRunLogCreateBodySchema,
  ScheduledJobRunLogRecordSchema,
  ScheduledJobRunQuerySchema,
  ScheduledJobRunRecordSchema,
  ScheduledJobUpdateBodySchema,
} from '@agent-platform/contracts';
import { and, asc, desc, eq, isNull, lte, or, sql } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';

type ScheduledJobRow = typeof schema.scheduledJobs.$inferSelect;
type ScheduledJobRunRow = typeof schema.scheduledJobRuns.$inferSelect;
type ScheduledJobRunLogRow = typeof schema.scheduledJobRunLogs.$inferSelect;

const TERMINAL_RUN_STATUSES = new Set<ScheduledJobRunStatus>(['succeeded', 'failed', 'cancelled']);

const RUN_TRANSITIONS: Record<ScheduledJobRunStatus, readonly ScheduledJobRunStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: ['queued'],
  cancelled: [],
};

export class ScheduledJobNotFoundError extends Error {
  constructor(id: string) {
    super(`Scheduled job not found: ${id}`);
    this.name = 'ScheduledJobNotFoundError';
  }
}

export class ScheduledJobRunNotFoundError extends Error {
  constructor(id: string) {
    super(`Scheduled job run not found: ${id}`);
    this.name = 'ScheduledJobRunNotFoundError';
  }
}

export class ScheduledJobTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid scheduled job run transition: ${from} -> ${to}`);
    this.name = 'ScheduledJobTransitionError';
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function rowToJob(row: ScheduledJobRow): ScheduledJobRecord {
  return ScheduledJobRecordSchema.parse({
    id: row.id,
    scope: row.scope,
    scopeId: row.scopeId ?? undefined,
    projectId: row.projectId ?? undefined,
    ownerAgentId: row.ownerAgentId ?? undefined,
    ownerSessionId: row.ownerSessionId ?? undefined,
    executionAgentId: row.executionAgentId ?? undefined,
    createdFromSessionId: row.createdFromSessionId ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    instructions: row.instructions,
    targetKind: row.targetKind,
    targetPayload: parseJsonObject(row.targetPayloadJson),
    scheduleType: row.scheduleType,
    runAtMs: row.runAtMs ?? undefined,
    intervalMs: row.intervalMs ?? undefined,
    cronExpression: row.cronExpression ?? undefined,
    timezone: row.timezone,
    nextRunAtMs: row.nextRunAtMs ?? undefined,
    status: row.status,
    retryPolicy: parseJsonObject(row.retryPolicyJson),
    timeoutMs: row.timeoutMs,
    lastRunAtMs: row.lastRunAtMs ?? undefined,
    leaseOwner: row.leaseOwner ?? undefined,
    leaseExpiresAtMs: row.leaseExpiresAtMs ?? undefined,
    metadata: parseJsonObject(row.metadataJson),
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  });
}

function rowToRun(row: ScheduledJobRunRow): ScheduledJobRunRecord {
  return ScheduledJobRunRecordSchema.parse({
    id: row.id,
    jobId: row.jobId,
    status: row.status,
    attempt: row.attempt,
    queuedAtMs: row.queuedAtMs,
    startedAtMs: row.startedAtMs ?? undefined,
    completedAtMs: row.completedAtMs ?? undefined,
    leaseOwner: row.leaseOwner ?? undefined,
    leaseExpiresAtMs: row.leaseExpiresAtMs ?? undefined,
    cancelRequestedAtMs: row.cancelRequestedAtMs ?? undefined,
    resultSummary: row.resultSummary ?? undefined,
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    metadata: parseJsonObject(row.metadataJson),
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  });
}

function rowToLog(row: ScheduledJobRunLogRow): ScheduledJobRunLogRecord {
  return ScheduledJobRunLogRecordSchema.parse({
    id: row.id,
    runId: row.runId,
    jobId: row.jobId,
    sequence: row.sequence,
    level: row.level,
    message: row.message,
    data: parseJsonObject(row.dataJson),
    truncated: row.truncated,
    createdAtMs: row.createdAtMs,
  });
}

function nextRunAtFor(input: ScheduledJobCreateBody): number | null {
  return input.nextRunAtMs ?? input.runAtMs ?? null;
}

export function createScheduledJob(
  db: DrizzleDb,
  rawInput: ScheduledJobCreateBody,
  options: { id?: string; nowMs?: number } = {},
): ScheduledJobRecord {
  const input = ScheduledJobCreateBodySchema.parse(rawInput);
  const nowMs = options.nowMs ?? Date.now();
  const id = options.id ?? randomUUID();

  db.insert(schema.scheduledJobs)
    .values({
      id,
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      projectId: input.projectId ?? null,
      ownerAgentId: input.ownerAgentId ?? null,
      ownerSessionId: input.ownerSessionId ?? null,
      executionAgentId: input.executionAgentId ?? null,
      createdFromSessionId: input.createdFromSessionId ?? null,
      name: input.name,
      description: input.description ?? null,
      instructions: input.instructions,
      targetKind: input.targetKind,
      targetPayloadJson: JSON.stringify(input.targetPayload),
      scheduleType: input.scheduleType,
      runAtMs: input.runAtMs ?? null,
      intervalMs: input.intervalMs ?? null,
      cronExpression: input.cronExpression ?? null,
      timezone: input.timezone,
      nextRunAtMs: nextRunAtFor(input),
      status: input.status,
      retryPolicyJson: JSON.stringify(input.retryPolicy),
      timeoutMs: input.timeoutMs,
      lastRunAtMs: input.lastRunAtMs ?? null,
      leaseOwner: input.leaseOwner ?? null,
      leaseExpiresAtMs: input.leaseExpiresAtMs ?? null,
      metadataJson: JSON.stringify(input.metadata),
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    })
    .run();

  return getScheduledJob(db, id);
}

export function getScheduledJob(db: DrizzleDb, id: string): ScheduledJobRecord {
  const row = db.select().from(schema.scheduledJobs).where(eq(schema.scheduledJobs.id, id)).get();
  if (!row) throw new ScheduledJobNotFoundError(id);
  return rowToJob(row);
}

function buildJobConditions(query: ScheduledJobQuery) {
  const conditions = [];
  if (query.scope) conditions.push(eq(schema.scheduledJobs.scope, query.scope));
  if (query.scopeId) conditions.push(eq(schema.scheduledJobs.scopeId, query.scopeId));
  if (query.projectId) conditions.push(eq(schema.scheduledJobs.projectId, query.projectId));
  if (query.ownerAgentId)
    conditions.push(eq(schema.scheduledJobs.ownerAgentId, query.ownerAgentId));
  if (query.ownerSessionId) {
    conditions.push(eq(schema.scheduledJobs.ownerSessionId, query.ownerSessionId));
  }
  if (query.executionAgentId) {
    conditions.push(eq(schema.scheduledJobs.executionAgentId, query.executionAgentId));
  }
  if (query.status) conditions.push(eq(schema.scheduledJobs.status, query.status));
  if (query.scheduleType)
    conditions.push(eq(schema.scheduledJobs.scheduleType, query.scheduleType));
  if (query.dueBeforeMs !== undefined) {
    conditions.push(lte(schema.scheduledJobs.nextRunAtMs, query.dueBeforeMs));
  }
  return conditions;
}

export function listScheduledJobs(
  db: DrizzleDb,
  rawQuery: Partial<ScheduledJobQuery> = {},
): ScheduledJobRecord[] {
  const query = ScheduledJobQuerySchema.parse(rawQuery);
  const conditions = buildJobConditions(query);
  const rows = db
    .select()
    .from(schema.scheduledJobs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(schema.scheduledJobs.nextRunAtMs), desc(schema.scheduledJobs.updatedAtMs))
    .limit(query.limit)
    .offset(query.offset)
    .all();
  return rows.map(rowToJob);
}

export function updateScheduledJob(
  db: DrizzleDb,
  id: string,
  patch: ScheduledJobUpdateBody,
  nowMs = Date.now(),
): ScheduledJobRecord {
  const existing = getScheduledJob(db, id);
  const parsed = ScheduledJobUpdateBodySchema.parse(patch);
  const next = ScheduledJobRecordSchema.parse({
    ...existing,
    ...parsed,
    description:
      parsed.description === undefined ? existing.description : (parsed.description ?? undefined),
    runAtMs: parsed.runAtMs === undefined ? existing.runAtMs : (parsed.runAtMs ?? undefined),
    intervalMs:
      parsed.intervalMs === undefined ? existing.intervalMs : (parsed.intervalMs ?? undefined),
    cronExpression:
      parsed.cronExpression === undefined
        ? existing.cronExpression
        : (parsed.cronExpression ?? undefined),
    nextRunAtMs:
      parsed.nextRunAtMs === undefined ? existing.nextRunAtMs : (parsed.nextRunAtMs ?? undefined),
    executionAgentId:
      parsed.executionAgentId === undefined
        ? existing.executionAgentId
        : (parsed.executionAgentId ?? undefined),
    createdFromSessionId:
      parsed.createdFromSessionId === undefined
        ? existing.createdFromSessionId
        : (parsed.createdFromSessionId ?? undefined),
    updatedAtMs: nowMs,
  });

  db.update(schema.scheduledJobs)
    .set({
      name: next.name,
      description: next.description ?? null,
      instructions: next.instructions,
      targetKind: next.targetKind,
      targetPayloadJson: JSON.stringify(next.targetPayload),
      scheduleType: next.scheduleType,
      runAtMs: next.runAtMs ?? null,
      intervalMs: next.intervalMs ?? null,
      cronExpression: next.cronExpression ?? null,
      timezone: next.timezone,
      nextRunAtMs: next.nextRunAtMs ?? null,
      executionAgentId: next.executionAgentId ?? null,
      createdFromSessionId: next.createdFromSessionId ?? null,
      retryPolicyJson: JSON.stringify(next.retryPolicy),
      timeoutMs: next.timeoutMs,
      metadataJson: JSON.stringify(next.metadata),
      updatedAtMs: nowMs,
    })
    .where(eq(schema.scheduledJobs.id, id))
    .run();

  return getScheduledJob(db, id);
}

export function setScheduledJobStatus(
  db: DrizzleDb,
  id: string,
  status: ScheduledJobStatus,
  nowMs = Date.now(),
): ScheduledJobRecord {
  getScheduledJob(db, id);
  db.update(schema.scheduledJobs)
    .set({ status, updatedAtMs: nowMs })
    .where(eq(schema.scheduledJobs.id, id))
    .run();
  return getScheduledJob(db, id);
}

export function claimDueScheduledJobs(
  db: DrizzleDb,
  options: { workerId: string; nowMs?: number; leaseMs: number; limit?: number },
): ScheduledJobRecord[] {
  const nowMs = options.nowMs ?? Date.now();
  const limit = Math.max(1, Math.min(options.limit ?? 10, 100));
  const leaseExpiresAtMs = nowMs + options.leaseMs;
  const leaseIsAvailable = or(
    isNull(schema.scheduledJobs.leaseOwner),
    lte(schema.scheduledJobs.leaseExpiresAtMs, nowMs),
  );
  const dueConditions = and(
    eq(schema.scheduledJobs.status, 'enabled'),
    lte(schema.scheduledJobs.nextRunAtMs, nowMs),
    leaseIsAvailable,
  );
  const candidates = db
    .select({ id: schema.scheduledJobs.id })
    .from(schema.scheduledJobs)
    .where(dueConditions)
    .orderBy(asc(schema.scheduledJobs.nextRunAtMs), asc(schema.scheduledJobs.createdAtMs))
    .limit(limit)
    .all();

  const claimed: ScheduledJobRecord[] = [];
  for (const candidate of candidates) {
    const result = db
      .update(schema.scheduledJobs)
      .set({
        leaseOwner: options.workerId,
        leaseExpiresAtMs,
        updatedAtMs: nowMs,
      })
      .where(and(eq(schema.scheduledJobs.id, candidate.id), dueConditions))
      .run() as { changes?: number };
    if ((result.changes ?? 0) > 0) {
      claimed.push(getScheduledJob(db, candidate.id));
    }
  }

  return claimed;
}

export function updateScheduledJobScheduleState(
  db: DrizzleDb,
  id: string,
  options: {
    status?: ScheduledJobStatus;
    nextRunAtMs?: number | null;
    clearLease?: boolean;
    nowMs?: number;
  },
): ScheduledJobRecord {
  getScheduledJob(db, id);
  const nowMs = options.nowMs ?? Date.now();
  db.update(schema.scheduledJobs)
    .set({
      ...(options.status ? { status: options.status } : {}),
      ...(options.nextRunAtMs !== undefined ? { nextRunAtMs: options.nextRunAtMs } : {}),
      ...(options.clearLease ? { leaseOwner: null, leaseExpiresAtMs: null } : {}),
      updatedAtMs: nowMs,
    })
    .where(eq(schema.scheduledJobs.id, id))
    .run();
  return getScheduledJob(db, id);
}

export function createScheduledJobRun(
  db: DrizzleDb,
  rawInput: ScheduledJobRunCreateBody,
  options: { id?: string; nowMs?: number } = {},
): ScheduledJobRunRecord {
  const input = ScheduledJobRunCreateBodySchema.parse(rawInput);
  getScheduledJob(db, input.jobId);
  const nowMs = options.nowMs ?? Date.now();
  const id = options.id ?? randomUUID();

  db.insert(schema.scheduledJobRuns)
    .values({
      id,
      jobId: input.jobId,
      status: input.status,
      attempt: input.attempt,
      queuedAtMs: nowMs,
      startedAtMs: input.status === 'running' ? nowMs : null,
      completedAtMs: TERMINAL_RUN_STATUSES.has(input.status) ? nowMs : null,
      leaseOwner: input.leaseOwner ?? null,
      leaseExpiresAtMs: input.leaseExpiresAtMs ?? null,
      metadataJson: JSON.stringify(input.metadata),
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    })
    .run();

  return getScheduledJobRun(db, id);
}

export function getScheduledJobRun(db: DrizzleDb, id: string): ScheduledJobRunRecord {
  const row = db
    .select()
    .from(schema.scheduledJobRuns)
    .where(eq(schema.scheduledJobRuns.id, id))
    .get();
  if (!row) throw new ScheduledJobRunNotFoundError(id);
  return rowToRun(row);
}

export function listScheduledJobRuns(
  db: DrizzleDb,
  rawQuery: Partial<ScheduledJobRunQuery> = {},
): ScheduledJobRunRecord[] {
  const query = ScheduledJobRunQuerySchema.parse(rawQuery);
  const conditions = [];
  if (query.jobId) conditions.push(eq(schema.scheduledJobRuns.jobId, query.jobId));
  if (query.status) conditions.push(eq(schema.scheduledJobRuns.status, query.status));
  return db
    .select()
    .from(schema.scheduledJobRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.scheduledJobRuns.createdAtMs))
    .limit(query.limit)
    .offset(query.offset)
    .all()
    .map(rowToRun);
}

export function listExpiredRunningScheduledJobRuns(
  db: DrizzleDb,
  options: { nowMs?: number; limit?: number } = {},
): ScheduledJobRunRecord[] {
  const nowMs = options.nowMs ?? Date.now();
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  return db
    .select()
    .from(schema.scheduledJobRuns)
    .where(
      and(
        eq(schema.scheduledJobRuns.status, 'running'),
        lte(schema.scheduledJobRuns.leaseExpiresAtMs, nowMs),
      ),
    )
    .orderBy(asc(schema.scheduledJobRuns.leaseExpiresAtMs))
    .limit(limit)
    .all()
    .map(rowToRun);
}

export function requestScheduledJobRunCancellation(
  db: DrizzleDb,
  id: string,
  nowMs = Date.now(),
): ScheduledJobRunRecord {
  getScheduledJobRun(db, id);
  db.update(schema.scheduledJobRuns)
    .set({ cancelRequestedAtMs: nowMs, updatedAtMs: nowMs })
    .where(eq(schema.scheduledJobRuns.id, id))
    .run();
  return getScheduledJobRun(db, id);
}

export function transitionScheduledJobRun(
  db: DrizzleDb,
  id: string,
  status: ScheduledJobRunStatus,
  options: {
    nowMs?: number;
    leaseOwner?: string | null;
    leaseExpiresAtMs?: number | null;
    resultSummary?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    cancelRequestedAtMs?: number | null;
  } = {},
): ScheduledJobRunRecord {
  const existing = getScheduledJobRun(db, id);
  const allowedTransitions = RUN_TRANSITIONS[existing.status] ?? [];
  if (!allowedTransitions.includes(status)) {
    throw new ScheduledJobTransitionError(existing.status, status);
  }
  const nowMs = options.nowMs ?? Date.now();

  db.update(schema.scheduledJobRuns)
    .set({
      status,
      startedAtMs: status === 'running' ? nowMs : (existing.startedAtMs ?? null),
      completedAtMs: TERMINAL_RUN_STATUSES.has(status) ? nowMs : null,
      leaseOwner:
        options.leaseOwner === undefined
          ? status === 'running'
            ? (existing.leaseOwner ?? null)
            : null
          : options.leaseOwner,
      leaseExpiresAtMs:
        options.leaseExpiresAtMs === undefined
          ? status === 'running'
            ? (existing.leaseExpiresAtMs ?? null)
            : null
          : options.leaseExpiresAtMs,
      cancelRequestedAtMs:
        options.cancelRequestedAtMs === undefined
          ? (existing.cancelRequestedAtMs ?? null)
          : options.cancelRequestedAtMs,
      resultSummary:
        options.resultSummary === undefined
          ? (existing.resultSummary ?? null)
          : options.resultSummary,
      errorCode: options.errorCode === undefined ? (existing.errorCode ?? null) : options.errorCode,
      errorMessage:
        options.errorMessage === undefined ? (existing.errorMessage ?? null) : options.errorMessage,
      updatedAtMs: nowMs,
    })
    .where(eq(schema.scheduledJobRuns.id, id))
    .run();

  if (TERMINAL_RUN_STATUSES.has(status)) {
    db.update(schema.scheduledJobs)
      .set({ lastRunAtMs: nowMs, updatedAtMs: nowMs })
      .where(eq(schema.scheduledJobs.id, existing.jobId))
      .run();
  }

  return getScheduledJobRun(db, id);
}

export function appendScheduledJobRunLog(
  db: DrizzleDb,
  rawInput: ScheduledJobRunLogCreateBody,
  options: { id?: string; nowMs?: number } = {},
): ScheduledJobRunLogRecord {
  const input = ScheduledJobRunLogCreateBodySchema.parse(rawInput);
  const run = getScheduledJobRun(db, input.runId);
  const id = options.id ?? randomUUID();
  const nowMs = options.nowMs ?? Date.now();
  const truncated = input.truncated ? 1 : 0;

  db.run(sql`
    insert into scheduled_job_run_logs (
      id,
      run_id,
      job_id,
      sequence,
      level,
      message,
      data_json,
      truncated,
      created_at_ms
    )
    select
      ${id},
      ${input.runId},
      ${run.jobId},
      coalesce(max(sequence) + 1, 0),
      ${input.level},
      ${input.message},
      ${JSON.stringify(input.data)},
      ${truncated},
      ${nowMs}
    from scheduled_job_run_logs
    where run_id = ${input.runId}
  `);

  const row = db
    .select()
    .from(schema.scheduledJobRunLogs)
    .where(eq(schema.scheduledJobRunLogs.id, id))
    .get();
  if (!row) throw new Error(`Scheduled job run log not found after insert: ${id}`);
  return rowToLog(row);
}

export function listScheduledJobRunLogs(
  db: DrizzleDb,
  runId: string,
  options: { limit?: number; offset?: number } = {},
): ScheduledJobRunLogRecord[] {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const offset = Math.max(0, options.offset ?? 0);
  return db
    .select()
    .from(schema.scheduledJobRunLogs)
    .where(eq(schema.scheduledJobRunLogs.runId, runId))
    .orderBy(asc(schema.scheduledJobRunLogs.sequence))
    .limit(limit)
    .offset(offset)
    .all()
    .map(rowToLog);
}
