import { createHash, randomUUID } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { executionContractSchema, type ExecutionContract } from './contracts.js';
import { deriveTransitionIdempotencyKey } from './lifecycle.js';
import {
  approvalInvalidationReason,
  criticReviewSchema,
  deriveContractMaterialDigest,
  findingDispositionSchema,
  planApprovalSchema,
  type CriticReview,
  type FindingDisposition,
  type PlanApproval,
} from './planning.js';
import { validateTransition, type TransitionContext, type WorkflowState } from './stateMachine.js';

export interface WorkflowControlPaths {
  workspaceId: string;
  root: string;
  database: string;
  artifacts: string;
}

export async function resolveWorkflowControlPaths(
  codexHome: string,
  workspaceRoot: string,
): Promise<WorkflowControlPaths> {
  const canonicalWorkspace = await realpath(workspaceRoot);
  const workspaceHash = createHash('sha256').update(canonicalWorkspace).digest('hex');
  const root = join(codexHome, 'workflow-control', workspaceHash);
  const artifacts = join(root, 'artifacts');
  await mkdir(artifacts, { recursive: true, mode: 0o700 });
  return {
    workspaceId: `sha256:${workspaceHash}`,
    root,
    database: join(root, 'workflow.sqlite'),
    artifacts,
  };
}

export type TransitionStatus = 'prepared' | 'committed' | 'escalated';

export interface RunRecord {
  id: string;
  contractId: string;
  state: WorkflowState;
  version: number;
  mergeVerified: boolean;
}

export interface LeaseRecord {
  resourceType: 'workspace' | 'run' | 'task' | 'closeout';
  resourceId: string;
  ownerId: string;
  epoch: number;
  expiresAtMs: number;
}

export type SchedulerExecutionStatus = 'active' | 'completed' | 'cancelled' | 'escalated';
export type SchedulerCredentialStatus =
  | 'pending'
  | 'issuing'
  | 'issued'
  | 'revoking'
  | 'revoked'
  | 'legacy_quarantined';

export const workflowCredentialJournalCapability = Symbol('workflowCredentialJournalCapability');

export interface SchedulerExecutionRecord {
  id: string;
  workspaceId: string;
  runId: string;
  taskId: string;
  role: string;
  mode: 'read_only' | 'mutating';
  status: SchedulerExecutionStatus;
  deadlineMs: number;
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
  processIdentity: string;
  credentialLeaseId: string;
  credentialStatus: SchedulerCredentialStatus;
  credentialBrokerGeneration: string | null;
  packet: unknown;
  result: unknown | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PrepareTransitionInput {
  id: string;
  runId: string;
  from: WorkflowState;
  to: WorkflowState;
  operation: string;
  expectedRunVersion: number;
  idempotencyKey: string;
  actorRole: string;
  contractVersion: number;
  policyDigest: string;
  leaseOwnerId: string;
  leaseEpoch: number;
  transitionContext: Pick<TransitionContext, 'workspaceLeaseEpoch'> &
    Partial<
      Pick<
        TransitionContext,
        'taskLeaseEpoch' | 'recoveryTarget' | 'mergeVerified' | 'finalizationVerified' | 'wait'
      >
    >;
  expectedExternalState: unknown;
  externalArguments: unknown;
  nowMs: number;
}

export interface TransitionRecord extends PrepareTransitionInput {
  status: TransitionStatus;
  result: unknown | null;
}

type RunRow = {
  id: string;
  contract_id: string;
  state: WorkflowState;
  version: number;
  merge_verified: number;
};

type LeaseRow = {
  resource_type: LeaseRecord['resourceType'];
  resource_id: string;
  owner_id: string;
  epoch: number;
  expires_at_ms: number;
};

type TransitionRow = {
  id: string;
  run_id: string;
  from_state: WorkflowState;
  to_state: WorkflowState;
  operation: string;
  expected_run_version: number;
  idempotency_key: string;
  status: TransitionStatus;
  actor_role: string;
  contract_version: number;
  policy_digest: string;
  lease_owner_id: string;
  lease_epoch: number;
  transition_context_json: string;
  expected_external_state_json: string;
  external_arguments_json: string;
  result_json: string | null;
  created_at_ms: number;
};

type SchedulerExecutionRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  task_id: string;
  role: string;
  mode: SchedulerExecutionRecord['mode'];
  status: SchedulerExecutionStatus;
  deadline_ms: number;
  owner_id: string;
  workspace_lease_epoch: number;
  run_lease_epoch: number;
  task_lease_epoch: number;
  process_identity: string;
  credential_lease_id: string;
  credential_status: SchedulerCredentialStatus;
  credential_broker_generation: string | null;
  packet_json: string;
  result_json: string | null;
  created_at_ms: number;
  updated_at_ms: number;
};

function parseJson(value: string | null): unknown | null {
  return value === null ? null : (JSON.parse(value) as unknown);
}

function requiredTransitionTaskId(arguments_: unknown): string {
  if (typeof arguments_ !== 'object' || arguments_ === null || Array.isArray(arguments_)) {
    throw new Error('task-fenced transition arguments must be an object');
  }
  const taskId = (arguments_ as Record<string, unknown>).taskId;
  if (typeof taskId !== 'string' || taskId.trim() === '') {
    throw new Error('task-fenced transition requires taskId');
  }
  return taskId;
}

function transitionFromRow(row: TransitionRow): TransitionRecord {
  return {
    id: row.id,
    runId: row.run_id,
    from: row.from_state,
    to: row.to_state,
    operation: row.operation,
    expectedRunVersion: row.expected_run_version,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    actorRole: row.actor_role,
    contractVersion: row.contract_version,
    policyDigest: row.policy_digest,
    leaseOwnerId: row.lease_owner_id,
    leaseEpoch: row.lease_epoch,
    transitionContext: JSON.parse(
      row.transition_context_json,
    ) as PrepareTransitionInput['transitionContext'],
    expectedExternalState: parseJson(row.expected_external_state_json),
    externalArguments: parseJson(row.external_arguments_json),
    result: parseJson(row.result_json),
    nowMs: row.created_at_ms,
  };
}

function schedulerExecutionFromRow(row: SchedulerExecutionRow): SchedulerExecutionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    runId: row.run_id,
    taskId: row.task_id,
    role: row.role,
    mode: row.mode,
    status: row.status,
    deadlineMs: row.deadline_ms,
    ownerId: row.owner_id,
    workspaceLeaseEpoch: row.workspace_lease_epoch,
    runLeaseEpoch: row.run_lease_epoch,
    taskLeaseEpoch: row.task_lease_epoch,
    processIdentity: row.process_identity,
    credentialLeaseId: row.credential_lease_id,
    credentialStatus: row.credential_status,
    credentialBrokerGeneration: row.credential_broker_generation,
    packet: parseJson(row.packet_json),
    result: parseJson(row.result_json),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

