import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';

import { z } from 'zod';

import {
  EXECUTION_CONTRACT_VERSION,
  evidenceReferenceSchema,
  executionContractSchema,
  findingSchema,
  relativePathSchema,
  workflowOperationSchema,
  workflowRoleSchema,
  type EvidenceReference,
  type ExecutionContract,
  type WorkflowOperation,
  type WorkflowRole,
} from './contracts.js';
import type { ExternalObservation } from './reconciliation.js';
import { OfficialBeadsDoltPort } from './reconciliation.js';
import { LocalGitDeliveryPort } from './gitDeliveryPort.js';
import { isProductionBeadsPort } from './beadsPortCapability.js';
import {
  isProductionRepairChildPort,
  registerProductionRepairChildPort,
} from './repairChildPortCapability.js';
import {
  workflowEvaluationMutationCapability,
  type EvaluationRecord,
  type RepairChildIntentRecord,
  type WorkflowStore,
} from './storage.js';

const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const shaSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const remainingRetryBudgetSchema = z
  .object({
    implementationAttempts: z.number().int().nonnegative(),
    findingAttempts: z.number().int().nonnegative(),
    infrastructureAttempts: z.number().int().nonnegative(),
    waitDeadlineSeconds: z.number().int().positive(),
  })
  .strict();

