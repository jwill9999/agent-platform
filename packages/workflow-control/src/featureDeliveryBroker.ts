import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';

import { z } from 'zod';

import { executionContractSchema, type ExecutionContract } from './contracts.js';
import { deriveDeliveryRequestDigest, type DeliveryFence } from './deliveryBrokers.js';
import { isProductionDeliveryPort } from './deliveryPortCapability.js';
import {
  deriveFeatureDeliveryContractDigest,
  featureDeliveryContractSchema,
  FEATURE_DELIVERY_CONTRACT_VERSION,
  type FeatureDeliveryContract,
} from './featureDeliveryContracts.js';
import type { ExternalObservation } from './reconciliation.js';
import {
  workflowDeliveryMutationCapability,
  type DeliveryOperationRecord,
  type WorkflowStore,
} from './storage.js';

const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const shaSchema = z.string().regex(/^[a-f0-9]{40,64}$/u);
const repositorySchema = z.string().regex(/^[^/\s]+\/[^/\s]+$/u);
const featureRefSchema = z.string().regex(/^feature\/[A-Za-z0-9._-]+$/u);

const featureBindingShape = {
  workspaceId: digestSchema,
  runId: identifierSchema,
  taskId: identifierSchema,
  repository: repositorySchema,
  actorRole: z.literal('workflow_orchestrator'),
  executionContractVersion: z.literal(1),
  policyDigest: digestSchema,
  featureContractVersion: z.literal(FEATURE_DELIVERY_CONTRACT_VERSION),
  featureContractDigest: digestSchema,
  originMergeOperationId: digestSchema,
  originMergeAttestationDigest: digestSchema,
  originPullRequestNumber: z.number().int().positive(),
  originTaskHeadSha: shaSchema,
  headRef: featureRefSchema,
  headSha: shaSchema,
  base: z.literal('staging'),
} as const;

export const featurePullRequestMutationSchema = z
  .object({
    ...featureBindingShape,
    kind: z.literal('feature.github.pr'),
    title: z.string().min(1).max(256),
    body: z.string().max(20_000),
    bodyDigest: digestSchema,
  })
  .strict();

export const featureChecksRequestSchema = z
  .object({
    ...featureBindingShape,
    kind: z.literal('feature.github.checks'),
    pullRequestNumber: z.number().int().positive(),
    requiredChecks: z.array(z.string().min(1)),
    protectionDigest: digestSchema,
    pollAttempt: z.number().int().nonnegative(),
  })
  .strict();

export const featureMergeRequestSchema = z
  .object({
    ...featureBindingShape,
    kind: z.literal('feature.github.merge'),
    pullRequestNumber: z.number().int().positive(),
    requiredChecks: z.array(z.string().min(1)),
    protectionDigest: digestSchema,
    reviewDecision: z.literal('approved'),
    mergeMethod: z.literal('squash'),
    adminBypass: z.literal(false),
  })
  .strict();

export const featureDeliveryRequestSchema = z
  .discriminatedUnion('kind', [
    featurePullRequestMutationSchema,
    featureChecksRequestSchema,
    featureMergeRequestSchema,
  ])
  .superRefine((request, context) => {
    if (
      'requiredChecks' in request &&
      new Set(request.requiredChecks).size !== request.requiredChecks.length
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'required checks must be unique' });
    }
  });

export type FeatureDeliveryRequest = z.infer<typeof featureDeliveryRequestSchema>;

export interface FeatureDeliveryMutationPort {
  observe(request: FeatureDeliveryRequest): Promise<ExternalObservation>;
  mutate(request: FeatureDeliveryRequest): Promise<unknown>;
}

export interface ProductionFeatureDeliveryMutationPort extends FeatureDeliveryMutationPort {
  readonly workspaceRoot: string;
  readonly repository: string;
}

export interface FeatureDeliveryReconciliationResult {
  operations: DeliveryOperationRecord[];
  errors: Array<{ operationId: string; message: string }>;
}

export type FeatureDeliveryFaultBoundary =
  | 'after_prepare'
  | 'before_mutation'
  | 'after_mutation'
  | 'before_commit'
  | 'after_commit'
  | 'after_adoption'
  | 'after_replay_mutation';

export type FeatureDeliveryFaultInjector = (
  boundary: FeatureDeliveryFaultBoundary,
  operation: DeliveryOperationRecord,
) => void;

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  const sortedActual = [...actual].sort((left, right) => left.localeCompare(right));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right));
  return (
    actual.length === expected.length &&
    sortedActual.every((value, index) => value === sortedExpected[index])
  );
}

