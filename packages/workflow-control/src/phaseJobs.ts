import { createHash } from 'node:crypto';

import Database from 'better-sqlite3';
import { z } from 'zod';

import { executionContractSchema } from './contracts.js';
import { delegateCallbackSchema, delegateCallbackTarget } from './governedOperations.js';
import { deriveContractMaterialDigest } from './planning.js';
import { runAcceptsWork } from './workCancellation.js';
import {
  recordContinuationEvent,
  type ContinuationEventKind,
} from './continuationNotifications.js';

/** Dispatch intent only: specialist capabilities and broker authority must still be acquired. */
export const PHASE_JOB_DISPATCH = {
  implementing: 'implementation_worker',
  task_verification: 'test_runner',
  task_review: 'code_reviewer',
  feature_evaluation: 'feature_evaluator',
  repair_planning: 'feature_planner',
  repair: 'repair_coordinator',
  task_accepted: 'task_acceptance_coordinator',
  pipeline: 'pipeline_coordinator',
  delivery: 'delivery_coordinator',
  finalizing: 'finalization_coordinator',
} as const;

export const phaseJobPhaseSchema = z.enum([
  'implementing',
  'task_verification',
  'task_review',
  'feature_evaluation',
  'repair_planning',
  'repair',
  'task_accepted',
  'pipeline',
  'delivery',
  'finalizing',
]);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const executePhaseActionSchema = z
  .object({
    kind: z.literal('execute_phase'),
    callbackId: digest,
    workspaceId: digest,
    runId: z.string().min(1),
    taskId: z.string().min(1),
    runVersion: z.number().int().positive(),
    contractVersion: z.literal(1),
    policyDigest: digest,
    materialDigest: digest,
    headSha: z.string().regex(/^[a-f0-9]{40,64}$/u),
    phase: phaseJobPhaseSchema,
  })
  .strict();
export type ExecutePhaseAction = z.infer<typeof executePhaseActionSchema>;

export function phaseActionForCallback(input: unknown): ExecutePhaseAction {
  const callback = delegateCallbackSchema.parse(input);
  return executePhaseActionSchema.parse({
    kind: 'execute_phase',
    callbackId: callback.callbackId,
    workspaceId: callback.workspaceId,
    runId: callback.parentRunId,
    taskId: callback.parentTaskId,
    runVersion: callback.parentRunVersion + 1,
    contractVersion: callback.contractVersion,
    policyDigest: callback.policyDigest,
    materialDigest: callback.materialDigest,
    headSha: callback.headSha,
    phase: delegateCallbackTarget(callback),
  });
}

