import { coordinatorProofSchema, verifyCoordinatorProof } from './coordinatorReceipts.js';
import {
  initializeInterruptionSchema,
  assertExecutionNotInterrupted,
  getInterruption,
  InterruptionCleanupJournal,
} from './executionInterruptions.js';
import { verifyDocumentBoundary, assertDocumentAuthority } from './documentApproval.js';
import { createHash } from 'node:crypto';

import Database from 'better-sqlite3';
import { z } from 'zod';

import { executionContractSchema } from './contracts.js';
import {
  digestGovernedValue,
  delegateCallbackSchema,
  delegateCallbackTarget,
} from './governedOperations.js';
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
    callbackId: digest.optional(),
    coordinatorReceiptId: digest.optional(),
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
  .strict()
  .refine(
    (action) => (action.callbackId === undefined) !== (action.coordinatorReceiptId === undefined),
    'phase requires exactly one authoritative origin',
  );
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
  initializeInterruptionSchema(database);
  database.exec(`CREATE TABLE IF NOT EXISTS coordinator_receipts (
    id TEXT PRIMARY KEY, phase_job_id TEXT NOT NULL UNIQUE,
    run_id TEXT NOT NULL REFERENCES runs(id), receipt_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
  )`);
  database.exec(`CREATE TABLE IF NOT EXISTS coordinator_recovery_attempts (
    job_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL CHECK(attempts > 0),
    maximum INTEGER NOT NULL CHECK(maximum >= 0), updated_at_ms INTEGER NOT NULL
  )`);
  database.exec(`CREATE TABLE IF NOT EXISTS implementation_phase_attempts (
    execution_id TEXT PRIMARY KEY,run_id TEXT NOT NULL,task_id TEXT NOT NULL,attempt INTEGER NOT NULL,
    UNIQUE(run_id,task_id,attempt)
  )`);
  const legacy = database.prepare('PRAGMA table_info(phase_jobs)').all() as Array<{ name: string }>;
  const migrate =
    legacy.length > 0 && !legacy.some((column) => column.name === 'coordinator_receipt_id');
  database
    .transaction(() => {
      if (migrate) database.exec('ALTER TABLE phase_jobs RENAME TO phase_jobs_legacy');
      database.exec(`CREATE TABLE IF NOT EXISTS phase_jobs (
      id TEXT PRIMARY KEY, continuation_id TEXT NOT NULL REFERENCES continuation_jobs(id),
      callback_id TEXT UNIQUE REFERENCES delegate_callbacks(callback_id),
      coordinator_receipt_id TEXT UNIQUE REFERENCES coordinator_receipts(id),
      run_id TEXT NOT NULL REFERENCES runs(id), action_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'claimed', 'started', 'completed', 'blocked')),
      lease_owner TEXT, lease_epoch INTEGER NOT NULL DEFAULT 0, lease_until_ms INTEGER NOT NULL DEFAULT 0,
      execution_id TEXT UNIQUE, created_at_ms INTEGER NOT NULL, started_at_ms INTEGER,
      completed_at_ms INTEGER, result_json TEXT, failure_code TEXT,
      CHECK((callback_id IS NOT NULL AND coordinator_receipt_id IS NULL) OR
            (callback_id IS NULL AND coordinator_receipt_id IS NOT NULL))
    )`);
      if (migrate)
        database.exec(`INSERT INTO phase_jobs
      (id,continuation_id,callback_id,run_id,action_json,status,lease_owner,lease_epoch,lease_until_ms,
       execution_id,created_at_ms,started_at_ms,completed_at_ms,result_json,failure_code)
      SELECT id,continuation_id,callback_id,run_id,action_json,status,lease_owner,lease_epoch,lease_until_ms,
       execution_id,created_at_ms,started_at_ms,completed_at_ms,result_json,failure_code FROM phase_jobs_legacy;
      DROP TABLE phase_jobs_legacy`);
    })
    .immediate();
}

