import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import Database from 'better-sqlite3';
import { z } from 'zod';

import { delegateCallbackSchema, delegateCallbackTarget } from './governedOperations.js';
import { runAcceptsWork } from './workCancellation.js';
import {
  enqueuePhaseJob,
  executePhaseActionSchema,
  initializePhaseJobSchema,
} from './phaseJobs.js';
import {
  initializeContinuationOutbox,
  recordContinuationEvent,
  type ContinuationEventKind,
  type ContinuationEvent,
} from './continuationNotifications.js';

export const continuationSignal = new EventEmitter();

export const continuationActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('blocked'), reason: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('approval_required'), eventId: z.string().min(1) }).strict(),
  executePhaseActionSchema,
]);
export type ContinuationAction = z.infer<typeof continuationActionSchema>;

export interface ContinuationJob {
  id: string;
  run_id: string;
  execution_id: string;
  callback_json: string | null;
  status: 'pending' | 'accepted' | 'started' | 'consumed' | 'blocked';
  lease_owner: string | null;
  lease_epoch: number;
  lease_until_ms: number;
  host_execution_id: string | null;
  host_process_id: number | null;
  accepted_at_ms: number | null;
  started_at_ms: number | null;
  consumed_at_ms: number | null;
  failure_code: string | null;
  created_at_ms: number;
  attempts: number;
  last_attempt_at_ms: number | null;
  next_check_at_ms: number;
}

/** Called on the WorkflowStore connection, inside the terminal-result transaction. */
export function enqueueContinuation(
  database: Database.Database,
  executionId: string,
  runId: string,
  nowMs: number,
  callback?: unknown,
): void {
  if (!runAcceptsWork(database, runId)) return;
  database
    .prepare(
      `INSERT OR IGNORE INTO continuation_jobs
    (id, run_id, execution_id, created_at_ms) VALUES (?, ?, ?, ?)`,
    )
    .run(`specialist:${executionId}`, runId, executionId, nowMs);
  const specialist = database
    .prepare('SELECT status, role FROM scheduler_executions WHERE id = ?')
    .get(executionId) as { status: string; role: string };
  if (specialist.status === 'completed')
    recordContinuationEvent(database, {
      runId,
      jobId: `specialist:${executionId}`,
      kind: 'specialist_completed',
      generation: executionId,
      details: { role: specialist.role },
      createdAtMs: nowMs,
    });
  if (callback !== undefined) {
    const value = delegateCallbackSchema.parse(callback);
    const prior = database
      .prepare('SELECT * FROM continuation_jobs WHERE execution_id = ?')
      .get(executionId) as ContinuationJob;
    const json = JSON.stringify(value);
    if (prior.callback_json === json) return;
    if (prior.callback_json !== null || ['blocked', 'consumed'].includes(prior.status)) {
      throw new Error('continuation callback is immutable after terminal consumption');
    }
    database
      .prepare('UPDATE continuation_jobs SET callback_json = ? WHERE execution_id = ?')
      .run(json, executionId);
    recordContinuationEvent(database, {
      runId,
      jobId: prior.id,
      kind: 'callback_committed',
      generation: value.callbackId,
      details: { nextPhase: delegateCallbackTarget(value) },
      createdAtMs: nowMs,
    });
  }
  queueMicrotask(() => continuationSignal.emit('ready'));
}