export function initializePhaseJobSchema(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS phase_jobs (
    id TEXT PRIMARY KEY, continuation_id TEXT NOT NULL UNIQUE REFERENCES continuation_jobs(id),
    callback_id TEXT NOT NULL UNIQUE REFERENCES delegate_callbacks(callback_id),
    run_id TEXT NOT NULL REFERENCES runs(id), action_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'claimed', 'started', 'completed', 'blocked')),
    lease_owner TEXT, lease_epoch INTEGER NOT NULL DEFAULT 0, lease_until_ms INTEGER NOT NULL DEFAULT 0,
    execution_id TEXT UNIQUE, created_at_ms INTEGER NOT NULL, started_at_ms INTEGER,
    completed_at_ms INTEGER, result_json TEXT, failure_code TEXT
  );`);
}

/** Revalidate before enqueue/claim/start. An accepted callback is not continuing authority. */
export function assertPhaseJobAuthority(
  database: Database.Database,
  action: ExecutePhaseAction,
): void {
  if (!runAcceptsWork(database, action.runId)) throw new Error('phase run is cancelled');
  const record = database
    .prepare('SELECT callback_json FROM delegate_callbacks WHERE callback_id = ?')
    .get(action.callbackId) as { callback_json: string } | undefined;
  if (
    record === undefined ||
    JSON.stringify(phaseActionForCallback(JSON.parse(record.callback_json))) !==
      JSON.stringify(action)
  )
    throw new Error('phase callback binding rejected');
  const parent = database
    .prepare(
      `SELECT r.state, r.version, c.body_json FROM runs r
    JOIN contracts c ON c.id = r.contract_id WHERE r.id = ?`,
    )
    .get(action.runId) as { state: string; version: number; body_json: string } | undefined;
  if (parent?.state !== action.phase || parent.version !== action.runVersion)
    throw new Error('phase parent state or version is stale');
  const contract = executionContractSchema.parse(JSON.parse(parent.body_json));
  if (
    contract.workspaceId !== action.workspaceId ||
    contract.contractVersion !== action.contractVersion ||
    contract.policyDigest !== action.policyDigest ||
    deriveContractMaterialDigest(contract) !== action.materialDigest
  )
    throw new Error('phase contract material is stale');
  if (
    !contract.authority.allowedActions.includes('workflow.delegate_callback') ||
    !contract.tasks
      .find((task) => task.id === action.taskId)
      ?.allowedOperations.includes('workflow.delegate_callback')
  )
    throw new Error('phase callback authority unavailable');
  const approval = database
    .prepare(
      `SELECT 1 FROM plan_approvals WHERE run_id = ? AND status = 'active'
    AND contract_version = ? AND policy_digest = ? AND material_digest = ? LIMIT 1`,
    )
    .get(action.runId, action.contractVersion, action.policyDigest, action.materialDigest);
  if (approval === undefined) throw new Error('phase material approval unavailable');
  const heads = database
    .prepare(
      `SELECT current_sha FROM delivery_approved_heads
    WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?
    UNION ALL SELECT current_sha FROM repair_approved_heads
    WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?`,
    )
    .all(
      action.workspaceId,
      action.runId,
      action.taskId,
      `refs/heads/task/${action.taskId}`,
      action.workspaceId,
      action.runId,
      action.taskId,
      `refs/heads/task/${action.taskId}`,
    ) as Array<{ current_sha: string }>;
  if (heads.length === 0 || heads.some((head) => head.current_sha !== action.headSha))
    throw new Error('phase approved head is missing or stale');
}

/** Caller must hold the continuation consumption transaction. */
export function enqueuePhaseJob(
  database: Database.Database,
  continuationId: string,
  action: ExecutePhaseAction,
  nowMs: number,
): void {
  assertPhaseJobAuthority(database, action);
  const callback = database
    .prepare('SELECT callback_json FROM continuation_jobs WHERE id = ?')
    .get(continuationId) as { callback_json: string | null } | undefined;
  if (
    callback?.callback_json === null ||
    callback === undefined ||
    delegateCallbackSchema.parse(JSON.parse(callback.callback_json)).callbackId !==
      action.callbackId
  )
    throw new Error('phase continuation identity mismatch');
  const id = `phase:${action.callbackId}`;
  database
    .prepare(
      `INSERT INTO phase_jobs (id, continuation_id, callback_id, run_id, action_json, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, continuationId, action.callbackId, action.runId, JSON.stringify(action), nowMs);
  recordContinuationEvent(database, {
    runId: action.runId,
    jobId: continuationId,
    kind: 'phase_queued',
    generation: id,
    details: { phaseJobId: id, phase: action.phase, dispatch: PHASE_JOB_DISPATCH[action.phase] },
    createdAtMs: nowMs,
  });
}

export interface PhaseJob {
  id: string;
  continuation_id: string;
  callback_id: string;
  run_id: string;
  action_json: string;
  status: 'pending' | 'claimed' | 'started' | 'completed' | 'blocked';
  lease_owner: string | null;
  lease_epoch: number;
  lease_until_ms: number;
  execution_id: string | null;
  failure_code: string | null;
  result_json: string | null;
}

/** Separate long-lived supervisor connection; independent from parent-host acknowledgement timeout.
 * Expired started jobs can be adopted only for reconciliation, never relaunched automatically.
 * A stable execution_id must be used as the downstream scheduler/coordinator idempotency key.
 */
export class PhaseJobJournal {
  readonly #database: Database.Database;
  constructor(path: string) {
    this.#database = new Database(path);
    this.#database.pragma('foreign_keys = ON');
    this.#database.pragma('busy_timeout = 5000');
  }
  close(): void {
    this.#database.close();
  }
  get(id: string): PhaseJob | undefined {
    return this.#database.prepare('SELECT * FROM phase_jobs WHERE id = ?').get(id) as
      | PhaseJob
      | undefined;
  }
  list(): PhaseJob[] {
    return this.#database
      .prepare('SELECT * FROM phase_jobs ORDER BY created_at_ms, id')
      .all() as PhaseJob[];
  }
  action(job: PhaseJob): ExecutePhaseAction {
    return executePhaseActionSchema.parse(JSON.parse(job.action_json));
  }