function sameImmutableTransition(
  existing: TransitionRecord,
  input: PrepareTransitionInput,
): boolean {
  return (
    existing.id === input.id &&
    existing.runId === input.runId &&
    existing.from === input.from &&
    existing.to === input.to &&
    existing.operation === input.operation &&
    existing.expectedRunVersion === input.expectedRunVersion &&
    existing.idempotencyKey === input.idempotencyKey &&
    existing.actorRole === input.actorRole &&
    existing.contractVersion === input.contractVersion &&
    existing.policyDigest === input.policyDigest &&
    existing.leaseOwnerId === input.leaseOwnerId &&
    existing.leaseEpoch === input.leaseEpoch &&
    JSON.stringify(existing.transitionContext) === JSON.stringify(input.transitionContext) &&
    JSON.stringify(existing.expectedExternalState) ===
      JSON.stringify(input.expectedExternalState) &&
    JSON.stringify(existing.externalArguments) === JSON.stringify(input.externalArguments)
  );
}

export class WorkflowStore {
  readonly #database: Database.Database;

  constructor(path: string) {
    this.#database = new Database(path);
    this.#database.pragma('foreign_keys = ON');
    this.#database.pragma('journal_mode = WAL');
    this.#migrate();
  }

  close(): void {
    this.#database.close();
  }

