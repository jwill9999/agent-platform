import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { isAbsolute } from 'node:path';
import { ContentAddressedArtifactStore, JournaledArtifactRecorder } from './artifacts.js';
import { LocalExactHeadIntegrationGate } from './integrationGate.js';
import { WorkflowOrchestrator } from './orchestrator.js';
import {
  JournaledBeadsDoltBroker,
  JournaledBeadsTaskCloser,
  createProductionBeadsDoltPort,
} from './reconciliation.js';
import { DurableDeliveryBroker, type DeliveryFence } from './deliveryBrokers.js';
import { CompositeDeliveryMutationPort, LocalGitDeliveryPort } from './gitDeliveryPort.js';
import { createProductionGitHubDeliveryPort } from './githubDeliveryPort.js';
import { FeatureFinalizationCoordinator } from './finalization.js';
import { deriveTransitionIdempotencyKey } from './lifecycle.js';
import { delegateCallbackSchema } from './governedOperations.js';
import { specialistTerminalResult } from './specialistTerminalResult.js';
import type { ExecutePhaseAction, PhaseJob } from './phaseJobs.js';
import type { CoordinatorProof } from './coordinatorReceipts.js';
import type { WorkflowStore } from './storage.js';
import type { DockerIsolatedSpecialistLauncher } from './specialistLauncher.js';
import { evidenceReferenceSchema, type ExecutionContract, type TaskPacket } from './contracts.js';
import { CoordinatorTransport, coordinatorTransportSchema } from './coordinatorTransport.js';

export const standaloneCoordinatorConfigSchema = z
  .object({
    transport: coordinatorTransportSchema,
    artifactRoot: z.string().refine(isAbsolute),
    checkCommands: z.record(z.array(z.string()).min(1)),
    remoteName: z.string().regex(/^[A-Za-z0-9._-]+$/u),
    protectionDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  })
  .strict();
export type StandaloneCoordinatorConfig = z.infer<typeof standaloneCoordinatorConfigSchema>;

/** Production composition. Services use the pinned operator adapter; workers cannot supply ports,
 * coordinator receipts or service credentials. Absence of configuration is a launch blocker.
 */