function normalizeDurableResult(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('feature delivery port returned a non-JSON result');
  return JSON.parse(serialized) as unknown;
}

function monotonicClock(clock: () => number): () => number {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const now = clock();
    if (!Number.isFinite(now) || now < last) {
      throw new Error('feature delivery clock must be finite and monotonic');
    }
    last = now;
    return now;
  };
}

const registeredFeatureDeliveryBrokers = new WeakMap<
  object,
  { store: WorkflowStore; executionContract: ExecutionContract }
>();

export class DurableFeatureDeliveryBroker {
  readonly #store: WorkflowStore;
  readonly #executionContract: ExecutionContract;
  readonly #contract: FeatureDeliveryContract;
  readonly #contractDigest: string;
  readonly #port: FeatureDeliveryMutationPort;
  readonly #clock: () => number;
  readonly #fault: FeatureDeliveryFaultInjector;

  private constructor(input: {
    store: WorkflowStore;
    executionContract: ExecutionContract;
    contract: FeatureDeliveryContract;
    port: FeatureDeliveryMutationPort;
    clock: () => number;
    fault?: FeatureDeliveryFaultInjector;
  }) {
    if (new.target !== DurableFeatureDeliveryBroker) {
      throw new Error('feature delivery broker subclasses are forbidden');
    }
    this.#store = input.store;
    this.#executionContract = executionContractSchema.parse(input.executionContract);
    this.#contract = featureDeliveryContractSchema.parse(input.contract);
    this.#contractDigest = deriveFeatureDeliveryContractDigest(this.#contract);
    this.#port = input.port;
    this.#clock = monotonicClock(input.clock);
    this.#fault = input.fault ?? (() => undefined);
    this.#assertContractOrigin();
    Object.defineProperties(this, {
      execute: { value: this.execute.bind(this), enumerable: false },
      reconcilePrepared: { value: this.reconcilePrepared.bind(this), enumerable: false },
      isBoundTo: { value: this.isBoundTo.bind(this), enumerable: false },
    });
    registeredFeatureDeliveryBrokers.set(this, {
      store: input.store,
      executionContract: this.#executionContract,
    });
    Object.freeze(this);
  }