  createContract(contract: ExecutionContract, createdAtMs = Date.now()): string {
    const id = `${contract.featureId}:v${contract.contractVersion}:${contract.policyDigest}`;
    const body = JSON.stringify(contract);
    this.#database
      .prepare(
        `INSERT OR IGNORE INTO contracts
         (id, feature_id, contract_version, policy_digest, workspace_id, body_json, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        contract.featureId,
        contract.contractVersion,
        contract.policyDigest,
        contract.workspaceId,
        body,
        createdAtMs,
      );
    const stored = this.#database
      .prepare('SELECT body_json FROM contracts WHERE id = ?')
      .get(id) as {
      body_json: string;
    };
    if (stored.body_json !== body) {
      throw new Error('immutable contract identity already exists with different content');
    }
    return id;
  }

  createRun(contractId: string, state: WorkflowState = 'approved', id = randomUUID()): RunRecord {
    this.#database
      .prepare(
        `INSERT INTO runs (id, contract_id, state, version, merge_verified, created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, 0, 0, ?, ?)`,
      )
      .run(id, contractId, state, Date.now(), Date.now());
    return this.getRun(id)!;
  }

  getRun(id: string): RunRecord | undefined {
    const row = this.#database
      .prepare('SELECT id, contract_id, state, version, merge_verified FROM runs WHERE id = ?')
      .get(id) as RunRow | undefined;
    return row === undefined
      ? undefined
      : {
          id: row.id,
          contractId: row.contract_id,
          state: row.state,
          version: row.version,
          mergeVerified: row.merge_verified === 1,
        };
  }

  assertRunUsesContract(runId: string, contract: ExecutionContract): void {
    const stored = this.#contractForRun(runId);
    if (JSON.stringify(stored) !== JSON.stringify(contract)) {
      throw new Error('workflow run does not use the approved execution contract');
    }
  }

  acquireLease(
    resourceType: LeaseRecord['resourceType'],
    resourceId: string,
    ownerId: string,
    ttlMs: number,
    nowMs = Date.now(),
  ): LeaseRecord {
    if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new Error('lease ttl must be positive');
    return this.#database.transaction(() => {
      const existing = this.#database
        .prepare('SELECT * FROM leases WHERE resource_type = ? AND resource_id = ?')
        .get(resourceType, resourceId) as LeaseRow | undefined;
      if (
        existing !== undefined &&
        existing.expires_at_ms > nowMs &&
        existing.owner_id !== ownerId
      ) {
        throw new Error('resource lease is held by another owner');
      }
      const epoch =
        existing !== undefined && existing.owner_id === ownerId && existing.expires_at_ms > nowMs
          ? existing.epoch
          : (existing?.epoch ?? 0) + 1;
      const expiresAtMs = nowMs + ttlMs;
      this.#database
        .prepare(
          `INSERT INTO leases (resource_type, resource_id, owner_id, epoch, expires_at_ms)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(resource_type, resource_id) DO UPDATE SET
             owner_id = excluded.owner_id,
             epoch = excluded.epoch,
             expires_at_ms = excluded.expires_at_ms`,
        )
        .run(resourceType, resourceId, ownerId, epoch, expiresAtMs);
      return { resourceType, resourceId, ownerId, epoch, expiresAtMs };
    })();
  }

  prepareTransition(input: PrepareTransitionInput): TransitionRecord {
    return this.#database.transaction(() => {
      const canonicalKey = deriveTransitionIdempotencyKey({
        runId: input.runId,
        transitionId: input.id,
        operation: input.operation,
        expectedVersion: input.expectedRunVersion,
      });
      if (input.idempotencyKey !== canonicalKey) {
        throw new Error('transition idempotency key does not match canonical transition identity');
      }
      const replay = this.getTransitionByIdempotencyKey(input.idempotencyKey);
      if (replay !== undefined) {
        if (!sameImmutableTransition(replay, input)) throw new Error('idempotency key collision');
        return replay;
      }
      const run = this.getRun(input.runId);
      if (run === undefined) throw new Error('workflow run not found');
      const approved = this.#database
        .prepare(
          `SELECT contracts.contract_version, contracts.policy_digest, contracts.workspace_id
           FROM runs JOIN contracts ON contracts.id = runs.contract_id WHERE runs.id = ?`,
        )
        .get(input.runId) as {
        contract_version: number;
        policy_digest: string;
        workspace_id: string;
      };
      if (
        approved.contract_version !== input.contractVersion ||
        approved.policy_digest !== input.policyDigest
      ) {
        throw new Error('transition contract or policy is stale');
      }
      this.#assertResourceLease(
        'workspace',
        approved.workspace_id,
        input.leaseOwnerId,
        input.transitionContext.workspaceLeaseEpoch,
        input.nowMs,
      );
      if (input.transitionContext.taskLeaseEpoch !== undefined) {
        this.#assertResourceLease(
          'task',
          requiredTransitionTaskId(input.externalArguments),
          input.leaseOwnerId,
          input.transitionContext.taskLeaseEpoch,
          input.nowMs,
        );
      }
      validateTransition(input.from, input.to, {
        ...input.transitionContext,
        mergeVerified: run.mergeVerified,
        currentContractVersion: approved.contract_version,
        requestedContractVersion: input.contractVersion,
        currentPolicyDigest: approved.policy_digest,
        requestedPolicyDigest: input.policyDigest,
        actorWorkspaceLeaseEpoch: input.transitionContext.workspaceLeaseEpoch,
        actorTaskLeaseEpoch: input.transitionContext.taskLeaseEpoch,
      });
      if (input.from === 'finalizing' && input.to === 'closed' && !run.mergeVerified) {
        throw new Error('finalization requires persisted merge verification');
      }
      if (run.version !== input.expectedRunVersion || run.state !== input.from) {
        throw new Error('run compare-and-swap failed');
      }
      const prepared = this.#database
        .prepare(`SELECT id FROM transitions WHERE run_id = ? AND status = 'prepared'`)
        .get(input.runId) as { id: string } | undefined;
      if (prepared !== undefined) throw new Error('run already has a prepared transition');
      this.#assertLease(input.runId, input.leaseOwnerId, input.leaseEpoch, input.nowMs);
      this.#database
        .prepare(
          `INSERT INTO transitions
           (id, run_id, from_state, to_state, operation, expected_run_version, idempotency_key,
            status, actor_role, contract_version, policy_digest, lease_owner_id, lease_epoch,
            transition_context_json, expected_external_state_json, external_arguments_json,
            result_json, created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        )
        .run(
          input.id,
          input.runId,
          input.from,
          input.to,
          input.operation,
          input.expectedRunVersion,
          input.idempotencyKey,
          input.actorRole,
          input.contractVersion,
          input.policyDigest,
          input.leaseOwnerId,
          input.leaseEpoch,
          JSON.stringify(input.transitionContext),
          JSON.stringify(input.expectedExternalState),
          JSON.stringify(input.externalArguments),
          input.nowMs,
          input.nowMs,
        );
      this.#database
        .prepare(
          `INSERT INTO external_effects
           (id, transition_id, provider, operation, idempotency_key, status, result_json,
            created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, 'prepared', NULL, ?, ?)`,
        )
        .run(
          input.id,
          input.id,
          input.operation.split('.')[0] ?? 'unknown',
          input.operation,
          input.idempotencyKey,
          input.nowMs,
          input.nowMs,
        );
      const changed = this.#database
        .prepare(
          'UPDATE runs SET version = version + 1, updated_at_ms = ? WHERE id = ? AND version = ?',
        )
        .run(input.nowMs, input.runId, input.expectedRunVersion);
      if (changed.changes !== 1) throw new Error('run compare-and-swap failed');
      return this.getTransition(input.id)!;
    })();
  }

  commitTransition(
    transitionId: string,
    ownerId: string,
    leaseEpoch: number,
    result: unknown,
    nowMs = Date.now(),
  ): TransitionRecord {
    return this.#database.transaction(() => {
      const transition = this.getTransition(transitionId);
      if (transition === undefined) throw new Error('transition not found');
      if (transition.status === 'committed') return transition;
      if (transition.status !== 'prepared') throw new Error('transition cannot be committed');
      this.#assertLease(transition.runId, ownerId, leaseEpoch, nowMs);
      this.#assertTransitionResourceLeases(transition, ownerId, nowMs);
      if (ownerId !== transition.leaseOwnerId || leaseEpoch !== transition.leaseEpoch) {
        throw new Error('transition fencing token changed');
      }
      this.#database
        .prepare(
          `UPDATE transitions SET status = 'committed', result_json = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'prepared'`,
        )
        .run(JSON.stringify(result), nowMs, transitionId);
      this.#database
        .prepare(
          `UPDATE external_effects SET status = 'committed', result_json = ?, updated_at_ms = ?
           WHERE transition_id = ?`,
        )
        .run(JSON.stringify(result), nowMs, transitionId);
      this.#database
        .prepare('UPDATE runs SET state = ?, version = version + 1, updated_at_ms = ? WHERE id = ?')
        .run(transition.to, nowMs, transition.runId);
      return this.getTransition(transitionId)!;
    })();
  }

  escalateTransition(
    transitionId: string,
    ownerId: string,
    leaseEpoch: number,
    evidence: unknown,
    nowMs = Date.now(),
  ): void {
    this.#database.transaction(() => {
      const transition = this.getTransition(transitionId);
      if (transition === undefined) throw new Error('transition not found');
      if (transition.status !== 'prepared') throw new Error('transition cannot be escalated');
      this.#assertLease(transition.runId, ownerId, leaseEpoch, nowMs);
      this.#assertTransitionResourceLeases(transition, ownerId, nowMs);
      this.#database
        .prepare(
          `UPDATE transitions SET status = 'escalated', result_json = ?, updated_at_ms = ? WHERE id = ?`,
        )
        .run(JSON.stringify(evidence), nowMs, transitionId);
      this.#database
        .prepare(
          `UPDATE external_effects SET status = 'escalated', result_json = ?, updated_at_ms = ?
           WHERE transition_id = ?`,
        )
        .run(JSON.stringify(evidence), nowMs, transitionId);
      this.#database
        .prepare(
          `UPDATE runs SET state = 'escalated', version = version + 1, updated_at_ms = ? WHERE id = ?`,
        )
        .run(nowMs, transition.runId);
    })();
  }

  getTransition(id: string): TransitionRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM transitions WHERE id = ?').get(id) as
      | TransitionRow
      | undefined;
    return row === undefined ? undefined : transitionFromRow(row);
  }

  getTransitionByIdempotencyKey(key: string): TransitionRecord | undefined {
    const row = this.#database
      .prepare('SELECT * FROM transitions WHERE idempotency_key = ?')
      .get(key) as TransitionRow | undefined;
    return row === undefined ? undefined : transitionFromRow(row);
  }

  listPreparedTransitions(runId: string): TransitionRecord[] {
    const rows = this.#database
      .prepare(
        `SELECT * FROM transitions WHERE run_id = ? AND status = 'prepared' ORDER BY created_at_ms`,
      )
      .all(runId) as TransitionRow[];
    return rows.map(transitionFromRow);
  }

  adoptPreparedTransition(
    transitionId: string,
    newOwnerId: string,
    newLeaseEpoch: number,
    nowMs = Date.now(),
    recoveryContext?: PrepareTransitionInput['transitionContext'],
  ): TransitionRecord {
    return this.#database.transaction(() => {
      const transition = this.getTransition(transitionId);
      if (transition === undefined || transition.status !== 'prepared') {
        throw new Error('prepared transition not found');
      }
      if (newLeaseEpoch <= transition.leaseEpoch) {
        throw new Error('recovery lease does not fence the interrupted owner');
      }
      this.#assertLease(transition.runId, newOwnerId, newLeaseEpoch, nowMs);
      const nextContext = recoveryContext ?? transition.transitionContext;
      this.#assertResourceLease(
        'workspace',
        this.#workspaceForRun(transition.runId),
        newOwnerId,
        nextContext.workspaceLeaseEpoch,
        nowMs,
      );
      if (nextContext.taskLeaseEpoch !== undefined) {
        this.#assertResourceLease(
          'task',
          requiredTransitionTaskId(transition.externalArguments),
          newOwnerId,
          nextContext.taskLeaseEpoch,
          nowMs,
        );
      }
      this.#database
        .prepare(
          `UPDATE transitions SET lease_owner_id = ?, lease_epoch = ?, transition_context_json = ?,
           updated_at_ms = ?
           WHERE id = ? AND status = 'prepared'`,
        )
        .run(newOwnerId, newLeaseEpoch, JSON.stringify(nextContext), nowMs, transitionId);
      return this.getTransition(transitionId)!;
    })();
  }

  createSchedulerExecution(input: {
    id: string;
    workspaceId: string;
    runId: string;
    taskId: string;
    role: string;
    mode: SchedulerExecutionRecord['mode'];
    deadlineMs: number;
    ownerId: string;
    workspaceLeaseEpoch: number;
    runLeaseEpoch: number;
    taskLeaseEpoch: number;
    processIdentity: string;
    credentialLeaseId: string;
    packet: unknown;
    nowMs?: number;
  }): SchedulerExecutionRecord {
    const nowMs = input.nowMs ?? Date.now();
    if (input.deadlineMs <= nowMs) throw new Error('specialist deadline has elapsed');
    return this.#database.transaction(() => {
      this.#assertResourceLease(
        'workspace',
        input.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        nowMs,
      );
      this.#assertResourceLease('run', input.runId, input.ownerId, input.runLeaseEpoch, nowMs);
      this.#assertResourceLease('task', input.taskId, input.ownerId, input.taskLeaseEpoch, nowMs);
      const runWorkspace = this.#database
        .prepare(
          `SELECT contracts.workspace_id FROM runs
           JOIN contracts ON contracts.id = runs.contract_id WHERE runs.id = ?`,
        )
        .get(input.runId) as { workspace_id: string } | undefined;
      if (runWorkspace?.workspace_id !== input.workspaceId) {
        throw new Error('scheduler execution run is outside the fenced workspace');
      }
      const counts = this.#database
        .prepare(
          `SELECT
             SUM(CASE WHEN mode = 'mutating' THEN 1 ELSE 0 END) AS mutating,
             SUM(CASE WHEN mode = 'read_only' THEN 1 ELSE 0 END) AS read_only
           FROM scheduler_executions WHERE workspace_id = ? AND status = 'active'`,
        )
        .get(input.workspaceId) as { mutating: number | null; read_only: number | null };
      if (input.mode === 'mutating' && (counts.mutating ?? 0) >= 1) {
        throw new Error('pilot permits only one mutating specialist');
      }
      if ((counts.mutating ?? 0) + (counts.read_only ?? 0) >= 4) {
        throw new Error('specialist concurrency limit reached');
      }
      this.#database
        .prepare(
          `INSERT INTO scheduler_executions
           (id, workspace_id, run_id, task_id, role, mode, status, deadline_ms, owner_id,
            workspace_lease_epoch, run_lease_epoch, task_lease_epoch, process_identity,
            credential_lease_id, credential_status, credential_broker_generation, packet_json,
            result_json, created_at_ms,
            updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, NULL, ?, ?)`,
        )
        .run(
          input.id,
          input.workspaceId,
          input.runId,
          input.taskId,
          input.role,
          input.mode,
          input.deadlineMs,
          input.ownerId,
          input.workspaceLeaseEpoch,
          input.runLeaseEpoch,
          input.taskLeaseEpoch,
          input.processIdentity,
          input.credentialLeaseId,
          JSON.stringify(input.packet),
          nowMs,
          nowMs,
        );
      return this.getSchedulerExecution(input.id)!;
    })();
  }

  bindSchedulerCredentialGeneration(
    input: {
      id: string;
      leaseId: string;
      generation: string;
      nowMs?: number;
    },
    capability?: symbol,
  ): SchedulerExecutionRecord {
    if (capability !== workflowCredentialJournalCapability) {
      throw new Error('credential journal mutation requires broker capability');
    }
    if (input.generation.trim() === '') throw new Error('credential broker generation is required');
    const result = this.#database
      .prepare(
        `UPDATE scheduler_executions
         SET credential_broker_generation = ?, updated_at_ms = ?
         WHERE id = ? AND status = 'active' AND credential_lease_id = ?
           AND credential_status = 'pending'
           AND (credential_broker_generation IS NULL OR credential_broker_generation = ?)`,
      )
      .run(input.generation, input.nowMs ?? Date.now(), input.id, input.leaseId, input.generation);
    if (result.changes !== 1) {
      const current = this.getSchedulerExecution(input.id);
      if (current?.credentialBrokerGeneration === input.generation) return current;
      throw new Error('credential broker generation binding changed');
    }
    return this.getSchedulerExecution(input.id)!;
  }

  advanceSchedulerCredential(
    input: {
      id: string;
      leaseId: string;
      from: readonly SchedulerCredentialStatus[];
      to: SchedulerCredentialStatus;
      nowMs?: number;
    },
    capability?: symbol,
  ): SchedulerExecutionRecord {
    if (capability !== workflowCredentialJournalCapability) {
      throw new Error('credential journal mutation requires broker capability');
    }
    const execution = this.getSchedulerExecution(input.id);
    if (execution === undefined || execution.status !== 'active') {
      throw new Error('active scheduler execution not found for credential transition');
    }
    if (execution.credentialLeaseId !== input.leaseId) {
      throw new Error('scheduler credential lease identity changed');
    }
    if (execution.credentialStatus === input.to) return execution;
    const normativeTransitions: Readonly<
      Record<SchedulerCredentialStatus, readonly SchedulerCredentialStatus[]>
    > = {
      pending: ['issuing', 'revoking'],
      issuing: ['issued', 'revoking'],
      issued: ['revoking'],
      revoking: ['revoked'],
      revoked: [],
      legacy_quarantined: [],
    };
    if (!normativeTransitions[execution.credentialStatus].includes(input.to)) {
      throw new Error(
        `credential transition ${execution.credentialStatus} -> ${input.to} is forbidden`,
      );
    }
    if (!input.from.includes(execution.credentialStatus)) {
      throw new Error(
        `credential transition ${execution.credentialStatus} -> ${input.to} is not allowed`,
      );
    }
    if (
      !this.#compareAndSwapSchedulerCredential({
        id: input.id,
        leaseId: input.leaseId,
        expected: execution.credentialStatus,
        to: input.to,
        nowMs: input.nowMs,
      })
    ) {
      const current = this.getSchedulerExecution(input.id);
      if (current?.credentialStatus === input.to) return current;
      throw new Error('credential transition lost compare-and-swap race');
    }
    return this.getSchedulerExecution(input.id)!;
  }

  #compareAndSwapSchedulerCredential(input: {
    id: string;
    leaseId: string;
    expected: SchedulerCredentialStatus;
    to: SchedulerCredentialStatus;
    nowMs?: number;
  }): boolean {
    const normativeTransitions: Readonly<
      Record<SchedulerCredentialStatus, readonly SchedulerCredentialStatus[]>
    > = {
      pending: ['issuing', 'revoking'],
      issuing: ['issued', 'revoking'],
      issued: ['revoking'],
      revoking: ['revoked'],
      revoked: [],
      legacy_quarantined: [],
    };
    if (!normativeTransitions[input.expected].includes(input.to)) {
      throw new Error(`credential transition ${input.expected} -> ${input.to} is forbidden`);
    }
    const updated = this.#database
      .prepare(
        `UPDATE scheduler_executions SET credential_status = ?, updated_at_ms = ?
         WHERE id = ? AND status = 'active' AND credential_lease_id = ?
           AND credential_status = ?`,
      )
      .run(input.to, input.nowMs ?? Date.now(), input.id, input.leaseId, input.expected);
    return updated.changes === 1;
  }

  finishSchedulerExecution(input: {
    id: string;
    status: Exclude<SchedulerExecutionStatus, 'active'>;
    ownerId: string;
    workspaceLeaseEpoch: number;
    runLeaseEpoch: number;
    taskLeaseEpoch: number;
    result: unknown;
    nowMs?: number;
  }): SchedulerExecutionRecord {
    const nowMs = input.nowMs ?? Date.now();
    return this.#database.transaction(() => {
      const execution = this.getSchedulerExecution(input.id);
      if (execution === undefined) throw new Error('scheduler execution not found');
      if (execution.status !== 'active') return execution;
      this.#assertResourceLease(
        'workspace',
        execution.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        nowMs,
      );
      this.#assertResourceLease('run', execution.runId, input.ownerId, input.runLeaseEpoch, nowMs);
      this.#assertResourceLease(
        'task',
        execution.taskId,
        input.ownerId,
        input.taskLeaseEpoch,
        nowMs,
      );
      if (execution.ownerId !== input.ownerId) throw new Error('scheduler execution owner changed');
      if (
        execution.workspaceLeaseEpoch !== input.workspaceLeaseEpoch ||
        execution.runLeaseEpoch !== input.runLeaseEpoch ||
        execution.taskLeaseEpoch !== input.taskLeaseEpoch
      ) {
        throw new Error('scheduler execution fencing token changed');
      }
      if (execution.credentialStatus !== 'revoked') {
        throw new Error('scheduler execution cannot finish before credential revocation');
      }
      if (input.status === 'completed' && execution.deadlineMs <= nowMs) {
        throw new Error('specialist reservation timed out');
      }
      this.#database
        .prepare(
          `UPDATE scheduler_executions SET status = ?, result_json = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'active'`,
        )
        .run(input.status, JSON.stringify(input.result), nowMs, input.id);
      return this.getSchedulerExecution(input.id)!;
    })();
  }

  getSchedulerExecution(id: string): SchedulerExecutionRecord | undefined {
    const row = this.#database
      .prepare('SELECT * FROM scheduler_executions WHERE id = ?')
      .get(id) as SchedulerExecutionRow | undefined;
    return row === undefined ? undefined : schedulerExecutionFromRow(row);
  }

  listActiveSchedulerExecutions(workspaceId: string): SchedulerExecutionRecord[] {
    const rows = this.#database
      .prepare(
        `SELECT * FROM scheduler_executions
         WHERE workspace_id = ? AND status = 'active' ORDER BY created_at_ms, id`,
      )
      .all(workspaceId) as SchedulerExecutionRow[];
    return rows.map(schedulerExecutionFromRow);
  }

  adoptSchedulerExecution(input: {
    id: string;
    ownerId: string;
    workspaceLeaseEpoch: number;
    runLeaseTtlMs: number;
    taskLeaseTtlMs: number;
    nowMs: number;
  }): SchedulerExecutionRecord | undefined {
    return this.#database.transaction(() => {
      const execution = this.getSchedulerExecution(input.id);
      if (execution === undefined || execution.status !== 'active') return undefined;
      this.#assertResourceLease(
        'workspace',
        execution.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      const runLease = this.acquireLease(
        'run',
        execution.runId,
        input.ownerId,
        input.runLeaseTtlMs,
        input.nowMs,
      );
      const taskLease = this.acquireLease(
        'task',
        execution.taskId,
        input.ownerId,
        input.taskLeaseTtlMs,
        input.nowMs,
      );
      this.#database
        .prepare(
          `UPDATE scheduler_executions SET owner_id = ?, workspace_lease_epoch = ?,
             run_lease_epoch = ?, task_lease_epoch = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'active'`,
        )
        .run(
          input.ownerId,
          input.workspaceLeaseEpoch,
          runLease.epoch,
          taskLease.epoch,
          input.nowMs,
          input.id,
        );
      return this.getSchedulerExecution(input.id)!;
    })();
  }

  recordAttempt(input: {
    runId: string;
    scope: 'task' | 'finding' | 'infrastructure';
    scopeId: string;
    maxAttempts: number;
    hypothesis: string;
    nowMs?: number;
  }): number {
    return this.#database.transaction(() => {
      const row = this.#database
        .prepare(
          `SELECT MAX(attempt) AS attempt FROM attempts
           WHERE run_id = ? AND scope = ? AND scope_id = ?`,
        )
        .get(input.runId, input.scope, input.scopeId) as { attempt: number | null };
      const attempt = (row.attempt ?? 0) + 1;
      if (attempt > input.maxAttempts) throw new Error('retry budget exhausted');
      if (input.hypothesis.trim() === '') throw new Error('attempt hypothesis is required');
      this.#database
        .prepare(
          `INSERT INTO attempts
           (run_id, scope, scope_id, attempt, max_attempts, hypothesis, created_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.runId,
          input.scope,
          input.scopeId,
          attempt,
          input.maxAttempts,
          input.hypothesis,
          input.nowMs ?? Date.now(),
        );
      return attempt;
    })();
  }

  putWait(input: {
    runId: string;
    checkId: string;
    eventIdentity: string;
    nextPollAtMs: number;
    absoluteDeadlineMs: number;
    backoffCount: number;
  }): void {
    this.#database.transaction(() => {
      const existing = this.#database
        .prepare('SELECT absolute_deadline_ms FROM waits WHERE run_id = ? AND check_id = ?')
        .get(input.runId, input.checkId) as { absolute_deadline_ms: number } | undefined;
      const effectiveDeadline = Math.min(
        existing?.absolute_deadline_ms ?? input.absoluteDeadlineMs,
        input.absoluteDeadlineMs,
      );
      if (input.nextPollAtMs >= effectiveDeadline) {
        throw new Error('next poll must precede absolute deadline');
      }
      this.#database
        .prepare(
          `INSERT INTO waits
         (run_id, check_id, event_identity, next_poll_at_ms, absolute_deadline_ms, backoff_count)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id, check_id) DO UPDATE SET
           event_identity = excluded.event_identity,
           next_poll_at_ms = excluded.next_poll_at_ms,
           absolute_deadline_ms = MIN(waits.absolute_deadline_ms, excluded.absolute_deadline_ms),
           backoff_count = excluded.backoff_count`,
        )
        .run(
          input.runId,
          input.checkId,
          input.eventIdentity,
          input.nextPollAtMs,
          input.absoluteDeadlineMs,
          input.backoffCount,
        );
    })();
  }

  listDueWaits(nowMs: number): Array<{
    runId: string;
    checkId: string;
    deadlineReached: boolean;
  }> {
    const rows = this.#database
      .prepare(
        `SELECT run_id, check_id, absolute_deadline_ms
         FROM waits WHERE next_poll_at_ms <= ? OR absolute_deadline_ms <= ?`,
      )
      .all(nowMs, nowMs) as Array<{
      run_id: string;
      check_id: string;
      absolute_deadline_ms: number;
    }>;
    return rows.map((row) => ({
      runId: row.run_id,
      checkId: row.check_id,
      deadlineReached: row.absolute_deadline_ms <= nowMs,
    }));
  }

  recordFinding(input: {
    id: string;
    runId: string;
    taskId?: string;
    severity: string;
    body: unknown;
    createdAtMs?: number;
  }): void {
    this.#database
      .prepare(
        `INSERT INTO findings (id, run_id, task_id, severity, body_json, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.runId,
        input.taskId ?? null,
        input.severity,
        JSON.stringify(input.body),
        input.createdAtMs ?? Date.now(),
      );
  }

  recordEvidence(input: {
    digest: string;
    mediaType: string;
    sizeBytes: number;
    kind: string;
    producer: string;
    producerRole: string;
    workspaceId: string;
    runId: string;
    taskId?: string;
    transitionId?: string;
    contractVersion: number;
    policyDigest: string;
    headSha?: string;
    createdAtMs?: number;
  }): void {
    const createdAtMs = input.createdAtMs ?? Date.now();
    this.#database.transaction(() => {
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO evidence
           (digest, media_type, size_bytes, kind, producer, producer_role, workspace_id, run_id,
            task_id, transition_id, contract_version, policy_digest, head_sha, created_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.digest,
          input.mediaType,
          input.sizeBytes,
          input.kind,
          input.producer,
          input.producerRole,
          input.workspaceId,
          input.runId,
          input.taskId ?? null,
          input.transitionId ?? null,
          input.contractVersion,
          input.policyDigest,
          input.headSha ?? null,
          createdAtMs,
        );
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO evidence_bindings
           (digest, workspace_id, run_id, task_id, transition_id, contract_version, policy_digest,
            head_sha, producer, producer_role, kind, created_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.digest,
          input.workspaceId,
          input.runId,
          input.taskId ?? '',
          input.transitionId ?? '',
          input.contractVersion,
          input.policyDigest,
          input.headSha ?? '',
          input.producer,
          input.producerRole,
          input.kind,
          createdAtMs,
        );
    })();
  }

  hasEvidence(digest: string): boolean {
    return (
      this.#database.prepare('SELECT 1 AS found FROM evidence WHERE digest = ?').get(digest) !==
      undefined
    );
  }

  hasRunEvidenceBinding(input: {
    digest: string;
    workspaceId: string;
    runId: string;
    contractVersion: number;
    policyDigest: string;
    allowedProducerRoles: readonly string[];
  }): boolean {
    if (input.allowedProducerRoles.length === 0) return false;
    const placeholders = input.allowedProducerRoles.map(() => '?').join(', ');
    return (
      this.#database
        .prepare(
          `SELECT 1 AS found FROM evidence_bindings
           WHERE digest = ? AND workspace_id = ? AND run_id = ? AND contract_version = ?
             AND policy_digest = ? AND producer_role IN (${placeholders}) LIMIT 1`,
        )
        .get(
          input.digest,
          input.workspaceId,
          input.runId,
          input.contractVersion,
          input.policyDigest,
          ...input.allowedProducerRoles,
        ) !== undefined
    );
  }

  hasTaskEvidenceAtHead(input: {
    digest: string;
    workspaceId: string;
    runId: string;
    taskId: string;
    headSha: string;
    contractVersion: number;
    policyDigest: string;
  }): boolean {
    return (
      this.#database
        .prepare(
          `SELECT 1 AS found FROM evidence_bindings
           WHERE digest = ? AND workspace_id = ? AND run_id = ? AND task_id = ? AND head_sha = ?
             AND contract_version = ? AND policy_digest = ?`,
        )
        .get(
          input.digest,
          input.workspaceId,
          input.runId,
          input.taskId,
          input.headSha,
          input.contractVersion,
          input.policyDigest,
        ) !== undefined
    );
  }

  recordCriticReview(reviewInput: unknown, createdAtMs = Date.now()): CriticReview {
    const review = criticReviewSchema.parse(reviewInput);
    this.#database.transaction(() => {
      const run = this.getRun(review.runId);
      if (run === undefined) throw new Error('workflow run not found');
      const contract = this.#contractForRun(review.runId);
      if (
        contract.contractVersion !== review.contractVersion ||
        contract.policyDigest !== review.policyDigest ||
        deriveContractMaterialDigest(contract) !== review.materialDigest
      ) {
        throw new Error('critic review contract or policy is stale');
      }
      this.#assertEvidenceReferences(review.evidence);
      for (const finding of review.findings) this.#assertEvidenceReferences(finding.evidence);
      this.#database
        .prepare(
          `INSERT INTO critic_reviews
           (id, run_id, planner_id, critic_id, contract_version, policy_digest, material_digest, verdict,
            summary, evidence_json, human_decision_json, created_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          review.reviewId,
          review.runId,
          review.plannerId,
          review.criticId,
          review.contractVersion,
          review.policyDigest,
          review.materialDigest,
          review.verdict,
          review.summary,
          JSON.stringify(review.evidence),
          JSON.stringify(review.humanDecision),
          createdAtMs,
        );
      const insertFinding = this.#database.prepare(
        `INSERT INTO critic_findings
         (id, review_id, severity, summary, requirement, evidence_json, proposed_correction,
          requires_human_decision, disposition_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      );
      for (const finding of review.findings) {
        insertFinding.run(
          finding.id,
          review.reviewId,
          finding.severity,
          finding.summary,
          finding.requirement,
          JSON.stringify(finding.evidence),
          finding.proposedCorrection ?? null,
          finding.requiresHumanDecision ? 1 : 0,
        );
      }
    })();
    return review;
  }

  disposeCriticFinding(dispositionInput: unknown): FindingDisposition {
    const disposition = findingDispositionSchema.parse(dispositionInput);
    this.#assertEvidenceReferences(disposition.evidence);
    const changed = this.#database
      .prepare(
        `UPDATE critic_findings SET disposition_json = ?
         WHERE id = ? AND disposition_json IS NULL`,
      )
      .run(JSON.stringify(disposition), disposition.findingId);
    if (changed.changes !== 1) throw new Error('finding not found or already disposed');
    return disposition;
  }

  createPlanApproval(input: {
    approvalId: string;
    runId: string;
    approverId: string;
    contract: unknown;
    evidence: PlanApproval['evidence'];
    approvedAtMs?: number;
  }): PlanApproval {
    const contract = executionContractForApproval(input.contract);
    this.#assertEvidenceReferences(input.evidence);
    return this.#database.transaction(() => {
      const storedContract = this.#contractForRun(input.runId);
      if (
        storedContract.contractVersion !== contract.contractVersion ||
        storedContract.policyDigest !== contract.policyDigest ||
        deriveContractMaterialDigest(storedContract) !== deriveContractMaterialDigest(contract)
      ) {
        throw new Error('approval contract or policy is stale');
      }
      const latestReview = this.#database
        .prepare(
          `SELECT id, verdict FROM critic_reviews
           WHERE run_id = ? ORDER BY created_at_ms DESC, id DESC LIMIT 1`,
        )
        .get(input.runId) as { id: string; verdict: string } | undefined;
      if (latestReview?.verdict !== 'approved')
        throw new Error('latest critic review is not approved');
      const unresolved = this.#database
        .prepare(
          `SELECT COUNT(*) AS count FROM critic_findings
           JOIN critic_reviews ON critic_reviews.id = critic_findings.review_id
           WHERE critic_reviews.run_id = ? AND critic_findings.disposition_json IS NULL`,
        )
        .get(input.runId) as { count: number };
      if (unresolved.count > 0) throw new Error('critic findings remain unresolved');
      this.#database
        .prepare(
          `UPDATE plan_approvals SET status = 'invalidated', invalidated_at_ms = ?,
          invalidation_reason = 'superseded' WHERE run_id = ? AND status = 'active'`,
        )
        .run(input.approvedAtMs ?? Date.now(), input.runId);
      const approval = planApprovalSchema.parse({
        approvalId: input.approvalId,
        runId: input.runId,
        approverId: input.approverId,
        contractVersion: contract.contractVersion,
        policyDigest: contract.policyDigest,
        materialDigest: deriveContractMaterialDigest(contract),
        status: 'active',
        approvedAtMs: input.approvedAtMs ?? Date.now(),
        invalidatedAtMs: null,
        invalidationReason: null,
        evidence: input.evidence,
      });
      this.#database
        .prepare(
          `INSERT INTO plan_approvals
           (id, run_id, approver_id, contract_version, policy_digest, material_digest, status,
            approved_at_ms, invalidated_at_ms, invalidation_reason, evidence_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
        )
        .run(
          approval.approvalId,
          approval.runId,
          approval.approverId,
          approval.contractVersion,
          approval.policyDigest,
          approval.materialDigest,
          approval.status,
          approval.approvedAtMs,
          JSON.stringify(approval.evidence),
        );
      return approval;
    })();
  }

  invalidatePlanApproval(
    approvalId: string,
    reason: string,
    invalidatedAtMs = Date.now(),
  ): PlanApproval {
    if (reason.trim() === '') throw new Error('invalidation reason is required');
    const changed = this.#database
      .prepare(
        `UPDATE plan_approvals SET status = 'invalidated', invalidated_at_ms = ?,
         invalidation_reason = ? WHERE id = ? AND status = 'active'`,
      )
      .run(invalidatedAtMs, reason, approvalId);
    if (changed.changes !== 1) throw new Error('active approval not found');
    return this.getPlanApproval(approvalId)!;
  }

  revalidatePlanApproval(
    approvalId: string,
    contractInput: unknown,
    nowMs = Date.now(),
  ): PlanApproval {
    const approval = this.getPlanApproval(approvalId);
    if (approval === undefined) throw new Error('approval not found');
    if (approval.status === 'invalidated') return approval;
    const reason = approvalInvalidationReason(approval, contractInput);
    return reason === undefined ? approval : this.invalidatePlanApproval(approvalId, reason, nowMs);
  }

  getPlanApproval(approvalId: string): PlanApproval | undefined {
    const row = this.#database
      .prepare('SELECT * FROM plan_approvals WHERE id = ?')
      .get(approvalId) as
      | {
          id: string;
          run_id: string;
          approver_id: string;
          contract_version: 1;
          policy_digest: string;
          material_digest: string;
          status: 'active' | 'invalidated';
          approved_at_ms: number;
          invalidated_at_ms: number | null;
          invalidation_reason: string | null;
          evidence_json: string;
        }
      | undefined;
    return row === undefined
      ? undefined
      : planApprovalSchema.parse({
          approvalId: row.id,
          runId: row.run_id,
          approverId: row.approver_id,
          contractVersion: row.contract_version,
          policyDigest: row.policy_digest,
          materialDigest: row.material_digest,
          status: row.status,
          approvedAtMs: row.approved_at_ms,
          invalidatedAtMs: row.invalidated_at_ms,
          invalidationReason: row.invalidation_reason,
          evidence: JSON.parse(row.evidence_json) as unknown,
        });
  }

  assertRunLease(runId: string, ownerId: string, epoch: number, nowMs = Date.now()): void {
    this.#assertLease(runId, ownerId, epoch, nowMs);
  }

  assertTransitionLeases(
    transition: TransitionRecord,
    ownerId: string,
    runLeaseEpoch: number,
    nowMs = Date.now(),
  ): void {
    this.#assertLease(transition.runId, ownerId, runLeaseEpoch, nowMs);
    this.#assertTransitionResourceLeases(transition, ownerId, nowMs);
    if (transition.leaseOwnerId !== ownerId || transition.leaseEpoch !== runLeaseEpoch) {
      throw new Error('transition fencing token changed');
    }
  }

  assertResourceLease(
    resourceType: LeaseRecord['resourceType'],
    resourceId: string,
    ownerId: string,
    epoch: number,
    nowMs = Date.now(),
  ): void {
    this.#assertResourceLease(resourceType, resourceId, ownerId, epoch, nowMs);
  }

  #assertLease(runId: string, ownerId: string, epoch: number, nowMs: number): void {
    this.#assertResourceLease('run', runId, ownerId, epoch, nowMs);
  }

  #assertResourceLease(
    resourceType: LeaseRecord['resourceType'],
    resourceId: string,
    ownerId: string,
    epoch: number,
    nowMs: number,
  ): void {
    const lease = this.#database
      .prepare(`SELECT * FROM leases WHERE resource_type = ? AND resource_id = ?`)
      .get(resourceType, resourceId) as LeaseRow | undefined;
    if (
      lease === undefined ||
      lease.owner_id !== ownerId ||
      lease.epoch !== epoch ||
      lease.expires_at_ms <= nowMs
    ) {
      throw new Error(`stale or expired ${resourceType} fencing token`);
    }
  }

  #contractForRun(runId: string): ExecutionContract {
    const row = this.#database
      .prepare(
        `SELECT contracts.body_json FROM runs JOIN contracts ON contracts.id = runs.contract_id
        WHERE runs.id = ?`,
      )
      .get(runId) as { body_json: string } | undefined;
    if (row === undefined) throw new Error('workflow run not found');
    return JSON.parse(row.body_json) as ExecutionContract;
  }

  #workspaceForRun(runId: string): string {
    const row = this.#database
      .prepare(
        `SELECT contracts.workspace_id FROM runs
         JOIN contracts ON contracts.id = runs.contract_id WHERE runs.id = ?`,
      )
      .get(runId) as { workspace_id: string } | undefined;
    if (row === undefined) throw new Error('workflow run not found');
    return row.workspace_id;
  }

  #assertTransitionResourceLeases(
    transition: TransitionRecord,
    ownerId: string,
    nowMs: number,
  ): void {
    this.#assertResourceLease(
      'workspace',
      this.#workspaceForRun(transition.runId),
      ownerId,
      transition.transitionContext.workspaceLeaseEpoch,
      nowMs,
    );
    if (transition.transitionContext.taskLeaseEpoch !== undefined) {
      this.#assertResourceLease(
        'task',
        requiredTransitionTaskId(transition.externalArguments),
        ownerId,
        transition.transitionContext.taskLeaseEpoch,
        nowMs,
      );
    }
  }

  #assertEvidenceReferences(references: ReadonlyArray<{ digest: string }>): void {
    if (references.some((reference) => !this.hasEvidence(reference.digest))) {
      throw new Error('planning evidence is not recorded');
    }
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        feature_id TEXT NOT NULL,
        contract_version INTEGER NOT NULL,
        policy_digest TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        body_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        UNIQUE(feature_id, contract_version, policy_digest)
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL REFERENCES contracts(id),
        state TEXT NOT NULL,
        version INTEGER NOT NULL,
        merge_verified INTEGER NOT NULL CHECK (merge_verified IN (0, 1)),
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leases (
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        epoch INTEGER NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        PRIMARY KEY(resource_type, resource_id)
      );
      CREATE TABLE IF NOT EXISTS transitions (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        operation TEXT NOT NULL,
        expected_run_version INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('prepared', 'committed', 'escalated')),
        actor_role TEXT NOT NULL,
        contract_version INTEGER NOT NULL,
        policy_digest TEXT NOT NULL,
        lease_owner_id TEXT NOT NULL,
        lease_epoch INTEGER NOT NULL,
        transition_context_json TEXT NOT NULL,
        expected_external_state_json TEXT NOT NULL,
        external_arguments_json TEXT NOT NULL,
        result_json TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        run_id TEXT NOT NULL REFERENCES runs(id),
        scope TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        max_attempts INTEGER NOT NULL,
        hypothesis TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        PRIMARY KEY(run_id, scope, scope_id, attempt)
      );
      CREATE TABLE IF NOT EXISTS waits (
        run_id TEXT NOT NULL REFERENCES runs(id),
        check_id TEXT NOT NULL,
        event_identity TEXT NOT NULL,
        next_poll_at_ms INTEGER NOT NULL,
        absolute_deadline_ms INTEGER NOT NULL,
        backoff_count INTEGER NOT NULL,
        PRIMARY KEY(run_id, check_id)
      );
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT,
        severity TEXT NOT NULL,
        body_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS external_effects (
        id TEXT PRIMARY KEY,
        transition_id TEXT NOT NULL REFERENCES transitions(id),
        provider TEXT NOT NULL,
        operation TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        result_json TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evidence (
        digest TEXT PRIMARY KEY,
        media_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        kind TEXT NOT NULL,
        producer TEXT NOT NULL,
        producer_role TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT,
        transition_id TEXT REFERENCES transitions(id),
        contract_version INTEGER NOT NULL,
        policy_digest TEXT NOT NULL,
        head_sha TEXT,
        created_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evidence_bindings (
        digest TEXT NOT NULL REFERENCES evidence(digest),
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        transition_id TEXT NOT NULL,
        contract_version INTEGER NOT NULL,
        policy_digest TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        producer TEXT NOT NULL,
        producer_role TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        PRIMARY KEY(digest, workspace_id, run_id, task_id, transition_id, head_sha, producer, kind)
      );
      CREATE TABLE IF NOT EXISTS critic_reviews (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        planner_id TEXT NOT NULL,
        critic_id TEXT NOT NULL,
        contract_version INTEGER NOT NULL,
        policy_digest TEXT NOT NULL,
        material_digest TEXT NOT NULL,
        verdict TEXT NOT NULL,
        summary TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        human_decision_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS critic_findings (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL REFERENCES critic_reviews(id),
        severity TEXT NOT NULL,
        summary TEXT NOT NULL,
        requirement TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        proposed_correction TEXT,
        requires_human_decision INTEGER NOT NULL CHECK (requires_human_decision IN (0, 1)),
        disposition_json TEXT
      );
      CREATE TABLE IF NOT EXISTS plan_approvals (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        approver_id TEXT NOT NULL,
        contract_version INTEGER NOT NULL,
        policy_digest TEXT NOT NULL,
        material_digest TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'invalidated')),
        approved_at_ms INTEGER NOT NULL,
        invalidated_at_ms INTEGER,
        invalidation_reason TEXT,
        evidence_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scheduler_executions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        role TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('read_only', 'mutating')),
        status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'cancelled', 'escalated')),
        deadline_ms INTEGER NOT NULL,
        owner_id TEXT NOT NULL,
        workspace_lease_epoch INTEGER NOT NULL,
        run_lease_epoch INTEGER NOT NULL,
        task_lease_epoch INTEGER NOT NULL,
        process_identity TEXT NOT NULL,
        credential_lease_id TEXT NOT NULL,
        credential_status TEXT NOT NULL CHECK(
          credential_status IN (
            'pending', 'issuing', 'issued', 'revoking', 'revoked', 'legacy_quarantined'
          )
        ),
        credential_broker_generation TEXT,
        packet_json TEXT NOT NULL,
        result_json TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS scheduler_executions_workspace_status
        ON scheduler_executions(workspace_id, status, mode);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (1, unixepoch() * 1000);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (2, unixepoch() * 1000);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (3, unixepoch() * 1000);
    `);
    const transitionColumns = this.#database
      .prepare('PRAGMA table_info(transitions)')
      .all() as Array<{
      name: string;
    }>;
    if (!transitionColumns.some((column) => column.name === 'transition_context_json')) {
      this.#database.exec(
        `ALTER TABLE transitions ADD COLUMN transition_context_json TEXT NOT NULL
         DEFAULT '{"workspaceLeaseEpoch":0}'`,
      );
    }
    const schedulerColumns = this.#database
      .prepare('PRAGMA table_info(scheduler_executions)')
      .all() as Array<{ name: string }>;
    if (!schedulerColumns.some((column) => column.name === 'process_identity')) {
      this.#database.exec(
        `ALTER TABLE scheduler_executions ADD COLUMN process_identity TEXT NOT NULL
         DEFAULT 'unknown:legacy-execution'`,
      );
    }
    if (!schedulerColumns.some((column) => column.name === 'credential_lease_id')) {
      this.#database.exec(
        `ALTER TABLE scheduler_executions ADD COLUMN credential_lease_id TEXT NOT NULL
         DEFAULT 'credential:legacy-execution'`,
      );
    }
    if (!schedulerColumns.some((column) => column.name === 'credential_status')) {
      this.#database.exec(
        `ALTER TABLE scheduler_executions ADD COLUMN credential_status TEXT NOT NULL
         DEFAULT 'legacy_quarantined'`,
      );
    }
    if (!schedulerColumns.some((column) => column.name === 'credential_broker_generation')) {
      this.#database.exec(
        `ALTER TABLE scheduler_executions ADD COLUMN credential_broker_generation TEXT`,
      );
    }
    this.#database
      .prepare(
        `UPDATE scheduler_executions
         SET credential_lease_id = 'legacy-quarantined:' || id
         WHERE credential_lease_id = 'credential:legacy-execution'`,
      )
      .run();
    this.#database
      .prepare(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (4, unixepoch() * 1000)',
      )
      .run();
    this.#database
      .prepare(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (5, unixepoch() * 1000)',
      )
      .run();
    this.#database
      .prepare(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (6, unixepoch() * 1000)',
      )
      .run();
    this.#database
      .prepare(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (7, unixepoch() * 1000)',
      )
      .run();
  }
}

function executionContractForApproval(input: unknown): ExecutionContract {
  return executionContractSchema.parse(input);
}