  claim(owner: string, ttlMs: number, nowMs: number, runId?: string): PhaseJob | undefined {
    if (!owner || !Number.isSafeInteger(ttlMs) || ttlMs <= 0)
      throw new Error('invalid phase lease');
    return this.#database
      .transaction(() => {
        const jobs = this.#database
          .prepare(
            `SELECT * FROM phase_jobs j
        WHERE status IN ('pending', 'claimed') AND lease_until_ms <= ? AND (? IS NULL OR run_id = ?)
        AND NOT EXISTS (SELECT 1 FROM phase_jobs p WHERE p.run_id = j.run_id AND p.id != j.id
          AND (p.status = 'started' OR (p.status = 'claimed' AND p.lease_until_ms > ?)))
        ORDER BY created_at_ms, id`,
          )
          .all(nowMs, runId ?? null, runId ?? null, nowMs) as PhaseJob[];
        for (const job of jobs) {
          try {
            assertPhaseJobAuthority(this.#database, this.action(job));
          } catch (error) {
            this.#database
              .prepare("UPDATE phase_jobs SET status = 'blocked', failure_code = ? WHERE id = ?")
              .run(error instanceof Error ? error.message : String(error), job.id);
            this.#event(
              job,
              'phase_blocked',
              'authority',
              { reason: 'phase_authority_stale' },
              nowMs,
            );
            continue;
          }
          this.#database
            .prepare(
              `UPDATE phase_jobs SET status = 'claimed', lease_owner = ?,
          lease_epoch = lease_epoch + 1, lease_until_ms = ? WHERE id = ?`,
            )
            .run(owner, nowMs + ttlMs, job.id);
          return this.get(job.id);
        }
        return undefined;
      })
      .immediate();
  }

  renew(job: PhaseJob, ttlMs: number, nowMs: number): void {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error('invalid phase lease');
    this.#update(job, 'lease_until_ms = ?', [nowMs + ttlMs], nowMs);
  }

  releaseClaim(job: PhaseJob, nowMs: number): void {
    if (this.get(job.id)?.status !== 'claimed')
      throw new Error('phase release requires unstarted claim');
    this.#update(job, "status = 'pending', lease_owner = NULL, lease_until_ms = 0", [], nowMs);
  }

  start(job: PhaseJob, nowMs: number): PhaseJob {
    return this.#database
      .transaction(() => {
        const current = this.get(job.id);
        if (current?.status !== 'claimed') throw new Error('phase job is not claimed');
        assertPhaseJobAuthority(this.#database, this.action(current));
        const hash = current.callback_id.slice('sha256:'.length);
        // Stable UUIDv8 namespace for the credential broker and Docker container identity.
        const executionId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
        this.#update(
          job,
          "status = 'started', execution_id = ?, started_at_ms = ?",
          [executionId, nowMs],
          nowMs,
        );
        this.#event(job, 'phase_started', String(job.lease_epoch), { executionId }, nowMs);
        return this.get(job.id)!;
      })
      .immediate();
  }