  static createForTest(input: {
    store: WorkflowStore;
    executionContract: ExecutionContract;
    contract: FeatureDeliveryContract;
    port: FeatureDeliveryMutationPort;
    clock?: () => number;
    fault?: FeatureDeliveryFaultInjector;
  }): DurableFeatureDeliveryBroker {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test feature delivery port is unavailable outside the test runtime');
    }
    return new DurableFeatureDeliveryBroker({ ...input, clock: input.clock ?? Date.now });
  }

  static create(input: {
    store: WorkflowStore;
    executionContract: ExecutionContract;
    contract: FeatureDeliveryContract;
    port: ProductionFeatureDeliveryMutationPort;
    workspaceRoot: string;
  }): DurableFeatureDeliveryBroker {
    const canonicalWorkspace = realpathSync(input.workspaceRoot);
    const workspaceId = `sha256:${createHash('sha256').update(canonicalWorkspace).digest('hex')}`;
    if (
      workspaceId !== input.contract.workspaceId ||
      !isProductionDeliveryPort(input.port) ||
      realpathSync(input.port.workspaceRoot) !== canonicalWorkspace ||
      input.port.repository !== input.contract.authority.repository
    ) {
      throw new Error(
        'feature delivery port binding differs from the approved workspace or repository',
      );
    }
    return new DurableFeatureDeliveryBroker({ ...input, clock: Date.now });
  }

  isBoundTo(store: WorkflowStore, executionContract: ExecutionContract): boolean {
    const registered = registeredFeatureDeliveryBrokers.get(this);
    return (
      Object.getPrototypeOf(this) === DurableFeatureDeliveryBroker.prototype &&
      registered?.store === store &&
      this.#store === store &&
      JSON.stringify(registered.executionContract) ===
        JSON.stringify(executionContractSchema.parse(executionContract)) &&
      JSON.stringify(this.#executionContract) ===
        JSON.stringify(executionContractSchema.parse(executionContract))
    );
  }

  async execute(requestInput: unknown, fence: DeliveryFence): Promise<DeliveryOperationRecord> {
    const request = featureDeliveryRequestSchema.parse(requestInput);
    this.#store.assertRunUsesContract(request.runId, this.#executionContract);
    this.#assertRequest(request);
    this.#recordContract(request.runId, request.taskId, fence);
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
        contractVersion: request.executionContractVersion,
        policyDigest: request.policyDigest,
        ...fence,
        nowMs: this.#clock(),
      },
      workflowDeliveryMutationCapability,
    );
    if (operation.status !== 'prepared') return operation;
    this.#assertFence(operation, fence);
    this.#assertReady(operation, fence);
    this.#fault('after_prepare', operation);
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
    if (after.kind !== 'expected') throw new Error('feature delivery mutation remains ambiguous');
    let result: unknown;
    try {
      result = normalizeDurableResult(after.result);
    } catch {
      return this.#escalate(operation, fence, { reason: 'feature_delivery_result_not_json' });
    }
    this.#fault('before_commit', operation);
    operation = this.#store.commitDeliveryOperation(
      {
        id: operation.id,
        ...fence,
        result,
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
  }): Promise<FeatureDeliveryReconciliationResult> {
    this.#store.assertRunUsesContract(input.runId, this.#executionContract);
    this.#recordContract(input.runId, this.#contract.origin.taskId, input.fence);
    const operations: DeliveryOperationRecord[] = [];
    const errors: FeatureDeliveryReconciliationResult['errors'] = [];
    for (const prepared of this.#store.listPreparedFeatureDeliveryOperations(input.runId)) {
      let operation: DeliveryOperationRecord | undefined;
      try {
        operation = this.#store.adoptPreparedDeliveryOperation(
          { id: prepared.id, ...input.fence, nowMs: this.#clock() },
          workflowDeliveryMutationCapability,
        );
        this.#fault('after_adoption', operation);
        let persisted: unknown;
        try {
          persisted = JSON.parse(operation.requestJson) as unknown;
        } catch {
          operations.push(
            this.#escalate(operation, input.fence, { reason: 'feature_delivery_request_invalid' }),
          );
          continue;
        }
        if (
          operation.resultJson !== null ||
          deriveDeliveryRequestDigest(persisted) !== operation.requestDigest ||
          operation.id !== operation.requestDigest
        ) {
          operations.push(
            this.#escalate(operation, input.fence, { reason: 'feature_delivery_journal_mismatch' }),
          );
          continue;
        }
        const parsed = featureDeliveryRequestSchema.safeParse(persisted);
        if (!parsed.success || parsed.data.runId !== input.runId) {
          operations.push(
            this.#escalate(operation, input.fence, { reason: 'feature_delivery_request_invalid' }),
          );
          continue;
        }
        const request = parsed.data;
        this.#assertRequest(request);
        let observed = await this.#port.observe(request);
        if (observed.kind === 'conflict') {
          operations.push(this.#escalate(operation, input.fence, observed.result));
          continue;
        }
        if (observed.kind === 'unchanged') {
          this.#assertReady(operation, input.fence);
          observed = await this.#port.observe(request);
          if (observed.kind === 'conflict') {
            operations.push(this.#escalate(operation, input.fence, observed.result));
            continue;
          }
          if (observed.kind === 'unchanged') {
            this.#assertReady(operation, input.fence);
            await this.#port.mutate(request);
            this.#fault('after_replay_mutation', operation);
          }
        }
        const after = await this.#port.observe(request);
        if (after.kind !== 'expected') {
          if (after.kind === 'conflict') {
            operations.push(this.#escalate(operation, input.fence, after.result));
            continue;
          }
          throw new Error('replayed feature delivery mutation remains ambiguous');
        }
        let result: unknown;
        try {
          result = normalizeDurableResult(after.result);
        } catch {
          operations.push(
            this.#escalate(operation, input.fence, { reason: 'feature_delivery_result_not_json' }),
          );
          continue;
        }
        operation = this.#store.commitDeliveryOperation(
          {
            id: operation.id,
            ...input.fence,
            result,
            assertExternalState: () => undefined,
            clock: this.#clock,
          },
          workflowDeliveryMutationCapability,
        );
        operations.push(operation);
      } catch (error) {
        errors.push({
          operationId: operation?.id ?? prepared.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { operations, errors };
  }

  #assertContractOrigin(): void {
    const executionDigest = `sha256:${createHash('sha256')
      .update(JSON.stringify(this.#executionContract))
      .digest('hex')}`;
    const task = this.#executionContract.tasks.find(
      (candidate) => candidate.id === this.#contract.origin.taskId,
    );
    if (
      this.#contract.executionContractDigest !== executionDigest ||
      this.#contract.featureId !== this.#executionContract.featureId ||
      this.#contract.workspaceId !== this.#executionContract.workspaceId ||
      this.#contract.policyDigest !== this.#executionContract.policyDigest ||
      this.#contract.origin.executionContractVersion !== this.#executionContract.contractVersion ||
      this.#contract.origin.repository !== this.#executionContract.authority.github.repository ||
      task === undefined ||
      !task.allowedOperations.includes('github.deliver') ||
      !task.allowedOperations.includes('github.read')
    ) {
      throw new Error('feature delivery contract is not bound to its immutable execution origin');
    }
  }

  #recordContract(runId: string, taskId: string, fence: DeliveryFence): void {
    this.#store.recordFeatureDeliveryContract(
      {
        runId,
        workspaceId: this.#contract.workspaceId,
        executionContractVersion: this.#contract.origin.executionContractVersion,
        policyDigest: this.#contract.policyDigest,
        featureContractVersion: this.#contract.contractVersion,
        contractDigest: this.#contractDigest,
        executionContractDigest: this.#contract.executionContractDigest,
        contract: this.#contract,
        taskId,
        ...fence,
        createdAtMs: this.#clock(),
      },
      workflowDeliveryMutationCapability,
    );
  }

  #assertRequest(request: FeatureDeliveryRequest): void {
    const authority = this.#contract.authority;
    const origin = this.#contract.origin;
    if (
      request.workspaceId !== this.#contract.workspaceId ||
      request.taskId !== origin.taskId ||
      request.repository !== authority.repository ||
      request.actorRole !== authority.actorRole ||
      request.executionContractVersion !== origin.executionContractVersion ||
      request.policyDigest !== this.#contract.policyDigest ||
      request.featureContractVersion !== this.#contract.contractVersion ||
      request.featureContractDigest !== this.#contractDigest ||
      request.originMergeOperationId !== origin.integrationMergeOperationId ||
      request.originMergeAttestationDigest !== origin.integrationMergeAttestationDigest ||
      request.originPullRequestNumber !== origin.integrationPullRequestNumber ||
      request.originTaskHeadSha !== origin.taskHeadSha ||
      request.headRef !== authority.headRef ||
      request.headSha !== authority.headSha ||
      request.base !== authority.base
    ) {
      throw new Error('feature delivery request changes its approved contract binding');
    }
    if (
      request.kind === 'feature.github.pr' &&
      `sha256:${createHash('sha256').update(request.body).digest('hex')}` !== request.bodyDigest
    ) {
      throw new Error('feature pull request body differs from its digest');
    }
    if ('requiredChecks' in request && !sameSet(request.requiredChecks, authority.requiredChecks)) {
      throw new Error('feature delivery request changes the required check set');
    }
    if ('protectionDigest' in request && request.protectionDigest !== authority.protectionDigest) {
      throw new Error('feature delivery request changes the protection snapshot');
    }
    if (
      request.kind === 'feature.github.merge' &&
      (request.mergeMethod !== authority.mergeMethod ||
        request.adminBypass !== authority.adminBypass)
    ) {
      throw new Error('feature delivery request changes the merge authority');
    }
  }

  #assertReady(operation: DeliveryOperationRecord, fence: DeliveryFence): void {
    this.#store.assertDeliveryOperationReady(
      operation,
      fence,
      this.#clock(),
      workflowDeliveryMutationCapability,
    );
  }

  #assertFence(operation: DeliveryOperationRecord, fence: DeliveryFence): void {
    if (
      operation.ownerId !== fence.ownerId ||
      operation.workspaceLeaseEpoch !== fence.workspaceLeaseEpoch ||
      operation.runLeaseEpoch !== fence.runLeaseEpoch ||
      operation.taskLeaseEpoch !== fence.taskLeaseEpoch
    ) {
      throw new Error('prepared feature delivery requires recovery adoption before execution');
    }
  }

  #escalate(
    operation: DeliveryOperationRecord,
    fence: DeliveryFence,
    value: unknown,
  ): DeliveryOperationRecord {
    let result: unknown;
    try {
      result = normalizeDurableResult(value);
    } catch {
      result = { reason: 'feature_delivery_result_not_json' };
    }
    return this.#store.escalateDeliveryOperation(
      { id: operation.id, ...fence, result, nowMs: this.#clock() },
      workflowDeliveryMutationCapability,
    );
  }
}

