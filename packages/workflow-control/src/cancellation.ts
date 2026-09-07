import { cancellationRecordSchema } from './lifecycle.js';
import type { EvidenceReference, ExecutionContract } from './contracts.js';
import {
  workflowCancellationMutationCapability,
  type WorkflowCancellationRecord,
  type WorkflowStore,
} from './storage.js';

export interface CancellationCleanupClient {
  stopOwnedWork(input: {
    runId: string;
    cancellationId: string;
    stopDeadlineMs: number;
  }): Promise<{ stopped: boolean; incomplete: string[] }>;
  cleanupPreparedEffects(input: {
    runId: string;
    cancellationId: string;
  }): Promise<{ incomplete: string[] }>;
}

const productionCleanupCapability = Symbol('productionCleanupCapability');
const testCleanupCapability = Symbol('testCleanupCapability');

export class OfficialCancellationCleanupPort {
  readonly #stopOwnedWork: CancellationCleanupClient['stopOwnedWork'];
  readonly #cleanupPreparedEffects: CancellationCleanupClient['cleanupPreparedEffects'];

  constructor(client: CancellationCleanupClient, capability: symbol) {
    if (
      capability !== productionCleanupCapability &&
      !(process.env.NODE_ENV === 'test' && capability === testCleanupCapability)
    ) {
      throw new Error('cancellation cleanup port requires the package bootstrap capability');
    }
    this.#stopOwnedWork = client.stopOwnedWork.bind(client);
    this.#cleanupPreparedEffects = client.cleanupPreparedEffects.bind(client);
  }

  static createForTest(client: CancellationCleanupClient): OfficialCancellationCleanupPort {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test cancellation cleanup port is unavailable outside the test runtime');
    }
    return new OfficialCancellationCleanupPort(client, testCleanupCapability);
  }

  stopOwnedWork(input: Parameters<CancellationCleanupClient['stopOwnedWork']>[0]) {
    return this.#stopOwnedWork(input);
  }

  cleanupPreparedEffects(
    input: Parameters<CancellationCleanupClient['cleanupPreparedEffects']>[0],
  ) {
    return this.#cleanupPreparedEffects(input);
  }
}

// Package-internal bootstrap only. Deliberately omitted from the package index.
export function createProductionCancellationCleanupPort(
  client: CancellationCleanupClient,
): OfficialCancellationCleanupPort {
  return new OfficialCancellationCleanupPort(client, productionCleanupCapability);
}

export type CancellationFaultBoundary =
  | 'after_request_commit'
  | 'before_cleanup'
  | 'after_cleanup'
  | 'after_completion_commit';

export type CancellationFaultInjector = (
  boundary: CancellationFaultBoundary,
  record: WorkflowCancellationRecord,
) => void;

export class WorkflowCancellationCoordinator {
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;
  readonly #port: OfficialCancellationCleanupPort;
  #clock: () => number;
  #fault: CancellationFaultInjector;