export class StandaloneCoordinators {
  readonly #db: Database.Database;
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;
  readonly #config: StandaloneCoordinatorConfig;
  readonly #transport: CoordinatorTransport;
  readonly #root: string;
  readonly #gitPin: { path: string; digest: string };
  readonly #launcher: DockerIsolatedSpecialistLauncher;
  readonly #owner: string;
  constructor(input: {
    database: string;
    store: WorkflowStore;
    contract: ExecutionContract;
    config: StandaloneCoordinatorConfig;
    sourceRoot: string;
    gitPin: { path: string; digest: string };
    launcher: DockerIsolatedSpecialistLauncher;
    owner: string;
  }) {
    this.#config = standaloneCoordinatorConfigSchema.parse(input.config);
    this.#transport = new CoordinatorTransport(this.#config.transport);
    this.#db = new Database(input.database, { readonly: true, fileMustExist: true });
    this.#store = input.store;
    this.#contract = input.contract;
    this.#root = input.sourceRoot;
    this.#gitPin = input.gitPin;
    this.#launcher = input.launcher;
    this.#owner = input.owner;
  }
  abort(): void {
    this.#transport.abort();
  }
  close(): void {
    this.abort();
    this.#db.close();
  }
  async execute(
    job: PhaseJob,
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    assertAuthority: () => void,
  ): Promise<CoordinatorProof> {
    assertAuthority();
    const call = <T>(method: string, args: unknown) =>
      this.#transport.call<T>(method, args, assertAuthority);
    const beads = createProductionBeadsDoltPort(this.#root, {
      readIssue: (workspaceRoot, taskId) => call('beads.readIssue', { workspaceRoot, taskId }),
      claimIssue: (workspaceRoot, taskId, idempotencyKey) =>
        call('beads.claimIssue', { workspaceRoot, taskId, idempotencyKey }),
      closeIssue: (workspaceRoot, taskId, reason, idempotencyKey) =>
        call('beads.closeIssue', { workspaceRoot, taskId, reason, idempotencyKey }),
      readDoltSync: (workspaceRoot, idempotencyKey) =>
        call('beads.readDoltSync', { workspaceRoot, idempotencyKey }),
      pushDolt: (workspaceRoot, idempotencyKey) =>
        call('beads.pushDolt', { workspaceRoot, idempotencyKey }),
    });
    const beadsBroker = new JournaledBeadsDoltBroker(this.#store, beads);
    if (action.phase === 'task_accepted') {
      const closer = new JournaledBeadsTaskCloser(beadsBroker, beads);
      const gate = LocalExactHeadIntegrationGate.create({
        workspaceRoot: this.#root,
        gitPin: this.#gitPin,
        artifacts: new JournaledArtifactRecorder(
          new ContentAddressedArtifactStore(this.#config.artifactRoot),
          this.#store,
        ),
        checkCommands: this.#config.checkCommands as Record<string, [string, ...string[]]>,
      });
      const orchestrator = new WorkflowOrchestrator({
        store: this.#store,
        contract: this.#contract,
        closer,
        launcher: this.#launcher,
        integrationGate: gate,
        ownerId: this.#owner,
      });
      const closeTransitionId = `${job.execution_id}:task-close`;
      const integrationTransitionId = `${job.execution_id}:integration`;
      if (!this.#store.getTransition(closeTransitionId)) {
        const row = this.#db
          .prepare('SELECT callback_json FROM delegate_callbacks WHERE callback_id=?')
          .get(action.callbackId) as { callback_json: string } | undefined;
        if (!row) throw new Error('coordinator_review_callback_missing');
        const callback = delegateCallbackSchema.parse(JSON.parse(row.callback_json));
        const execution = this.#store.getSchedulerExecution(callback.delegationId);
        if (
          !execution ||
          callback.delegateRole !== 'code_reviewer' ||
          callback.terminalStatus !== 'continue'
        )
          throw new Error('coordinator_review_not_accepted');
        const terminal = specialistTerminalResult(execution.result);
        if (!terminal) throw new Error('coordinator_review_result_missing');
        const evidence = this.#store.getSecureEvidence(
          callback.resultArtifactDigest,
          action.runId,
          action.taskId,
        );
        if (!evidence || evidence.headSha !== action.headSha || evidence.deletedAtMs !== null)
          throw new Error('coordinator_review_evidence_missing');
        const verified = await gate.verify({
          contract: this.#contract,
          runId: action.runId,
          taskId: action.taskId,
        });
        if (verified.headSha !== action.headSha) throw new Error('coordinator_head_changed');
        const reference = evidenceReferenceSchema.parse({
          digest: evidence.digest,
          mediaType: evidence.mediaType,
          sizeBytes: evidence.sizeBytes,
          kind: evidence.kind,
        });
        const packet: TaskPacket = orchestrator.createTaskPacket({
          runId: action.runId,
          taskId: action.taskId,
          evidence: [reference],
        });
        await orchestrator.acceptAndCloseTask({
          packet,
          result: { ...terminal, changedFiles: verified.changedFiles, evidence: [reference] },
          transitionId: closeTransitionId,
          workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
          runLeaseEpoch: fence.runLeaseEpoch,
          taskLeaseEpoch: fence.taskLeaseEpoch,
        });
      } else if (this.#store.getTransition(closeTransitionId)?.status !== 'committed') {
        await closer.reconcilePreparedTaskTransition({
          runId: action.runId,
          taskId: action.taskId,
          recoveryOwnerId: this.#owner,
          recoveryRunLeaseEpoch: fence.runLeaseEpoch,
          recoveryWorkspaceLeaseEpoch: fence.workspaceLeaseEpoch,
          recoveryTaskLeaseEpoch: fence.taskLeaseEpoch,
          contractVersion: action.contractVersion,
          policyDigest: action.policyDigest,
          nowMs: Date.now(),
        });
      }
      if (!this.#store.getTransition(integrationTransitionId)) {
        const verified = await gate.verify({
          contract: this.#contract,
          runId: action.runId,
          taskId: action.taskId,
        });
        assertAuthority();
        if (verified.headSha !== action.headSha) throw new Error('coordinator_head_changed');
        this.#transition(
          action,
          fence,
          integrationTransitionId,
          'integration',
          'feature_evaluation',
          'internal.integration_verified',
          { taskId: action.taskId },
          {
            headSha: action.headSha,
            evidenceDigests: verified.evidence.map((item) => item.digest),
          },
        );
      }
      return { kind: 'task_acceptance', closeTransitionId, integrationTransitionId };
    }
    const git = LocalGitDeliveryPort.create({
      workspaceRoot: this.#root,
      remoteName: this.#config.remoteName,
      gitPin: this.#gitPin,
      remote: {
        observeRef: (input) => call('git.observeRef', input),
        pushCas: (input) => call('git.pushCas', input),
      },
    });
    const github = createProductionGitHubDeliveryPort(
      {
        findPullRequest: (input) => call('github.findPullRequest', input),
        createPullRequest: (input) => call('github.createPullRequest', input),
        compareAndMergePullRequest: (input) => call('github.compareAndMergePullRequest', input),
      },
      this.#contract.authority.github.repository,
    );
    const delivery = DurableDeliveryBroker.create({
      store: this.#store,
      contract: this.#contract,
      port: CompositeDeliveryMutationPort.create(git, github),
      workspaceRoot: this.#root,
      policy: {
        authorName: 'Workflow importer',
        authorEmail: 'workflow@localhost',
        approvedParentShas: {},
        approvedProtectionDigest: this.#config.protectionDigest,
      },
    });
    const binding = {
      workspaceId: action.workspaceId,
      runId: action.runId,
      taskId: action.taskId,
      repository: this.#contract.authority.github.repository,
      actorRole: 'workflow_orchestrator' as const,
      contractVersion: action.contractVersion,
      policyDigest: action.policyDigest,
    };
    if (action.phase === 'pipeline') {
      const ref = `refs/heads/task/${action.taskId}`;
      const pushed = this.#db
        .prepare(
          `SELECT published_sha FROM delivery_approved_heads WHERE run_id=? AND task_id=?
        UNION ALL SELECT published_sha FROM repair_approved_heads WHERE run_id=? AND task_id=?`,
        )
        .get(action.runId, action.taskId, action.runId, action.taskId) as {
        published_sha: string | null;
      };
      await delivery.execute(
        {
          ...binding,
          kind: 'git.push',
          ref,
          expectedRemoteSha: pushed.published_sha,
          newSha: action.headSha,
        },
        fence,
      );
      const body = `Verified workflow task ${action.taskId}. Head: ${action.headSha}.`;
      const pr = await delivery.execute(
        {
          ...binding,
          kind: 'github.pr',
          headRef: ref.slice('refs/heads/'.length),
          headSha: action.headSha,
          base: this.#contract.authority.github.base,
          title: `${action.taskId}: verified task`,
          body,
          bodyDigest: `sha256:${createHash('sha256').update(body).digest('hex')}`,
        },
        fence,
      );
      const number = (pr.result as { pullRequestNumber: number }).pullRequestNumber;
      const checks = await delivery.execute(
        {
          ...binding,
          kind: 'github.checks',
          pullRequestNumber: number,
          headSha: action.headSha,
          base: this.#contract.authority.github.base,
          requiredChecks: this.#contract.authority.github.requiredChecks,
          protectionDigest: this.#config.protectionDigest,
          pollAttempt: 0,
        },
        fence,
      );
      const observed = checks.result as { checks: Record<string, string> };
      if (
        this.#contract.authority.github.requiredChecks.some(
          (name) => observed.checks[name] !== 'success',
        )
      )
        throw new Error('coordinator_pipeline_checks_not_passed');
      const transitionId = `${job.execution_id}:pipeline`;
      this.#transition(
        action,
        fence,
        transitionId,
        'pipeline',
        'delivery',
        'internal.pipeline_verified',
        { taskId: action.taskId, checksOperationId: checks.id },
        { headSha: action.headSha },
      );
      return { kind: 'pipeline', checksOperationId: checks.id, transitionId };
    }
    if (action.phase === 'delivery') {
      const pr = await github.observe({
        ...binding,
        kind: 'github.pr',
        headRef: `task/${action.taskId}`,
        headSha: action.headSha,
        base: this.#contract.authority.github.base,
        title: `${action.taskId}: verified task`,
        body: `Verified workflow task ${action.taskId}. Head: ${action.headSha}.`,
        bodyDigest: `sha256:${createHash('sha256').update(`Verified workflow task ${action.taskId}. Head: ${action.headSha}.`).digest('hex')}`,
      });
      if (pr.kind !== 'expected') throw new Error('coordinator_pr_unavailable');
      const merge = await delivery.execute(
        {
          ...binding,
          kind: 'github.merge',
          pullRequestNumber: (pr.result as { pullRequestNumber: number }).pullRequestNumber,
          headSha: action.headSha,
          base: this.#contract.authority.github.base,
          requiredChecks: this.#contract.authority.github.requiredChecks,
          protectionDigest: this.#config.protectionDigest,
          reviewDecision: 'approved',
          mergeMethod: this.#contract.authority.github.mergeMethod,
          adminBypass: false,
        },
        fence,
      );
      return { kind: 'delivery', mergeOperationId: merge.id };
    }
    if (action.phase === 'finalizing') {
      const finalizer = new FeatureFinalizationCoordinator({
        store: this.#store,
        contract: this.#contract,
        broker: beadsBroker,
      });
      const lease = this.#store.acquireLease('closeout', action.runId, this.#owner, 30000);
      const report = await finalizer.finalize({
        runId: action.runId,
        epicId: this.#contract.featureId,
        fence: {
          ownerId: this.#owner,
          workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
          runLeaseEpoch: fence.runLeaseEpoch,
          closeoutLeaseEpoch: lease.epoch,
        },
      });
      return { kind: 'finalization', reportDigest: report.reportDigest };
    }
    throw new Error('coordinator_phase_unavailable');
  }
  #transition(
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    id: string,
    from: 'integration' | 'pipeline',
    to: 'feature_evaluation' | 'delivery',
    operation: string,
    args: unknown,
    result: unknown,
  ): void {
    const existing = this.#store.getTransition(id);
    if (existing?.status === 'committed') return;
    if (existing) throw new Error('coordinator_transition_recovery_required');
    const version = this.#store.getRun(action.runId)!.version;
    this.#store.prepareTransition({
      id,
      runId: action.runId,
      from,
      to,
      operation,
      expectedRunVersion: version,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: action.runId,
        transitionId: id,
        operation,
        expectedVersion: version,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: action.contractVersion,
      policyDigest: action.policyDigest,
      leaseOwnerId: this.#owner,
      leaseEpoch: fence.runLeaseEpoch,
      transitionContext: {
        workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
        taskLeaseEpoch: fence.taskLeaseEpoch,
      },
      expectedExternalState: { status: 'internal' },
      externalArguments: args,
      nowMs: Date.now(),
    });
    this.#store.commitTransition(id, this.#owner, fence.runLeaseEpoch, result, Date.now());
  }
}
