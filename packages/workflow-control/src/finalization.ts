import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  EXECUTION_CONTRACT_VERSION,
  evidenceReferenceSchema,
  type ExecutionContract,
} from './contracts.js';
import { deriveTransitionIdempotencyKey } from './lifecycle.js';
import { isJournaledBeadsDoltBrokerForStore, JournaledBeadsDoltBroker } from './reconciliation.js';
import {
  workflowFinalizationMutationCapability,
  type FeatureFinalizationRecord,
  type TransitionRecord,
  type WorkflowStore,
} from './storage.js';

const identifierSchema = z.string().min(1).max(200);
const shaSchema = z.string().regex(/^[a-f0-9]{40,64}$/u);

export const finalAcceptanceEvidenceSchema = z
  .object({
    criterion: z.string().min(1),
    implementation: z.array(z.string().min(1)).min(1),
    taskId: identifierSchema,
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

export const featureFinalReportSchema = z
  .object({
    version: z.literal(1),
    featureId: identifierSchema,
    runId: identifierSchema,
    epicId: identifierSchema,
    repository: z.string().min(3),
    destination: z.string().min(1),
    mergedHeadSha: shaSchema,
    mergeSha: shaSchema,
    mergeEventIdentity: identifierSchema,
    evaluationId: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    childTaskIds: z.array(identifierSchema).min(1),
    acceptance: z.array(finalAcceptanceEvidenceSchema).min(1),
    generatedAtMs: z.number().int().nonnegative(),
  })
  .strict();

export type FinalAcceptanceEvidence = z.infer<typeof finalAcceptanceEvidenceSchema>;
export type FeatureFinalReport = z.infer<typeof featureFinalReportSchema>;

export type FinalizationFaultBoundary =
  | 'before_report_commit'
  | 'after_report_commit'
  | 'before_run_close'
  | 'after_run_close';

export type FinalizationFaultInjector = (
  boundary: FinalizationFaultBoundary,
  runId: string,
) => void;

export interface FinalizationFence {
  ownerId: string;
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  closeoutLeaseEpoch: number;
}

export class FeatureFinalizationCoordinator {
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;
  readonly #broker: JournaledBeadsDoltBroker;
  #clock: () => number;
  #fault: FinalizationFaultInjector;

  constructor(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    broker: JournaledBeadsDoltBroker;
  }) {
    if (!(input.broker instanceof JournaledBeadsDoltBroker)) {
      throw new Error('feature closeout requires the exclusive journaled Beads/Dolt broker');
    }
    if (!isJournaledBeadsDoltBrokerForStore(input.broker, input.store)) {
      throw new Error('feature closeout broker journals to a different workflow store');
    }
    this.#store = input.store;
    this.#contract = input.contract;
    this.#broker = input.broker;
    this.#clock = finiteNondecreasingClock(Date.now);
    this.#fault = () => undefined;
  }

  static createForTest(input: {
    store: WorkflowStore;
    contract: ExecutionContract;
    broker: JournaledBeadsDoltBroker;
    clock?: () => number;
    fault?: FinalizationFaultInjector;
  }): FeatureFinalizationCoordinator {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test feature finalization coordinator is unavailable outside tests');
    }
    const coordinator = new FeatureFinalizationCoordinator(input);
    coordinator.#clock = finiteNondecreasingClock(input.clock ?? Date.now);
    coordinator.#fault = input.fault ?? (() => undefined);
    return coordinator;
  }

  async finalize(input: {
    runId: string;
    epicId: string;
    fence: FinalizationFence;
  }): Promise<FeatureFinalizationRecord> {
    this.#store.assertRunUsesContract(input.runId, this.#contract);
    const existing = this.#store.getFeatureFinalization(input.runId);
    if (existing?.status === 'closed') return existing;
    this.#assertFences(input.runId, input.fence);
    await this.#reconcilePrepared(input.runId, input.fence);

    let finalization = this.#store.getFeatureFinalization(input.runId);
    if (finalization === undefined) {
      const report = this.#buildReport(input.runId, input.epicId);
      const reportDigest = `sha256:${createHash('sha256')
        .update(JSON.stringify(report))
        .digest('hex')}`;
      this.#fault('before_report_commit', input.runId);
      finalization = this.#store.recordFeatureFinalization(
        {
          runId: input.runId,
          featureId: this.#contract.featureId,
          epicId: input.epicId,
          childTaskIds: report.childTaskIds,
          reportDigest,
          report,
          evidenceBindings: report.acceptance.flatMap((binding) =>
            binding.evidence.map((evidence) => ({
              criterion: binding.criterion,
              taskId: binding.taskId,
              digest: evidence.digest,
              mediaType: evidence.mediaType,
              sizeBytes: evidence.sizeBytes,
              kind: evidence.kind,
            })),
          ),
          ...input.fence,
          createdAtMs: this.#clock(),
        },
        workflowFinalizationMutationCapability,
      );
      this.#fault('after_report_commit', input.runId);
    }
    const durableReport = featureFinalReportSchema.parse(finalization.report);
    if (durableReport.epicId !== input.epicId) {
      throw new Error('finalization epic differs from the durable report intent');
    }
    await this.#assertChildrenClosed(durableReport.childTaskIds);

    await this.#executeCloseoutTransition({
      id: `closeout:${input.runId}:epic-close`,
      operation: 'beads.task_close',
      expectedExternalState: { status: 'closed' },
      externalArguments: {
        taskId: durableReport.epicId,
        reason: 'All feature acceptance criteria and delivery gates are verified',
        evidenceDigests: durableReport.acceptance.flatMap((binding) =>
          binding.evidence.map((evidence) => evidence.digest),
        ),
      },
      runId: input.runId,
      fence: input.fence,
    });
    await this.#executeCloseoutTransition({
      id: `closeout:${input.runId}:dolt-sync`,
      operation: 'beads.dolt_push',
      expectedExternalState: { status: 'synced' },
      externalArguments: { featureId: this.#contract.featureId },
      runId: input.runId,
      fence: input.fence,
    });

    finalization = this.#store.verifyFeatureFinalizationEffects(
      { runId: input.runId, ...input.fence, nowMs: this.#clock() },
      workflowFinalizationMutationCapability,
    );
    this.#fault('before_run_close', input.runId);
    finalization = this.#store.closeFeatureFinalization(
      { runId: input.runId, ...input.fence, nowMs: this.#clock() },
      workflowFinalizationMutationCapability,
    );
    this.#fault('after_run_close', input.runId);
    return finalization;
  }

  async #reconcilePrepared(runId: string, fence: FinalizationFence): Promise<void> {
    const prepared = this.#store.listPreparedTransitions(runId);
    if (prepared.length === 0) return;
    if (
      prepared.some(
        (transition) =>
          transition.operation !== 'beads.task_close' && transition.operation !== 'beads.dolt_push',
      )
    ) {
      throw new Error('finalization found a non-closeout prepared transition');
    }
    await this.#broker.reconcilePrepared({
      runId,
      recoveryOwnerId: fence.ownerId,
      recoveryLeaseEpoch: fence.runLeaseEpoch,
      recoveryWorkspaceLeaseEpoch: fence.workspaceLeaseEpoch,
      recoveryCloseoutLeaseEpoch: fence.closeoutLeaseEpoch,
      currentContractVersion: this.#contract.contractVersion,
      currentPolicyDigest: this.#contract.policyDigest,
      nowMs: this.#clock(),
      operations: ['beads.task_close', 'beads.dolt_push'],
    });
  }

  async #assertChildrenClosed(childTaskIds: readonly string[]): Promise<void> {
    const unique = [...new Set(childTaskIds)];
    if (
      unique.length !== childTaskIds.length ||
      this.#contract.tasks.some((task) => !unique.includes(task.id))
    ) {
      throw new Error('closeout child set does not cover the approved task graph');
    }
    const snapshots = await this.#broker.readTaskSnapshots(unique);
    if (snapshots.some((snapshot) => snapshot.status !== 'closed')) {
      throw new Error('feature closeout requires every implementation child to be closed');
    }
  }

  async #executeCloseoutTransition(input: {
    id: string;
    runId: string;
    operation: 'beads.task_close' | 'beads.dolt_push';
    expectedExternalState: unknown;
    externalArguments: unknown;
    fence: FinalizationFence;
  }): Promise<TransitionRecord> {
    const existing = this.#store.getTransition(input.id);
    if (existing !== undefined) {
      if (existing.status === 'committed') return existing;
      if (existing.status === 'escalated') throw new Error(`${input.operation} is escalated`);
      await this.#reconcilePrepared(input.runId, input.fence);
      const reconciled = this.#store.getTransition(input.id);
      if (reconciled?.status !== 'committed') {
        throw new Error(`${input.operation} recovery did not commit`);
      }
      return reconciled;
    }
    const run = this.#store.getRun(input.runId);
    if (run?.state !== 'finalizing' || !run.mergeVerified) {
      throw new Error('closeout effects require a verified merge in finalizing');
    }
    const idempotencyKey = deriveTransitionIdempotencyKey({
      runId: input.runId,
      transitionId: input.id,
      operation: input.operation,
      expectedVersion: run.version,
    });
    return this.#broker.execute({
      id: input.id,
      runId: input.runId,
      from: 'finalizing',
      to: 'finalizing',
      operation: input.operation,
      expectedRunVersion: run.version,
      idempotencyKey,
      actorRole: 'workflow_orchestrator',
      contractVersion: EXECUTION_CONTRACT_VERSION,
      policyDigest: this.#contract.policyDigest,
      leaseOwnerId: input.fence.ownerId,
      leaseEpoch: input.fence.runLeaseEpoch,
      transitionContext: {
        workspaceLeaseEpoch: input.fence.workspaceLeaseEpoch,
        closeoutLeaseEpoch: input.fence.closeoutLeaseEpoch,
      },
      expectedExternalState: input.expectedExternalState,
      externalArguments: input.externalArguments,
      nowMs: this.#clock(),
    });
  }

  #buildReport(runId: string, epicId: string): FeatureFinalReport {
    const merge = this.#store.getCommittedMergeAttestation(runId);
    const request = merge?.request as Record<string, unknown> | undefined;
    const result = merge?.result as Record<string, unknown> | undefined;
    const mergedHeadSha = request?.headSha;
    if (typeof mergedHeadSha !== 'string') throw new Error('committed merge head is unavailable');
    const evaluation = this.#store.getPassedFeatureEvaluation(runId, mergedHeadSha);
    const evaluationResult = evaluation?.result as Record<string, unknown> | undefined;
    if (evaluation === undefined || !Array.isArray(evaluationResult?.criteria)) {
      throw new Error('passed feature evaluation at the merged head is unavailable');
    }
    const parsedAcceptance = evaluationResult.criteria.map((criterion) => {
      const parsed = z
        .object({
          criterion: z.string().min(1),
          status: z.literal('passed'),
          summary: z.string().min(1),
          evidence: z.array(evidenceReferenceSchema).min(1),
        })
        .strict()
        .parse(criterion);
      return finalAcceptanceEvidenceSchema.parse({
        criterion: parsed.criterion,
        implementation: [parsed.summary],
        taskId: evaluation.taskId,
        evidence: parsed.evidence,
      });
    });
    const criteria = parsedAcceptance.map((binding) => binding.criterion);
    if (
      criteria.length !== this.#contract.acceptanceCriteria.length ||
      new Set(criteria).size !== criteria.length ||
      this.#contract.acceptanceCriteria.some((criterion) => !criteria.includes(criterion))
    ) {
      throw new Error('final report must map every approved acceptance criterion exactly once');
    }
    return featureFinalReportSchema.parse({
      version: 1,
      featureId: this.#contract.featureId,
      runId,
      epicId,
      repository: this.#contract.authority.github.repository,
      destination: this.#contract.authority.deliveryTarget,
      mergedHeadSha: request?.headSha,
      mergeSha: result?.mergeSha,
      mergeEventIdentity: result?.eventIdentity,
      evaluationId: evaluation.id,
      childTaskIds: [
        ...this.#contract.tasks.map((task) => task.id),
        ...this.#store.listCommittedRepairChildIds(runId),
      ],
      acceptance: parsedAcceptance,
      generatedAtMs: this.#clock(),
    });
  }

  #assertFences(runId: string, fence: FinalizationFence): void {
    const nowMs = this.#clock();
    this.#store.assertResourceLease(
      'workspace',
      this.#contract.workspaceId,
      fence.ownerId,
      fence.workspaceLeaseEpoch,
      nowMs,
    );
    this.#store.assertResourceLease('run', runId, fence.ownerId, fence.runLeaseEpoch, nowMs);
    this.#store.assertResourceLease(
      'closeout',
      runId,
      fence.ownerId,
      fence.closeoutLeaseEpoch,
      nowMs,
    );
  }
}

function finiteNondecreasingClock(source: () => number): () => number {
  let previous = Number.NEGATIVE_INFINITY;
  return () => {
    const current = source();
    if (!Number.isFinite(current) || current < previous) {
      throw new Error('feature finalization clock must be finite and nondecreasing');
    }
    previous = current;
    return current;
  };
}