  constructor(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: OfficialCancellationCleanupPort;
  }) {
    if (!(input.port instanceof OfficialCancellationCleanupPort)) {
      throw new Error('workflow cancellation requires the registered cleanup port');
    }
    this.#store = input.store;
    this.#contract = input.contract;
    this.#port = input.port;
    this.#clock = finiteNondecreasingClock(Date.now);
    this.#fault = () => undefined;
  }

  static createForTest(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    port: OfficialCancellationCleanupPort;
    clock?: () => number;
    fault?: CancellationFaultInjector;
  }): WorkflowCancellationCoordinator {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test cancellation coordinator is unavailable outside tests');
    }
    const coordinator = new WorkflowCancellationCoordinator(input);
    coordinator.#clock = finiteNondecreasingClock(input.clock ?? Date.now);
    coordinator.#fault = input.fault ?? (() => undefined);
    return coordinator;
  }

  async cancel(input: {
    id: string;
    runId: string;
    requestedBy: string;
    reason: string;
    stopDeadlineMs: number;
    retainedEvidence: readonly EvidenceReference[];
    ownerId: string;
    workspaceLeaseEpoch: number;
    runLeaseEpoch: number;
  }): Promise<WorkflowCancellationRecord> {
    this.#store.assertRunUsesContract(input.runId, this.#contract);
    const existing = this.#store.getWorkflowCancellation(input.runId);
    const requestedAtMs = existing?.requestedAtMs ?? this.#clock();
    cancellationRecordSchema.parse({
      requestedAt: new Date(requestedAtMs).toISOString(),
      requestedBy: input.requestedBy,
      reason: input.reason,
      stopDeadline: new Date(input.stopDeadlineMs).toISOString(),
      ownedWorkStopped: false,
      incompleteCleanup: [],
      retainedEvidence: input.retainedEvidence,
    });
    const record = this.#store.requestWorkflowCancellation(
      { ...input, requestedAtMs, nowMs: requestedAtMs },
      workflowCancellationMutationCapability,
    );
    if (record.status !== 'requested') return record;
    this.#fault('after_request_commit', record);
    return this.#completeRequested(record, {
      ownerId: input.ownerId,
      workspaceLeaseEpoch: input.workspaceLeaseEpoch,
      runLeaseEpoch: input.runLeaseEpoch,
    });
  }

  async resume(input: {
    runId: string;
    ownerId: string;
    workspaceLeaseEpoch: number;
    runLeaseEpoch: number;
  }): Promise<WorkflowCancellationRecord> {
    this.#store.assertRunUsesContract(input.runId, this.#contract);
    const record = this.#store.getWorkflowCancellation(input.runId);
    if (record === undefined) throw new Error('cancellation request not found');
    if (record.status !== 'requested') return record;
    return this.#completeRequested(record, input);
  }

  async #completeRequested(
    record: WorkflowCancellationRecord,
    fence: { ownerId: string; workspaceLeaseEpoch: number; runLeaseEpoch: number },
  ): Promise<WorkflowCancellationRecord> {
    this.#fault('before_cleanup', record);
    const remainingMs = Math.max(0, record.stopDeadlineMs - this.#clock());
    const [work, effects] =
      remainingMs === 0
        ? [
            { stopped: false, incomplete: ['stop-owned-work-timeout'] },
            { incomplete: ['cleanup-prepared-effects-timeout'] },
          ]
        : await Promise.all([
            this.#boundedCleanup(
              this.#port.stopOwnedWork({
                runId: record.runId,
                cancellationId: record.id,
                stopDeadlineMs: record.stopDeadlineMs,
              }),
              remainingMs,
              { stopped: false, incomplete: ['stop-owned-work-timeout'] },
            ),
            this.#boundedCleanup(
              this.#port.cleanupPreparedEffects({
                runId: record.runId,
                cancellationId: record.id,
              }),
              remainingMs,
              { incomplete: ['cleanup-prepared-effects-timeout'] },
            ),
          ]);
    this.#fault('after_cleanup', record);
    const completed = this.#store.completeWorkflowCancellation(
      {
        runId: record.runId,
        ownedWorkStopped: work.stopped,
        incompleteCleanup: [...work.incomplete, ...effects.incomplete],
        ...fence,
        nowMs: this.#clock(),
      },
      workflowCancellationMutationCapability,
    );
    if (completed.status !== 'requested') this.#fault('after_completion_commit', completed);
    return completed;
  }

  async #boundedCleanup<T>(operation: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((resolve) => {
          timeout = setTimeout(() => resolve(fallback), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}

export class WorkflowCancellationRecoveryDriver {
  readonly #store: WorkflowStore;
  readonly #coordinator: WorkflowCancellationCoordinator;
  readonly #fenceProvider: (
    runId: string,
  ) => Promise<{ ownerId: string; workspaceLeaseEpoch: number; runLeaseEpoch: number }>;

  constructor(input: {
    store: WorkflowStore;
    coordinator: WorkflowCancellationCoordinator;
    fenceProvider: (
      runId: string,
    ) => Promise<{ ownerId: string; workspaceLeaseEpoch: number; runLeaseEpoch: number }>;
  }) {
    this.#store = input.store;
    this.#coordinator = input.coordinator;
    this.#fenceProvider = input.fenceProvider;
  }

  async recoverRequested(): Promise<{
    recovered: WorkflowCancellationRecord[];
    errors: Array<{ runId: string; message: string }>;
  }> {
    const result: {
      recovered: WorkflowCancellationRecord[];
      errors: Array<{ runId: string; message: string }>;
    } = { recovered: [], errors: [] };
    for (const record of this.#store.listRequestedWorkflowCancellations()) {
      try {
        const fence = await this.#boundedFence(
          this.#fenceProvider(record.runId),
          Math.max(1, Math.min(30_000, record.stopDeadlineMs - Date.now())),
        );
        result.recovered.push(await this.#coordinator.resume({ runId: record.runId, ...fence }));
      } catch (error) {
        result.errors.push({
          runId: record.runId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  }

  async #boundedFence<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('cancellation recovery fence acquisition timed out')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}

function finiteNondecreasingClock(source: () => number): () => number {
  let previous = Number.NEGATIVE_INFINITY;
  return () => {
    const current = source();
    if (!Number.isFinite(current) || current < previous) {
      throw new Error('cancellation clock must be finite and nondecreasing');
    }
    previous = current;
    return current;
  };
}
