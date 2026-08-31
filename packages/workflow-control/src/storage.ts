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
export const workflowRepairMutationCapability = Symbol('workflowRepairMutationCapability');
export const workflowDeliveryMutationCapability = Symbol('workflowDeliveryMutationCapability');
export const workflowEvaluationMutationCapability = Symbol('workflowEvaluationMutationCapability');
export const workflowSecureEvidenceMutationCapability = Symbol(
  'workflowSecureEvidenceMutationCapability',
);
export const workflowFinalizationMutationCapability = Symbol(
  'workflowFinalizationMutationCapability',
);
export const workflowCancellationMutationCapability = Symbol(
  'workflowCancellationMutationCapability',
);

export type DeliveryOperationStatus = 'prepared' | 'committed' | 'escalated';

export interface DeliveryOperationRecord {
  id: string;
  workspaceId: string;
  runId: string;
  taskId: string;
  kind: string;
  actorRole: string;
  requestDigest: string;
  request: unknown;
  requestJson: string;
  status: DeliveryOperationStatus;
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
  result: unknown | null;
  resultJson: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SecureEvidenceRecord {
  digest: string;
  workspaceId: string;
  runId: string;
  taskId: string;
  mediaType: string;
  sizeBytes: number;
  kind: string;
  producer: string;
  producerRole: string;
  contractVersion: number;
  policyDigest: string;
  headSha: string;
  redactionCount: number;
  retentionClass: 'raw' | 'summary';
  retentionUntilMs: number;
  acceptedAtMs: number | null;
  deletedAtMs: number | null;
  tombstoneDigest: string | null;
  createdAtMs: number;
}

export interface FeatureFinalizationRecord {
  runId: string;
  featureId: string;
  epicId: string;
  status: 'prepared' | 'finalizing' | 'closed';
  reportDigest: string;
  report: unknown;
  createdAtMs: number;
  closedAtMs: number | null;
}

export interface WorkflowCancellationRecord {
  id: string;
  runId: string;
  requestedBy: string;
  reason: string;
  requestedAtMs: number;
  stopDeadlineMs: number;
  status: 'requested' | 'cancelled' | 'escalated';
  ownedWorkStopped: boolean;
  incompleteCleanup: string[];
  retainedEvidence: unknown[];
  completedAtMs: number | null;
}

export interface EvaluationRecord {
  id: string;
  workspaceId: string;
  runId: string;
  taskId: string;
  headSha: string;
  evaluatorRole: string;
  result: unknown;
  createdAtMs: number;
}

export interface RepairChildIntentRecord {
  id: string;
  workspaceId: string;
  runId: string;
  sequence: number;
  findingDigest: string;
  chainTipTaskId: string;
  request: unknown;
  status: 'prepared' | 'committed' | 'escalated';
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
  result: unknown | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AuthorizedRunTask {
  id: string;
  assignedRole: string;
  allowedPaths: string[];
  allowedOperations: string[];
}

export interface PrepareDeliveryOperationInput {
  id: string;
  workspaceId: string;
  runId: string;
  taskId: string;
  kind: string;
  actorRole: string;
  requestDigest: string;
  request: unknown;
  contractVersion: number;
  policyDigest: string;
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
  nowMs: number;
}

export interface PipelineWaitEscalationRecord {
  id: string;
  workspaceId: string;
  runId: string;
  taskId: string;
  checkId: string;
  eventIdentity: string;
  report: unknown;
  createdAtMs: number;
}

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

export interface RepairDispatchRecord {
  id: string;
  runId: string;
  taskId: string;
  findingId: string;
  taskAttempt: number;
  findingAttempt: number;
  ownerRole: string;
  findingDigest: string;
  failureHeadSha: string;
  changeDigest: string;
  changeEvidenceMinAtMs: number | null;
  changeEvidenceAtMs: number | null;
  changeHeadSha: string | null;
  packet: unknown;
  status: 'dispatched' | 'accepted' | 'cancelled';
  result: unknown | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface RepairEscalationRecord {
  id: string;
  runId: string;
  scope: 'task' | 'finding';
  scopeId: string;
  findingId: string;
  findingDigest: string;
  report: unknown;
  createdAtMs: number;
}

export type RepairPlanResult =
  | { kind: 'dispatch'; dispatch: RepairDispatchRecord }
  | { kind: 'escalated'; escalation: RepairEscalationRecord };

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
        | 'taskLeaseEpoch'
        | 'closeoutLeaseEpoch'
        | 'recoveryTarget'
        | 'mergeVerified'
        | 'finalizationVerified'
        | 'wait'
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

type DeliveryOperationRow = {
  id: string;
  workspace_id: string;
  run_id: string;
  task_id: string;
  kind: string;
  actor_role: string;
  request_digest: string;
  request_json: string;
  status: DeliveryOperationStatus;
  owner_id: string;
  workspace_lease_epoch: number;
  run_lease_epoch: number;
  task_lease_epoch: number;
  result_json: string | null;
  created_at_ms: number;
  updated_at_ms: number;
};

type RepairDispatchRow = {
  id: string;
  run_id: string;
  task_id: string;
  finding_id: string;
  task_attempt: number;
  finding_attempt: number;
  owner_role: string;
  finding_digest: string;
  failure_head_sha: string;
  change_digest: string;
  change_evidence_min_at_ms: number | null;
  change_evidence_at_ms: number | null;
  change_head_sha: string | null;
  packet_json: string;
  status: RepairDispatchRecord['status'];
  result_json: string | null;
  created_at_ms: number;
  updated_at_ms: number;
};

type RepairEscalationRow = {
  id: string;
  run_id: string;
  scope: RepairEscalationRecord['scope'];
  scope_id: string;
  finding_id: string;
  finding_digest: string;
  report_json: string;
  created_at_ms: number;
};

function parseJson(value: string | null): unknown | null {
  return value === null ? null : (JSON.parse(value) as unknown);
}

function serializeDurableJson(value: unknown): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('delivery result must be JSON-compatible');
  }
  if (serialized === undefined) throw new Error('delivery result must be JSON-compatible');
  return serialized;
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

function repairDispatchFromRow(row: RepairDispatchRow): RepairDispatchRecord {
  return {
    id: row.id,
    runId: row.run_id,
    taskId: row.task_id,
    findingId: row.finding_id,
    taskAttempt: row.task_attempt,
    findingAttempt: row.finding_attempt,
    ownerRole: row.owner_role,
    findingDigest: row.finding_digest,
    failureHeadSha: row.failure_head_sha,
    changeDigest: row.change_digest,
    changeEvidenceMinAtMs: row.change_evidence_min_at_ms,
    changeEvidenceAtMs: row.change_evidence_at_ms,
    changeHeadSha: row.change_head_sha,
    packet: JSON.parse(row.packet_json) as unknown,
    status: row.status,
    result: parseJson(row.result_json),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

function repairEscalationFromRow(row: RepairEscalationRow): RepairEscalationRecord {
  return {
    id: row.id,
    runId: row.run_id,
    scope: row.scope,
    scopeId: row.scope_id,
    findingId: row.finding_id,
    findingDigest: row.finding_digest,
    report: JSON.parse(row.report_json) as unknown,
    createdAtMs: row.created_at_ms,
  };
}

function deliveryOperationFromRow(row: DeliveryOperationRow): DeliveryOperationRecord {
  let request: unknown;
  try {
    request = JSON.parse(row.request_json) as unknown;
  } catch {
    request = undefined;
  }
  let result: unknown | null = null;
  if (row.result_json !== null) {
    try {
      result = JSON.parse(row.result_json) as unknown;
    } catch {
      result = undefined;
    }
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    runId: row.run_id,
    taskId: row.task_id,
    kind: row.kind,
    actorRole: row.actor_role,
    requestDigest: row.request_digest,
    request,
    requestJson: row.request_json,
    status: row.status,
    ownerId: row.owner_id,
    workspaceLeaseEpoch: row.workspace_lease_epoch,
    runLeaseEpoch: row.run_lease_epoch,
    taskLeaseEpoch: row.task_lease_epoch,
    result,
    resultJson: row.result_json,
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

  assertApprovedTaskHead(
    input: { workspaceId: string; runId: string; taskId: string; headSha: string },
    capability?: symbol,
  ): void {
    if (
      capability !== workflowSecureEvidenceMutationCapability &&
      capability !== workflowEvaluationMutationCapability &&
      capability !== workflowDeliveryMutationCapability
    ) {
      throw new Error('approved task-head verification requires an internal capability');
    }
    const row = this.#database
      .prepare(
        `SELECT current_sha FROM delivery_approved_heads
         WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?
         UNION ALL
         SELECT current_sha FROM repair_approved_heads
         WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?`,
      )
      .get(
        input.workspaceId,
        input.runId,
        input.taskId,
        `refs/heads/task/${input.taskId}`,
        input.workspaceId,
        input.runId,
        input.taskId,
        `refs/heads/task/${input.taskId}`,
      ) as { current_sha: string } | undefined;
    if (row?.current_sha !== input.headSha) {
      throw new Error('evidence head is not the broker-approved exact task head');
    }
  }

  getAuthorizedRunTask(
    runId: string,
    taskId: string,
    capability?: symbol,
  ): AuthorizedRunTask | undefined {
    if (
      capability !== workflowSecureEvidenceMutationCapability &&
      capability !== workflowEvaluationMutationCapability &&
      capability !== workflowDeliveryMutationCapability
    ) {
      throw new Error('run-task authorization requires an internal capability');
    }
    const contract = this.#contractForRun(runId);
    const contractTask = contract.tasks.find((task) => task.id === taskId);
    if (contractTask !== undefined) {
      return {
        id: contractTask.id,
        assignedRole: contractTask.assignedRole,
        allowedPaths: [...contractTask.allowedPaths],
        allowedOperations: [...contractTask.allowedOperations],
      };
    }
    const row = this.#database
      .prepare(
        `SELECT request_json FROM repair_child_intents
         WHERE run_id = ? AND id = ? AND status = 'committed'`,
      )
      .get(runId, taskId) as { request_json: string } | undefined;
    if (row === undefined) return undefined;
    const request = JSON.parse(row.request_json) as Record<string, unknown>;
    if (
      request.id !== taskId ||
      typeof request.assignedRole !== 'string' ||
      !Array.isArray(request.allowedPaths) ||
      !request.allowedPaths.every((path) => typeof path === 'string') ||
      !Array.isArray(request.allowedOperations) ||
      !request.allowedOperations.every((operation) => typeof operation === 'string')
    ) {
      throw new Error('committed repair-child authority is malformed');
    }
    return {
      id: taskId,
      assignedRole: request.assignedRole,
      allowedPaths: request.allowedPaths as string[],
      allowedOperations: request.allowedOperations as string[],
    };
  }

  remainingRepairBudgetForChild(
    input: {
      runId: string;
      featureId: string;
      childId: string;
      findingId: string;
      policy: ExecutionContract['retryPolicy'];
    },
    capability?: symbol,
  ): ExecutionContract['retryPolicy'] {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('repair budget calculation requires an internal capability');
    }
    const reservations = this.#database
      .prepare(`SELECT child_id, finding_id FROM repair_child_budget_reservations WHERE run_id = ?`)
      .all(input.runId) as Array<{ child_id: string; finding_id: string }>;
    const existing = reservations.some((reservation) => reservation.child_id === input.childId);
    const reservationCount = reservations.length + (existing ? 0 : 1);
    const taskAttempts = this.#database
      .prepare(
        `SELECT scope_id, COUNT(*) AS count FROM attempts
         WHERE run_id = ? AND scope = 'task' AND scope_id LIKE ? GROUP BY scope_id`,
      )
      .all(input.runId, `${input.featureId}.repair.%`) as Array<{
      scope_id: string;
      count: number;
    }>;
    const findingIds = new Set([
      ...reservations.map((reservation) => reservation.finding_id),
      input.findingId,
    ]);
    const findingAttempts = this.#database
      .prepare(
        `SELECT scope_id, COUNT(*) AS count FROM attempts
         WHERE run_id = ? AND scope = 'finding' GROUP BY scope_id`,
      )
      .all(input.runId) as Array<{ scope_id: string; count: number }>;
    const taskExtras = taskAttempts.reduce((total, row) => total + Math.max(0, row.count - 1), 0);
    const findingExtras = findingAttempts.reduce(
      (total, row) => total + (findingIds.has(row.scope_id) ? Math.max(0, row.count - 1) : 0),
      0,
    );
    const infrastructure = this.#database
      .prepare(
        `SELECT COUNT(*) AS count FROM attempts WHERE run_id = ? AND scope = 'infrastructure'`,
      )
      .get(input.runId) as { count: number };
    if (
      !existing &&
      (reservations.length + taskExtras >= input.policy.implementationAttempts ||
        reservations.length + findingExtras >= input.policy.findingAttempts)
    ) {
      throw new Error('repair-child retry budget is exhausted');
    }
    return {
      implementationAttempts: Math.max(
        0,
        input.policy.implementationAttempts - reservationCount - taskExtras,
      ),
      findingAttempts: Math.max(0, input.policy.findingAttempts - reservationCount - findingExtras),
      infrastructureAttempts: Math.max(
        0,
        input.policy.infrastructureAttempts - infrastructure.count,
      ),
      waitDeadlineSeconds: input.policy.waitDeadlineSeconds,
    };
  }

  assertAcceptedRepairPredecessor(
    input: { workspaceId: string; runId: string; taskId: string; headSha: string },
    capability?: symbol,
  ): void {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('repair predecessor verification requires an internal capability');
    }
    const head = this.#database
      .prepare(
        `SELECT base_sha, current_sha FROM repair_approved_heads
         WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?`,
      )
      .get(input.workspaceId, input.runId, input.taskId, `refs/heads/task/${input.taskId}`) as
      | { base_sha: string; current_sha: string }
      | undefined;
    const closed = this.#database
      .prepare(
        `SELECT 1 FROM transitions
         WHERE run_id = ? AND operation = 'beads.task_close' AND status = 'committed'
           AND from_state = 'task_accepted' AND to_state = 'integration'
           AND json_extract(external_arguments_json, '$.taskId') = ?
         LIMIT 1`,
      )
      .get(input.runId, input.taskId);
    if (
      head === undefined ||
      head.current_sha !== input.headSha ||
      head.current_sha === head.base_sha ||
      closed === undefined
    ) {
      throw new Error(
        'repair predecessor is not accepted, Beads-closed, and advanced to an approved head',
      );
    }
  }

  seedAcceptedRepairTaskForTest(input: {
    workspaceId: string;
    runId: string;
    taskId: string;
    headSha: string;
    nowMs?: number;
  }): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('repair predecessor acceptance seeding is test-only');
    }
    const nowMs = input.nowMs ?? Date.now();
    const contract = this.#contractForRun(input.runId);
    this.#database.transaction(() => {
      const updated = this.#database
        .prepare(
          `UPDATE repair_approved_heads SET current_sha = ?, updated_at_ms = ?
           WHERE workspace_id = ? AND run_id = ? AND task_id = ?`,
        )
        .run(input.headSha, nowMs, input.workspaceId, input.runId, input.taskId);
      if (updated.changes !== 1) throw new Error('repair test predecessor head is unavailable');
      const transitionId = `test-repair-close:${input.runId}:${input.taskId}`;
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO transitions
           (id, run_id, from_state, to_state, operation, expected_run_version, idempotency_key,
            status, actor_role, contract_version, policy_digest, lease_owner_id, lease_epoch,
            transition_context_json, expected_external_state_json, external_arguments_json,
            result_json, created_at_ms, updated_at_ms)
           VALUES (?, ?, 'task_accepted', 'integration', 'beads.task_close', 0, ?, 'committed',
            'workflow_orchestrator', ?, ?, 'test-lineage', 0, '{}', '{"status":"closed"}', ?,
            '{"status":"closed"}', ?, ?)`,
        )
        .run(
          transitionId,
          input.runId,
          transitionId,
          contract.contractVersion,
          contract.policyDigest,
          JSON.stringify({ taskId: input.taskId }),
          nowMs,
          nowMs,
        );
    })();
  }

  seedApprovedTaskHeadForTest(input: {
    workspaceId: string;
    runId: string;
    taskId: string;
    headSha: string;
    nowMs?: number;
  }): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('approved task-head seeding is test-only');
    }
    const nowMs = input.nowMs ?? Date.now();
    const ref = `refs/heads/task/${input.taskId}`;
    const operationId = `test-approved-head:${input.runId}:${input.taskId}`;
    const request = { kind: 'git.commit', ref, headSha: input.headSha };
    const requestJson = JSON.stringify(request);
    const requestDigest = `sha256:${createHash('sha256').update(requestJson).digest('hex')}`;
    this.#database.transaction(() => {
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO delivery_operations
           (id, workspace_id, run_id, task_id, kind, actor_role, request_digest, request_json,
            status, owner_id, workspace_lease_epoch, run_lease_epoch, task_lease_epoch, result_json,
            created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, 'git.commit', 'workflow_orchestrator', ?, ?, 'committed',
            'test-lineage', 0, 0, 0, ?, ?, ?)`,
        )
        .run(
          operationId,
          input.workspaceId,
          input.runId,
          input.taskId,
          requestDigest,
          requestJson,
          JSON.stringify({ sha: input.headSha }),
          nowMs,
          nowMs,
        );
      this.#database
        .prepare(
          `INSERT OR REPLACE INTO delivery_approved_heads
           (workspace_id, run_id, task_id, ref, base_sha, current_sha, published_sha,
            operation_id, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.workspaceId,
          input.runId,
          input.taskId,
          ref,
          input.headSha,
          input.headSha,
          input.headSha,
          operationId,
          nowMs,
        );
    })();
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
      if (input.transitionContext.closeoutLeaseEpoch !== undefined) {
        this.#assertResourceLease(
          'closeout',
          input.runId,
          input.leaseOwnerId,
          input.transitionContext.closeoutLeaseEpoch,
          input.nowMs,
        );
      }
      const activeRecovery = this.#activeRecovery(input.runId);
      if (input.from === 'recovering' && activeRecovery === undefined) {
        throw new Error('recovering run has no durable recovery target');
      }
      if (
        input.from === 'recovering' &&
        input.transitionContext.recoveryTarget !== activeRecovery?.recovery_target
      ) {
        throw new Error('requested recovery target differs from the durable recovery target');
      }
      const recoveryTarget =
        input.from === 'recovering'
          ? activeRecovery!.recovery_target
          : input.transitionContext.recoveryTarget;
      validateTransition(input.from, input.to, {
        ...input.transitionContext,
        recoveryTarget,
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
      if (input.from === 'finalizing' && input.to === 'closed') {
        throw new Error('feature closure requires the durable finalization coordinator');
      }
      if (
        input.from === 'finalizing' &&
        input.to === 'finalizing' &&
        (!['beads.task_close', 'beads.dolt_push'].includes(input.operation) ||
          input.transitionContext.closeoutLeaseEpoch === undefined)
      ) {
        throw new Error('finalizing self-transition requires a fenced closeout operation');
      }
      let recoveryInterruptedTransitionId: string | undefined;
      if (input.to === 'recovering') {
        const preparedMerge = this.#database
          .prepare(
            `SELECT 1 FROM delivery_operations
             WHERE run_id = ? AND kind = 'github.merge' AND status = 'prepared' LIMIT 1`,
          )
          .get(input.runId);
        if (preparedMerge !== undefined) {
          throw new Error('prepared merge must be reconciled before recovery');
        }
        const arguments_ = input.externalArguments as Record<string, unknown> | null;
        const interruptedTransitionId = arguments_?.interruptedTransitionId;
        const evidenceDigests = arguments_?.evidenceDigests;
        if (
          typeof interruptedTransitionId !== 'string' ||
          interruptedTransitionId.length === 0 ||
          !Array.isArray(evidenceDigests) ||
          evidenceDigests.length === 0 ||
          !evidenceDigests.every(
            (digest) => typeof digest === 'string' && /^sha256:[a-f0-9]{64}$/u.test(digest),
          )
        ) {
          throw new Error('recovery entry requires interrupted-transition evidence');
        }
        const interrupted = this.getTransition(interruptedTransitionId);
        const latestTransition = this.getLatestCommittedTransitionInto(input.runId, input.from);
        const mergePredecessor =
          input.from === 'finalizing' && run.mergeVerified
            ? this.getCommittedMergeAttestation(input.runId)
            : undefined;
        const transitionIsCurrent =
          interrupted !== undefined &&
          interrupted.runId === input.runId &&
          interrupted.status === 'committed' &&
          interrupted.to === input.from &&
          interrupted.expectedRunVersion + 2 === input.expectedRunVersion &&
          latestTransition?.id === interruptedTransitionId;
        const mergeIsCurrent =
          latestTransition === undefined &&
          mergePredecessor?.id === interruptedTransitionId &&
          mergePredecessor.status === 'committed';
        if (!transitionIsCurrent && !mergeIsCurrent) {
          throw new Error('recovery interrupted transition is not the committed run predecessor');
        }
        recoveryInterruptedTransitionId = interruptedTransitionId;
        const authoritativeRoles = [
          'workflow_orchestrator',
          'planner',
          'plan_critic',
          'human_approver',
          'implementation_worker',
          'code_reviewer',
          'test_runner',
          'qa_evaluator',
          'feature_evaluator',
        ];
        if (
          evidenceDigests.some(
            (digest) =>
              !this.hasRecoveryEvidenceBinding({
                digest,
                workspaceId: approved.workspace_id,
                runId: input.runId,
                contractVersion: input.contractVersion,
                policyDigest: input.policyDigest,
                allowedProducerRoles: authoritativeRoles,
                taskId: typeof arguments_?.taskId === 'string' ? arguments_.taskId : undefined,
                minCreatedAtMs: interrupted?.nowMs ?? mergePredecessor!.updatedAtMs,
                interruptedTransitionId,
              }),
          )
        ) {
          throw new Error('recovery evidence is not bound to the interrupted run');
        }
        if (activeRecovery !== undefined) {
          throw new Error('run already has an active recovery target');
        }
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
      if (input.to === 'recovering') {
        const arguments_ = input.externalArguments as Record<string, unknown>;
        this.#database
          .prepare(
            `INSERT INTO recovery_records
             (transition_id, run_id, interrupted_state, recovery_target,
              interrupted_transition_id, merge_verified, evidence_json, created_at_ms,
              resumed_at_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          )
          .run(
            input.id,
            input.runId,
            input.from,
            input.transitionContext.recoveryTarget,
            recoveryInterruptedTransitionId,
            run.mergeVerified ? 1 : 0,
            JSON.stringify(arguments_.evidenceDigests),
            input.nowMs,
          );
      }
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
      if (transition.from === 'finalizing' && transition.to === 'closed') {
        throw new Error('feature closure requires the durable finalization coordinator');
      }
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
      const runUpdate = this.#database
        .prepare(
          `UPDATE runs SET state = ?, version = version + 1, updated_at_ms = ?
           WHERE id = ? AND state = ? AND version = ?`,
        )
        .run(
          transition.to,
          nowMs,
          transition.runId,
          transition.from,
          transition.expectedRunVersion + 1,
        );
      if (runUpdate.changes !== 1) throw new Error('transition run commit failed');
      if (transition.from === 'recovering') {
        this.#database
          .prepare(
            `UPDATE recovery_records SET resumed_at_ms = ?, terminal_outcome = 'resumed'
             WHERE transition_id = (
               SELECT transition_id FROM recovery_records
               WHERE run_id = ? AND resumed_at_ms IS NULL
               ORDER BY created_at_ms DESC, transition_id DESC LIMIT 1
             ) AND resumed_at_ms IS NULL`,
          )
          .run(nowMs, transition.runId);
      }
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
      const runUpdate = this.#database
        .prepare(
          `UPDATE runs SET state = 'escalated', version = version + 1, updated_at_ms = ?
           WHERE id = ? AND state = ? AND version = ?`,
        )
        .run(nowMs, transition.runId, transition.from, transition.expectedRunVersion + 1);
      if (runUpdate.changes !== 1) throw new Error('transition escalation compare-and-swap failed');
      if (transition.to === 'recovering') {
        this.#database
          .prepare(
            `UPDATE recovery_records SET resumed_at_ms = ?, terminal_outcome = 'escalated'
             WHERE transition_id = ? AND resumed_at_ms IS NULL`,
          )
          .run(nowMs, transition.id);
      } else if (transition.from === 'recovering') {
        this.#database
          .prepare(
            `UPDATE recovery_records SET resumed_at_ms = ?, terminal_outcome = 'escalated'
             WHERE transition_id = (
               SELECT transition_id FROM recovery_records
               WHERE run_id = ? AND resumed_at_ms IS NULL
               ORDER BY created_at_ms DESC, transition_id DESC LIMIT 1
             ) AND resumed_at_ms IS NULL`,
          )
          .run(nowMs, transition.runId);
      }
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

