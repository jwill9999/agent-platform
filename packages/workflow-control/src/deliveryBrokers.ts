import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';

import { z } from 'zod';

import {
  EXECUTION_CONTRACT_VERSION,
  executionContractSchema,
  relativePathSchema,
  type ExecutionContract,
  type WorkflowOperation,
} from './contracts.js';
import type { ExternalObservation } from './reconciliation.js';
import { isProductionDeliveryPort } from './deliveryPortCapability.js';
import type { GovernedJournalRecord, GovernedOperationJournal } from './governedOperations.js';
import {
  workflowDeliveryMutationCapability,
  type AuthorizedRunTask,
  type DeliveryOperationRecord,
  type PipelineWaitEscalationRecord,
  type WorkflowStore,
} from './storage.js';

const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const shaSchema = z.string().regex(/^[a-f0-9]{40,64}$/u);
const taskRefSchema = z.string().regex(/^refs\/heads\/task\/[A-Za-z0-9._-]+$/u);
const repositorySchema = z.string().regex(/^[^/\s]+\/[^/\s]+$/u);

const bindingSchema = z
  .object({
    workspaceId: digestSchema,
    runId: identifierSchema,
    taskId: identifierSchema,
    repository: repositorySchema,
    actorRole: z.literal('workflow_orchestrator'),
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digestSchema,
  })
  .strict();

const gitBindingShape = bindingSchema.shape;

export const createTaskRefRequestSchema = z
  .object({
    ...gitBindingShape,
    kind: z.literal('git.create_ref'),
    ref: taskRefSchema,
    parentRef: z.string().min(1),
    parentSha: shaSchema,
  })
  .strict();

export const exactTreeCommitRequestSchema = z
  .object({
    ...gitBindingShape,
    kind: z.literal('git.commit'),
    ref: taskRefSchema,
    parentSha: shaSchema,
    treeSha: shaSchema,
    diffDigest: digestSchema,
    changedFiles: z.array(relativePathSchema).min(1),
    message: z.string().min(1).max(500),
    authorName: z.string().min(1).max(200),
    authorEmail: z.string().email(),
    authoredAtUnix: z.number().int().nonnegative(),
  })
  .strict();

export const casPushRequestSchema = z
  .object({
    ...gitBindingShape,
    kind: z.literal('git.push'),
    ref: taskRefSchema,
    expectedRemoteSha: shaSchema.nullable(),
    newSha: shaSchema,
  })
  .strict();

export const pullRequestMutationSchema = z
  .object({
    ...gitBindingShape,
    kind: z.literal('github.pr'),
    headRef: z.string().regex(/^task\/[A-Za-z0-9._-]+$/u),
    headSha: shaSchema,
    base: z.string().min(1),
    title: z.string().min(1).max(256),
    body: z.string().max(20_000),
    bodyDigest: digestSchema,
  })
  .strict();

export const githubChecksRequestSchema = z
  .object({
    ...gitBindingShape,
    kind: z.literal('github.checks'),
    pullRequestNumber: z.number().int().positive(),
    headSha: shaSchema,
    base: z.string().min(1),
    requiredChecks: z.array(z.string().min(1)),
    protectionDigest: digestSchema,
    pollAttempt: z.number().int().nonnegative(),
  })
  .strict();

export const githubMergeRequestSchema = z
  .object({
    ...gitBindingShape,
    kind: z.literal('github.merge'),
    pullRequestNumber: z.number().int().positive(),
    headSha: shaSchema,
    base: z.string().min(1),
    requiredChecks: z.array(z.string().min(1)),
    protectionDigest: digestSchema,
    reviewDecision: z.literal('approved'),
    mergeMethod: z.enum(['merge', 'squash', 'rebase']),
    adminBypass: z.literal(false),
  })
  .strict();

export const deliveryRequestSchema = z
  .discriminatedUnion('kind', [
    createTaskRefRequestSchema,
    exactTreeCommitRequestSchema,
    casPushRequestSchema,
    pullRequestMutationSchema,
    githubChecksRequestSchema,
    githubMergeRequestSchema,
  ])
  .superRefine((request, context) => {
    if (
      'changedFiles' in request &&
      new Set(request.changedFiles).size !== request.changedFiles.length
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'changed files must be unique' });
    }
    if (
      'requiredChecks' in request &&
      new Set(request.requiredChecks).size !== request.requiredChecks.length
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'required checks must be unique' });
    }
  });

