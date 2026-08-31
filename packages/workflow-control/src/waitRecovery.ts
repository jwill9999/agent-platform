import {
  DurableDeliveryBroker,
  deriveDeliveryRequestDigest,
  githubChecksRequestSchema,
  type DeliveryFence,
  type PipelineObservationDecision,
} from './deliveryBrokers.js';
import type { WorkflowStore } from './storage.js';

export interface WaitRecoveryResult {
  recovered: Array<{
    runId: string;
    checkId: string;
    decision: PipelineObservationDecision | { kind: 'escalated' };
  }>;
  errors: Array<{ runId: string; checkId: string; message: string }>;
}

export class PipelineWaitRecoveryDriver {
  readonly #store: WorkflowStore;
  readonly #broker: DurableDeliveryBroker;
  readonly #fenceProvider: (runId: string, taskId: string) => Promise<DeliveryFence>;
  readonly #clock: () => number;
  readonly #operationTimeoutMs: number;

  constructor(input: {
    store: WorkflowStore;
    broker: DurableDeliveryBroker;
    fenceProvider: (runId: string, taskId: string) => Promise<DeliveryFence>;
    clock?: () => number;
    operationTimeoutMs?: number;
  }) {
    this.#store = input.store;
    this.#broker = input.broker;
    this.#fenceProvider = input.fenceProvider;
    this.#clock = input.clock ?? Date.now;
    this.#operationTimeoutMs = input.operationTimeoutMs ?? 30_000;
  }

  async recoverDue(): Promise<WaitRecoveryResult> {
    const nowMs = this.#clock();
    const result: WaitRecoveryResult = { recovered: [], errors: [] };
    for (const due of this.#store.listDueWaits(nowMs)) {
      try {
        const wait = this.#store.getWait(due.runId, due.checkId);
        if (wait?.workspaceId === null || wait?.taskId === null || wait === undefined) {
          throw new Error('due pipeline wait has no durable workspace/task binding');
        }
        const fence = await this.#bounded(this.#fenceProvider(due.runId, wait.taskId));
        if (due.deadlineReached) {
          this.#broker.expirePipelineWait({
            runId: due.runId,
            taskId: wait.taskId,
            checkId: due.checkId,
            eventIdentity: wait.eventIdentity,
            fence,
          });
          result.recovered.push({
            runId: due.runId,
            checkId: due.checkId,
            decision: { kind: 'escalated' },
          });
          continue;
        }
        if (wait.operationId === null) {
          throw new Error('pipeline wait has no originating checks operation');
        }
        const previous = this.#store.getDeliveryOperation(wait.operationId);
        if (
          previous === undefined ||
          previous.status !== 'committed' ||
          previous.kind !== 'github.checks' ||
          previous.runId !== due.runId ||
          previous.taskId !== wait.taskId
        ) {
          throw new Error('pipeline wait originating operation is invalid');
        }
        const request = githubChecksRequestSchema.parse(previous.request);
        const expectedCheckId = deriveDeliveryRequestDigest([
          request.repository,
          request.pullRequestNumber,
          request.headSha,
          request.base,
          request.protectionDigest,
        ]);
        if (expectedCheckId !== due.checkId || request.pollAttempt + 1 !== wait.backoffCount) {
          throw new Error('pipeline wait differs from its originating checks identity');
        }
        const operation = await this.#bounded(
          this.#broker.execute({ ...request, pollAttempt: wait.backoffCount }, fence),
        );
        const remaining = wait.absoluteDeadlineMs - nowMs;
        const delay = Math.min(60_000, 1_000 * 2 ** Math.min(wait.backoffCount, 6));
        const nextPollAtMs = nowMs + Math.min(delay, Math.max(1, remaining - 1));
        const decision = this.#broker.recordPipelineObservation({
          operationId: operation.id,
          fence,
          nextPollAtMs,
          absoluteDeadlineMs: wait.absoluteDeadlineMs,
        });
        result.recovered.push({ runId: due.runId, checkId: due.checkId, decision });
      } catch (error) {
        result.errors.push({
          runId: due.runId,
          checkId: due.checkId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  }

  async #bounded<T>(operation: Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('pipeline wait recovery operation timed out')),
            this.#operationTimeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}