  getLatestCommittedTransitionInto(
    runId: string,
    state: WorkflowState,
  ): TransitionRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT * FROM transitions WHERE run_id = ? AND to_state = ? AND status = 'committed'
         ORDER BY updated_at_ms DESC, id DESC LIMIT 1`,
      )
      .get(runId, state) as TransitionRow | undefined;
    return row === undefined ? undefined : transitionFromRow(row);
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
      const hypothesis = input.hypothesis.trim();
      if (hypothesis === '') throw new Error('attempt hypothesis is required');
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
          hypothesis,
          input.nowMs ?? Date.now(),
        );
      return attempt;
    })();
  }

  planRepairDispatch(
    input: {
      id: string;
      runId: string;
      taskId: string;
      findingId: string;
      ownerRole: string;
      findingDigest: string;
      failureHeadSha: string;
      hypothesis: string;
      requiresHypothesisChange: boolean;
      changeDigest: string;
      changeEvidenceMinAtMs: number | null;
      changeEvidenceAtMs: number | null;
      changeHeadSha: string | null;
      failureEvidenceAtMs: number;
      packet: (taskAttempt: number, findingAttempt: number) => unknown;
      maxTaskAttempts: number;
      maxFindingAttempts: number;
      escalationReport: (scope: 'task' | 'finding', attemptsUsed: number) => unknown;
      workspaceId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs?: number;
    },
    capability?: symbol,
  ): RepairPlanResult {
    if (capability !== workflowRepairMutationCapability) {
      throw new Error('repair mutation requires coordinator capability');
    }
    const nowMs = input.nowMs ?? Date.now();
    return this.#database.transaction((): RepairPlanResult => {
      if (this.#workspaceForRun(input.runId) !== input.workspaceId) {
        throw new Error('repair workspace does not match the run contract');
      }
      if (!this.#contractForRun(input.runId).tasks.some((task) => task.id === input.taskId)) {
        throw new Error('repair task does not match the run contract');
      }
      this.#assertResourceLease(
        'workspace',
        input.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        nowMs,
      );
      this.#assertResourceLease('run', input.runId, input.ownerId, input.runLeaseEpoch, nowMs);
      this.#assertResourceLease('task', input.taskId, input.ownerId, input.taskLeaseEpoch, nowMs);
      const run = this.getRun(input.runId);
      if (run?.state !== 'repair' && run?.state !== 'repair_planning') {
        throw new Error('run is not in a repair state');
      }
      const existing = this.getRepairDispatch(input.id);
      if (existing !== undefined) {
        if (
          existing.runId !== input.runId ||
          existing.taskId !== input.taskId ||
          existing.findingId !== input.findingId ||
          existing.ownerRole !== input.ownerRole ||
          existing.findingDigest !== input.findingDigest ||
          existing.failureHeadSha !== input.failureHeadSha ||
          existing.changeDigest !== input.changeDigest ||
          existing.changeEvidenceMinAtMs !== input.changeEvidenceMinAtMs ||
          existing.changeEvidenceAtMs !== input.changeEvidenceAtMs ||
          existing.changeHeadSha !== input.changeHeadSha ||
          JSON.stringify(existing.packet) !==
            JSON.stringify(input.packet(existing.taskAttempt, existing.findingAttempt))
        ) {
          throw new Error('repair dispatch id is already bound to different immutable input');
        }
        return { kind: 'dispatch', dispatch: existing };
      }
      const taskEscalation = this.getRepairEscalation(input.runId, 'task', input.taskId);
      if (taskEscalation !== undefined) {
        if (
          taskEscalation.findingId === input.findingId &&
          taskEscalation.findingDigest !== input.findingDigest
        ) {
          throw new Error('repair finding id is already bound to different immutable input');
        }
        return { kind: 'escalated', escalation: taskEscalation };
      }
      const findingEscalation = this.getRepairEscalation(input.runId, 'finding', input.findingId);
      if (findingEscalation !== undefined) {
        if (findingEscalation.findingDigest !== input.findingDigest) {
          throw new Error('repair finding id is already bound to different immutable input');
        }
        return { kind: 'escalated', escalation: findingEscalation };
      }
      if (input.hypothesis.trim() === '') throw new Error('repair hypothesis is required');
      const lastDispatch = this.#database
        .prepare(
          `SELECT * FROM repair_dispatches WHERE run_id = ? AND finding_id = ?
           ORDER BY finding_attempt DESC LIMIT 1`,
        )
        .get(input.runId, input.findingId) as RepairDispatchRow | undefined;
      if (lastDispatch?.change_digest === input.changeDigest) {
        throw new Error('identical repair retry is forbidden');
      }
      if (
        input.changeEvidenceMinAtMs !== null &&
        input.changeEvidenceMinAtMs <=
          (lastDispatch?.change_evidence_at_ms ?? input.failureEvidenceAtMs)
      ) {
        throw new Error('repair evidence does not prove a newer changed condition');
      }
      if (
        lastDispatch?.finding_digest !== undefined &&
        lastDispatch.finding_digest !== input.findingDigest
      ) {
        throw new Error('repair finding id is already bound to different immutable input');
      }
      if (input.requiresHypothesisChange && lastDispatch === undefined) {
        const previousTaskAttempt = this.#database
          .prepare(
            `SELECT hypothesis FROM attempts WHERE run_id = ? AND scope = 'task' AND scope_id = ?
             ORDER BY attempt DESC LIMIT 1`,
          )
          .get(input.runId, input.taskId) as { hypothesis: string } | undefined;
        if (previousTaskAttempt?.hypothesis.trim() === input.hypothesis.trim()) {
          throw new Error('repair retry requires a changed hypothesis');
        }
      }
      const attemptCount = (
        scope: 'task' | 'finding',
        scopeId: string,
        expectedMaximum: number,
      ): number => {
        const row = this.#database
          .prepare(
            `SELECT COALESCE(MAX(attempt), 0) AS attempt, MIN(max_attempts) AS minimum,
                    MAX(max_attempts) AS maximum FROM attempts
             WHERE run_id = ? AND scope = ? AND scope_id = ?`,
          )
          .get(input.runId, scope, scopeId) as {
          attempt: number;
          minimum: number | null;
          maximum: number | null;
        };
        if (
          row.minimum !== null &&
          (row.minimum !== expectedMaximum || row.maximum !== expectedMaximum)
        ) {
          throw new Error('repair attempt budget does not match the approved contract');
        }
        return row.attempt;
      };
      const taskAttempts = attemptCount('task', input.taskId, input.maxTaskAttempts);
      const findingAttempts = attemptCount('finding', input.findingId, input.maxFindingAttempts);
      const exhausted =
        taskAttempts >= input.maxTaskAttempts
          ? ({ scope: 'task', scopeId: input.taskId, attempts: taskAttempts } as const)
          : findingAttempts >= input.maxFindingAttempts
            ? ({ scope: 'finding', scopeId: input.findingId, attempts: findingAttempts } as const)
            : undefined;
      if (exhausted !== undefined) {
        const id = `repair-escalation:${input.runId}:${exhausted.scope}:${exhausted.scopeId}`;
        this.#database
          .prepare(
            `INSERT OR IGNORE INTO repair_escalations
             (id, run_id, scope, scope_id, finding_id, finding_digest, report_json, created_at_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.runId,
            exhausted.scope,
            exhausted.scopeId,
            input.findingId,
            input.findingDigest,
            JSON.stringify(input.escalationReport(exhausted.scope, exhausted.attempts)),
            nowMs,
          );
        return {
          kind: 'escalated',
          escalation: this.getRepairEscalation(input.runId, exhausted.scope, exhausted.scopeId)!,
        };
      }
      const taskAttempt = taskAttempts + 1;
      const findingAttempt = findingAttempts + 1;
      const insertAttempt = this.#database.prepare(
        `INSERT INTO attempts
         (run_id, scope, scope_id, attempt, max_attempts, hypothesis, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      insertAttempt.run(
        input.runId,
        'task',
        input.taskId,
        taskAttempt,
        input.maxTaskAttempts,
        input.hypothesis.trim(),
        nowMs,
      );
      insertAttempt.run(
        input.runId,
        'finding',
        input.findingId,
        findingAttempt,
        input.maxFindingAttempts,
        input.hypothesis.trim(),
        nowMs,
      );
      this.#database
        .prepare(
          `INSERT INTO repair_dispatches
           (id, run_id, task_id, finding_id, task_attempt, finding_attempt, owner_role, finding_digest,
            failure_head_sha, change_digest, change_evidence_min_at_ms, change_evidence_at_ms, change_head_sha,
            packet_json, status, result_json, created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dispatched', NULL, ?, ?)`,
        )
        .run(
          input.id,
          input.runId,
          input.taskId,
          input.findingId,
          taskAttempt,
          findingAttempt,
          input.ownerRole,
          input.findingDigest,
          input.failureHeadSha,
          input.changeDigest,
          input.changeEvidenceMinAtMs,
          input.changeEvidenceAtMs,
          input.changeHeadSha,
          JSON.stringify(input.packet(taskAttempt, findingAttempt)),
          nowMs,
          nowMs,
        );
      return { kind: 'dispatch', dispatch: this.getRepairDispatch(input.id)! };
    })();
  }

  getRepairDispatch(id: string): RepairDispatchRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM repair_dispatches WHERE id = ?').get(id) as
      | RepairDispatchRow
      | undefined;
    return row === undefined ? undefined : repairDispatchFromRow(row);
  }

  acceptRepairDispatch(
    input: {
      id: string;
      result: unknown;
      workspaceId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      assertExternalState: () => void;
      clock: () => number;
    },
    capability?: symbol,
  ): RepairDispatchRecord {
    if (capability !== workflowRepairMutationCapability) {
      throw new Error('repair mutation requires coordinator capability');
    }
    const nowMs = input.clock();
    return this.#database.transaction(() => {
      const before = this.getRepairDispatch(input.id);
      if (before === undefined) throw new Error('repair dispatch not found');
      this.#assertRepairMutationLeases(before, input, nowMs);
      const run = this.getRun(before.runId);
      if (run?.state !== 'repair' && run?.state !== 'repair_planning') {
        throw new Error('run is not in a repair state');
      }
      input.assertExternalState();
      const verifiedAtMs = input.clock();
      this.#assertRepairMutationLeases(before, input, verifiedAtMs);
      const changed = this.#database
        .prepare(
          `UPDATE repair_dispatches SET status = 'accepted', result_json = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'dispatched'`,
        )
        .run(serializeDurableJson(input.result), verifiedAtMs, input.id);
      const dispatch = this.getRepairDispatch(input.id)!;
      if (
        dispatch.status === 'accepted' &&
        changed.changes === 0 &&
        JSON.stringify(dispatch.result) !== JSON.stringify(input.result)
      ) {
        throw new Error('accepted repair result is immutable');
      }
      if (changed.changes === 0 && dispatch.status !== 'accepted') {
        throw new Error('only an active repair dispatch can be accepted');
      }
      return dispatch;
    })();
  }

  cancelRepairDispatch(
    input: {
      id: string;
      reason: unknown;
      workspaceId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs?: number;
    },
    capability?: symbol,
  ): RepairDispatchRecord {
    if (capability !== workflowRepairMutationCapability) {
      throw new Error('repair mutation requires coordinator capability');
    }
    const nowMs = input.nowMs ?? Date.now();
    return this.#database.transaction(() => {
      const before = this.getRepairDispatch(input.id);
      if (before === undefined) throw new Error('repair dispatch not found');
      this.#assertRepairMutationLeases(before, input, nowMs);
      const run = this.getRun(before.runId);
      if (
        run?.state !== 'repair' &&
        run?.state !== 'repair_planning' &&
        run?.state !== 'cancelling'
      ) {
        throw new Error('run cannot cancel a repair dispatch from its current state');
      }
      this.#database
        .prepare(
          `UPDATE repair_dispatches SET status = 'cancelled', result_json = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'dispatched'`,
        )
        .run(JSON.stringify(input.reason), nowMs, input.id);
      return this.getRepairDispatch(input.id)!;
    })();
  }

  #assertRepairMutationLeases(
    dispatch: RepairDispatchRecord,
    input: {
      workspaceId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
    },
    nowMs: number,
  ): void {
    if (this.#workspaceForRun(dispatch.runId) !== input.workspaceId) {
      throw new Error('repair workspace does not match the run contract');
    }
    this.#assertResourceLease(
      'workspace',
      input.workspaceId,
      input.ownerId,
      input.workspaceLeaseEpoch,
      nowMs,
    );
    this.#assertResourceLease('run', dispatch.runId, input.ownerId, input.runLeaseEpoch, nowMs);
    this.#assertResourceLease('task', dispatch.taskId, input.ownerId, input.taskLeaseEpoch, nowMs);
  }

  getRepairEscalation(
    runId: string,
    scope: RepairEscalationRecord['scope'],
    scopeId: string,
  ): RepairEscalationRecord | undefined {
    const row = this.#database
      .prepare('SELECT * FROM repair_escalations WHERE run_id = ? AND scope = ? AND scope_id = ?')
      .get(runId, scope, scopeId) as RepairEscalationRow | undefined;
    return row === undefined ? undefined : repairEscalationFromRow(row);
  }

  prepareDeliveryOperation(
    input: PrepareDeliveryOperationInput,
    capability?: symbol,
  ): DeliveryOperationRecord {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery operations require the internal delivery broker capability');
    }
    return this.#database.transaction(() => {
      const contract = this.#contractForRun(input.runId);
      if (
        contract.workspaceId !== input.workspaceId ||
        contract.contractVersion !== input.contractVersion ||
        contract.policyDigest !== input.policyDigest
      ) {
        throw new Error('delivery operation contract, policy, or workspace is stale');
      }
      const preparedTransition = this.#database
        .prepare(`SELECT 1 FROM transitions WHERE run_id = ? AND status = 'prepared' LIMIT 1`)
        .get(input.runId);
      if (preparedTransition !== undefined) {
        throw new Error('delivery operation cannot race a prepared workflow transition');
      }
      if (
        this.getAuthorizedRunTask(input.runId, input.taskId, workflowDeliveryMutationCapability) ===
        undefined
      ) {
        throw new Error('delivery operation task is outside the contract');
      }
      const replay = this.#database
        .prepare('SELECT * FROM delivery_operations WHERE request_digest = ?')
        .get(input.requestDigest) as DeliveryOperationRow | undefined;
      if (replay !== undefined) {
        const operation = deliveryOperationFromRow(replay);
        if (
          operation.id !== input.id ||
          operation.workspaceId !== input.workspaceId ||
          operation.runId !== input.runId ||
          operation.taskId !== input.taskId ||
          operation.kind !== input.kind ||
          operation.actorRole !== input.actorRole ||
          JSON.stringify(operation.request) !== JSON.stringify(input.request)
        ) {
          throw new Error('delivery operation idempotency collision');
        }
        if (operation.status === 'prepared') {
          this.#assertDeliveryRunState(input.runId, input.kind);
        }
        return operation;
      }
      this.#assertDeliveryRunState(input.runId, input.kind);
      this.#assertResourceLease(
        'workspace',
        input.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'task',
        input.taskId,
        input.ownerId,
        input.taskLeaseEpoch,
        input.nowMs,
      );
      this.#database
        .prepare(
          `INSERT INTO delivery_operations
           (id, workspace_id, run_id, task_id, kind, actor_role, request_digest, request_json, status,
            owner_id, workspace_lease_epoch, run_lease_epoch, task_lease_epoch, result_json,
            created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?, ?, ?, NULL, ?, ?)`,
        )
        .run(
          input.id,
          input.workspaceId,
          input.runId,
          input.taskId,
          input.kind,
          input.actorRole,
          input.requestDigest,
          JSON.stringify(input.request),
          input.ownerId,
          input.workspaceLeaseEpoch,
          input.runLeaseEpoch,
          input.taskLeaseEpoch,
          input.nowMs,
          input.nowMs,
        );
      return this.getDeliveryOperation(input.id)!;
    })();
  }

  getDeliveryOperation(id: string): DeliveryOperationRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM delivery_operations WHERE id = ?').get(id) as
      | DeliveryOperationRow
      | undefined;
    return row === undefined ? undefined : deliveryOperationFromRow(row);
  }

  getCommittedMergeAttestation(runId: string): DeliveryOperationRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT * FROM delivery_operations
         WHERE run_id = ? AND kind = 'github.merge' AND status = 'committed'
         ORDER BY updated_at_ms DESC, id DESC LIMIT 1`,
      )
      .get(runId) as DeliveryOperationRow | undefined;
    return row === undefined ? undefined : deliveryOperationFromRow(row);
  }

  listPreparedDeliveryOperations(runId: string): DeliveryOperationRecord[] {
    return (
      this.#database
        .prepare(
          `SELECT * FROM delivery_operations
           WHERE run_id = ? AND status = 'prepared' ORDER BY created_at_ms, id`,
        )
        .all(runId) as DeliveryOperationRow[]
    ).map(deliveryOperationFromRow);
  }

  commitDeliveryOperation(
    input: {
      id: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      result: unknown;
      assertExternalState: () => void;
      clock: () => number;
    },
    capability?: symbol,
  ): DeliveryOperationRecord {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery operations require the internal delivery broker capability');
    }
    return this.#database.transaction(() => {
      const operation = this.getDeliveryOperation(input.id);
      if (operation === undefined) throw new Error('delivery operation not found');
      if (operation.status === 'committed') return operation;
      if (operation.status !== 'prepared')
        throw new Error('delivery operation cannot be committed');
      this.#assertDeliveryOperationLeases(operation, input, input.clock());
      this.#assertDeliveryRunState(operation.runId, operation.kind);
      input.assertExternalState();
      const verifiedAtMs = input.clock();
      this.#assertDeliveryOperationLeases(operation, input, verifiedAtMs);
      this.#assertDeliveryRunState(operation.runId, operation.kind);
      this.#database
        .prepare(
          `UPDATE delivery_operations SET status = 'committed', result_json = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'prepared'`,
        )
        .run(serializeDurableJson(input.result), verifiedAtMs, input.id);
      this.#commitDeliveryLineage(operation, input.result, verifiedAtMs);
      if (operation.kind === 'github.merge') {
        this.#commitVerifiedMerge(operation, input.result, verifiedAtMs);
      }
      return this.getDeliveryOperation(input.id)!;
    })();
  }

  #commitVerifiedMerge(
    operation: DeliveryOperationRecord,
    result: unknown,
    verifiedAtMs: number,
  ): void {
    const request = operation.request as Record<string, unknown>;
    const attestation = result as Record<string, unknown> | null;
    if (
      attestation === null ||
      typeof attestation.mergeSha !== 'string' ||
      !/^[a-f0-9]{40,64}$/u.test(attestation.mergeSha) ||
      attestation.headSha !== request.headSha ||
      attestation.base !== request.base ||
      attestation.mergeMethod !== request.mergeMethod ||
      typeof attestation.eventIdentity !== 'string' ||
      attestation.eventIdentity.length === 0
    ) {
      throw new Error('GitHub merge result is not an exact durable attestation');
    }
    const updated = this.#database
      .prepare(
        `UPDATE runs SET state = 'finalizing', merge_verified = 1,
         version = version + 1, updated_at_ms = ?
         WHERE id = ? AND state = 'delivery' AND merge_verified = 0`,
      )
      .run(verifiedAtMs, operation.runId);
    if (updated.changes !== 1) {
      throw new Error('verified merge could not atomically enter finalizing');
    }
  }

  escalateDeliveryOperation(
    input: {
      id: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      result: unknown;
      nowMs: number;
    },
    capability?: symbol,
  ): DeliveryOperationRecord {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery operations require the internal delivery broker capability');
    }
    return this.#database.transaction(() => {
      const operation = this.getDeliveryOperation(input.id);
      if (operation === undefined) throw new Error('delivery operation not found');
      if (operation.status === 'escalated') return operation;
      if (operation.status !== 'prepared')
        throw new Error('delivery operation cannot be escalated');
      this.#assertDeliveryOperationLeases(operation, input, input.nowMs);
      this.#assertDeliveryRunState(operation.runId, operation.kind);
      this.#database
        .prepare(
          `UPDATE delivery_operations SET status = 'escalated', result_json = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'prepared'`,
        )
        .run(serializeDurableJson(input.result), input.nowMs, input.id);
      return this.getDeliveryOperation(input.id)!;
    })();
  }

  adoptPreparedDeliveryOperation(
    input: {
      id: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): DeliveryOperationRecord {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery operations require the internal delivery broker capability');
    }
    return this.#database.transaction(() => {
      const operation = this.getDeliveryOperation(input.id);
      if (operation === undefined || operation.status !== 'prepared') {
        throw new Error('prepared delivery operation not found');
      }
      if (
        input.ownerId === operation.ownerId &&
        input.workspaceLeaseEpoch === operation.workspaceLeaseEpoch &&
        input.runLeaseEpoch === operation.runLeaseEpoch &&
        input.taskLeaseEpoch === operation.taskLeaseEpoch
      ) {
        this.#assertDeliveryOperationLeases(operation, input, input.nowMs);
        this.#assertDeliveryRunState(operation.runId, operation.kind);
        return operation;
      }
      if (input.runLeaseEpoch <= operation.runLeaseEpoch) {
        throw new Error('recovery lease does not fence the interrupted delivery owner');
      }
      this.#assertDeliveryRunState(operation.runId, operation.kind);
      this.#assertResourceLease(
        'workspace',
        operation.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        operation.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'task',
        operation.taskId,
        input.ownerId,
        input.taskLeaseEpoch,
        input.nowMs,
      );
      this.#database
        .prepare(
          `UPDATE delivery_operations SET owner_id = ?, workspace_lease_epoch = ?,
           run_lease_epoch = ?, task_lease_epoch = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'prepared'`,
        )
        .run(
          input.ownerId,
          input.workspaceLeaseEpoch,
          input.runLeaseEpoch,
          input.taskLeaseEpoch,
          input.nowMs,
          input.id,
        );
      return this.getDeliveryOperation(input.id)!;
    })();
  }

  #assertDeliveryOperationLeases(
    operation: DeliveryOperationRecord,
    input: {
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
    },
    nowMs: number,
  ): void {
    if (
      operation.ownerId !== input.ownerId ||
      operation.workspaceLeaseEpoch !== input.workspaceLeaseEpoch ||
      operation.runLeaseEpoch !== input.runLeaseEpoch ||
      operation.taskLeaseEpoch !== input.taskLeaseEpoch
    ) {
      throw new Error('delivery operation fencing token changed');
    }
    this.#assertResourceLease(
      'workspace',
      operation.workspaceId,
      input.ownerId,
      input.workspaceLeaseEpoch,
      nowMs,
    );
    this.#assertResourceLease('run', operation.runId, input.ownerId, input.runLeaseEpoch, nowMs);
    this.#assertResourceLease('task', operation.taskId, input.ownerId, input.taskLeaseEpoch, nowMs);
  }

  assertDeliveryOperationReady(
    operation: DeliveryOperationRecord,
    fence: {
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
    },
    nowMs: number,
    capability?: symbol,
  ): void {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery operations require the internal delivery broker capability');
    }
    this.#database.transaction(() => {
      this.#assertDeliveryOperationLeases(operation, fence, nowMs);
      this.#assertDeliveryRunState(operation.runId, operation.kind);
      this.#assertDeliveryLineage(operation);
    })();
  }

  #assertDeliveryLineage(operation: DeliveryOperationRecord): void {
    const request = operation.request as Record<string, unknown> | undefined;
    const ref = operation.kind.startsWith('github.')
      ? `refs/heads/task/${operation.taskId}`
      : request?.ref;
    if (operation.kind.startsWith('github.')) {
      const headSha = request?.headSha;
      if (typeof headSha !== 'string') throw new Error('GitHub delivery request has invalid head');
      const published = this.#database
        .prepare(
          `SELECT current_sha, published_sha FROM delivery_approved_heads
           WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?
           UNION ALL
           SELECT current_sha, published_sha FROM repair_approved_heads
           WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?`,
        )
        .get(
          operation.workspaceId,
          operation.runId,
          operation.taskId,
          ref,
          operation.workspaceId,
          operation.runId,
          operation.taskId,
          ref,
        ) as { current_sha: string; published_sha: string | null } | undefined;
      if (published?.current_sha !== headSha || published.published_sha !== headSha) {
        throw new Error('GitHub delivery head is not the current published Git/ref broker head');
      }
      return;
    }
    if (operation.kind !== 'git.commit' && operation.kind !== 'git.push') return;
    const expectedSha = operation.kind === 'git.commit' ? request?.parentSha : request?.newSha;
    if (typeof ref !== 'string' || typeof expectedSha !== 'string') {
      throw new Error('Git delivery request has invalid lineage fields');
    }
    const approved = this.#database
      .prepare(
        `SELECT current_sha FROM delivery_approved_heads
         WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?
         UNION ALL
         SELECT current_sha FROM repair_approved_heads
         WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?`,
      )
      .get(
        operation.workspaceId,
        operation.runId,
        operation.taskId,
        ref,
        operation.workspaceId,
        operation.runId,
        operation.taskId,
        ref,
      ) as { current_sha: string } | undefined;
    if (approved?.current_sha !== expectedSha) {
      throw new Error('Git delivery request does not descend from the broker-approved task head');
    }
  }

  #commitDeliveryLineage(operation: DeliveryOperationRecord, result: unknown, nowMs: number): void {
    if (!operation.kind.startsWith('git.')) return;
    const request = operation.request as Record<string, unknown> | undefined;
    const resultRecord = result as Record<string, unknown> | undefined;
    const ref = request?.ref;
    const resultSha = resultRecord?.sha;
    if (typeof ref !== 'string' || typeof resultSha !== 'string') {
      throw new Error('Git delivery result has invalid lineage fields');
    }
    if (operation.kind === 'git.create_ref') {
      if (resultSha !== request?.parentSha) {
        throw new Error('created task ref differs from its approved parent');
      }
      const existing = this.#database
        .prepare(
          `SELECT current_sha FROM delivery_approved_heads
           WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?`,
        )
        .get(operation.workspaceId, operation.runId, operation.taskId, ref) as
        | { current_sha: string }
        | undefined;
      if (existing !== undefined && existing.current_sha !== resultSha) {
        throw new Error('broker-approved task head already differs');
      }
      this.#database
        .prepare(
          `INSERT INTO delivery_approved_heads
           (workspace_id, run_id, task_id, ref, base_sha, current_sha, operation_id, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(workspace_id, run_id, task_id, ref) DO UPDATE SET
             operation_id = excluded.operation_id, updated_at_ms = excluded.updated_at_ms`,
        )
        .run(
          operation.workspaceId,
          operation.runId,
          operation.taskId,
          ref,
          resultSha,
          resultSha,
          operation.id,
          nowMs,
        );
      return;
    }
    this.#assertDeliveryLineage(operation);
    if (operation.kind === 'git.commit') {
      const updated = this.#database
        .prepare(
          `UPDATE delivery_approved_heads SET current_sha = ?, published_sha = NULL,
           operation_id = ?, updated_at_ms = ?
           WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ? AND current_sha = ?`,
        )
        .run(
          resultSha,
          operation.id,
          nowMs,
          operation.workspaceId,
          operation.runId,
          operation.taskId,
          ref,
          request?.parentSha,
        );
      if (updated.changes !== 1) {
        const repaired = this.#database
          .prepare(
            `UPDATE repair_approved_heads SET current_sha = ?, published_sha = NULL,
               updated_at_ms = ?
               WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ?
                 AND current_sha = ?`,
          )
          .run(
            resultSha,
            nowMs,
            operation.workspaceId,
            operation.runId,
            operation.taskId,
            ref,
            request?.parentSha,
          );
        if (repaired.changes !== 1) {
          throw new Error('broker-approved task head compare-and-swap failed');
        }
      }
    } else {
      if (resultSha !== request?.newSha) {
        throw new Error('pushed task ref differs from the broker-approved head');
      }
      const published = this.#database
        .prepare(
          `UPDATE delivery_approved_heads SET published_sha = ?, operation_id = ?, updated_at_ms = ?
           WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ? AND current_sha = ?`,
        )
        .run(
          resultSha,
          operation.id,
          nowMs,
          operation.workspaceId,
          operation.runId,
          operation.taskId,
          ref,
          resultSha,
        );
      if (published.changes !== 1) {
        const repaired = this.#database
          .prepare(
            `UPDATE repair_approved_heads SET published_sha = ?, updated_at_ms = ?
             WHERE workspace_id = ? AND run_id = ? AND task_id = ? AND ref = ? AND current_sha = ?`,
          )
          .run(
            resultSha,
            nowMs,
            operation.workspaceId,
            operation.runId,
            operation.taskId,
            ref,
            resultSha,
          );
        if (repaired.changes !== 1) {
          throw new Error('published task head compare-and-swap failed');
        }
      }
    }
  }

  #assertDeliveryRunState(runId: string, kind: string): void {
    const state = this.getRun(runId)?.state;
    if (state === undefined) throw new Error('workflow run not found');
    const allowedStates: Readonly<Record<string, readonly WorkflowState[]>> = {
      'git.create_ref': ['scheduling', 'implementing', 'repair'],
      'git.commit': ['implementing', 'repair'],
      'git.push': ['implementing', 'repair', 'pipeline'],
      'github.pr': ['pipeline', 'waiting', 'delivery'],
      'github.checks': ['pipeline', 'waiting', 'delivery'],
      'github.merge': ['delivery'],
    };
    if (!(allowedStates[kind] ?? []).includes(state)) {
      throw new Error(`delivery operation ${kind} is not allowed while run is ${state}`);
    }
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
        .prepare(
          `SELECT absolute_deadline_ms, workspace_id, task_id
           FROM waits WHERE run_id = ? AND check_id = ?`,
        )
        .get(input.runId, input.checkId) as
        | {
            absolute_deadline_ms: number;
            workspace_id: string | null;
            task_id: string | null;
          }
        | undefined;
      if (existing !== undefined && (existing.workspace_id !== null || existing.task_id !== null)) {
        throw new Error('generic wait API cannot mutate a delivery-bound wait');
      }
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

  putDeliveryWait(
    input: Parameters<WorkflowStore['putWait']>[0] & {
      workspaceId: string;
      taskId: string;
      operationId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): void {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery waits require the internal delivery broker capability');
    }
    this.#database.transaction(() => {
      this.#assertDeliveryWaitRunBinding(input);
      if (this.getDeliveryWaitEscalation(input.runId, input.checkId) !== undefined) {
        throw new Error('pipeline wait is already terminally escalated');
      }
      this.#assertDeliveryRunState(input.runId, 'github.checks');
      this.#assertResourceLease(
        'workspace',
        input.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'task',
        input.taskId,
        input.ownerId,
        input.taskLeaseEpoch,
        input.nowMs,
      );
      const existing = this.getWait(input.runId, input.checkId);
      if (
        existing !== undefined &&
        (existing.workspaceId !== null || existing.taskId !== null) &&
        (existing.workspaceId !== input.workspaceId || existing.taskId !== input.taskId)
      ) {
        throw new Error('pipeline wait identity differs from its durable binding');
      }
      const effectiveDeadline = Math.min(
        existing?.workspaceId === input.workspaceId && existing.taskId === input.taskId
          ? existing.absoluteDeadlineMs
          : input.absoluteDeadlineMs,
        input.absoluteDeadlineMs,
      );
      if (input.nextPollAtMs >= effectiveDeadline) {
        throw new Error('next poll must precede absolute deadline');
      }
      this.#database
        .prepare(
          `INSERT INTO waits
           (run_id, check_id, event_identity, next_poll_at_ms, absolute_deadline_ms, backoff_count,
            workspace_id, task_id, operation_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(run_id, check_id) DO UPDATE SET
             event_identity = excluded.event_identity,
             next_poll_at_ms = excluded.next_poll_at_ms,
             absolute_deadline_ms = CASE
               WHEN waits.workspace_id IS NULL AND waits.task_id IS NULL
                 THEN excluded.absolute_deadline_ms
               ELSE MIN(waits.absolute_deadline_ms, excluded.absolute_deadline_ms)
             END,
             backoff_count = excluded.backoff_count,
             workspace_id = excluded.workspace_id,
             task_id = excluded.task_id,
             operation_id = excluded.operation_id`,
        )
        .run(
          input.runId,
          input.checkId,
          input.eventIdentity,
          input.nextPollAtMs,
          input.absoluteDeadlineMs,
          input.backoffCount,
          input.workspaceId,
          input.taskId,
          input.operationId,
        );
    })();
  }

  getWait(
    runId: string,
    checkId: string,
  ):
    | {
        runId: string;
        checkId: string;
        eventIdentity: string;
        nextPollAtMs: number;
        absoluteDeadlineMs: number;
        backoffCount: number;
        workspaceId: string | null;
        taskId: string | null;
        operationId: string | null;
      }
    | undefined {
    const row = this.#database
      .prepare(
        `SELECT run_id, check_id, event_identity, next_poll_at_ms, absolute_deadline_ms,
                backoff_count, workspace_id, task_id, operation_id
         FROM waits WHERE run_id = ? AND check_id = ?`,
      )
      .get(runId, checkId) as
      | {
          run_id: string;
          check_id: string;
          event_identity: string;
          next_poll_at_ms: number;
          absolute_deadline_ms: number;
          backoff_count: number;
          workspace_id: string | null;
          task_id: string | null;
          operation_id: string | null;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          runId: row.run_id,
          checkId: row.check_id,
          eventIdentity: row.event_identity,
          nextPollAtMs: row.next_poll_at_ms,
          absoluteDeadlineMs: row.absolute_deadline_ms,
          backoffCount: row.backoff_count,
          workspaceId: row.workspace_id,
          taskId: row.task_id,
          operationId: row.operation_id,
        };
  }

  assertDeliveryWaitReady(
    input: {
      workspaceId: string;
      runId: string;
      taskId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): void {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery waits require the internal delivery broker capability');
    }
    this.#database.transaction(() => {
      this.#assertDeliveryWaitRunBinding(input);
      this.#assertDeliveryRunState(input.runId, 'github.checks');
      this.#assertResourceLease(
        'workspace',
        input.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'task',
        input.taskId,
        input.ownerId,
        input.taskLeaseEpoch,
        input.nowMs,
      );
    })();
  }

  completeDeliveryWait(
    input: {
      workspaceId: string;
      runId: string;
      taskId: string;
      checkId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): void {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery waits require the internal delivery broker capability');
    }
    this.#database.transaction(() => {
      this.#assertDeliveryWaitRunBinding(input);
      if (this.getDeliveryWaitEscalation(input.runId, input.checkId) !== undefined) {
        throw new Error('pipeline wait is already terminally escalated');
      }
      const wait = this.getWait(input.runId, input.checkId);
      if (
        wait === undefined ||
        wait.workspaceId !== input.workspaceId ||
        wait.taskId !== input.taskId
      ) {
        throw new Error('pipeline wait identity differs from its durable binding');
      }
      if (input.nowMs >= wait.absoluteDeadlineMs) {
        throw new Error('pipeline wait deadline expired before observation completion');
      }
      this.#assertDeliveryRunState(input.runId, 'github.checks');
      this.#assertResourceLease(
        'workspace',
        input.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'task',
        input.taskId,
        input.ownerId,
        input.taskLeaseEpoch,
        input.nowMs,
      );
      this.#database
        .prepare('DELETE FROM waits WHERE run_id = ? AND check_id = ?')
        .run(input.runId, input.checkId);
    })();
  }

  escalateDeliveryWait(
    input: {
      id: string;
      workspaceId: string;
      runId: string;
      taskId: string;
      checkId: string;
      eventIdentity: string;
      report: unknown;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): PipelineWaitEscalationRecord {
    if (capability !== workflowDeliveryMutationCapability) {
      throw new Error('delivery waits require the internal delivery broker capability');
    }
    return this.#database.transaction(() => {
      this.#assertDeliveryWaitRunBinding(input);
      this.#assertDeliveryRunState(input.runId, 'github.checks');
      this.#assertResourceLease(
        'workspace',
        input.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'task',
        input.taskId,
        input.ownerId,
        input.taskLeaseEpoch,
        input.nowMs,
      );
      const existing = this.getDeliveryWaitEscalation(input.runId, input.checkId);
      if (existing !== undefined) {
        if (
          existing.workspaceId !== input.workspaceId ||
          existing.taskId !== input.taskId ||
          existing.eventIdentity !== input.eventIdentity
        ) {
          throw new Error('pipeline wait escalation identity differs from its durable binding');
        }
        return existing;
      }
      const wait = this.getWait(input.runId, input.checkId);
      if (wait === undefined) throw new Error('pipeline wait not found');
      if (wait.eventIdentity !== input.eventIdentity) {
        throw new Error('pipeline wait event identity changed');
      }
      if (wait.workspaceId !== input.workspaceId || wait.taskId !== input.taskId) {
        throw new Error('pipeline wait identity differs from its durable binding');
      }
      if (input.nowMs < wait.absoluteDeadlineMs) {
        throw new Error('pipeline wait deadline has not expired');
      }
      this.#database
        .prepare(
          `INSERT INTO delivery_wait_escalations
           (id, workspace_id, run_id, task_id, check_id, event_identity, report_json, created_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.workspaceId,
          input.runId,
          input.taskId,
          input.checkId,
          input.eventIdentity,
          serializeDurableJson(input.report),
          input.nowMs,
        );
      this.#database
        .prepare('DELETE FROM waits WHERE run_id = ? AND check_id = ?')
        .run(input.runId, input.checkId);
      return this.getDeliveryWaitEscalation(input.runId, input.checkId)!;
    })();
  }

  getDeliveryWaitEscalation(
    runId: string,
    checkId: string,
  ): PipelineWaitEscalationRecord | undefined {
    const row = this.#database
      .prepare('SELECT * FROM delivery_wait_escalations WHERE run_id = ? AND check_id = ?')
      .get(runId, checkId) as
      | {
          id: string;
          workspace_id: string;
          run_id: string;
          task_id: string;
          check_id: string;
          event_identity: string;
          report_json: string;
          created_at_ms: number;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          id: row.id,
          workspaceId: row.workspace_id,
          runId: row.run_id,
          taskId: row.task_id,
          checkId: row.check_id,
          eventIdentity: row.event_identity,
          report: JSON.parse(row.report_json) as unknown,
          createdAtMs: row.created_at_ms,
        };
  }

  #assertDeliveryWaitRunBinding(input: {
    workspaceId: string;
    runId: string;
    taskId: string;
  }): void {
    const contract = this.#contractForRun(input.runId);
    if (contract.workspaceId !== input.workspaceId) {
      throw new Error('pipeline wait workspace does not match the run contract');
    }
    if (
      this.getAuthorizedRunTask(input.runId, input.taskId, workflowDeliveryMutationCapability) ===
      undefined
    ) {
      throw new Error('pipeline wait task does not match the run contract');
    }
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

  getLatestCommittedChecksOperation(
    runId: string,
    taskId: string,
  ): DeliveryOperationRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT * FROM delivery_operations
         WHERE run_id = ? AND task_id = ? AND kind = 'github.checks' AND status = 'committed'
         ORDER BY updated_at_ms DESC, id DESC LIMIT 1`,
      )
      .get(runId, taskId) as DeliveryOperationRow | undefined;
    return row === undefined ? undefined : deliveryOperationFromRow(row);
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
      const contentMetadata = this.#database
        .prepare('SELECT media_type, size_bytes FROM evidence WHERE digest = ?')
        .get(input.digest) as { media_type: string; size_bytes: number };
      if (
        contentMetadata.media_type !== input.mediaType ||
        contentMetadata.size_bytes !== input.sizeBytes
      ) {
        throw new Error('evidence digest already exists with different content metadata');
      }
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

  recordSecureEvidence(
    input: Omit<SecureEvidenceRecord, 'acceptedAtMs' | 'deletedAtMs' | 'tombstoneDigest'>,
    content: Uint8Array,
    maxRunBytes: number,
    capability?: symbol,
  ): SecureEvidenceRecord {
    if (capability !== workflowSecureEvidenceMutationCapability) {
      throw new Error('secure evidence mutation requires the internal vault capability');
    }
    return this.#database.transaction(() => {
      if (!Number.isInteger(maxRunBytes) || maxRunBytes <= 0) {
        throw new Error('invalid secure evidence run-size bound');
      }
      const contract = this.#contractForRun(input.runId);
      if (
        contract.workspaceId !== input.workspaceId ||
        contract.contractVersion !== input.contractVersion ||
        contract.policyDigest !== input.policyDigest ||
        this.getAuthorizedRunTask(
          input.runId,
          input.taskId,
          workflowSecureEvidenceMutationCapability,
        ) === undefined
      ) {
        throw new Error('secure evidence binding differs from the run contract');
      }
      const actualDigest = `sha256:${createHash('sha256').update(content).digest('hex')}`;
      if (actualDigest !== input.digest || content.byteLength !== input.sizeBytes) {
        throw new Error('secure evidence content differs from its digest or size');
      }
      const existingIdentity = this.getSecureEvidence(input.digest, input.runId, input.taskId);
      if (existingIdentity !== undefined && existingIdentity.deletedAtMs !== null) {
        throw new Error('tombstoned secure evidence cannot be recreated');
      }
      const liveDigest = this.#database
        .prepare(
          `SELECT 1 FROM secure_evidence
           WHERE digest = ? AND run_id = ? AND deleted_at_ms IS NULL LIMIT 1`,
        )
        .get(input.digest, input.runId);
      if (
        liveDigest === undefined &&
        this.sumLiveSecureEvidenceBytes(input.runId) + input.sizeBytes > maxRunBytes
      ) {
        throw new Error('evidence exceeds the approved per-run size bound');
      }
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO secure_evidence_blobs (digest, content, size_bytes)
           VALUES (?, ?, ?)`,
        )
        .run(input.digest, Buffer.from(content), input.sizeBytes);
      const blob = this.#database
        .prepare('SELECT content, size_bytes FROM secure_evidence_blobs WHERE digest = ?')
        .get(input.digest) as { content: Buffer; size_bytes: number };
      if (
        blob.size_bytes !== input.sizeBytes ||
        !Buffer.from(blob.content).equals(Buffer.from(content))
      ) {
        throw new Error('secure evidence digest already exists with different content');
      }
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO secure_evidence
           (digest, workspace_id, run_id, task_id, media_type, size_bytes, kind, producer,
            producer_role, contract_version, policy_digest, head_sha, redaction_count, retention_class,
            retention_until_ms, accepted_at_ms, deleted_at_ms, tombstone_digest, created_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
        )
        .run(
          input.digest,
          input.workspaceId,
          input.runId,
          input.taskId,
          input.mediaType,
          input.sizeBytes,
          input.kind,
          input.producer,
          input.producerRole,
          input.contractVersion,
          input.policyDigest,
          input.headSha,
          input.redactionCount,
          input.retentionClass,
          input.retentionUntilMs,
          input.createdAtMs,
        );
      const stored = this.getSecureEvidence(input.digest, input.runId, input.taskId);
      if (stored === undefined) throw new Error('secure evidence record was not persisted');
      if (
        stored.workspaceId !== input.workspaceId ||
        stored.mediaType !== input.mediaType ||
        stored.sizeBytes !== input.sizeBytes ||
        stored.kind !== input.kind ||
        stored.producer !== input.producer ||
        stored.producerRole !== input.producerRole ||
        stored.contractVersion !== input.contractVersion ||
        stored.policyDigest !== input.policyDigest ||
        stored.headSha !== input.headSha ||
        stored.redactionCount !== input.redactionCount ||
        stored.retentionClass !== input.retentionClass
      ) {
        throw new Error('secure evidence identity already exists with different metadata');
      }
      return stored;
    })();
  }

  getSecureEvidence(
    digest: string,
    runId: string,
    taskId: string,
  ): SecureEvidenceRecord | undefined {
    const row = this.#database
      .prepare(`SELECT * FROM secure_evidence WHERE digest = ? AND run_id = ? AND task_id = ?`)
      .get(digest, runId, taskId) as Record<string, unknown> | undefined;
    return row === undefined ? undefined : secureEvidenceRecordFromRow(row);
  }

  recordFeatureFinalization(
    input: {
      runId: string;
      featureId: string;
      epicId: string;
      childTaskIds: readonly string[];
      reportDigest: string;
      report: unknown;
      evidenceBindings: ReadonlyArray<{
        criterion: string;
        taskId: string;
        digest: string;
        mediaType: string;
        sizeBytes: number;
        kind: string;
      }>;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      closeoutLeaseEpoch: number;
      createdAtMs: number;
    },
    capability?: symbol,
  ): FeatureFinalizationRecord {
    if (capability !== workflowFinalizationMutationCapability) {
      throw new Error('feature finalization requires the internal closeout capability');
    }
    return this.#database.transaction(() => {
      const contract = this.#contractForRun(input.runId);
      const run = this.getRun(input.runId);
      if (
        run?.state !== 'finalizing' ||
        !run.mergeVerified ||
        contract.featureId !== input.featureId ||
        input.epicId !== input.featureId
      ) {
        throw new Error('feature finalization binding or merge state is invalid');
      }
      this.#assertResourceLease(
        'workspace',
        contract.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.createdAtMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.createdAtMs,
      );
      this.#assertResourceLease(
        'closeout',
        input.runId,
        input.ownerId,
        input.closeoutLeaseEpoch,
        input.createdAtMs,
      );
      const reportJson = serializeDurableJson(input.report);
      const actualDigest = `sha256:${createHash('sha256').update(reportJson).digest('hex')}`;
      if (actualDigest !== input.reportDigest) {
        throw new Error('final report digest does not match its canonical content');
      }
      const criteria = [...new Set(input.evidenceBindings.map((binding) => binding.criterion))];
      if (
        criteria.length !== contract.acceptanceCriteria.length ||
        contract.acceptanceCriteria.some((criterion) => !criteria.includes(criterion))
      ) {
        throw new Error('final report must map every approved acceptance criterion exactly once');
      }
      const childIds = [...new Set(input.childTaskIds)];
      const authoritativeChildIds = [
        ...contract.tasks.map((task) => task.id),
        ...this.listCommittedRepairChildIds(input.runId),
      ];
      if (
        childIds.length !== input.childTaskIds.length ||
        JSON.stringify(childIds) !== JSON.stringify(authoritativeChildIds)
      ) {
        throw new Error('final report child lineage differs from the authoritative task graph');
      }
      for (const childId of childIds) {
        const closed = this.#database
          .prepare(
            `SELECT 1 FROM transitions WHERE run_id = ? AND operation = 'beads.task_close'
             AND status = 'committed' AND json_extract(external_arguments_json, '$.taskId') = ?
             LIMIT 1`,
          )
          .get(input.runId, childId);
        if (closed === undefined) throw new Error(`implementation child is not closed: ${childId}`);
      }
      const merge = this.getCommittedMergeAttestation(input.runId);
      const mergeRequest = merge?.request as Record<string, unknown> | undefined;
      const mergedHeadSha = mergeRequest?.headSha;
      if (typeof mergedHeadSha !== 'string') {
        throw new Error('final report has no committed merge head');
      }
      const evaluation = this.getPassedFeatureEvaluation(input.runId, mergedHeadSha);
      const evaluationResult = evaluation?.result as Record<string, unknown> | undefined;
      const evaluatedCriteria = Array.isArray(evaluationResult?.criteria)
        ? (evaluationResult.criteria as Array<Record<string, unknown>>)
        : [];
      if (evaluation === undefined || evaluationResult?.verdict !== 'passed') {
        throw new Error('final report requires a passed feature evaluation at the merged head');
      }
      const report = input.report as Record<string, unknown>;
      if (
        report.runId !== input.runId ||
        report.featureId !== input.featureId ||
        report.epicId !== input.epicId ||
        report.mergedHeadSha !== mergedHeadSha ||
        report.evaluationId !== evaluation.id
      ) {
        throw new Error('final report identity differs from its authoritative run evidence');
      }
      for (const binding of input.evidenceBindings) {
        const evidence = this.getSecureEvidence(binding.digest, input.runId, binding.taskId);
        const evaluated = evaluatedCriteria.find(
          (criterion) =>
            criterion.criterion === binding.criterion &&
            criterion.status === 'passed' &&
            Array.isArray(criterion.evidence) &&
            criterion.evidence.some(
              (reference) =>
                typeof reference === 'object' &&
                reference !== null &&
                (reference as Record<string, unknown>).digest === binding.digest &&
                (reference as Record<string, unknown>).mediaType === binding.mediaType &&
                (reference as Record<string, unknown>).sizeBytes === binding.sizeBytes &&
                (reference as Record<string, unknown>).kind === binding.kind,
            ),
        );
        if (
          evidence === undefined ||
          evidence.deletedAtMs !== null ||
          evidence.acceptedAtMs === null ||
          evidence.workspaceId !== contract.workspaceId ||
          evidence.contractVersion !== contract.contractVersion ||
          evidence.policyDigest !== contract.policyDigest ||
          evidence.headSha !== mergedHeadSha ||
          evidence.mediaType !== binding.mediaType ||
          evidence.sizeBytes !== binding.sizeBytes ||
          evidence.kind !== binding.kind ||
          !['test_runner', 'qa_evaluator', 'code_reviewer', 'feature_evaluator'].includes(
            evidence.producerRole,
          ) ||
          evaluated === undefined
        ) {
          throw new Error(
            `final report references non-final evaluation evidence: ${binding.digest}`,
          );
        }
      }
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO feature_finalizations
           (run_id, feature_id, epic_id, status, report_digest, report_json,
            created_at_ms, closed_at_ms)
           VALUES (?, ?, ?, 'prepared', ?, ?, ?, NULL)`,
        )
        .run(
          input.runId,
          input.featureId,
          input.epicId,
          input.reportDigest,
          reportJson,
          input.createdAtMs,
        );
      const record = this.getFeatureFinalization(input.runId);
      if (
        record === undefined ||
        record.featureId !== input.featureId ||
        record.epicId !== input.epicId ||
        record.reportDigest !== input.reportDigest ||
        serializeDurableJson(record.report) !== reportJson
      ) {
        throw new Error('immutable feature finalization identity changed');
      }
      return record;
    })();
  }

  getFeatureFinalization(runId: string): FeatureFinalizationRecord | undefined {
    const row = this.#database
      .prepare('SELECT * FROM feature_finalizations WHERE run_id = ?')
      .get(runId) as
      | {
          run_id: string;
          feature_id: string;
          epic_id: string;
          status: 'prepared' | 'finalizing' | 'closed';
          report_digest: string;
          report_json: string;
          created_at_ms: number;
          closed_at_ms: number | null;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          runId: row.run_id,
          featureId: row.feature_id,
          epicId: row.epic_id,
          status: row.status,
          reportDigest: row.report_digest,
          report: JSON.parse(row.report_json) as unknown,
          createdAtMs: row.created_at_ms,
          closedAtMs: row.closed_at_ms,
        };
  }

  closeFeatureFinalization(
    input: {
      runId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      closeoutLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): FeatureFinalizationRecord {
    if (capability !== workflowFinalizationMutationCapability) {
      throw new Error('feature finalization requires the internal closeout capability');
    }
    return this.#database.transaction(() => {
      const existing = this.getFeatureFinalization(input.runId);
      if (existing === undefined) throw new Error('final evidence report is not recorded');
      if (existing.status === 'closed') return existing;
      if (existing.status !== 'finalizing') {
        throw new Error('closeout effects are not verified');
      }
      const contract = this.#contractForRun(input.runId);
      const run = this.getRun(input.runId);
      if (run?.state !== 'finalizing' || !run.mergeVerified) {
        throw new Error('run is not ready for feature closure');
      }
      this.#assertResourceLease(
        'workspace',
        contract.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'closeout',
        input.runId,
        input.ownerId,
        input.closeoutLeaseEpoch,
        input.nowMs,
      );
      this.#assertCommittedCloseoutEffects(input.runId, existing.epicId);
      this.#database
        .prepare(
          `UPDATE feature_finalizations SET status = 'closed', closed_at_ms = ?
           WHERE run_id = ? AND status = 'finalizing'`,
        )
        .run(input.nowMs, input.runId);
      const updated = this.#database
        .prepare(
          `UPDATE runs SET state = 'closed', version = version + 1, updated_at_ms = ?
           WHERE id = ? AND state = 'finalizing' AND merge_verified = 1`,
        )
        .run(input.nowMs, input.runId);
      if (updated.changes !== 1) throw new Error('feature closure compare-and-swap failed');
      return this.getFeatureFinalization(input.runId)!;
    })();
  }

  verifyFeatureFinalizationEffects(
    input: {
      runId: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      closeoutLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): FeatureFinalizationRecord {
    if (capability !== workflowFinalizationMutationCapability) {
      throw new Error('feature finalization requires the internal closeout capability');
    }
    return this.#database.transaction(() => {
      const existing = this.getFeatureFinalization(input.runId);
      if (existing === undefined) throw new Error('finalization intent is not prepared');
      if (existing.status !== 'prepared') return existing;
      const contract = this.#contractForRun(input.runId);
      this.#assertResourceLease(
        'workspace',
        contract.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'closeout',
        input.runId,
        input.ownerId,
        input.closeoutLeaseEpoch,
        input.nowMs,
      );
      this.#assertCommittedCloseoutEffects(input.runId, existing.epicId);
      this.#database
        .prepare(
          `UPDATE feature_finalizations SET status = 'finalizing'
           WHERE run_id = ? AND status = 'prepared'`,
        )
        .run(input.runId);
      return this.getFeatureFinalization(input.runId)!;
    })();
  }

  requestWorkflowCancellation(
    input: {
      id: string;
      runId: string;
      requestedBy: string;
      reason: string;
      requestedAtMs: number;
      stopDeadlineMs: number;
      retainedEvidence: readonly unknown[];
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): WorkflowCancellationRecord {
    if (capability !== workflowCancellationMutationCapability) {
      throw new Error('workflow cancellation requires the internal cancellation capability');
    }
    if (input.requestedAtMs !== input.nowMs) {
      throw new Error('cancellation request time must come from the coordinator clock');
    }
    if (input.stopDeadlineMs < input.requestedAtMs) {
      throw new Error('cancellation stop deadline precedes the request');
    }
    return this.#database.transaction(() => {
      const existing = this.getWorkflowCancellation(input.runId);
      if (existing !== undefined) {
        if (
          existing.id !== input.id ||
          existing.requestedBy !== input.requestedBy ||
          existing.reason !== input.reason ||
          existing.requestedAtMs !== input.requestedAtMs ||
          existing.stopDeadlineMs !== input.stopDeadlineMs ||
          serializeDurableJson(existing.retainedEvidence) !==
            serializeDurableJson(input.retainedEvidence)
        ) {
          throw new Error('immutable cancellation request changed');
        }
        return existing;
      }
      const contract = this.#contractForRun(input.runId);
      const run = this.getRun(input.runId);
      const invalidEvidence = input.retainedEvidence.some((reference) => {
        if (
          typeof reference !== 'object' ||
          reference === null ||
          !('digest' in reference) ||
          !('mediaType' in reference) ||
          !('sizeBytes' in reference) ||
          !('kind' in reference)
        ) {
          return true;
        }
        const candidate = reference as Record<string, unknown>;
        return (
          this.#database
            .prepare(
              `SELECT 1 FROM secure_evidence
               WHERE digest = ? AND run_id = ? AND workspace_id = ?
                 AND contract_version = ? AND policy_digest = ?
                 AND media_type = ? AND size_bytes = ? AND kind = ?
                 AND accepted_at_ms IS NOT NULL AND deleted_at_ms IS NULL
               LIMIT 1`,
            )
            .get(
              candidate.digest,
              input.runId,
              contract.workspaceId,
              contract.contractVersion,
              contract.policyDigest,
              candidate.mediaType,
              candidate.sizeBytes,
              candidate.kind,
            ) === undefined
        );
      });
      if (invalidEvidence) {
        throw new Error('cancellation retained evidence is not recorded');
      }
      const cancellable = new Set<WorkflowState>([
        'approved',
        'scheduling',
        'implementing',
        'task_verification',
        'task_review',
        'repair',
        'task_accepted',
        'integration',
        'feature_evaluation',
        'repair_planning',
        'pipeline',
        'waiting',
        'delivery',
        'finalizing',
        'recovering',
        'escalated',
      ]);
      if (run === undefined || !cancellable.has(run.state)) {
        throw new Error('workflow run is not cancellable');
      }
      const preparedMerge = this.#database
        .prepare(
          `SELECT 1 FROM delivery_operations
           WHERE run_id = ? AND kind = 'github.merge' AND status = 'prepared' LIMIT 1`,
        )
        .get(input.runId);
      if (preparedMerge !== undefined || run.mergeVerified) {
        throw new Error(
          'verified or prepared merge must reconcile to finalizing before cancellation',
        );
      }
      this.#assertResourceLease(
        'workspace',
        contract.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#database
        .prepare(
          `INSERT INTO workflow_cancellations
           (id, run_id, requested_by, reason, requested_at_ms, stop_deadline_ms, status,
            owned_work_stopped, incomplete_cleanup_json, retained_evidence_json, completed_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, 'requested', 0, '[]', ?, NULL)`,
        )
        .run(
          input.id,
          input.runId,
          input.requestedBy,
          input.reason,
          input.requestedAtMs,
          input.stopDeadlineMs,
          serializeDurableJson(input.retainedEvidence),
        );
      this.#database
        .prepare(
          `UPDATE runs SET state = 'cancelling', version = version + 1, updated_at_ms = ?
           WHERE id = ? AND state = ?`,
        )
        .run(input.nowMs, input.runId, run.state);
      return this.getWorkflowCancellation(input.runId)!;
    })();
  }

  completeWorkflowCancellation(
    input: {
      runId: string;
      ownedWorkStopped: boolean;
      incompleteCleanup: readonly string[];
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): WorkflowCancellationRecord {
    if (capability !== workflowCancellationMutationCapability) {
      throw new Error('workflow cancellation requires the internal cancellation capability');
    }
    return this.#database.transaction(() => {
      const record = this.getWorkflowCancellation(input.runId);
      if (record === undefined) throw new Error('cancellation request not found');
      if (record.status !== 'requested') return record;
      const contract = this.#contractForRun(input.runId);
      this.#assertResourceLease(
        'workspace',
        contract.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        input.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      const durableIncomplete: string[] = [];
      const blockers = [
        [
          'active-specialists',
          `SELECT 1 FROM scheduler_executions WHERE run_id = ? AND status = 'active' LIMIT 1`,
        ],
        [
          'prepared-transitions',
          `SELECT 1 FROM transitions WHERE run_id = ? AND status = 'prepared' LIMIT 1`,
        ],
        [
          'prepared-delivery',
          `SELECT 1 FROM delivery_operations WHERE run_id = ? AND status = 'prepared' LIMIT 1`,
        ],
        [
          'active-repairs',
          `SELECT 1 FROM repair_dispatches WHERE run_id = ? AND status = 'dispatched' LIMIT 1`,
        ],
        [
          'prepared-repair-children',
          `SELECT 1 FROM repair_child_intents WHERE run_id = ? AND status = 'prepared' LIMIT 1`,
        ],
        ['active-waits', `SELECT 1 FROM waits WHERE run_id = ? LIMIT 1`],
      ] as const;
      for (const [label, query] of blockers) {
        if (this.#database.prepare(query).get(input.runId) !== undefined) {
          durableIncomplete.push(label);
        }
      }
      const incomplete = [...new Set([...input.incompleteCleanup, ...durableIncomplete])];
      const complete = input.ownedWorkStopped && incomplete.length === 0;
      if (!complete && input.nowMs < record.stopDeadlineMs) return record;
      const status = complete ? 'cancelled' : 'escalated';
      this.#database
        .prepare(
          `UPDATE workflow_cancellations SET status = ?, owned_work_stopped = ?,
           incomplete_cleanup_json = ?, completed_at_ms = ?
           WHERE run_id = ? AND status = 'requested'`,
        )
        .run(
          status,
          input.ownedWorkStopped ? 1 : 0,
          serializeDurableJson(incomplete),
          input.nowMs,
          input.runId,
        );
      this.#database
        .prepare(
          `UPDATE runs SET state = ?, version = version + 1, updated_at_ms = ?
           WHERE id = ? AND state = 'cancelling'`,
        )
        .run(status, input.nowMs, input.runId);
      return this.getWorkflowCancellation(input.runId)!;
    })();
  }

  getWorkflowCancellation(runId: string): WorkflowCancellationRecord | undefined {
    const row = this.#database
      .prepare('SELECT * FROM workflow_cancellations WHERE run_id = ?')
      .get(runId) as Record<string, unknown> | undefined;
    return row === undefined
      ? undefined
      : {
          id: String(row.id),
          runId: String(row.run_id),
          requestedBy: String(row.requested_by),
          reason: String(row.reason),
          requestedAtMs: Number(row.requested_at_ms),
          stopDeadlineMs: Number(row.stop_deadline_ms),
          status: row.status as WorkflowCancellationRecord['status'],
          ownedWorkStopped: row.owned_work_stopped === 1,
          incompleteCleanup: JSON.parse(String(row.incomplete_cleanup_json)) as string[],
          retainedEvidence: JSON.parse(String(row.retained_evidence_json)) as unknown[],
          completedAtMs: row.completed_at_ms === null ? null : Number(row.completed_at_ms),
        };
  }

  listRequestedWorkflowCancellations(): WorkflowCancellationRecord[] {
    const rows = this.#database
      .prepare(
        "SELECT run_id FROM workflow_cancellations WHERE status = 'requested' ORDER BY requested_at_ms, id",
      )
      .all() as Array<{ run_id: string }>;
    return rows.map((row) => this.getWorkflowCancellation(row.run_id)!);
  }

  #assertCommittedCloseoutEffects(runId: string, epicId: string): void {
    const epicClose = this.#database
      .prepare(
        `SELECT result_json FROM transitions WHERE run_id = ? AND operation = 'beads.task_close'
         AND status = 'committed' AND json_extract(external_arguments_json, '$.taskId') = ?
         ORDER BY updated_at_ms DESC LIMIT 1`,
      )
      .get(runId, epicId) as { result_json: string } | undefined;
    const doltSync = this.#database
      .prepare(
        `SELECT result_json FROM transitions WHERE run_id = ? AND operation = 'beads.dolt_push'
         AND status = 'committed' ORDER BY updated_at_ms DESC LIMIT 1`,
      )
      .get(runId) as { result_json: string } | undefined;
    const epicResult = epicClose === undefined ? undefined : JSON.parse(epicClose.result_json);
    const doltResult = doltSync === undefined ? undefined : JSON.parse(doltSync.result_json);
    if (epicResult?.status !== 'closed' || doltResult?.status !== 'synced') {
      throw new Error('epic closure and remote Dolt synchronization are not verified');
    }
  }

  getSecureEvidenceBlob(digest: string, capability?: symbol): Uint8Array {
    if (capability !== workflowSecureEvidenceMutationCapability) {
      throw new Error('secure evidence read requires the internal vault capability');
    }
    const row = this.#database
      .prepare('SELECT content FROM secure_evidence_blobs WHERE digest = ?')
      .get(digest) as { content: Buffer } | undefined;
    if (row === undefined) throw new Error('secure evidence blob is unavailable');
    const content = Buffer.from(row.content);
    const actual = `sha256:${createHash('sha256').update(content).digest('hex')}`;
    if (actual !== digest) throw new Error('secure evidence blob integrity check failed');
    return content;
  }

  acceptSecureEvidence(
    input: {
      digest: string;
      runId: string;
      taskId: string;
      acceptedAtMs: number;
    },
    capability?: symbol,
  ): SecureEvidenceRecord {
    if (
      capability !== workflowSecureEvidenceMutationCapability &&
      capability !== workflowEvaluationMutationCapability
    ) {
      throw new Error('secure evidence acceptance requires an internal capability');
    }
    const before = this.getSecureEvidence(input.digest, input.runId, input.taskId);
    if (
      before !== undefined &&
      before.acceptedAtMs !== null &&
      before.acceptedAtMs !== input.acceptedAtMs
    ) {
      throw new Error('secure evidence acceptance is immutable');
    }
    this.#database
      .prepare(
        `UPDATE secure_evidence SET accepted_at_ms = COALESCE(accepted_at_ms, ?)
         WHERE digest = ? AND run_id = ? AND task_id = ? AND deleted_at_ms IS NULL`,
      )
      .run(input.acceptedAtMs, input.digest, input.runId, input.taskId);
    const record = this.getSecureEvidence(input.digest, input.runId, input.taskId);
    if (record?.acceptedAtMs === null || record === undefined) {
      throw new Error('secure evidence cannot be accepted');
    }
    return record;
  }

  tombstoneSecureEvidence(
    input: {
      digest: string;
      runId: string;
      taskId: string;
      deletedAtMs: number;
      tombstoneDigest: string;
    },
    capability?: symbol,
  ): SecureEvidenceRecord {
    if (capability !== workflowSecureEvidenceMutationCapability) {
      throw new Error('secure evidence deletion requires the internal vault capability');
    }
    return this.#database.transaction(() => {
      const before = this.getSecureEvidence(input.digest, input.runId, input.taskId);
      if (before === undefined) throw new Error('secure evidence not found');
      if (before.deletedAtMs !== null) {
        if (
          before.deletedAtMs !== input.deletedAtMs ||
          before.tombstoneDigest !== input.tombstoneDigest
        ) {
          throw new Error('secure evidence tombstone is immutable');
        }
        return before;
      }
      if (input.deletedAtMs < before.retentionUntilMs) {
        throw new Error('secure evidence retention has not expired');
      }
      this.#database
        .prepare(
          `UPDATE secure_evidence SET deleted_at_ms = COALESCE(deleted_at_ms, ?),
           tombstone_digest = COALESCE(tombstone_digest, ?)
           WHERE digest = ? AND run_id = ? AND task_id = ?`,
        )
        .run(input.deletedAtMs, input.tombstoneDigest, input.digest, input.runId, input.taskId);
      if (this.countLiveSecureEvidenceBindings(input.digest) === 0) {
        this.#database
          .prepare('DELETE FROM secure_evidence_blobs WHERE digest = ?')
          .run(input.digest);
      }
      return this.getSecureEvidence(input.digest, input.runId, input.taskId)!;
    })();
  }

  countLiveSecureEvidenceBindings(digest: string): number {
    const row = this.#database
      .prepare(
        'SELECT COUNT(*) AS count FROM secure_evidence WHERE digest = ? AND deleted_at_ms IS NULL',
      )
      .get(digest) as { count: number };
    return row.count;
  }

  sumLiveSecureEvidenceBytes(runId: string): number {
    const row = this.#database
      .prepare(
        `SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM (
           SELECT digest, MAX(size_bytes) AS size_bytes FROM secure_evidence
           WHERE run_id = ? AND deleted_at_ms IS NULL GROUP BY digest
         )`,
      )
      .get(runId) as { bytes: number };
    return row.bytes;
  }

  recordEvaluation(
    input: Omit<EvaluationRecord, 'result'> & { result: unknown },
    capability?: symbol,
  ): EvaluationRecord {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('evaluation records require the internal evaluator capability');
    }
    const contract = this.#contractForRun(input.runId);
    if (
      contract.workspaceId !== input.workspaceId ||
      this.getAuthorizedRunTask(input.runId, input.taskId, workflowEvaluationMutationCapability) ===
        undefined
    ) {
      throw new Error('evaluation binding differs from the run contract');
    }
    const resultJson = serializeDurableJson(input.result);
    this.#database
      .prepare(
        `INSERT OR IGNORE INTO evaluations
         (id, workspace_id, run_id, task_id, head_sha, evaluator_role, result_json, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.workspaceId,
        input.runId,
        input.taskId,
        input.headSha,
        input.evaluatorRole,
        resultJson,
        input.createdAtMs,
      );
    const record = this.getEvaluation(input.id);
    if (
      record === undefined ||
      record.workspaceId !== input.workspaceId ||
      record.runId !== input.runId ||
      record.taskId !== input.taskId ||
      record.headSha !== input.headSha ||
      record.evaluatorRole !== input.evaluatorRole ||
      serializeDurableJson(record.result) !== resultJson
    ) {
      throw new Error('evaluation identity already exists with different content');
    }
    return record;
  }

  recordEvaluationWithEvidence(
    input: Omit<EvaluationRecord, 'result'> & { result: unknown },
    evidenceDigests: readonly string[],
    capability?: symbol,
  ): EvaluationRecord {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('evaluation records require the internal evaluator capability');
    }
    return this.#database.transaction(() => {
      const record = this.recordEvaluation(input, capability);
      for (const digest of new Set(evidenceDigests)) {
        const secure = this.getSecureEvidence(digest, input.runId, input.taskId);
        if (secure === undefined || secure.deletedAtMs !== null) {
          throw new Error('evaluation acceptance references unavailable secure evidence');
        }
        this.#database
          .prepare(
            `INSERT OR IGNORE INTO evaluation_evidence_acceptances
             (evaluation_id, digest, run_id, task_id, accepted_at_ms)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(record.id, digest, input.runId, input.taskId, record.createdAtMs);
        const acceptance = this.#database
          .prepare(
            `SELECT accepted_at_ms FROM evaluation_evidence_acceptances
             WHERE evaluation_id = ? AND digest = ? AND run_id = ? AND task_id = ?`,
          )
          .get(record.id, digest, input.runId, input.taskId) as { accepted_at_ms: number };
        if (acceptance.accepted_at_ms !== record.createdAtMs) {
          throw new Error('evaluation evidence acceptance identity changed');
        }
        this.#database
          .prepare(
            `UPDATE secure_evidence SET accepted_at_ms = COALESCE(accepted_at_ms, ?)
             WHERE digest = ? AND run_id = ? AND task_id = ? AND deleted_at_ms IS NULL`,
          )
          .run(record.createdAtMs, digest, input.runId, input.taskId);
      }
      return record;
    })();
  }

  getEvaluation(id: string): EvaluationRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM evaluations WHERE id = ?').get(id) as
      | {
          id: string;
          workspace_id: string;
          run_id: string;
          task_id: string;
          head_sha: string;
          evaluator_role: string;
          result_json: string;
          created_at_ms: number;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          id: row.id,
          workspaceId: row.workspace_id,
          runId: row.run_id,
          taskId: row.task_id,
          headSha: row.head_sha,
          evaluatorRole: row.evaluator_role,
          result: JSON.parse(row.result_json) as unknown,
          createdAtMs: row.created_at_ms,
        };
  }

  getPassedFeatureEvaluation(runId: string, headSha: string): EvaluationRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT * FROM evaluations WHERE run_id = ? AND head_sha = ?
         AND evaluator_role = 'feature_evaluator'
         AND json_extract(result_json, '$.verdict') = 'passed'
         ORDER BY created_at_ms DESC, id DESC LIMIT 1`,
      )
      .get(runId, headSha) as
      | {
          id: string;
          workspace_id: string;
          run_id: string;
          task_id: string;
          head_sha: string;
          evaluator_role: string;
          result_json: string;
          created_at_ms: number;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          id: row.id,
          workspaceId: row.workspace_id,
          runId: row.run_id,
          taskId: row.task_id,
          headSha: row.head_sha,
          evaluatorRole: row.evaluator_role,
          result: JSON.parse(row.result_json) as unknown,
          createdAtMs: row.created_at_ms,
        };
  }

  listCommittedRepairChildIds(runId: string): string[] {
    return (
      this.#database
        .prepare(
          `SELECT id FROM repair_child_intents WHERE run_id = ? AND status = 'committed'
           ORDER BY sequence, id`,
        )
        .all(runId) as Array<{ id: string }>
    ).map((row) => row.id);
  }

  prepareRepairChildIntent(
    input: Omit<RepairChildIntentRecord, 'status' | 'result' | 'updatedAtMs'>,
    capability?: symbol,
  ): RepairChildIntentRecord {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('repair-child intent requires the internal evaluator capability');
    }
    const contract = this.#contractForRun(input.runId);
    if (contract.workspaceId !== input.workspaceId) {
      throw new Error('repair-child workspace differs from the run contract');
    }
    const run = this.getRun(input.runId);
    if (run?.state !== 'repair_planning') {
      throw new Error('repair children require the repair_planning state');
    }
    this.#assertResourceLease(
      'workspace',
      input.workspaceId,
      input.ownerId,
      input.workspaceLeaseEpoch,
      input.createdAtMs,
    );
    this.#assertResourceLease(
      'run',
      input.runId,
      input.ownerId,
      input.runLeaseEpoch,
      input.createdAtMs,
    );
    this.#assertResourceLease(
      'task',
      input.chainTipTaskId,
      input.ownerId,
      input.taskLeaseEpoch,
      input.createdAtMs,
    );
    const requestJson = serializeDurableJson(input.request);
    const request = input.request as Record<string, unknown>;
    return this.#database.transaction(() => {
      if (
        typeof request.featureId !== 'string' ||
        typeof request.finding !== 'object' ||
        request.finding === null ||
        typeof (request.finding as Record<string, unknown>).id !== 'string'
      ) {
        throw new Error('repair-child budget request is malformed');
      }
      const remaining = this.remainingRepairBudgetForChild(
        {
          runId: input.runId,
          featureId: request.featureId,
          childId: input.id,
          findingId: (request.finding as Record<string, unknown>).id as string,
          policy: contract.retryPolicy,
        },
        workflowEvaluationMutationCapability,
      );
      if (JSON.stringify(request.remainingRetryBudget) !== JSON.stringify(remaining)) {
        throw new Error('repair-child retry reservation changed before prepare');
      }
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO repair_child_budget_reservations
           (child_id, run_id, finding_id, created_at_ms) VALUES (?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.runId,
          (request.finding as Record<string, unknown>).id,
          input.createdAtMs,
        );
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO repair_child_intents
         (id, workspace_id, run_id, sequence, finding_digest, chain_tip_task_id, request_json,
          status, owner_id, workspace_lease_epoch, run_lease_epoch, task_lease_epoch, result_json,
          created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?, ?, ?, NULL, ?, ?)`,
        )
        .run(
          input.id,
          input.workspaceId,
          input.runId,
          input.sequence,
          input.findingDigest,
          input.chainTipTaskId,
          requestJson,
          input.ownerId,
          input.workspaceLeaseEpoch,
          input.runLeaseEpoch,
          input.taskLeaseEpoch,
          input.createdAtMs,
          input.createdAtMs,
        );
      const record = this.getRepairChildIntent(input.id);
      if (
        record === undefined ||
        record.workspaceId !== input.workspaceId ||
        record.runId !== input.runId ||
        record.sequence !== input.sequence ||
        record.findingDigest !== input.findingDigest ||
        record.chainTipTaskId !== input.chainTipTaskId ||
        record.ownerId !== input.ownerId ||
        record.workspaceLeaseEpoch !== input.workspaceLeaseEpoch ||
        record.runLeaseEpoch !== input.runLeaseEpoch ||
        record.taskLeaseEpoch !== input.taskLeaseEpoch ||
        record.createdAtMs !== input.createdAtMs ||
        serializeDurableJson(record.request) !== requestJson
      ) {
        throw new Error('repair-child identity already exists with different content');
      }
      return record;
    })();
  }

  finalizeRepairChildIntent(
    input: {
      id: string;
      status: 'committed' | 'escalated';
      result: unknown;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      updatedAtMs: number;
    },
    capability?: symbol,
  ): RepairChildIntentRecord {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('repair-child intent requires the internal evaluator capability');
    }
    const before = this.getRepairChildIntent(input.id);
    if (before === undefined) throw new Error('repair-child intent not found');
    this.#assertResourceLease(
      'workspace',
      before.workspaceId,
      input.ownerId,
      input.workspaceLeaseEpoch,
      input.updatedAtMs,
    );
    this.#assertResourceLease(
      'run',
      before.runId,
      input.ownerId,
      input.runLeaseEpoch,
      input.updatedAtMs,
    );
    this.#assertResourceLease(
      'task',
      before.chainTipTaskId,
      input.ownerId,
      input.taskLeaseEpoch,
      input.updatedAtMs,
    );
    if (
      before.ownerId !== input.ownerId ||
      before.workspaceLeaseEpoch !== input.workspaceLeaseEpoch ||
      before.runLeaseEpoch !== input.runLeaseEpoch ||
      before.taskLeaseEpoch !== input.taskLeaseEpoch
    ) {
      throw new Error('repair-child fencing token changed');
    }
    if (before.status !== 'prepared') {
      if (
        before.status !== input.status ||
        serializeDurableJson(before.result) !== serializeDurableJson(input.result)
      ) {
        throw new Error('repair-child intent is already finalized differently');
      }
      return before;
    }
    return this.#database.transaction(() => {
      this.#database
        .prepare(
          `UPDATE repair_child_intents SET status = ?, result_json = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'prepared'`,
        )
        .run(input.status, serializeDurableJson(input.result), input.updatedAtMs, input.id);
      if (input.status === 'committed') {
        const request = before.request as Record<string, unknown>;
        if (
          request.id !== before.id ||
          typeof request.branchParentSha !== 'string' ||
          !/^[a-f0-9]{40}$/u.test(request.branchParentSha)
        ) {
          throw new Error('repair-child lineage request is malformed');
        }
        this.#database
          .prepare(
            `INSERT OR IGNORE INTO repair_approved_heads
             (intent_id, workspace_id, run_id, task_id, ref, base_sha, current_sha, updated_at_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            before.id,
            before.workspaceId,
            before.runId,
            before.id,
            `refs/heads/task/${before.id}`,
            request.branchParentSha,
            request.branchParentSha,
            input.updatedAtMs,
          );
        const lineage = this.#database
          .prepare('SELECT * FROM repair_approved_heads WHERE intent_id = ?')
          .get(before.id) as { task_id: string; base_sha: string; current_sha: string } | undefined;
        if (
          lineage?.task_id !== before.id ||
          lineage.base_sha !== request.branchParentSha ||
          lineage.current_sha !== request.branchParentSha
        ) {
          throw new Error('repair-child approved-head lineage conflicts with the intent');
        }
      }
      return this.getRepairChildIntent(input.id)!;
    })();
  }

  getRepairChildIntent(id: string): RepairChildIntentRecord | undefined {
    const row = this.#database
      .prepare('SELECT * FROM repair_child_intents WHERE id = ?')
      .get(id) as
      | {
          id: string;
          workspace_id: string;
          run_id: string;
          sequence: number;
          finding_digest: string;
          chain_tip_task_id: string;
          request_json: string;
          status: RepairChildIntentRecord['status'];
          owner_id: string;
          workspace_lease_epoch: number;
          run_lease_epoch: number;
          task_lease_epoch: number;
          result_json: string | null;
          created_at_ms: number;
          updated_at_ms: number;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          id: row.id,
          workspaceId: row.workspace_id,
          runId: row.run_id,
          sequence: row.sequence,
          findingDigest: row.finding_digest,
          chainTipTaskId: row.chain_tip_task_id,
          request: JSON.parse(row.request_json) as unknown,
          status: row.status,
          ownerId: row.owner_id,
          workspaceLeaseEpoch: row.workspace_lease_epoch,
          runLeaseEpoch: row.run_lease_epoch,
          taskLeaseEpoch: row.task_lease_epoch,
          result: row.result_json === null ? null : (JSON.parse(row.result_json) as unknown),
          createdAtMs: row.created_at_ms,
          updatedAtMs: row.updated_at_ms,
        };
  }

  assertRepairChildIntentFence(
    input: {
      id: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): RepairChildIntentRecord {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('repair-child intent requires the internal evaluator capability');
    }
    const intent = this.getRepairChildIntent(input.id);
    if (intent === undefined) throw new Error('repair-child intent not found');
    if (this.getRun(intent.runId)?.state !== 'repair_planning') {
      throw new Error('repair children require the repair_planning state');
    }
    if (
      intent.ownerId !== input.ownerId ||
      intent.workspaceLeaseEpoch !== input.workspaceLeaseEpoch ||
      intent.runLeaseEpoch !== input.runLeaseEpoch ||
      intent.taskLeaseEpoch !== input.taskLeaseEpoch
    ) {
      throw new Error('repair-child fencing token changed');
    }
    this.#assertResourceLease(
      'workspace',
      intent.workspaceId,
      input.ownerId,
      input.workspaceLeaseEpoch,
      input.nowMs,
    );
    this.#assertResourceLease('run', intent.runId, input.ownerId, input.runLeaseEpoch, input.nowMs);
    this.#assertResourceLease(
      'task',
      intent.chainTipTaskId,
      input.ownerId,
      input.taskLeaseEpoch,
      input.nowMs,
    );
    return intent;
  }

  adoptPreparedRepairChildIntent(
    input: {
      id: string;
      ownerId: string;
      workspaceLeaseEpoch: number;
      runLeaseEpoch: number;
      taskLeaseEpoch: number;
      nowMs: number;
    },
    capability?: symbol,
  ): RepairChildIntentRecord {
    if (capability !== workflowEvaluationMutationCapability) {
      throw new Error('repair-child intent requires the internal evaluator capability');
    }
    return this.#database.transaction(() => {
      const intent = this.getRepairChildIntent(input.id);
      if (intent?.status !== 'prepared') throw new Error('prepared repair-child intent not found');
      if (this.getRun(intent.runId)?.state !== 'repair_planning') {
        throw new Error('repair children require the repair_planning state');
      }
      this.#assertResourceLease(
        'workspace',
        intent.workspaceId,
        input.ownerId,
        input.workspaceLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'run',
        intent.runId,
        input.ownerId,
        input.runLeaseEpoch,
        input.nowMs,
      );
      this.#assertResourceLease(
        'task',
        intent.chainTipTaskId,
        input.ownerId,
        input.taskLeaseEpoch,
        input.nowMs,
      );
      const regresses =
        input.workspaceLeaseEpoch < intent.workspaceLeaseEpoch ||
        input.runLeaseEpoch < intent.runLeaseEpoch ||
        input.taskLeaseEpoch < intent.taskLeaseEpoch;
      const advances =
        input.workspaceLeaseEpoch > intent.workspaceLeaseEpoch ||
        input.runLeaseEpoch > intent.runLeaseEpoch ||
        input.taskLeaseEpoch > intent.taskLeaseEpoch;
      if (regresses || (!advances && input.ownerId === intent.ownerId)) {
        throw new Error('repair-child adoption does not fence the interrupted owner');
      }
      this.#database
        .prepare(
          `UPDATE repair_child_intents SET owner_id = ?, workspace_lease_epoch = ?,
           run_lease_epoch = ?, task_lease_epoch = ?, updated_at_ms = ?
           WHERE id = ? AND status = 'prepared'`,
        )
        .run(
          input.ownerId,
          input.workspaceLeaseEpoch,
          input.runLeaseEpoch,
          input.taskLeaseEpoch,
          input.nowMs,
          input.id,
        );
      return this.getRepairChildIntent(input.id)!;
    })();
  }

  countRepairChildIntents(runId: string): number {
    const row = this.#database
      .prepare('SELECT COUNT(*) AS count FROM repair_child_intents WHERE run_id = ?')
      .get(runId) as { count: number };
    return row.count;
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

  hasRecoveryEvidenceBinding(input: {
    digest: string;
    workspaceId: string;
    runId: string;
    contractVersion: number;
    policyDigest: string;
    allowedProducerRoles: readonly string[];
    taskId?: string;
    minCreatedAtMs: number;
    interruptedTransitionId: string;
  }): boolean {
    if (input.allowedProducerRoles.length === 0) return false;
    const placeholders = input.allowedProducerRoles.map(() => '?').join(', ');
    const taskClause = input.taskId === undefined ? '' : 'AND binding.task_id = ?';
    const parameters = [
      input.digest,
      input.workspaceId,
      input.runId,
      input.contractVersion,
      input.policyDigest,
      ...input.allowedProducerRoles,
      ...(input.taskId === undefined ? [] : [input.taskId]),
      input.interruptedTransitionId,
      input.minCreatedAtMs,
    ];
    return (
      this.#database
        .prepare(
          `SELECT 1 FROM evidence_bindings AS binding
           WHERE binding.digest = ? AND binding.workspace_id = ? AND binding.run_id = ?
             AND binding.contract_version = ? AND binding.policy_digest = ?
             AND binding.producer_role IN (${placeholders}) ${taskClause}
             AND (
               binding.transition_id = ? OR (
                 binding.created_at_ms >= ? AND binding.head_sha <> ''
                 AND binding.head_sha = COALESCE(
                   (SELECT current_sha FROM delivery_approved_heads
                    WHERE workspace_id = binding.workspace_id AND run_id = binding.run_id
                      AND task_id = binding.task_id AND ref = 'refs/heads/task/' || binding.task_id),
                   (SELECT current_sha FROM repair_approved_heads
                    WHERE workspace_id = binding.workspace_id AND run_id = binding.run_id
                      AND task_id = binding.task_id AND ref = 'refs/heads/task/' || binding.task_id)
                 )
               )
             )
           LIMIT 1`,
        )
        .get(...parameters) !== undefined
    );
  }

  hasTaskEvidenceBinding(input: {
    digest: string;
    mediaType: string;
    sizeBytes: number;
    kind: string;
    workspaceId: string;
    runId: string;
    taskId: string;
    contractVersion: number;
    policyDigest: string;
    allowedProducerRoles: readonly string[];
  }): boolean {
    return this.getTaskEvidenceBindingCreatedAt(input) !== undefined;
  }

  getTaskEvidenceBindingCreatedAt(input: {
    digest: string;
    mediaType: string;
    sizeBytes: number;
    kind: string;
    workspaceId: string;
    runId: string;
    taskId: string;
    contractVersion: number;
    policyDigest: string;
    allowedProducerRoles: readonly string[];
  }): { createdAtMs: number; headSha: string; transitionId: string } | undefined {
    if (input.allowedProducerRoles.length === 0) return undefined;
    const placeholders = input.allowedProducerRoles.map(() => '?').join(', ');
    const row = this.#database
      .prepare(
        `SELECT evidence_bindings.created_at_ms, evidence_bindings.head_sha,
                evidence_bindings.transition_id FROM evidence_bindings
           JOIN evidence ON evidence.digest = evidence_bindings.digest
           WHERE evidence_bindings.digest = ? AND evidence.media_type = ? AND evidence.size_bytes = ?
             AND evidence_bindings.kind = ? AND evidence_bindings.workspace_id = ?
             AND evidence_bindings.run_id = ? AND evidence_bindings.task_id = ?
             AND evidence_bindings.contract_version = ? AND evidence_bindings.policy_digest = ?
             AND evidence_bindings.producer_role IN (${placeholders})
           ORDER BY evidence_bindings.created_at_ms ASC LIMIT 1`,
      )
      .get(
        input.digest,
        input.mediaType,
        input.sizeBytes,
        input.kind,
        input.workspaceId,
        input.runId,
        input.taskId,
        input.contractVersion,
        input.policyDigest,
        ...input.allowedProducerRoles,
      ) as { created_at_ms: number; head_sha: string; transition_id: string } | undefined;
    return row === undefined
      ? undefined
      : {
          createdAtMs: row.created_at_ms,
          headSha: row.head_sha,
          transitionId: row.transition_id,
        };
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
    if (transition.transitionContext.closeoutLeaseEpoch !== undefined) {
      this.#assertResourceLease(
        'closeout',
        transition.runId,
        ownerId,
        transition.transitionContext.closeoutLeaseEpoch,
        nowMs,
      );
    }
  }

  #activeRecovery(
    runId: string,
  ): { recovery_target: WorkflowState; merge_verified: number } | undefined {
    return this.#database
      .prepare(
        `SELECT recovery_target, merge_verified FROM recovery_records
         WHERE run_id = ? AND resumed_at_ms IS NULL
         ORDER BY created_at_ms DESC, transition_id DESC LIMIT 1`,
      )
      .get(runId) as { recovery_target: WorkflowState; merge_verified: number } | undefined;
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
      CREATE TABLE IF NOT EXISTS recovery_records (
        transition_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        interrupted_state TEXT NOT NULL,
        recovery_target TEXT NOT NULL,
        interrupted_transition_id TEXT NOT NULL,
        merge_verified INTEGER NOT NULL CHECK (merge_verified IN (0, 1)),
        evidence_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        resumed_at_ms INTEGER,
        terminal_outcome TEXT CHECK (terminal_outcome IN ('resumed', 'escalated')),
        FOREIGN KEY(run_id) REFERENCES runs(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS recovery_records_one_active
        ON recovery_records(run_id) WHERE resumed_at_ms IS NULL;
      CREATE TABLE IF NOT EXISTS feature_finalizations (
        run_id TEXT PRIMARY KEY,
        feature_id TEXT NOT NULL,
        epic_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('prepared', 'finalizing', 'closed')),
        report_digest TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        closed_at_ms INTEGER,
        FOREIGN KEY(run_id) REFERENCES runs(id)
      );
      CREATE TABLE IF NOT EXISTS workflow_cancellations (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL UNIQUE,
        requested_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        requested_at_ms INTEGER NOT NULL,
        stop_deadline_ms INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('requested', 'cancelled', 'escalated')),
        owned_work_stopped INTEGER NOT NULL CHECK (owned_work_stopped IN (0, 1)),
        incomplete_cleanup_json TEXT NOT NULL,
        retained_evidence_json TEXT NOT NULL,
        completed_at_ms INTEGER,
        FOREIGN KEY(run_id) REFERENCES runs(id)
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
        workspace_id TEXT,
        task_id TEXT,
        operation_id TEXT REFERENCES delivery_operations(id),
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
      CREATE TABLE IF NOT EXISTS secure_evidence_blobs (
        digest TEXT PRIMARY KEY,
        content BLOB NOT NULL,
        size_bytes INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS secure_evidence (
        digest TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        media_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        kind TEXT NOT NULL,
        producer TEXT NOT NULL,
        producer_role TEXT NOT NULL,
        contract_version INTEGER NOT NULL,
        policy_digest TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        redaction_count INTEGER NOT NULL,
        retention_class TEXT NOT NULL CHECK(retention_class IN ('raw', 'summary')),
        retention_until_ms INTEGER NOT NULL,
        accepted_at_ms INTEGER,
        deleted_at_ms INTEGER,
        tombstone_digest TEXT,
        created_at_ms INTEGER NOT NULL,
        PRIMARY KEY(digest, run_id, task_id)
      );
      CREATE INDEX IF NOT EXISTS secure_evidence_digest_live
        ON secure_evidence(digest, deleted_at_ms);
      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        evaluator_role TEXT NOT NULL CHECK(evaluator_role IN ('qa_evaluator', 'feature_evaluator')),
        result_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS evaluations_run_task_head
        ON evaluations(run_id, task_id, head_sha);
      CREATE TABLE IF NOT EXISTS evaluation_evidence_acceptances (
        evaluation_id TEXT NOT NULL REFERENCES evaluations(id),
        digest TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        accepted_at_ms INTEGER NOT NULL,
        PRIMARY KEY(evaluation_id, digest, run_id, task_id),
        FOREIGN KEY(digest, run_id, task_id) REFERENCES secure_evidence(digest, run_id, task_id)
      );
      CREATE TABLE IF NOT EXISTS repair_child_intents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        sequence INTEGER NOT NULL,
        finding_digest TEXT NOT NULL,
        chain_tip_task_id TEXT NOT NULL,
        request_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared', 'committed', 'escalated')),
        owner_id TEXT NOT NULL,
        workspace_lease_epoch INTEGER NOT NULL,
        run_lease_epoch INTEGER NOT NULL,
        task_lease_epoch INTEGER NOT NULL,
        result_json TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        UNIQUE(run_id, sequence),
        UNIQUE(run_id, finding_digest)
      );
      CREATE TABLE IF NOT EXISTS repair_child_budget_reservations (
        child_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        finding_id TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS repair_approved_heads (
        intent_id TEXT PRIMARY KEY REFERENCES repair_child_intents(id),
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        ref TEXT NOT NULL,
        base_sha TEXT NOT NULL,
        current_sha TEXT NOT NULL,
        published_sha TEXT,
        updated_at_ms INTEGER NOT NULL,
        UNIQUE(workspace_id, run_id, task_id, ref)
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
      CREATE TABLE IF NOT EXISTS repair_dispatches (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        finding_id TEXT NOT NULL,
        task_attempt INTEGER NOT NULL,
        finding_attempt INTEGER NOT NULL,
        owner_role TEXT NOT NULL,
        finding_digest TEXT NOT NULL,
        failure_head_sha TEXT NOT NULL,
        change_digest TEXT NOT NULL,
        change_evidence_min_at_ms INTEGER,
        change_evidence_at_ms INTEGER,
        change_head_sha TEXT,
        packet_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('dispatched', 'accepted', 'cancelled')),
        result_json TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        UNIQUE(run_id, finding_id, finding_attempt)
      );
      CREATE TABLE IF NOT EXISTS repair_escalations (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id),
        scope TEXT NOT NULL CHECK(scope IN ('task', 'finding')),
        scope_id TEXT NOT NULL,
        finding_id TEXT NOT NULL,
        finding_digest TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        UNIQUE(run_id, scope, scope_id)
      );
      CREATE TABLE IF NOT EXISTS delivery_operations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        request_digest TEXT NOT NULL UNIQUE,
        request_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared', 'committed', 'escalated')),
        owner_id TEXT NOT NULL,
        workspace_lease_epoch INTEGER NOT NULL,
        run_lease_epoch INTEGER NOT NULL,
        task_lease_epoch INTEGER NOT NULL,
        result_json TEXT,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS delivery_operations_run_status
        ON delivery_operations(run_id, status, created_at_ms);
      CREATE TABLE IF NOT EXISTS delivery_approved_heads (
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        ref TEXT NOT NULL,
        base_sha TEXT NOT NULL,
        current_sha TEXT NOT NULL,
        published_sha TEXT,
        operation_id TEXT NOT NULL REFERENCES delivery_operations(id),
        updated_at_ms INTEGER NOT NULL,
        PRIMARY KEY(workspace_id, run_id, task_id, ref)
      );
      CREATE TABLE IF NOT EXISTS delivery_wait_escalations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL,
        check_id TEXT NOT NULL,
        event_identity TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        UNIQUE(run_id, check_id)
      );
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (1, unixepoch() * 1000);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (2, unixepoch() * 1000);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (3, unixepoch() * 1000);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (8, unixepoch() * 1000);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (9, unixepoch() * 1000);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (10, unixepoch() * 1000);
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
    const waitColumns = this.#database.prepare('PRAGMA table_info(waits)').all() as Array<{
      name: string;
    }>;
    if (!waitColumns.some((column) => column.name === 'workspace_id')) {
      this.#database.exec('ALTER TABLE waits ADD COLUMN workspace_id TEXT');
    }
    if (!waitColumns.some((column) => column.name === 'task_id')) {
      this.#database.exec('ALTER TABLE waits ADD COLUMN task_id TEXT');
    }
    if (!waitColumns.some((column) => column.name === 'operation_id')) {
      this.#database.exec(
        'ALTER TABLE waits ADD COLUMN operation_id TEXT REFERENCES delivery_operations(id)',
      );
    }
    const recoveryColumns = this.#database
      .prepare('PRAGMA table_info(recovery_records)')
      .all() as Array<{ name: string }>;
    if (!recoveryColumns.some((column) => column.name === 'terminal_outcome')) {
      this.#database.exec(
        `ALTER TABLE recovery_records ADD COLUMN terminal_outcome TEXT
         CHECK (terminal_outcome IN ('resumed', 'escalated'))`,
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
    const secureEvidenceColumns = this.#database
      .prepare('PRAGMA table_info(secure_evidence)')
      .all() as Array<{ name: string }>;
    if (!secureEvidenceColumns.some((column) => column.name === 'retention_class')) {
      this.#database.exec(
        `ALTER TABLE secure_evidence ADD COLUMN retention_class TEXT NOT NULL DEFAULT 'raw'`,
      );
    }
    const repairHeadColumns = this.#database
      .prepare('PRAGMA table_info(repair_approved_heads)')
      .all() as Array<{ name: string }>;
    if (!repairHeadColumns.some((column) => column.name === 'published_sha')) {
      this.#database.exec('ALTER TABLE repair_approved_heads ADD COLUMN published_sha TEXT');
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

function secureEvidenceRecordFromRow(row: Record<string, unknown>): SecureEvidenceRecord {
  return {
    digest: String(row.digest),
    workspaceId: String(row.workspace_id),
    runId: String(row.run_id),
    taskId: String(row.task_id),
    mediaType: String(row.media_type),
    sizeBytes: Number(row.size_bytes),
    kind: String(row.kind),
    producer: String(row.producer),
    producerRole: String(row.producer_role),
    contractVersion: Number(row.contract_version),
    policyDigest: String(row.policy_digest),
    headSha: String(row.head_sha),
    redactionCount: Number(row.redaction_count),
    retentionClass: row.retention_class === 'summary' ? 'summary' : 'raw',
    retentionUntilMs: Number(row.retention_until_ms),
    acceptedAtMs: row.accepted_at_ms === null ? null : Number(row.accepted_at_ms),
    deletedAtMs: row.deleted_at_ms === null ? null : Number(row.deleted_at_ms),
    tombstoneDigest: row.tombstone_digest === null ? null : String(row.tombstone_digest),
    createdAtMs: Number(row.created_at_ms),
  };
}