export type DeliveryRequest = z.infer<typeof deliveryRequestSchema>;

export interface DeliveryFence {
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
}

export interface DeliveryMutationPort {
  observe(request: DeliveryRequest): Promise<ExternalObservation>;
  mutate(
    request: DeliveryRequest,
    verifiedMergePrecondition?: {
      reviewEventIdentity: string;
      verifiedObservationDigest: string;
    },
  ): Promise<unknown>;
}

export interface ProductionDeliveryMutationPort extends DeliveryMutationPort {
  readonly workspaceRoot: string;
  readonly repository: string;
}

export interface DeliveryBrokerPolicy {
  authorName: string;
  authorEmail: string;
  approvedParentShas: Readonly<Record<string, string>>;
  approvedProtectionDigest: string;
}

export interface DeliveryReconciliationResult {
  operations: DeliveryOperationRecord[];
  errors: Array<{ operationId: string; message: string }>;
}

export type PipelineObservationDecision =
  | { kind: 'passed'; checkId: string }
  | { kind: 'failed'; checkId: string; failedChecks: string[] }
  | {
      kind: 'waiting';
      checkId: string;
      eventIdentity: string;
      nextPollAtMs: number;
      absoluteDeadlineMs: number;
      backoffCount: number;
    };

export type DeliveryFaultBoundary =
  | 'after_prepare'
  | 'after_verified_observation'
  | 'before_mutation'
  | 'after_mutation'
  | 'before_commit'
  | 'after_commit'
  | 'after_adoption'
  | 'after_replay_mutation';

export type DeliveryFaultInjector = (
  boundary: DeliveryFaultBoundary,
  operation: DeliveryOperationRecord,
) => void;

export function deriveDeliveryRequestDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function normalizeDurableResult(value: unknown): unknown {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('delivery port returned a non-JSON result');
  }
  if (serialized === undefined) throw new Error('delivery port returned a non-JSON result');
  return JSON.parse(serialized) as unknown;
}

function correspondingAuthority(kind: DeliveryRequest['kind']): WorkflowOperation {
  if (kind === 'git.commit' || kind === 'git.create_ref') return 'git.commit';
  if (kind === 'git.push') return 'git.push';
  if (kind === 'github.checks') return 'github.read';
  return 'github.deliver';
}

/** Binds the governed broker to the same SQLite delivery journal and lease checks as Git/GitHub. */
export function createWorkflowStoreGovernedJournal(
  store: WorkflowStore,
  clock: () => number = Date.now,
): GovernedOperationJournal {
  const asGoverned = (operation: DeliveryOperationRecord): GovernedJournalRecord => ({
    id: operation.id,
    requestDigest: operation.requestDigest,
    request: operation.request as GovernedJournalRecord['request'],
    status: operation.status,
    result: operation.result,
  });
  return {
    guard(id, fence, initiate) {
      return store.guardGovernedMutation(
        { id, ...fence, initiate, clock },
        workflowDeliveryMutationCapability,
      );
    },
    adopt(id, fence) {
      return asGoverned(
        store.adoptPreparedDeliveryOperation(
          { id, ...fence, nowMs: clock() },
          workflowDeliveryMutationCapability,
        ),
      );
    },
    prepare(record) {
      const request = record.request;
      return asGoverned(
        store.prepareDeliveryOperation(
          {
            id: record.id,
            workspaceId: request.workspaceId,
            runId: request.runId,
            taskId: request.taskId,
            kind: request.kind,
            actorRole: request.actorRole,
            requestDigest: record.requestDigest,
            request,
            contractVersion: request.contractVersion,
            policyDigest: request.policyDigest,
            ownerId: request.ownerId,
            workspaceLeaseEpoch: request.workspaceLeaseEpoch,
            runLeaseEpoch: request.runLeaseEpoch,
            taskLeaseEpoch: request.taskLeaseEpoch,
            nowMs: clock(),
          },
          workflowDeliveryMutationCapability,
        ),
      );
    },
    get(id) {
      const operation = store.getDeliveryOperation(id);
      return operation === undefined ? undefined : asGoverned(operation);
    },
    commit(id, _expectedStatus, result) {
      const operation = store.getDeliveryOperation(id);
      if (operation === undefined) throw new Error('governed operation not found');
      return asGoverned(
        store.commitDeliveryOperation(
          {
            id,
            ownerId: operation.ownerId,
            workspaceLeaseEpoch: operation.workspaceLeaseEpoch,
            runLeaseEpoch: operation.runLeaseEpoch,
            taskLeaseEpoch: operation.taskLeaseEpoch,
            result,
            assertExternalState: () => undefined,
            clock,
          },
          workflowDeliveryMutationCapability,
        ),
      );
    },
    escalate(id, _expectedStatus, result) {
      const operation = store.getDeliveryOperation(id);
      if (operation === undefined) throw new Error('governed operation not found');
      return asGoverned(
        store.escalateDeliveryOperation(
          {
            id,
            ownerId: operation.ownerId,
            workspaceLeaseEpoch: operation.workspaceLeaseEpoch,
            runLeaseEpoch: operation.runLeaseEpoch,
            taskLeaseEpoch: operation.taskLeaseEpoch,
            result,
            nowMs: clock(),
          },
          workflowDeliveryMutationCapability,
        ),
      );
    },
  };
}