const criterionEvaluationSchema = z
  .object({
    criterion: z.string().min(1),
    status: z.enum(['passed', 'failed']),
    summary: z.string().min(1),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

export const featureEvaluationRequestSchema = z
  .object({
    workspaceId: digestSchema,
    runId: identifierSchema,
    taskId: identifierSchema,
    headSha: shaSchema,
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digestSchema,
    evaluatorRole: z.enum(['qa_evaluator', 'feature_evaluator']),
    summary: z.string().min(1),
    criteria: z.array(criterionEvaluationSchema).min(1),
  })
  .strict();

const persistedEvaluationResultSchema = featureEvaluationRequestSchema
  .extend({
    verdict: z.enum(['passed', 'needs_repair']),
    failedCriteria: z.array(z.string()),
  })
  .strict();

export type FeatureEvaluationRequest = z.infer<typeof featureEvaluationRequestSchema>;

export interface FeatureEvaluationResult {
  id: string;
  verdict: 'passed' | 'needs_repair';
  failedCriteria: string[];
  record: EvaluationRecord;
}

const repairChildRequestSchema = z
  .object({
    workspaceId: digestSchema,
    runId: identifierSchema,
    featureId: identifierSchema,
    id: identifierSchema,
    sequence: z.number().int().positive(),
    parentEpicId: identifierSchema,
    dependsOn: identifierSchema,
    chainTipTaskId: identifierSchema,
    branchParent: z.string().regex(/^task\/[A-Za-z0-9._-]+$/u),
    branchParentSha: shaSchema,
    evaluationId: digestSchema,
    finding: findingSchema,
    findingDigest: digestSchema,
    remainingRetryBudget: remainingRetryBudgetSchema,
    assignedRole: workflowRoleSchema,
    allowedPaths: z.array(relativePathSchema),
    allowedOperations: z.array(workflowOperationSchema),
    authorityExpanded: z.literal(false),
    actorRole: z.literal('workflow_orchestrator'),
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digestSchema,
  })
  .strict();

export type RepairChildRequest = z.infer<typeof repairChildRequestSchema>;

export interface RepairChildFence {
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
}

export interface RepairChildMutationPort {
  observe(request: RepairChildRequest): Promise<ExternalObservation>;
  mutate(request: RepairChildRequest): Promise<unknown>;
}

export interface OfficialRepairChildSnapshot {
  id: string;
  issueType: 'task';
  status: 'open';
  specId: string;
  parentEpicId: string;
  blockingDependencies: string[];
  assignedRole: WorkflowRole;
  allowedPaths: string[];
  allowedOperations: WorkflowOperation[];
  findingDigest: string;
  remainingRetryBudget: ExecutionContract['retryPolicy'];
}

const officialRepairChildSnapshotSchema = z
  .object({
    id: identifierSchema,
    issueType: z.literal('task'),
    status: z.literal('open'),
    specId: z.string().min(1),
    parentEpicId: identifierSchema,
    blockingDependencies: z.array(identifierSchema),
    assignedRole: workflowRoleSchema,
    allowedPaths: z.array(relativePathSchema),
    allowedOperations: z.array(workflowOperationSchema),
    findingDigest: digestSchema,
    remainingRetryBudget: remainingRetryBudgetSchema,
  })
  .strict();

export interface OfficialRepairChildClient {
  readChild(workspaceRoot: string, childId: string): Promise<OfficialRepairChildSnapshot | null>;
  createChild(
    workspaceRoot: string,
    request: RepairChildRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  readTaskRef(workspaceRoot: string, ref: string): Promise<string | null>;
  createTaskRefCas(input: {
    workspaceRoot: string;
    ref: string;
    expectedOldSha: null;
    newSha: string;
    idempotencyKey: string;
  }): Promise<unknown>;
}

export type RepairChildFaultBoundary =
  | 'after_prepare'
  | 'before_mutation'
  | 'after_mutation'
  | 'before_commit';

export type RepairChildFaultInjector = (
  boundary: RepairChildFaultBoundary,
  intent: RepairChildIntentRecord,
) => void;

function durableJson(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('broker result must be JSON-compatible');
  return JSON.parse(serialized) as unknown;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function allowedEvidenceRoles(role: FeatureEvaluationRequest['evaluatorRole']): WorkflowRole[] {
  return role === 'qa_evaluator'
    ? ['test_runner', 'qa_evaluator']
    : ['test_runner', 'qa_evaluator', 'code_reviewer', 'feature_evaluator'];
}

function isWithin(path: string, allowed: string): boolean {
  return path === allowed || path.startsWith(`${allowed}/`);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function expectedChildSnapshot(request: RepairChildRequest): OfficialRepairChildSnapshot {
  return {
    id: request.id,
    issueType: 'task',
    status: 'open',
    specId: `docs/tasks/${request.id}.md`,
    parentEpicId: request.parentEpicId,
    blockingDependencies: [request.dependsOn],
    assignedRole: request.assignedRole,
    allowedPaths: request.allowedPaths,
    allowedOperations: request.allowedOperations,
    findingDigest: request.findingDigest,
    remainingRetryBudget: request.remainingRetryBudget,
  };
}

function childMatches(
  actual: OfficialRepairChildSnapshot,
  expected: OfficialRepairChildSnapshot,
): boolean {
  return (
    actual.id === expected.id &&
    actual.issueType === expected.issueType &&
    actual.status === expected.status &&
    actual.specId === expected.specId &&
    actual.parentEpicId === expected.parentEpicId &&
    actual.assignedRole === expected.assignedRole &&
    actual.findingDigest === expected.findingDigest &&
    JSON.stringify(actual.remainingRetryBudget) === JSON.stringify(expected.remainingRetryBudget) &&
    sameSet(actual.blockingDependencies, expected.blockingDependencies) &&
    sameSet(actual.allowedPaths, expected.allowedPaths) &&
    sameSet(actual.allowedOperations, expected.allowedOperations)
  );
}

export class OfficialRepairChildPort implements RepairChildMutationPort {
  readonly workspaceRoot: string;
  readonly observe: (request: RepairChildRequest) => Promise<ExternalObservation>;
  readonly mutate: (request: RepairChildRequest) => Promise<unknown>;

  private constructor(workspaceRoot: string, client: OfficialRepairChildClient) {
    this.workspaceRoot = realpathSync(workspaceRoot);
    const readChild = client.readChild.bind(client);
    const createChild = client.createChild.bind(client);
    const readTaskRef = client.readTaskRef.bind(client);
    const createTaskRefCas = client.createTaskRefCas.bind(client);
    this.observe = async (request) => {
      const [child, refSha] = await Promise.all([
        readChild(this.workspaceRoot, request.id),
        readTaskRef(this.workspaceRoot, `refs/heads/task/${request.id}`),
      ]);
      const expected = expectedChildSnapshot(request);
      if (
        (child !== null && !childMatches(child, expected)) ||
        (refSha !== null && refSha !== request.branchParentSha)
      ) {
        return { kind: 'conflict', result: { child, refSha } };
      }
      if (child !== null && refSha === request.branchParentSha) {
        return { kind: 'expected', result: { child, refSha } };
      }
      return { kind: 'unchanged', result: { child, refSha } };
    };
    this.mutate = async (request) => {
      const key = digest(request);
      const child = await readChild(this.workspaceRoot, request.id);
      if (child === null) {
        await createChild(this.workspaceRoot, request, `${key}:beads`);
      } else if (!childMatches(child, expectedChildSnapshot(request))) {
        throw new Error('repair child changed before Beads mutation');
      }
      const ref = `refs/heads/task/${request.id}`;
      const refSha = await readTaskRef(this.workspaceRoot, ref);
      if (refSha === null) {
        await createTaskRefCas({
          workspaceRoot: this.workspaceRoot,
          ref,
          expectedOldSha: null,
          newSha: request.branchParentSha,
          idempotencyKey: `${key}:git`,
        });
      } else if (refSha !== request.branchParentSha) {
        throw new Error('repair child ref changed before Git mutation');
      }
      return { childId: request.id, ref, refSha: request.branchParentSha };
    };
  }

  static create(input: {
    workspaceRoot: string;
    beads: OfficialBeadsDoltPort;
    git: LocalGitDeliveryPort;
  }): OfficialRepairChildPort {
    const canonicalWorkspace = realpathSync(input.workspaceRoot);
    if (
      input.beads.workspaceRoot !== canonicalWorkspace ||
      input.git.workspaceRoot !== canonicalWorkspace ||
      !isProductionBeadsPort(input.beads)
    ) {
      throw new Error('repair-child adapters differ from the canonical workspace');
    }
    const readUntrustedChild = input.beads.readRepairChild.bind(input.beads);
    const createChild = input.beads.createRepairChild.bind(input.beads);
    const readTaskRef = input.git.readLocalTaskRef.bind(input.git);
    const createTaskRefCas = input.git.createLocalTaskRefCas.bind(input.git);
    return registerProductionRepairChildPort(
      new OfficialRepairChildPort(canonicalWorkspace, {
        readChild: async (_workspaceRoot, childId) =>
          officialRepairChildSnapshotSchema.nullable().parse(await readUntrustedChild(childId)),
        createChild: (_workspaceRoot, request, idempotencyKey) =>
          createChild(request, idempotencyKey),
        readTaskRef: async (_workspaceRoot, ref) => readTaskRef(ref),
        createTaskRefCas: async ({ ref, expectedOldSha, newSha }) =>
          createTaskRefCas(ref, expectedOldSha, newSha),
      }),
    );
  }

  static createForTest(
    workspaceRoot: string,
    client: OfficialRepairChildClient,
  ): OfficialRepairChildPort {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test repair-child client is unavailable outside the test runtime');
    }
    return registerProductionRepairChildPort(new OfficialRepairChildPort(workspaceRoot, client));
  }
}

function assertExactCriteria(
  contract: ExecutionContract,
  criteria: FeatureEvaluationRequest['criteria'],
): void {
  const actual = criteria.map((item) => item.criterion);
  if (
    new Set(actual).size !== actual.length ||
    actual.length !== contract.acceptanceCriteria.length ||
    contract.acceptanceCriteria.some((criterion) => !actual.includes(criterion))
  ) {
    throw new Error('evaluation must map every approved acceptance criterion exactly once');
  }
}

export class ContractEvaluator {
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;

  constructor(input: { store: WorkflowStore; contract: ExecutionContract }) {
    this.#store = input.store;
    this.#contract = executionContractSchema.parse(input.contract);
  }

  evaluate(input: unknown, createdAtMs = Date.now()): FeatureEvaluationResult {
    const request = featureEvaluationRequestSchema.parse(input);
    this.#store.assertRunUsesContract(request.runId, this.#contract);
    if (
      request.workspaceId !== this.#contract.workspaceId ||
      request.contractVersion !== this.#contract.contractVersion ||
      request.policyDigest !== this.#contract.policyDigest ||
      this.#store.getAuthorizedRunTask(
        request.runId,
        request.taskId,
        workflowEvaluationMutationCapability,
      ) === undefined
    ) {
      throw new Error('evaluation changes its approved contract binding');
    }
    assertExactCriteria(this.#contract, request.criteria);
    this.#store.assertApprovedTaskHead(
      {
        workspaceId: request.workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        headSha: request.headSha,
      },
      workflowEvaluationMutationCapability,
    );
    const roles = allowedEvidenceRoles(request.evaluatorRole);
    for (const criterion of request.criteria) {
      for (const reference of criterion.evidence) {
        const secure = this.#store.getSecureEvidence(
          reference.digest,
          request.runId,
          request.taskId,
        );
        if (
          secure === undefined ||
          secure.deletedAtMs !== null ||
          secure.headSha !== request.headSha ||
          secure.mediaType !== reference.mediaType ||
          secure.sizeBytes !== reference.sizeBytes ||
          secure.kind !== reference.kind ||
          !roles.includes(secure.producerRole as WorkflowRole)
        ) {
          throw new Error(
            'evaluation evidence is not secure and bound to the exact evaluated head',
          );
        }
      }
    }
    const id = digest(request);
    const verdict = request.criteria.some((criterion) => criterion.status === 'failed')
      ? 'needs_repair'
      : 'passed';
    const result = {
      ...request,
      verdict,
      failedCriteria: request.criteria
        .filter((criterion) => criterion.status === 'failed')
        .map((criterion) => criterion.criterion),
    };
    const evidenceDigests = request.criteria.flatMap((criterion) =>
      criterion.evidence.map((reference) => reference.digest),
    );
    const record = this.#store.recordEvaluationWithEvidence(
      {
        id,
        workspaceId: request.workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        headSha: request.headSha,
        evaluatorRole: request.evaluatorRole,
        result,
        createdAtMs,
      },
      evidenceDigests,
      workflowEvaluationMutationCapability,
    );
    return { id, verdict, failedCriteria: result.failedCriteria, record };
  }
}

export class DurableRepairChildBroker {
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;
  readonly #port: RepairChildMutationPort;
  readonly #fault: RepairChildFaultInjector;
  readonly #clock: () => number;

  private constructor(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: RepairChildMutationPort;
    clock?: () => number;
    fault?: RepairChildFaultInjector;
  }) {
    this.#store = input.store;
    this.#contract = executionContractSchema.parse(input.contract);
    if (
      this.#contract.repairTaskPolicy.idPattern !== `${this.#contract.featureId}.repair.<sequence>`
    ) {
      throw new Error('repair-child id pattern is not the canonical feature sequence');
    }
    this.#port = input.port;
    this.#clock = input.clock ?? Date.now;
    this.#fault = input.fault ?? (() => undefined);
  }

  static createForTest(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: RepairChildMutationPort;
    clock?: () => number;
    fault?: RepairChildFaultInjector;
  }): DurableRepairChildBroker {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test repair-child port is unavailable outside the test runtime');
    }
    return new DurableRepairChildBroker(input);
  }

  static create(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: OfficialRepairChildPort;
    workspaceRoot: string;
  }): DurableRepairChildBroker {
    const canonicalWorkspace = realpathSync(input.workspaceRoot);
    const workspaceId = `sha256:${createHash('sha256').update(canonicalWorkspace).digest('hex')}`;
    if (
      workspaceId !== input.contract.workspaceId ||
      input.port.workspaceRoot !== canonicalWorkspace ||
      !isProductionRepairChildPort(input.port)
    ) {
      throw new Error('repair-child port differs from the verified workspace');
    }
    return new DurableRepairChildBroker({ ...input, clock: Date.now });
  }

  async execute(input: unknown, fence: RepairChildFence): Promise<RepairChildIntentRecord> {
    const request = repairChildRequestSchema.parse(input);
    this.#store.assertRunUsesContract(request.runId, this.#contract);
    const replay = this.#store.getRepairChildIntent(request.id);
    if (replay !== undefined && JSON.stringify(replay.request) !== JSON.stringify(request)) {
      throw new Error('repair-child replay changes its request');
    }
    if (replay?.status === 'committed' || replay?.status === 'escalated') return replay;
    this.#assertRequest(request);
    const expectedSequence = this.#store.countRepairChildIntents(request.runId) + 1;
    if (replay === undefined && request.sequence !== expectedSequence) {
      throw new Error('repair-child sequence is not the next append-only sequence');
    }
    let intent =
      replay ??
      this.#store.prepareRepairChildIntent(
        {
          id: request.id,
          workspaceId: request.workspaceId,
          runId: request.runId,
          sequence: request.sequence,
          findingDigest: request.findingDigest,
          chainTipTaskId: request.chainTipTaskId,
          request,
          ...fence,
          createdAtMs: this.#clock(),
        },
        workflowEvaluationMutationCapability,
      );
    if (intent.status !== 'prepared') return intent;
    if (
      intent.ownerId !== fence.ownerId ||
      intent.workspaceLeaseEpoch !== fence.workspaceLeaseEpoch ||
      intent.runLeaseEpoch !== fence.runLeaseEpoch ||
      intent.taskLeaseEpoch !== fence.taskLeaseEpoch
    ) {
      intent = this.#store.adoptPreparedRepairChildIntent(
        { id: intent.id, ...fence, nowMs: this.#clock() },
        workflowEvaluationMutationCapability,
      );
    }
    this.#assertFence(intent, fence);
    this.#fault('after_prepare', intent);
    let observation = await this.#port.observe(request);
    if (observation.kind === 'conflict') {
      return this.#finalize(intent, fence, 'escalated', observation.result);
    }
    if (observation.kind === 'unchanged') {
      this.#assertRequest(request);
      this.#assertFence(intent, fence);
      if (this.#store.countRepairChildIntents(request.runId) !== request.sequence) {
        throw new Error('repair-child append-only position changed before mutation');
      }
      this.#fault('before_mutation', intent);
      await this.#port.mutate(request);
      this.#fault('after_mutation', intent);
    }
    observation = await this.#port.observe(request);
    if (observation.kind === 'conflict') {
      return this.#finalize(intent, fence, 'escalated', observation.result);
    }
    if (observation.kind !== 'expected') {
      throw new Error('repair-child mutation result remains ambiguous');
    }
    this.#fault('before_commit', intent);
    intent = this.#finalize(intent, fence, 'committed', durableJson(observation.result));
    return intent;
  }

  #assertFence(intent: RepairChildIntentRecord, fence: RepairChildFence): void {
    this.#store.assertRepairChildIntentFence(
      { id: intent.id, ...fence, nowMs: this.#clock() },
      workflowEvaluationMutationCapability,
    );
  }

  #finalize(
    intent: RepairChildIntentRecord,
    fence: RepairChildFence,
    status: 'committed' | 'escalated',
    result: unknown,
  ): RepairChildIntentRecord {
    return this.#store.finalizeRepairChildIntent(
      { id: intent.id, status, result: durableJson(result), ...fence, updatedAtMs: this.#clock() },
      workflowEvaluationMutationCapability,
    );
  }

  #assertRequest(request: RepairChildRequest): void {
    if (
      request.workspaceId !== this.#contract.workspaceId ||
      request.featureId !== this.#contract.featureId ||
      request.parentEpicId !== this.#contract.featureId ||
      request.contractVersion !== this.#contract.contractVersion ||
      request.policyDigest !== this.#contract.policyDigest
    ) {
      throw new Error('repair child changes its approved contract binding');
    }
    const expectedId = this.#contract.repairTaskPolicy.idPattern.replace(
      '<sequence>',
      String(request.sequence),
    );
    if (
      request.id !== expectedId ||
      request.sequence > this.#contract.repairTaskPolicy.maxChildren
    ) {
      throw new Error('repair child id or count exceeds the contract');
    }
    const expectedTip =
      request.sequence === 1
        ? this.#contract.tasks.at(-1)?.id
        : this.#contract.repairTaskPolicy.idPattern.replace(
            '<sequence>',
            String(request.sequence - 1),
          );
    if (
      expectedTip === undefined ||
      request.chainTipTaskId !== expectedTip ||
      request.dependsOn !== expectedTip ||
      request.branchParent !== `task/${expectedTip}`
    ) {
      throw new Error('repair child breaks linear branch or dependency semantics');
    }
    this.#store.assertApprovedTaskHead(
      {
        workspaceId: request.workspaceId,
        runId: request.runId,
        taskId: expectedTip,
        headSha: request.branchParentSha,
      },
      workflowEvaluationMutationCapability,
    );
    if (request.sequence > 1) {
      const predecessor = this.#store.getRepairChildIntent(expectedTip);
      if (predecessor?.status !== 'committed') {
        throw new Error('repair child predecessor is not committed');
      }
      this.#store.assertAcceptedRepairPredecessor(
        {
          workspaceId: request.workspaceId,
          runId: request.runId,
          taskId: expectedTip,
          headSha: request.branchParentSha,
        },
        workflowEvaluationMutationCapability,
      );
    }
    if (request.finding.acceptanceCriterion === undefined) {
      throw new Error('repair finding must map to an acceptance criterion');
    }
    if (!this.#contract.acceptanceCriteria.includes(request.finding.acceptanceCriterion)) {
      throw new Error('repair finding references an unapproved acceptance criterion');
    }
    if (request.findingDigest !== digest(request.finding)) {
      throw new Error('repair finding differs from its immutable digest');
    }
    const expectedRemaining = this.#store.remainingRepairBudgetForChild(
      {
        runId: request.runId,
        featureId: request.featureId,
        childId: request.id,
        findingId: request.finding.id,
        policy: this.#contract.retryPolicy,
      },
      workflowEvaluationMutationCapability,
    );
    if (JSON.stringify(request.remainingRetryBudget) !== JSON.stringify(expectedRemaining)) {
      throw new Error('repair retry budget is not the durable remaining feature budget');
    }
    const evaluation = this.#store.getEvaluation(request.evaluationId);
    const result = persistedEvaluationResultSchema.safeParse(evaluation?.result);
    if (
      evaluation === undefined ||
      !result.success ||
      evaluation.workspaceId !== request.workspaceId ||
      evaluation.runId !== request.runId ||
      evaluation.taskId !== request.chainTipTaskId ||
      evaluation.headSha !== request.branchParentSha ||
      result.data.verdict !== 'needs_repair' ||
      !result.data.failedCriteria.includes(request.finding.acceptanceCriterion)
    ) {
      throw new Error('repair child lacks an authoritative failed exact-head evaluation');
    }
    const failedCriterion = result.data.criteria.find(
      (criterion) =>
        criterion.criterion === request.finding.acceptanceCriterion &&
        criterion.status === 'failed',
    );
    const evaluationEvidence = new Set(
      failedCriterion?.evidence.map((reference) => JSON.stringify(reference)) ?? [],
    );
    if (
      failedCriterion === undefined ||
      request.finding.evidence.some(
        (reference) => !evaluationEvidence.has(JSON.stringify(reference)),
      )
    ) {
      throw new Error('repair finding evidence is not from the failed evaluation criterion');
    }
    if (!this.#contract.repairTaskPolicy.allowedRoles.includes(request.assignedRole)) {
      throw new Error('repair role exceeds the contract');
    }
    if (
      request.allowedPaths.some(
        (path) =>
          !this.#contract.repairTaskPolicy.allowedPaths.some((allowed) =>
            isWithin(path, allowed),
          ) || !this.#contract.constraints.allowedPaths.some((allowed) => isWithin(path, allowed)),
      )
    ) {
      throw new Error('repair paths exceed the contract');
    }
    const actions = new Set<WorkflowOperation>(this.#contract.authority.allowedActions);
    if (request.allowedOperations.some((operation) => !actions.has(operation))) {
      throw new Error('repair operations exceed the contract');
    }
  }
}

export function deriveEvaluationDigest(value: unknown): string {
  return digest(value);
}

export function collectEvaluationEvidence(request: FeatureEvaluationRequest): EvidenceReference[] {
  return request.criteria.flatMap((criterion) => criterion.evidence);
}