Object.freeze(DurableFeatureDeliveryBroker.prototype);

const registeredRecoveryDrivers = new WeakMap<
  FeatureDeliveryRecoveryDriver,
  {
    store: WorkflowStore;
    executionContract: ExecutionContract;
    broker: DurableFeatureDeliveryBroker;
  }
>();

export function isRegisteredFeatureDeliveryRecoveryDriver(
  driver: FeatureDeliveryRecoveryDriver,
  store: WorkflowStore,
  executionContract: ExecutionContract,
): boolean {
  const registered = registeredRecoveryDrivers.get(driver);
  return (
    Object.getPrototypeOf(driver) === FeatureDeliveryRecoveryDriver.prototype &&
    registered?.store === store &&
    registered.broker.isBoundTo(store, executionContract) &&
    JSON.stringify(registered.executionContract) ===
      JSON.stringify(executionContractSchema.parse(executionContract)) &&
    Object.isFrozen(driver)
  );
}

export class FeatureDeliveryRecoveryDriver {
  readonly #store: WorkflowStore;
  readonly #broker: DurableFeatureDeliveryBroker;
  readonly #fenceProvider: (runId: string, taskId: string) => Promise<DeliveryFence>;
  readonly #operationTimeoutMs: number;

  private constructor(input: {
    store: WorkflowStore;
    broker: DurableFeatureDeliveryBroker;
    executionContract: ExecutionContract;
    fenceProvider: (runId: string, taskId: string) => Promise<DeliveryFence>;
    operationTimeoutMs?: number;
  }) {
    if (new.target !== FeatureDeliveryRecoveryDriver) {
      throw new Error('feature delivery recovery driver subclasses are forbidden');
    }
    const executionContract = executionContractSchema.parse(input.executionContract);
    if (!input.broker.isBoundTo(input.store, executionContract)) {
      throw new Error('feature recovery driver broker differs from its exact store or contract');
    }
    this.#store = input.store;
    this.#broker = input.broker;
    this.#fenceProvider = input.fenceProvider;
    this.#operationTimeoutMs = input.operationTimeoutMs ?? 30_000;
    Object.defineProperties(this, {
      reconcileFinalizing: { value: this.reconcileFinalizing.bind(this), enumerable: false },
    });
    registeredRecoveryDrivers.set(this, {
      store: input.store,
      executionContract,
      broker: input.broker,
    });
    Object.freeze(this);
  }