function sameOrderedSet(actual: readonly string[], expected: readonly string[]): boolean {
  const sortedActual = [...actual].sort((left, right) => left.localeCompare(right));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right));
  return (
    actual.length === expected.length &&
    sortedActual.every((value, index) => value === sortedExpected[index])
  );
}

function assertRequestWithinContract(
  contract: ExecutionContract,
  request: DeliveryRequest,
  policy: DeliveryBrokerPolicy,
  authorizedTask?: AuthorizedRunTask,
): void {
  if (
    request.workspaceId !== contract.workspaceId ||
    request.contractVersion !== contract.contractVersion ||
    request.policyDigest !== contract.policyDigest ||
    request.repository !== contract.authority.github.repository
  ) {
    throw new Error('delivery request changes its approved contract binding');
  }
  const contractTask = contract.tasks.find((candidate) => candidate.id === request.taskId);
  const task = contractTask ?? authorizedTask;
  if (task === undefined) throw new Error('delivery request references an unknown task');
  const authority = correspondingAuthority(request.kind);
  if (
    !contract.authority.allowedActions.includes(authority) ||
    !task.allowedOperations.includes(authority)
  ) {
    throw new Error(`delivery request lacks ${authority} authority`);
  }
  const expectedRef = `refs/heads/task/${request.taskId}`;
  if ('ref' in request && request.ref !== expectedRef) {
    throw new Error('delivery request targets an unapproved task ref');
  }
  if (
    request.kind === 'git.create_ref' &&
    (contractTask === undefined || request.parentRef !== contractTask.branchParent)
  ) {
    throw new Error('task ref parent differs from the immutable contract');
  }
  if (
    request.kind === 'git.create_ref' &&
    request.parentSha !== policy.approvedParentShas[request.taskId]
  ) {
    throw new Error('task ref parent SHA differs from the broker-approved parent');
  }
  if (request.kind === 'git.commit') {
    if (request.authorName !== policy.authorName || request.authorEmail !== policy.authorEmail) {
      throw new Error('commit identity differs from the broker identity');
    }
    const escapedTask = request.taskId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (
      !new RegExp(`^${escapedTask} (feat|fix|test|docs|chore|refactor) .+`, 'u').test(
        request.message,
      )
    ) {
      throw new Error('commit message does not use the approved task format');
    }
    for (const path of request.changedFiles) {
      if (
        !task.allowedPaths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))
      ) {
        throw new Error(`commit changes path outside task authority: ${path}`);
      }
    }
  }
  if ('base' in request && request.base !== contract.authority.github.base) {
    throw new Error('GitHub request changes the approved base');
  }
  if ('headRef' in request && request.headRef !== expectedRef.slice('refs/heads/'.length)) {
    throw new Error('pull request changes the approved feature head ref');
  }
  if (
    request.kind === 'github.pr' &&
    `sha256:${createHash('sha256').update(request.body).digest('hex')}` !== request.bodyDigest
  ) {
    throw new Error('pull request body differs from its approved digest');
  }
  if (
    'requiredChecks' in request &&
    !sameOrderedSet(request.requiredChecks, contract.authority.github.requiredChecks)
  ) {
    throw new Error('GitHub request changes the required check set');
  }
  if (
    'protectionDigest' in request &&
    request.protectionDigest !== policy.approvedProtectionDigest
  ) {
    throw new Error('GitHub request changes the approved protection snapshot');
  }
  if (
    request.kind === 'github.merge' &&
    request.mergeMethod !== contract.authority.github.mergeMethod
  ) {
    throw new Error('GitHub request changes the approved merge method');
  }
}