/** Revalidate before enqueue/claim/start. An accepted callback is not continuing authority. */
export function assertPhaseJobAuthority(
  database: Database.Database,
  action: ExecutePhaseAction,
): void {
  if (!runAcceptsWork(database, action.runId)) throw new Error('phase run is cancelled');
  if (action.coordinatorReceiptId !== undefined) {
    const origin = database
      .prepare('SELECT receipt_json FROM coordinator_receipts WHERE id=? AND run_id=?')
      .get(action.coordinatorReceiptId, action.runId) as { receipt_json: string } | undefined;
    if (
      !origin ||
      JSON.stringify(actionForCoordinatorReceipt(JSON.parse(origin.receipt_json))) !==
        JSON.stringify(action)
    )
      throw new Error('phase coordinator origin rejected');
  } else {
    const record = database
      .prepare('SELECT callback_json FROM delegate_callbacks WHERE callback_id = ?')
      .get(action.callbackId!) as { callback_json: string } | undefined;
    if (
      !record ||
      JSON.stringify(phaseActionForCallback(JSON.parse(record.callback_json))) !==
        JSON.stringify(action)
    )
      throw new Error('phase callback binding rejected');
  }
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

const coordinatorReceiptSchema = z
  .object({
    jobId: z.string().min(1),
    executionId: z.string().min(1),
    action: executePhaseActionSchema,
    owner: z.string().min(1),
    phaseEpoch: z.number().int().positive(),
    fences: z
      .object({
        workspace: z.number().int().positive(),
        run: z.number().int().positive(),
        task: z.number().int().positive(),
      })
      .strict(),
    proof: coordinatorProofSchema,
    outcome: z
      .object({
        state: z.enum([
          'feature_evaluation',
          'implementing',
          'delivery',
          'repair_planning',
          'finalizing',
          'closed',
        ]),
        version: z.number().int().positive(),
        headSha: z.string().regex(/^[a-f0-9]{40,64}$/u),
      })
      .strict(),
  })
  .strict();
function actionForCoordinatorReceipt(raw: unknown): ExecutePhaseAction {
  const receipt = coordinatorReceiptSchema.parse(raw);
  if (receipt.outcome.state === 'closed') throw new Error('closed coordinator has no successor');
  const binding = { ...receipt.action };
  delete binding.callbackId;
  delete binding.coordinatorReceiptId;
  return executePhaseActionSchema.parse({
    ...binding,
    coordinatorReceiptId: digestGovernedValue(receipt),
    phase: receipt.outcome.state,
    runVersion: receipt.outcome.version,
    headSha: receipt.outcome.headSha,
  });
}

export interface PhaseJob {
  id: string;
  continuation_id: string;
  callback_id: string | null;
  coordinator_receipt_id: string | null;
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
    const jobs = this.#database
      .prepare(
        `SELECT * FROM phase_jobs
      WHERE status IN ('pending','claimed') AND lease_until_ms <= ?
      AND (? IS NULL OR run_id = ?) ORDER BY created_at_ms,id`,
      )
      .all(nowMs, runId ?? null, runId ?? null) as PhaseJob[];
    for (const job of jobs) {
      let verified: ReturnType<typeof verifyDocumentBoundary>;
      try {
        verified = verifyDocumentBoundary(this.#database, {
          runId: job.run_id,
          taskId: this.action(job).taskId,
          boundary: 'phase.claim',
          ownerId: owner,
          nowMs,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : '';
        const code = (error as { code?: string })?.code;
        if (
          reason === 'document_verification_unresolved' ||
          code === 'SQLITE_BUSY' ||
          code === 'SQLITE_LOCKED'
        )
          continue;
        if (
          ![
            'planning_documents_changed',
            'document_approval_required',
            'document_manifest_required',
            'document_publication_missing',
            'document_task_unknown',
          ].includes(reason)
        )
          throw error;
        this.#database
          .prepare(
            `UPDATE phase_jobs SET status='blocked',failure_code='document_authority_unavailable'
          WHERE id=? AND status IN ('pending','claimed') AND lease_until_ms<=?`,
          )
          .run(job.id, nowMs);
        continue;
      }
      const claimed = this.#database
        .transaction(() => {
          assertDocumentAuthority(this.#database, job.run_id, verified.approvalId);
          const current = this.get(job.id);
          if (
            !current ||
            !['pending', 'claimed'].includes(current.status) ||
            current.lease_until_ms > nowMs
          )
            return undefined;
          if (
            this.#database
              .prepare(
                `SELECT 1 FROM phase_jobs WHERE run_id=? AND id!=?
          AND (status='started' OR (status='claimed' AND lease_until_ms>?))`,
              )
              .get(job.run_id, job.id, nowMs)
          )
            return undefined;
          try {
            assertPhaseJobAuthority(this.#database, this.action(current));
          } catch (error) {
            this.#database
              .prepare("UPDATE phase_jobs SET status='blocked',failure_code=? WHERE id=?")
              .run(error instanceof Error ? error.message : 'phase_authority_stale', job.id);
            this.#event(
              job,
              'phase_blocked',
              'authority',
              { reason: 'phase_authority_stale' },
              nowMs,
            );
            return undefined;
          }
          this.#database
            .prepare(
              `UPDATE phase_jobs SET status='claimed',lease_owner=?,
          lease_epoch=lease_epoch+1,lease_until_ms=? WHERE id=?`,
            )
            .run(owner, nowMs + ttlMs, job.id);
          return this.get(job.id);
        })
        .immediate();
      if (claimed) return claimed;
    }
    return undefined;
  }

  renew(job: PhaseJob, ttlMs: number, nowMs: number): void {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error('invalid phase lease');
    this.#update(job, 'lease_until_ms = ?', [nowMs + ttlMs], nowMs);
  }

  reserveImplementationAttempt(job: PhaseJob, nowMs: number): number {
    const action = this.action(job);
    if (action.phase !== 'implementing') throw new Error('implementation attempt phase mismatch');
    return this.#database
      .transaction(() => {
        this.#update(job, 'failure_code=NULL', [], nowMs);
        const existing = this.#database
          .prepare('SELECT * FROM implementation_phase_attempts WHERE execution_id=?')
          .get(job.execution_id) as
          | { run_id: string; task_id: string; attempt: number }
          | undefined;
        if (existing) {
          if (existing.run_id !== action.runId || existing.task_id !== action.taskId)
            throw new Error('implementation attempt identity mismatch');
          return existing.attempt;
        }
        const row = this.#database
          .prepare(
            'SELECT c.body_json FROM runs r JOIN contracts c ON c.id=r.contract_id WHERE r.id=?',
          )
          .get(action.runId) as { body_json: string };
        const contract = executionContractSchema.parse(JSON.parse(row.body_json));
        const active = this.#database
          .prepare(
            "SELECT task_attempt,failure_head_sha FROM repair_dispatches WHERE run_id=? AND task_id=? AND status='dispatched'",
          )
          .all(action.runId, action.taskId) as Array<{
          task_attempt: number;
          failure_head_sha: string;
        }>;
        if (active.length > 1) throw new Error('ambiguous implementation repair reservation');
        let attempt: number;
        if (active[0]) {
          attempt = active[0].task_attempt;
          if (active[0].failure_head_sha !== action.headSha)
            throw new Error('repair reservation head mismatch');
          if (
            !this.#database
              .prepare(
                "SELECT 1 FROM attempts WHERE run_id=? AND scope='task' AND scope_id=? AND attempt=? AND max_attempts=?",
              )
              .get(
                action.runId,
                action.taskId,
                attempt,
                contract.retryPolicy.implementationAttempts,
              )
          )
            throw new Error('repair attempt reservation missing');
        } else {
          const used = this.#database
            .prepare(
              "SELECT COUNT(*) AS n FROM attempts WHERE run_id=? AND scope='task' AND scope_id=?",
            )
            .get(action.runId, action.taskId) as { n: number };
          if (used.n !== 0) throw new Error('implementation retry requires repair reservation');
          attempt = 1;
          if (attempt > contract.retryPolicy.implementationAttempts)
            throw new Error('implementation budget exhausted');
          this.#database
            .prepare(
              "INSERT INTO attempts(run_id,scope,scope_id,attempt,max_attempts,hypothesis,created_at_ms) VALUES(?,'task',?,?,?,'initial approved implementation',?)",
            )
            .run(
              action.runId,
              action.taskId,
              attempt,
              contract.retryPolicy.implementationAttempts,
              nowMs,
            );
        }
        this.#database
          .prepare('INSERT INTO implementation_phase_attempts VALUES(?,?,?,?)')
          .run(job.execution_id, action.runId, action.taskId, attempt);
        return attempt;
      })
      .immediate();
  }

  deferCoordinatorAdmission(job: PhaseJob, nowMs: number): void {
    const action = this.action(job);
    const held = this.#database
      .prepare(
        `SELECT MAX(expires_at_ms) AS until FROM leases WHERE
      owner_id != ? AND ((resource_type='workspace' AND resource_id=?) OR
      (resource_type='run' AND resource_id=?) OR (resource_type='task' AND resource_id=?))`,
      )
      .get(job.lease_owner, action.workspaceId, action.runId, action.taskId) as {
      until: number | null;
    };
    this.#update(
      job,
      "lease_until_ms=?,failure_code='phase_coordinator_waiting_for_owner'",
      [Math.max(nowMs + 1000, held.until ?? 0)],
      nowMs,
    );
  }

  deferCoordinator(job: PhaseJob, maximum: number, nowMs: number): void {
    if (
      !Number.isSafeInteger(maximum) ||
      maximum < 0 ||
      !PHASE_JOB_DISPATCH[this.action(job).phase].endsWith('_coordinator')
    )
      throw new Error('invalid coordinator recovery policy');
    this.#database
      .transaction(() => {
        const previous = this.#database
          .prepare('SELECT attempts,maximum FROM coordinator_recovery_attempts WHERE job_id=?')
          .get(job.id) as { attempts: number; maximum: number } | undefined;
        if (previous && previous.maximum !== maximum)
          throw new Error('coordinator recovery budget changed');
        const attempts = (previous?.attempts ?? 0) + 1;
        if (attempts > maximum) {
          this.block(job, 'phase_coordinator_recovery_exhausted', nowMs);
        } else {
          this.#update(
            job,
            "lease_until_ms=?,failure_code='phase_coordinator_recovery_pending'",
            [nowMs + Math.min(60000, 1000 * 2 ** Math.min(attempts - 1, 6))],
            nowMs,
          );
          this.#event(
            job,
            'phase_recovery_required',
            `coordinator:${attempts}`,
            { attempts, maximum },
            nowMs,
          );
        }
        this.#database
          .prepare(
            `INSERT INTO coordinator_recovery_attempts VALUES(?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET attempts=excluded.attempts,updated_at_ms=excluded.updated_at_ms`,
          )
          .run(job.id, attempts, maximum, nowMs);
      })
      .immediate();
  }

  releaseClaim(job: PhaseJob, nowMs: number): void {
    if (this.get(job.id)?.status !== 'claimed')
      throw new Error('phase release requires unstarted claim');
    this.#update(job, "status = 'pending', lease_owner = NULL, lease_until_ms = 0", [], nowMs);
  }

  start(job: PhaseJob, nowMs: number): PhaseJob {
    const verified = verifyDocumentBoundary(this.#database, {
      runId: job.run_id,
      taskId: this.action(job).taskId,
      boundary: 'phase.start',
      ownerId: job.lease_owner ?? '',
      nowMs,
    });
    return this.#database
      .transaction(() => {
        assertDocumentAuthority(this.#database, job.run_id, verified.approvalId);
        const current = this.get(job.id);
        if (current?.status !== 'claimed') throw new Error('phase job is not claimed');
        assertPhaseJobAuthority(this.#database, this.action(current));
        const hash = (current.callback_id ?? current.coordinator_receipt_id!).slice(
          'sha256:'.length,
        );
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
            AND (EXISTS (SELECT 1 FROM runs r WHERE r.id=phase_jobs.run_id AND r.state NOT IN ('cancelled','closed'))
              OR EXISTS (SELECT 1 FROM execution_interruptions i WHERE i.execution_id=phase_jobs.execution_id)
              OR json_extract(action_json,'$.phase')='finalizing')
            AND NOT EXISTS (SELECT 1 FROM execution_interruptions i WHERE i.execution_id=phase_jobs.execution_id
              AND (i.state='exhausted' OR (i.state='pending' AND i.next_attempt_ms>?)))
            ORDER BY created_at_ms, id LIMIT 1`,
          )
          .get(nowMs, runId ?? null, runId ?? null, nowMs) as PhaseJob | undefined;
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
        assertExecutionNotInterrupted(this.#database, value.executionId);
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
        if (dispatch === 'implementation_worker') {
          const imported = this.#database
            .prepare(
              `SELECT 1 FROM implementation_imports WHERE
            execution_id=? AND base_head=? AND result_head=? AND status='verified'`,
            )
            .get(value.executionId, action.headSha, callback.headSha);
          if (!imported) throw new Error('phase completion lacks verified implementation import');
        }
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

  /** Atomically records verified coordinator effects, finishes this job and queues its successor.
   * Recovery re-observes the same broker records. No workflow transition is performed here.
   */
  completeCoordinator(
    job: PhaseJob,
    proofInput: unknown,
    fences: { workspace: number; run: number; task: number },
    nowMs = Date.now(),
  ): void {
    const action = this.action(job);
    const previous = this.get(job.id);
    if (
      previous?.status === 'completed' &&
      previous.result_json &&
      previous.lease_owner === job.lease_owner &&
      previous.lease_epoch === job.lease_epoch
    ) {
      const receipt = coordinatorReceiptSchema.parse(JSON.parse(previous.result_json));
      if (
        JSON.stringify(receipt.proof) !== JSON.stringify(coordinatorProofSchema.parse(proofInput))
      )
        throw new Error('coordinator completion replay conflict');
      return;
    }
    const documents = verifyDocumentBoundary(this.#database, {
      runId: action.runId,
      taskId: action.taskId,
      boundary: 'phase.coordinator_complete',
      ownerId: job.lease_owner ?? '',
      nowMs,
    });
    this.#database
      .transaction(() => {
        assertDocumentAuthority(this.#database, action.runId, documents.approvalId);
        const current = this.get(job.id);
        if (current?.status !== 'started' || current.execution_id !== job.execution_id)
          throw new Error('coordinator execution mismatch');
        for (const [kind, resource, epoch] of [
          ['workspace', action.workspaceId, fences.workspace],
          ['run', action.runId, fences.run],
          ['task', action.taskId, fences.task],
        ] as const) {
          if (
            !this.#database
              .prepare(
                `SELECT 1 FROM leases WHERE resource_type=? AND resource_id=?
          AND owner_id=? AND epoch=? AND expires_at_ms>?`,
              )
              .get(kind, resource, job.lease_owner, epoch, nowMs)
          )
            throw new Error('coordinator resource fence rejected');
        }
        const currentContract = this.#database
          .prepare(
            `SELECT c.body_json FROM contracts c JOIN runs r ON r.contract_id=c.id WHERE r.id=?`,
          )
          .get(action.runId) as { body_json: string };
        if (
          deriveContractMaterialDigest(
            executionContractSchema.parse(JSON.parse(currentContract.body_json)),
          ) !== action.materialDigest ||
          !this.#database
            .prepare(
              `SELECT 1 FROM plan_approvals WHERE run_id=? AND status='active' AND material_digest=?
          AND contract_version=? AND policy_digest=?`,
            )
            .get(action.runId, action.materialDigest, action.contractVersion, action.policyDigest)
        )
          throw new Error('coordinator approved material changed');
        const outcome = verifyCoordinatorProof(this.#database, action, proofInput);
        const receipt = coordinatorReceiptSchema.parse({
          jobId: job.id,
          executionId: job.execution_id,
          action,
          owner: job.lease_owner,
          phaseEpoch: job.lease_epoch,
          fences,
          proof: proofInput,
          outcome,
        });
        const id = digestGovernedValue(receipt);
        this.#database
          .prepare(
            `INSERT INTO coordinator_receipts (id,phase_job_id,run_id,receipt_json,created_at_ms)
        VALUES (?,?,?,?,?)`,
          )
          .run(id, job.id, action.runId, JSON.stringify(receipt), nowMs);
        this.#update(
          job,
          "status='completed',result_json=?,completed_at_ms=?,lease_until_ms=0",
          [JSON.stringify(receipt), nowMs],
          nowMs,
        );
        if (outcome.state !== 'closed') {
          const next = actionForCoordinatorReceipt(receipt);
          assertPhaseJobAuthority(this.#database, next);
          this.#database
            .prepare(
              `INSERT INTO phase_jobs (id,continuation_id,coordinator_receipt_id,run_id,action_json,created_at_ms)
          VALUES (?,?,?,?,?,?)`,
            )
            .run(`phase:${id}`, job.continuation_id, id, action.runId, JSON.stringify(next), nowMs);
          this.#event(
            job,
            'phase_queued',
            id,
            {
              phaseJobId: `phase:${id}`,
              phase: next.phase,
              dispatch: PHASE_JOB_DISPATCH[next.phase],
            },
            nowMs,
          );
        }
        this.#event(
          job,
          'phase_completed',
          id,
          { receiptId: id, executionId: job.execution_id },
          nowMs,
        );
      })
      .immediate();
  }

  finalizeInterrupted(job: PhaseJob, nowMs = Date.now()): void {
    this.#database
      .transaction(() => {
        const interruption = getInterruption(this.#database, job.execution_id!);
        if (interruption?.state !== 'settled' || interruption.job_id !== job.id)
          throw new Error('cleanup_unsettled');
        const execution = this.#database
          .prepare(
            'SELECT status,credential_status FROM scheduler_executions WHERE id=? AND run_id=?',
          )
          .get(job.execution_id, job.run_id) as
          | { status: string; credential_status: string }
          | undefined;
        if (
          execution &&
          (execution.status === 'completed' || execution.credential_status !== 'revoked')
        )
          throw new Error('cleanup_finalization_rejected');
        this.#update(
          job,
          "status='blocked',failure_code=?,lease_until_ms=0",
          [interruption.reason],
          nowMs,
        );
        this.#database
          .prepare(
            "UPDATE scheduler_executions SET status='escalated',result_json=?,updated_at_ms=? WHERE id=? AND status='active'",
          )
          .run(JSON.stringify({ reason: interruption.reason }), nowMs, job.execution_id);
        this.#event(
          job,
          'phase_blocked',
          String(job.lease_epoch),
          { reason: interruption.reason },
          nowMs,
        );
      })
      .immediate();
  }

  deferInterrupted(job: PhaseJob, nowMs: number): void {
    if (!job.execution_id || !getInterruption(this.#database, job.execution_id))
      throw new Error('interruption_missing');
    this.#update(job, 'lease_until_ms=0', [], nowMs);
  }

  interruptions(): InterruptionCleanupJournal {
    return new InterruptionCleanupJournal(this.#database);
  }

  interrupt(job: PhaseJob, reason: string, nowMs: number): boolean {
    if (!/^[a-z][a-z0-9_]{0,95}$/u.test(reason) || !job.execution_id)
      throw new Error('invalid_interruption');
    return this.#database
      .transaction(() => {
        const execution = this.#database
          .prepare(
            'SELECT status,credential_broker_generation FROM scheduler_executions WHERE id=?',
          )
          .get(job.execution_id) as
          | { status: string; credential_broker_generation: string | null }
          | undefined;
        if (execution?.status === 'completed') return false;
        this.#update(job, 'failure_code=COALESCE(failure_code,?)', [reason], nowMs);
        if (!getInterruption(this.#database, job.execution_id!)) {
          this.#database
            .prepare(
              `INSERT INTO execution_interruptions
          (execution_id,job_id,run_id,reason,observed_at_ms,broker_generation,owner,epoch,lease_until_ms)
          VALUES (?,?,?,?,?,?,?,?,?)`,
            )
            .run(
              job.execution_id,
              job.id,
              job.run_id,
              reason,
              nowMs,
              execution?.credential_broker_generation ?? null,
              job.lease_owner,
              job.lease_epoch,
              0,
            );
          this.#event(
            job,
            'phase_recovery_required',
            'interrupted',
            { executionId: job.execution_id, reason, cleanup: 'pending' },
            nowMs,
          );
        }
        return true;
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