  /** Returns expired started work under a new fence for observe/cancel/reconcile only. */
  claimRecovery(owner: string, ttlMs: number, nowMs: number, runId?: string): PhaseJob | undefined {
    if (!owner || !Number.isSafeInteger(ttlMs) || ttlMs <= 0)
      throw new Error('invalid phase lease');
    return this.#database
      .transaction(() => {
        const job = this.#database
          .prepare(
            `SELECT * FROM phase_jobs WHERE status = 'started' AND lease_until_ms <= ? AND (? IS NULL OR run_id = ?)
            AND EXISTS (SELECT 1 FROM runs r WHERE r.id = phase_jobs.run_id AND r.state NOT IN ('cancelled', 'closed'))
            ORDER BY created_at_ms, id LIMIT 1`,
          )
          .get(nowMs, runId ?? null, runId ?? null) as PhaseJob | undefined;
        if (job === undefined) return undefined;
        this.#database
          .prepare(
            'UPDATE phase_jobs SET lease_owner = ?, lease_epoch = lease_epoch + 1, lease_until_ms = ? WHERE id = ?',
          )
          .run(owner, nowMs + ttlMs, job.id);
        const recovered = this.get(job.id)!;
        this.#event(
          recovered,
          'phase_recovery_required',
          String(recovered.lease_epoch),
          { executionId: job.execution_id },
          nowMs,
        );
        return recovered;
      })
      .immediate();
  }

  /** Completion is local bookkeeping only; it never advances or closes the workflow run.
   * Specialist receipts require their committed callback and execution-bound result evidence.
   * Coordinator completion needs a separate typed receipt adapter and currently fails closed.
   */
  complete(
    job: PhaseJob,
    receipt: { executionId: string; evidenceDigest: string },
    nowMs: number,
  ): void {
    const value = z
      .object({ executionId: z.string().min(1), evidenceDigest: digest })
      .strict()
      .parse(receipt);
    this.#database
      .transaction(() => {
        const current = this.get(job.id);
        if (
          current?.status === 'completed' &&
          current.lease_epoch === job.lease_epoch &&
          current.lease_owner === job.lease_owner &&
          current.result_json === JSON.stringify(value)
        )
          return;
        if (current?.status !== 'started' || current.execution_id !== value.executionId)
          throw new Error('phase completion execution mismatch');
        const action = this.action(current);
        const dispatch = PHASE_JOB_DISPATCH[action.phase];
        // Transitions do not record a uniform process identity or authoritative result head.
        // Their lease owner and arbitrary result fields must not stand in for those attestations.
        if (dispatch.endsWith('_coordinator'))
          throw new Error('phase coordinator completion authority unavailable');
        const result = this.#database
          .prepare(
            `SELECT result_json, process_identity FROM scheduler_executions WHERE id = ? AND run_id = ?
          AND task_id = ? AND workspace_id = ? AND role = ? AND status = 'completed' AND credential_status = 'revoked'`,
          )
          .get(value.executionId, action.runId, action.taskId, action.workspaceId, dispatch) as
          | { result_json: string | null; process_identity: string }
          | undefined;
        const resultJson = result?.result_json;
        if (
          resultJson === undefined ||
          resultJson === null ||
          `sha256:${createHash('sha256').update(resultJson).digest('hex')}` !== value.evidenceDigest
        )
          throw new Error('phase completion lacks committed execution receipt');
        const callbacks = this.#database
          .prepare(
            `SELECT callback_json FROM delegate_callbacks
          WHERE status = 'committed' AND run_id = ? AND task_id = ?
          AND json_extract(callback_json, '$.delegationId') = ?`,
          )
          .all(action.runId, action.taskId, value.executionId) as Array<{ callback_json: string }>;
        if (callbacks.length !== 1)
          throw new Error('phase completion lacks committed result callback');
        const callback = delegateCallbackSchema.parse(JSON.parse(callbacks[0]!.callback_json));
        if (
          callback.workspaceId !== action.workspaceId ||
          callback.parentRunId !== action.runId ||
          callback.parentTaskId !== action.taskId ||
          callback.parentState !== action.phase ||
          callback.parentRunVersion !== action.runVersion ||
          callback.contractVersion !== action.contractVersion ||
          callback.policyDigest !== action.policyDigest ||
          callback.materialDigest !== action.materialDigest ||
          callback.delegateAgentId !== result!.process_identity ||
          callback.resultProducerIdentity !== result!.process_identity ||
          callback.delegateRole !== dispatch ||
          callback.resultArtifactDigest !== value.evidenceDigest ||
          (dispatch !== 'implementation_worker' && callback.headSha !== action.headSha)
        )
          throw new Error('phase completion result callback binding rejected');
        const evidence = this.#database
          .prepare(
            `SELECT 1 FROM secure_evidence WHERE digest = ? AND run_id = ?
        AND task_id = ? AND workspace_id = ? AND contract_version = ? AND policy_digest = ?
        AND head_sha = ? AND producer = ? AND producer_role = ? AND deleted_at_ms IS NULL LIMIT 1`,
          )
          .get(
            value.evidenceDigest,
            job.run_id,
            action.taskId,
            action.workspaceId,
            action.contractVersion,
            action.policyDigest,
            callback.headSha,
            result!.process_identity,
            dispatch,
          );
        if (evidence === undefined) throw new Error('phase completion lacks durable evidence');
        this.#update(
          job,
          "status = 'completed', result_json = ?, completed_at_ms = ?, lease_until_ms = 0",
          [JSON.stringify(value), nowMs],
          nowMs,
        );
        this.#event(job, 'phase_completed', value.executionId, value, nowMs);
      })
      .immediate();
  }

  block(job: PhaseJob, reason: string, nowMs: number): void {
    if (!reason) throw new Error('phase blocker requires reason');
    this.#database
      .transaction(() => {
        this.#update(
          job,
          "status = 'blocked', failure_code = ?, lease_until_ms = 0",
          [reason],
          nowMs,
        );
        this.#event(job, 'phase_blocked', String(job.lease_epoch), { reason }, nowMs);
      })
      .immediate();
  }
  #update(job: PhaseJob, set: string, values: Array<string | number>, nowMs: number): void {
    const result = this.#database
      .prepare(
        `UPDATE phase_jobs SET ${set} WHERE id = ? AND lease_owner = ?
      AND lease_epoch = ? AND lease_until_ms > ? AND status IN ('claimed', 'started')`,
      )
      .run(...values, job.id, job.lease_owner, job.lease_epoch, nowMs);
    if (result.changes !== 1) throw new Error('phase job fence rejected');
  }
  #event(
    job: PhaseJob,
    kind: ContinuationEventKind,
    generation: string,
    details: unknown,
    nowMs: number,
  ): void {
    recordContinuationEvent(this.#database, {
      runId: job.run_id,
      jobId: job.continuation_id,
      kind,
      generation: `${job.id}:${generation}`,
      details,
      createdAtMs: nowMs,
    });
  }
}