function monotonicClock(clock: () => number): () => number {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const now = clock();
    if (!Number.isFinite(now) || now < last)
      throw new Error('delivery clock must be finite and monotonic');
    last = now;
    return now;
  };
}

export class DurableDeliveryBroker {
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;
  readonly #port: DeliveryMutationPort;
  readonly #policy: DeliveryBrokerPolicy;
  readonly #clock: () => number;
  readonly #fault: DeliveryFaultInjector;

  private constructor(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: DeliveryMutationPort;
    policy: DeliveryBrokerPolicy;
    clock: () => number;
    fault?: DeliveryFaultInjector;
  }) {
    this.#store = input.store;
    this.#contract = executionContractSchema.parse(input.contract);
    this.#port = input.port;
    this.#policy = input.policy;
    if (!/^sha256:[a-f0-9]{64}$/u.test(input.policy.approvedProtectionDigest)) {
      throw new Error('delivery policy has an invalid protection digest');
    }
    for (const task of this.#contract.tasks) {
      if (!/^[a-f0-9]{40,64}$/u.test(input.policy.approvedParentShas[task.id] ?? '')) {
        throw new Error(`delivery policy lacks an approved parent SHA for ${task.id}`);
      }
    }
    this.#clock = monotonicClock(input.clock);
    this.#fault = input.fault ?? (() => undefined);
  }

  static createForTest(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: DeliveryMutationPort;
    policy: DeliveryBrokerPolicy;
    clock?: () => number;
    fault?: DeliveryFaultInjector;
  }): DurableDeliveryBroker {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test delivery port is unavailable outside the test runtime');
    }
    return new DurableDeliveryBroker({ ...input, clock: input.clock ?? Date.now });
  }

  static create(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: ProductionDeliveryMutationPort;
    policy: DeliveryBrokerPolicy;
    workspaceRoot: string;
  }): DurableDeliveryBroker {
    const canonicalWorkspace = realpathSync(input.workspaceRoot);
    const workspaceId = `sha256:${createHash('sha256').update(canonicalWorkspace).digest('hex')}`;
    if (workspaceId !== input.contract.workspaceId) {
      throw new Error('delivery broker workspace differs from the execution contract');
    }
    if (
      !isProductionDeliveryPort(input.port) ||
      realpathSync(input.port.workspaceRoot) !== canonicalWorkspace ||
      input.port.repository !== input.contract.authority.github.repository
    ) {
      throw new Error('delivery port binding differs from the verified workspace or repository');
    }
    return new DurableDeliveryBroker({ ...input, clock: Date.now });
  }

  async execute(requestInput: unknown, fence: DeliveryFence): Promise<DeliveryOperationRecord> {
    const request = deliveryRequestSchema.parse(requestInput);
    this.#store.assertRunUsesContract(request.runId, this.#contract);
    assertRequestWithinContract(
      this.#contract,
      request,
      this.#policy,
      this.#store.getAuthorizedRunTask(
        request.runId,
        request.taskId,
        workflowDeliveryMutationCapability,
      ),
    );
    const requestDigest = deriveDeliveryRequestDigest(request);
    let operation = this.#store.prepareDeliveryOperation(
      {
        id: requestDigest,
        workspaceId: request.workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        kind: request.kind,
        actorRole: request.actorRole,
        requestDigest,
        request,
        contractVersion: request.contractVersion,
        policyDigest: request.policyDigest,
        ...fence,
        nowMs: this.#clock(),
      },
      workflowDeliveryMutationCapability,
    );
    if (operation.status !== 'prepared') return operation;
    this.#assertOperationFence(operation, fence);
    this.#assertReady(operation, fence);
    this.#fault('after_prepare', operation);
    if (request.kind === 'github.merge') {
      return this.#executeProviderAttestedMerge(request, operation, fence);
    }
    const before = await this.#port.observe(request);
    if (before.kind === 'conflict') return this.#escalate(operation, fence, before.result);
    if (before.kind === 'unchanged') {
      this.#assertReady(operation, fence);
      const fresh = await this.#port.observe(request);
      if (fresh.kind === 'conflict') return this.#escalate(operation, fence, fresh.result);
      if (fresh.kind === 'unchanged') {
        this.#assertReady(operation, fence);
        this.#fault('before_mutation', operation);
        await this.#port.mutate(request);
        this.#fault('after_mutation', operation);
      }
    }
    const after = await this.#port.observe(request);
    if (after.kind === 'conflict') return this.#escalate(operation, fence, after.result);
    if (after.kind !== 'expected') throw new Error('delivery mutation result remains ambiguous');
    let durableResult: unknown;
    try {
      durableResult = normalizeDurableResult(after.result);
    } catch {
      return this.#escalate(operation, fence, { reason: 'delivery_port_result_not_json' });
    }
    this.#fault('before_commit', operation);
    operation = this.#store.commitDeliveryOperation(
      {
        id: operation.id,
        ...fence,
        result: durableResult,
        assertExternalState: () => undefined,
        clock: this.#clock,
      },
      workflowDeliveryMutationCapability,
    );
    this.#fault('after_commit', operation);
    return operation;
  }

  async reconcilePrepared(input: {
    runId: string;
    fence: DeliveryFence;
  }): Promise<DeliveryReconciliationResult> {
    this.#store.assertRunUsesContract(input.runId, this.#contract);
    const operations: DeliveryOperationRecord[] = [];
    const errors: DeliveryReconciliationResult['errors'] = [];
    for (const prepared of this.#store.listPreparedDeliveryOperations(input.runId)) {
      let operation: DeliveryOperationRecord | undefined;
      try {
        operation = this.#store.adoptPreparedDeliveryOperation(
          { id: prepared.id, ...input.fence, nowMs: this.#clock() },
          workflowDeliveryMutationCapability,
        );
        this.#fault('after_adoption', operation);
        operations.push(await this.#reconcileOperation(operation, input.runId, input.fence));
      } catch (error) {
        errors.push({
          operationId: operation?.id ?? prepared.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { operations, errors };
  }

  async #reconcileOperation(
    operation: DeliveryOperationRecord,
    runId: string,
    fence: DeliveryFence,
  ): Promise<DeliveryOperationRecord> {
    if (operation.resultJson !== null) {
      return this.#escalate(operation, fence, {
        reason: 'prepared_delivery_journal_contains_result',
      });
    }
    let persistedRequest: unknown;
    try {
      persistedRequest = JSON.parse(operation.requestJson) as unknown;
    } catch {
      return this.#escalate(operation, fence, { reason: 'delivery_journal_request_invalid' });
    }
    if (
      deriveDeliveryRequestDigest(persistedRequest) !== operation.requestDigest ||
      operation.id !== operation.requestDigest
    ) {
      return this.#escalate(operation, fence, { reason: 'delivery_journal_digest_mismatch' });
    }
    const parsed = deliveryRequestSchema.safeParse(persistedRequest);
    if (!parsed.success) {
      return this.#escalate(operation, fence, { reason: 'delivery_journal_request_invalid' });
    }
    const request = parsed.data;
    if (request.runId !== runId) {
      return this.#escalate(operation, fence, { reason: 'delivery_journal_run_mismatch' });
    }
    assertRequestWithinContract(
      this.#contract,
      request,
      this.#policy,
      this.#store.getAuthorizedRunTask(
        request.runId,
        request.taskId,
        workflowDeliveryMutationCapability,
      ),
    );
    if (request.kind === 'github.merge') {
      return this.#executeProviderAttestedMerge(request, operation, fence);
    }
    return this.#replayMutation(request, operation, fence);
  }

  async #replayMutation(
    request: DeliveryRequest,
    operation: DeliveryOperationRecord,
    fence: DeliveryFence,
  ): Promise<DeliveryOperationRecord> {
    let observed = await this.#port.observe(request);
    if (observed.kind === 'conflict') return this.#escalate(operation, fence, observed.result);
    if (observed.kind === 'unchanged') {
      this.#assertReady(operation, fence);
      observed = await this.#port.observe(request);
      if (observed.kind === 'conflict') return this.#escalate(operation, fence, observed.result);
      if (observed.kind === 'unchanged') {
        this.#assertReady(operation, fence);
        await this.#port.mutate(request);
        this.#fault('after_replay_mutation', operation);
      }
    }
    const after = await this.#port.observe(request);
    if (after.kind !== 'expected') {
      if (after.kind === 'conflict') return this.#escalate(operation, fence, after.result);
      throw new Error('replayed delivery mutation remains ambiguous');
    }
    let durableResult: unknown;
    try {
      durableResult = normalizeDurableResult(after.result);
    } catch {
      return this.#escalate(operation, fence, { reason: 'delivery_port_result_not_json' });
    }
    return this.#store.commitDeliveryOperation(
      {
        id: operation.id,
        ...fence,
        result: durableResult,
        assertExternalState: () => undefined,
        clock: this.#clock,
      },
      workflowDeliveryMutationCapability,
    );
  }

  recordPipelineObservation(input: {
    operationId: string;
    fence: DeliveryFence;
    nextPollAtMs: number;
    absoluteDeadlineMs: number;
  }): PipelineObservationDecision {
    const operation = this.#store.getDeliveryOperation(input.operationId);
    if (
      operation === undefined ||
      operation.status !== 'committed' ||
      operation.kind !== 'github.checks'
    ) {
      throw new Error('pipeline observation requires a committed GitHub checks operation');
    }
    this.#store.assertRunUsesContract(operation.runId, this.#contract);
    const request = githubChecksRequestSchema.parse(operation.request);
    assertRequestWithinContract(
      this.#contract,
      request,
      this.#policy,
      this.#store.getAuthorizedRunTask(
        request.runId,
        request.taskId,
        workflowDeliveryMutationCapability,
      ),
    );
    this.#store.assertDeliveryWaitReady(
      {
        workspaceId: request.workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        ...input.fence,
        nowMs: this.#clock(),
      },
      workflowDeliveryMutationCapability,
    );
    const result = operation.result as Record<string, unknown> | null;
    const checks = result?.checks;
    const eventIdentity = result?.eventIdentity;
    if (
      typeof checks !== 'object' ||
      checks === null ||
      Array.isArray(checks) ||
      typeof eventIdentity !== 'string' ||
      eventIdentity === ''
    ) {
      throw new Error('GitHub checks result has invalid durable wait evidence');
    }
    const checkRecord = checks as Record<string, unknown>;
    if (
      !sameOrderedSet(Object.keys(checkRecord), request.requiredChecks) ||
      Object.values(checkRecord).some(
        (value) => value !== 'pending' && value !== 'success' && value !== 'failure',
      )
    ) {
      throw new Error('GitHub checks result changes the approved check set');
    }
    const checkId = deriveDeliveryRequestDigest([
      request.repository,
      request.pullRequestNumber,
      request.headSha,
      request.base,
      request.protectionDigest,
    ]);
    const storedWait = this.#store.getWait(request.runId, checkId);
    const existing =
      storedWait?.workspaceId === request.workspaceId && storedWait.taskId === request.taskId
        ? storedWait
        : undefined;
    if (this.#store.getDeliveryWaitEscalation(request.runId, checkId) !== undefined) {
      throw new Error('pipeline wait is already terminally escalated');
    }
    const effectiveDeadline = Math.min(
      existing?.absoluteDeadlineMs ?? input.absoluteDeadlineMs,
      input.absoluteDeadlineMs,
    );
    if (
      existing !== undefined &&
      existing.workspaceId === request.workspaceId &&
      existing.taskId === request.taskId &&
      existing.eventIdentity === eventIdentity &&
      existing.backoffCount === request.pollAttempt + 1 &&
      existing.nextPollAtMs === input.nextPollAtMs &&
      existing.absoluteDeadlineMs === effectiveDeadline
    ) {
      return {
        kind: 'waiting',
        checkId,
        eventIdentity,
        nextPollAtMs: existing.nextPollAtMs,
        absoluteDeadlineMs: existing.absoluteDeadlineMs,
        backoffCount: existing.backoffCount,
      };
    }
    if (request.pollAttempt !== (existing?.backoffCount ?? 0)) {
      throw new Error('pipeline poll attempt does not match durable backoff state');
    }
    const failedChecks = request.requiredChecks.filter((check) => checkRecord[check] === 'failure');
    if (failedChecks.length > 0) {
      if (existing !== undefined) this.#completeWait(request, checkId, input.fence);
      return { kind: 'failed', checkId, failedChecks };
    }
    if (request.requiredChecks.every((check) => checkRecord[check] === 'success')) {
      if (existing !== undefined) this.#completeWait(request, checkId, input.fence);
      return { kind: 'passed', checkId };
    }
    const nowMs = this.#clock();
    const maximumDeadline =
      operation.createdAtMs + this.#contract.retryPolicy.waitDeadlineSeconds * 1000;
    if (
      input.nextPollAtMs <= nowMs ||
      input.nextPollAtMs >= input.absoluteDeadlineMs ||
      input.absoluteDeadlineMs > maximumDeadline
    ) {
      throw new Error('pipeline wait exceeds the immutable retry deadline');
    }
    const backoffCount = request.pollAttempt + 1;
    this.#store.putDeliveryWait(
      {
        workspaceId: request.workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        checkId,
        eventIdentity,
        nextPollAtMs: input.nextPollAtMs,
        absoluteDeadlineMs: input.absoluteDeadlineMs,
        backoffCount,
        operationId: operation.id,
        ...input.fence,
        nowMs,
      },
      workflowDeliveryMutationCapability,
    );
    return {
      kind: 'waiting',
      checkId,
      eventIdentity,
      nextPollAtMs: input.nextPollAtMs,
      absoluteDeadlineMs: Math.min(
        existing?.absoluteDeadlineMs ?? input.absoluteDeadlineMs,
        input.absoluteDeadlineMs,
      ),
      backoffCount,
    };
  }

  expirePipelineWait(input: {
    runId: string;
    taskId: string;
    checkId: string;
    eventIdentity: string;
    fence: DeliveryFence;
  }): PipelineWaitEscalationRecord {
    this.#store.assertRunUsesContract(input.runId, this.#contract);
    const nowMs = this.#clock();
    const id = deriveDeliveryRequestDigest([input.runId, input.checkId, 'deadline']);
    return this.#store.escalateDeliveryWait(
      {
        id,
        workspaceId: this.#contract.workspaceId,
        runId: input.runId,
        taskId: input.taskId,
        checkId: input.checkId,
        eventIdentity: input.eventIdentity,
        report: { reason: 'pipeline_wait_deadline_exhausted', checkId: input.checkId },
        ...input.fence,
        nowMs,
      },
      workflowDeliveryMutationCapability,
    );
  }

  #completeWait(
    request: Extract<DeliveryRequest, { kind: 'github.checks' }>,
    checkId: string,
    fence: DeliveryFence,
  ): void {
    this.#store.completeDeliveryWait(
      {
        workspaceId: request.workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        checkId,
        ...fence,
        nowMs: this.#clock(),
      },
      workflowDeliveryMutationCapability,
    );
  }

  #assertReady(operation: DeliveryOperationRecord, fence: DeliveryFence): void {
    this.#store.assertDeliveryOperationReady(
      operation,
      fence,
      this.#clock(),
      workflowDeliveryMutationCapability,
    );
  }

  async #executeProviderAttestedMerge(
    request: Extract<DeliveryRequest, { kind: 'github.merge' }>,
    initialOperation: DeliveryOperationRecord,
    fence: DeliveryFence,
  ): Promise<DeliveryOperationRecord> {
    let operation = initialOperation;
    let observed = await this.#port.observe(request);
    if (observed.kind === 'conflict') return this.#escalate(operation, fence, observed.result);
    if (observed.kind === 'expected') {
      if (operation.verifiedObservationDigest === null) {
        return this.#escalate(operation, fence, {
          reason: 'merge_result_without_verified_precondition',
        });
      }
      return this.#commitObservedResult(operation, fence, observed.result);
    }
    const observedResult = normalizeDurableResult(observed.result);
    const observedDigest = deriveDeliveryRequestDigest(observedResult);
    if (operation.verifiedObservationDigest === null) {
      operation = this.#store.verifyAndPersistMergeObservation(
        {
          id: operation.id,
          ...fence,
          observation: observedResult,
          observationDigest: observedDigest,
          nowMs: this.#clock(),
        },
        workflowDeliveryMutationCapability,
      );
      this.#fault('after_verified_observation', operation);
    } else if (
      operation.verifiedObservationDigest !== observedDigest ||
      operation.verifiedObservationJson !== JSON.stringify(observedResult)
    ) {
      return this.#escalate(operation, fence, {
        reason: 'provider_merge_observation_changed_before_mutation',
      });
    }
    this.#assertReady(operation, fence);
    observed = await this.#port.observe(request);
    if (observed.kind === 'conflict') return this.#escalate(operation, fence, observed.result);
    if (observed.kind === 'expected') {
      return this.#commitObservedResult(operation, fence, observed.result);
    }
    const immediateResult = normalizeDurableResult(observed.result);
    if (deriveDeliveryRequestDigest(immediateResult) !== operation.verifiedObservationDigest) {
      return this.#escalate(operation, fence, {
        reason: 'provider_merge_observation_changed_before_mutation',
        observed: immediateResult,
      });
    }
    this.#assertReady(operation, fence);
    this.#fault('before_mutation', operation);
    await this.#port.mutate(request, {
      reviewEventIdentity: String(
        (operation.verifiedObservation as { reviewEventIdentity: unknown }).reviewEventIdentity,
      ),
      verifiedObservationDigest: operation.verifiedObservationDigest!,
    });
    this.#fault('after_mutation', operation);
    const after = await this.#port.observe(request);
    if (after.kind === 'conflict') return this.#escalate(operation, fence, after.result);
    if (after.kind !== 'expected') throw new Error('delivery merge result remains ambiguous');
    return this.#commitObservedResult(operation, fence, after.result);
  }

  #commitObservedResult(
    operation: DeliveryOperationRecord,
    fence: DeliveryFence,
    result: unknown,
  ): DeliveryOperationRecord {
    let durableResult: unknown;
    try {
      durableResult = normalizeDurableResult(result);
    } catch {
      return this.#escalate(operation, fence, { reason: 'delivery_port_result_not_json' });
    }
    this.#fault('before_commit', operation);
    const committed = this.#store.commitDeliveryOperation(
      {
        id: operation.id,
        ...fence,
        result: durableResult,
        assertExternalState: () => undefined,
        clock: this.#clock,
      },
      workflowDeliveryMutationCapability,
    );
    this.#fault('after_commit', committed);
    return committed;
  }

  #assertOperationFence(operation: DeliveryOperationRecord, fence: DeliveryFence): void {
    if (
      operation.ownerId !== fence.ownerId ||
      operation.workspaceLeaseEpoch !== fence.workspaceLeaseEpoch ||
      operation.runLeaseEpoch !== fence.runLeaseEpoch ||
      operation.taskLeaseEpoch !== fence.taskLeaseEpoch
    ) {
      throw new Error('prepared delivery replay requires recovery adoption before execution');
    }
  }

  #escalate(
    operation: DeliveryOperationRecord,
    fence: DeliveryFence,
    result: unknown,
  ): DeliveryOperationRecord {
    let durableResult: unknown;
    try {
      durableResult = normalizeDurableResult(result);
    } catch {
      durableResult = { reason: 'delivery_port_result_not_json' };
    }
    return this.#store.escalateDeliveryOperation(
      { id: operation.id, ...fence, result: durableResult, nowMs: this.#clock() },
      workflowDeliveryMutationCapability,
    );
  }
}