  static create(input: {
    store: WorkflowStore;
    broker: DurableFeatureDeliveryBroker;
    executionContract: ExecutionContract;
    fenceProvider: (runId: string, taskId: string) => Promise<DeliveryFence>;
    operationTimeoutMs?: number;
  }): FeatureDeliveryRecoveryDriver {
    return new FeatureDeliveryRecoveryDriver(input);
  }

  static createForTest(input: {
    store: WorkflowStore;
    broker: DurableFeatureDeliveryBroker;
    executionContract: ExecutionContract;
    fenceProvider: (runId: string, taskId: string) => Promise<DeliveryFence>;
    operationTimeoutMs?: number;
  }): FeatureDeliveryRecoveryDriver {
    if (process.env.NODE_ENV !== 'test') throw new Error('test recovery driver unavailable');
    return new FeatureDeliveryRecoveryDriver(input);
  }

  async reconcileFinalizing(runId: string): Promise<DeliveryOperationRecord[]> {
    if (this.#store.getRun(runId)?.state !== 'finalizing') {
      throw new Error('feature delivery recovery requires a finalizing run');
    }
    const prepared = this.#store.listPreparedFeatureDeliveryOperations(runId);
    if (prepared.length === 0) return [];
    const taskIds = [...new Set(prepared.map((operation) => operation.taskId))];
    if (taskIds.length !== 1) {
      throw new Error('prepared feature delivery operations span multiple task authorities');
    }
    const taskId = taskIds[0]!;
    const fence = await this.#bounded(this.#fenceProvider(runId, taskId));
    const result = await this.#bounded(this.#broker.reconcilePrepared({ runId, fence }));
    if (
      result.errors.length > 0 ||
      result.operations.some((operation) => operation.status === 'escalated') ||
      this.#store.listPreparedFeatureDeliveryOperations(runId).length > 0
    ) {
      throw new Error('feature delivery recovery did not reconcile every prepared operation');
    }
    return result.operations;
  }

  async #bounded<T>(operation: Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('feature delivery recovery operation timed out')),
            this.#operationTimeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}

Object.freeze(FeatureDeliveryRecoveryDriver.prototype);