export function initializeContinuationSchema(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS continuation_jobs (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
    execution_id TEXT NOT NULL UNIQUE REFERENCES scheduler_executions(id), callback_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'accepted', 'started', 'consumed', 'blocked')),
    lease_owner TEXT, lease_epoch INTEGER NOT NULL DEFAULT 0,
    lease_until_ms INTEGER NOT NULL DEFAULT 0, host_execution_id TEXT, host_process_id INTEGER,
    accepted_at_ms INTEGER, started_at_ms INTEGER, consumed_at_ms INTEGER,
    failure_code TEXT, created_at_ms INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at_ms INTEGER,
    next_check_at_ms INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS continuation_actions (
    job_id TEXT PRIMARY KEY REFERENCES continuation_jobs(id),
    host_execution_id TEXT NOT NULL, action_json TEXT NOT NULL, created_at_ms INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO continuation_jobs (id, run_id, execution_id, callback_json, created_at_ms)
    SELECT 'specialist:' || s.id, s.run_id, s.id, c.callback_json, s.updated_at_ms
    FROM scheduler_executions s LEFT JOIN delegate_callbacks c
      ON json_extract(c.callback_json, '$.delegationId') = s.id
    WHERE s.status = 'completed' AND EXISTS (SELECT 1 FROM runs r WHERE r.id = s.run_id
      AND r.state NOT IN ('cancelling', 'cancelled', 'closed')
      AND NOT EXISTS (SELECT 1 FROM workflow_cancellations c WHERE c.run_id = r.id));
  INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (13, unixepoch() * 1000);`);
  initializeContinuationOutbox(database);
  initializePhaseJobSchema(database);
}

/** Dedicated worker connection. Durable leases fence overlapping supervisors and restarts. */
export class ContinuationJournal {
  readonly #database: Database.Database;

  constructor(path: string) {
    this.#database = new Database(path);
    this.#database.pragma('foreign_keys = ON');
    this.#database.pragma('busy_timeout = 5000');
  }

  close(): void {
    this.#database.close();
  }

  get(id: string): ContinuationJob | undefined {
    return this.#database.prepare('SELECT * FROM continuation_jobs WHERE id = ?').get(id) as
      | ContinuationJob
      | undefined;
  }

  list(): ContinuationJob[] {
    return this.#database
      .prepare('SELECT * FROM continuation_jobs ORDER BY created_at_ms, id')
      .all() as ContinuationJob[];
  }

  timeline(runId: string): ContinuationEvent[] {
    const rows = this.#database
      .prepare(
        'SELECT event_json FROM continuation_events WHERE run_id = ? ORDER BY created_at_ms, rowid',
      )
      .all(runId) as Array<{ event_json: string }>;
    return rows.map((row) => JSON.parse(row.event_json) as ContinuationEvent);
  }

  notificationReceipts(runId: string): unknown[] {
    return this.#database
      .prepare(
        `SELECT d.* FROM continuation_event_deliveries d
      JOIN continuation_events e ON e.id = d.event_id WHERE e.run_id = ?
      ORDER BY e.created_at_ms, e.rowid, d.channel`,
      )
      .all(runId);
  }

  reconcileMissingIntents(nowMs: number): void {
    this.#database
      .transaction(() => {
        this.#database
          .prepare(
            `INSERT OR IGNORE INTO continuation_jobs
      (id, run_id, execution_id, callback_json, created_at_ms)
      SELECT 'specialist:' || s.id, s.run_id, s.id, c.callback_json, s.updated_at_ms
      FROM scheduler_executions s LEFT JOIN delegate_callbacks c
        ON json_extract(c.callback_json, '$.delegationId') = s.id
      WHERE (s.status = 'completed' OR (s.status = 'active' AND s.deadline_ms <= ?))
      AND EXISTS (SELECT 1 FROM runs r WHERE r.id = s.run_id
        AND r.state NOT IN ('cancelling', 'cancelled', 'closed')
        AND NOT EXISTS (SELECT 1 FROM workflow_cancellations c WHERE c.run_id = r.id))`,
          )
          .run(nowMs);
        const missing = this.#database
          .prepare(
            `SELECT j.*, s.role FROM continuation_jobs j
      JOIN scheduler_executions s ON s.id = j.execution_id WHERE s.status = 'completed'
      AND NOT EXISTS (SELECT 1 FROM continuation_events e WHERE e.job_id = j.id AND e.kind = 'specialist_completed')`,
          )
          .all() as Array<ContinuationJob & { role: string }>;
        for (const job of missing) {
          this.#event(
            job,
            'specialist_completed',
            job.execution_id,
            { role: job.role },
            job.created_at_ms,
          );
          if (job.callback_json !== null) {
            const callback = delegateCallbackSchema.parse(JSON.parse(job.callback_json));
            this.#event(
              job,
              'callback_committed',
              callback.callbackId,
              { nextPhase: delegateCallbackTarget(callback) },
              nowMs,
            );
          }
        }
      })
      .immediate();
  }

  claim(owner: string, ttlMs: number, nowMs: number): ContinuationJob | undefined {
    return this.#database
      .transaction(() => {
        const job = this.#database
          .prepare(
            `SELECT * FROM continuation_jobs j
        WHERE j.status NOT IN ('consumed', 'blocked') AND j.lease_until_ms <= ?
        AND EXISTS (SELECT 1 FROM runs r WHERE r.id = j.run_id AND r.state NOT IN ('cancelling', 'cancelled', 'closed'))
        AND NOT EXISTS (SELECT 1 FROM workflow_cancellations c WHERE c.run_id = j.run_id)
        AND j.next_check_at_ms <= ?
        AND NOT EXISTS (SELECT 1 FROM continuation_jobs p WHERE p.run_id = j.run_id
          AND p.id != j.id AND p.status NOT IN ('consumed', 'blocked') AND p.lease_until_ms > ?)
        ORDER BY created_at_ms, id LIMIT 1`,
          )
          .get(nowMs, nowMs, nowMs) as ContinuationJob | undefined;
        if (job === undefined) return undefined;
        this.#database
          .prepare(
            `UPDATE continuation_jobs SET lease_owner = ?, lease_epoch = lease_epoch + 1,
        lease_until_ms = ?, host_execution_id = COALESCE(host_execution_id, ?),
        status = CASE WHEN status = 'started' THEN 'accepted' ELSE status END,
        attempts = attempts + 1, last_attempt_at_ms = ? WHERE id = ?`,
          )
          .run(owner, nowMs + ttlMs, randomUUID(), nowMs, job.id);
        return this.get(job.id);
      })
      .immediate();
  }

  accepted(job: ContinuationJob, nowMs: number): void {
    this.#database
      .transaction(() => {
        this.#cas(
          job,
          `status = CASE WHEN status = 'pending' THEN 'accepted' ELSE status END,
      accepted_at_ms = COALESCE(accepted_at_ms, ?), next_check_at_ms = lease_until_ms`,
          [nowMs],
          nowMs,
        );
        this.#event(job, 'continuation_accepted', job.host_execution_id!, {}, nowMs);
      })
      .immediate();
  }

  release(job: ContinuationJob, retryAtMs: number, nowMs: number, attempted = true): void {
    this.#cas(
      job,
      'lease_owner = NULL, lease_until_ms = 0, next_check_at_ms = ?, attempts = attempts - ?',
      [retryAtMs, attempted ? 0 : 1],
      nowMs,
    );
  }

  block(job: ContinuationJob, reason: string, nowMs: number): void {
    this.#database
      .transaction(() => {
        const blocked = this.#cas(
          job,
          "status = 'blocked', failure_code = ?, lease_until_ms = 0",
          [reason],
          nowMs,
        );
        if (blocked) this.#event(job, 'blocked', job.id, { reason }, nowMs);
      })
      .immediate();
  }

  overdue(job: ContinuationJob, nowMs: number): void {
    this.#event(job, 'resume_overdue', job.id, { status: job.status }, nowMs);
  }

  reconcileOverdue(nowMs: number, thresholdMs: number): void {
    const jobs = this.#database
      .prepare(
        `SELECT * FROM continuation_jobs
      WHERE status NOT IN ('consumed', 'blocked') AND created_at_ms <= ?`,
      )
      .all(nowMs - thresholdMs) as ContinuationJob[];
    this.#database
      .transaction(() => {
        for (const job of jobs) this.overdue(job, nowMs);
      })
      .immediate();
  }

  /** Absolute deadlines revoke outstanding host leases in the same transaction as the blocker. */
  reconcileDeadlines(nowMs: number, deadlineMs: number): void {
    this.#database
      .transaction(() => {
        const jobs = this.#database
          .prepare(
            `SELECT * FROM continuation_jobs
        WHERE status NOT IN ('consumed', 'blocked') AND created_at_ms <= ?`,
          )
          .all(nowMs - deadlineMs) as ContinuationJob[];
        for (const job of jobs) {
          this.#database
            .prepare(
              `UPDATE continuation_jobs SET status = 'blocked',
          failure_code = 'host_resume_unavailable', lease_epoch = lease_epoch + 1,
          lease_owner = NULL, lease_until_ms = 0 WHERE id = ?`,
            )
            .run(job.id);
          this.#event(job, 'blocked', job.id, { reason: 'host_resume_unavailable' }, nowMs);
        }
      })
      .immediate();
  }

  /** The executing parent process must call this itself; provider acceptance cannot call it. */
  start(id: string, executionId: string, epoch: number, nowMs: number): boolean {
    return this.#database
      .transaction(() => {
        const prior = this.get(id);
        if (prior === undefined || !runAcceptsWork(this.#database, prior.run_id)) return false;
        const started =
          this.#database
            .prepare(
              `UPDATE continuation_jobs SET status = 'started',
      started_at_ms = COALESCE(started_at_ms, ?), host_process_id = ? WHERE id = ? AND host_execution_id = ?
      AND lease_epoch = ? AND lease_until_ms > ? AND status IN ('pending', 'accepted')`,
            )
            .run(nowMs, process.pid, id, executionId, epoch, nowMs).changes === 1;
        if (started && prior !== undefined) {
          this.#event(
            prior,
            'continuation_started',
            executionId,
            { processId: process.pid },
            nowMs,
          );
          if (prior.attempts > 1)
            this.#event(
              prior,
              'watchdog_recovery',
              String(epoch),
              { processId: process.pid },
              nowMs,
            );
        }
        return started;
      })
      .immediate();
  }

  /** Next action and callback consumption share a transaction and a unique job identity. */
  consume(
    id: string,
    executionId: string,
    epoch: number,
    actionInput: unknown,
    nowMs: number,
  ): void {
    const action = continuationActionSchema.parse(actionInput);
    this.#database
      .transaction(() => {
        const job = this.get(id);
        if (job !== undefined && !runAcceptsWork(this.#database, job.run_id))
          throw new Error('continuation run is cancelled');
        if (job?.status === 'consumed') {
          const prior = this.action(id);
          if (
            job.host_execution_id !== executionId ||
            JSON.stringify(prior) !== JSON.stringify(action)
          ) {
            throw new Error('continuation consumption identity conflict');
          }
          return;
        }
        if (
          job?.status !== 'started' ||
          job.host_execution_id !== executionId ||
          job.lease_epoch !== epoch ||
          job.lease_until_ms <= nowMs
        ) {
          throw new Error('continuation consumption fence rejected');
        }
        if (action.kind === 'approval_required') {
          const callback = delegateCallbackSchema.parse(JSON.parse(job.callback_json ?? 'null'));
          if (callback.approvalIntent?.eventId !== action.eventId) {
            throw new Error('continuation approval does not match durable callback');
          }
          const parent = this.#database
            .prepare('SELECT state, version FROM runs WHERE id = ?')
            .get(job.run_id) as { state: string; version: number };
          if (
            parent.state !== delegateCallbackTarget(callback) ||
            parent.version !== callback.parentRunVersion + 1
          ) {
            throw new Error('continuation parent changed after callback');
          }
        }
        if (action.kind === 'execute_phase') enqueuePhaseJob(this.#database, id, action, nowMs);
        this.#database
          .prepare(
            `INSERT INTO continuation_actions
        (job_id, host_execution_id, action_json, created_at_ms) VALUES (?, ?, ?, ?)`,
          )
          .run(id, executionId, JSON.stringify(action), nowMs);
        this.#database
          .prepare(
            `UPDATE continuation_jobs SET status = 'consumed', consumed_at_ms = ?,
        lease_until_ms = 0 WHERE id = ?`,
          )
          .run(nowMs, id);
        this.#event(job, 'next_action', job.id, action, nowMs);
        this.#event(job, 'continuation_consumed', executionId, {}, nowMs);
        if (action.kind !== 'execute_phase') this.#event(job, action.kind, job.id, action, nowMs);
        if (job.callback_json !== null) {
          const callback = delegateCallbackSchema.parse(JSON.parse(job.callback_json));
          this.#database
            .prepare(
              "UPDATE delegate_callbacks SET wake_status = 'woken', woke_at_ms = ? WHERE callback_id = ?",
            )
            .run(nowMs, callback.callbackId);
        }
      })
      .immediate();
  }

  action(id: string): ContinuationAction | undefined {
    const row = this.#database
      .prepare('SELECT action_json FROM continuation_actions WHERE job_id = ?')
      .get(id) as { action_json: string } | undefined;
    return row === undefined
      ? undefined
      : continuationActionSchema.parse(JSON.parse(row.action_json));
  }

  specialistResult(executionId: string): { status: string; result: unknown } {
    const row = this.#database
      .prepare('SELECT status, result_json FROM scheduler_executions WHERE id = ?')
      .get(executionId) as { status: string; result_json: string | null } | undefined;
    if (row === undefined) throw new Error('continuation specialist is missing');
    return { status: row.status, result: JSON.parse(row.result_json ?? 'null') as unknown };
  }

  #cas(job: ContinuationJob, set: string, values: Array<string | number>, nowMs: number): boolean {
    const updated = this.#database
      .prepare(
        `UPDATE continuation_jobs SET ${set}
      WHERE id = ? AND lease_owner = ? AND lease_epoch = ? AND lease_until_ms > ?
      AND status NOT IN ('consumed', 'blocked')`,
      )
      .run(...values, job.id, job.lease_owner, job.lease_epoch, nowMs);
    if (updated.changes !== 1 && this.get(job.id)?.status !== 'consumed') {
      throw new Error('continuation supervisor fence rejected');
    }
    return updated.changes === 1;
  }

  #event(
    job: ContinuationJob,
    kind: ContinuationEventKind,
    generation: string,
    details: unknown,
    nowMs: number,
  ): void {
    recordContinuationEvent(this.#database, {
      runId: job.run_id,
      jobId: job.id,
      kind,
      generation,
      details,
      createdAtMs: nowMs,
    });
  }
}
