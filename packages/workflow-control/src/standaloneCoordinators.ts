import { setTimeout as wait } from 'node:timers/promises';
import {
  repairFindingSchema,
  repairDispatchPacketSchema,
  DurableRepairCoordinator,
} from './repairLoops.js';
import { TrustedSourceGit } from './sourceGit.js';
import { isDeepStrictEqual } from 'node:util';
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
import {
  DurableDeliveryBroker,
  deriveDeliveryRequestDigest,
  type DeliveryFence,
} from './deliveryBrokers.js';
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
    approvedParentShas: z.record(z.string().regex(/^[a-f0-9]{40,64}$/u)),
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
  readonly #abort = new AbortController();
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
    this.#abort.abort();
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
    if (action.phase === 'repair') return this.#repair(job, action, fence, assertAuthority);
    if (action.phase === 'pipeline') {
      const transitionId = `${job.execution_id}:pipeline`;
      const previous = this.#store.getTransition(transitionId);
      if (previous) {
        const checksOperationId = (previous.externalArguments as { checksOperationId?: string })
          .checksOperationId;
        if (!checksOperationId) throw new Error('coordinator_pipeline_proof_missing');
        this.#transition(
          action,
          fence,
          transitionId,
          'pipeline',
          'delivery',
          'internal.pipeline_verified',
          {
            arguments: { taskId: action.taskId, checksOperationId },
            result: { headSha: action.headSha },
          },
        );
        return { kind: 'pipeline', checksOperationId, transitionId };
      }
    }
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
    if (action.phase === 'task_accepted')
      return this.#acceptTask(job, action, fence, assertAuthority, beadsBroker, beads);
    const git = LocalGitDeliveryPort.createForWorkflow({
      store: this.#store,
      runId: action.runId,
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
        approvedParentShas: this.#config.approvedParentShas,
        approvedProtectionDigest: this.#config.protectionDigest,
      },
    });
    const reconciled = await delivery.reconcilePrepared({ runId: action.runId, fence });
    if (
      reconciled.errors.length ||
      reconciled.operations.some((operation) => operation.status !== 'committed')
    )
      throw new Error('coordinator_delivery_reconciliation_blocked');
    const binding = coordinatorBinding(this.#contract, action);
    if (action.phase === 'pipeline') return this.#pipeline(job, action, fence, delivery, binding);
    if (action.phase === 'delivery')
      return this.#delivery(action, fence, delivery, binding, github);
    if (action.phase === 'finalizing') return this.#finalizing(action, fence, beadsBroker);
    throw new Error('coordinator_phase_unavailable');
  }
  #repair(
    job: PhaseJob,
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    assertAuthority: () => void,
  ): CoordinatorProof {
    const dispatchId = `${job.execution_id}:repair`;
    const transitionId = `${job.execution_id}:repair-handoff`;
    if (this.#store.getTransition(transitionId)?.status === 'committed')
      return { kind: 'repair', dispatchId, transitionId };
    const row = this.#db
      .prepare(
        "SELECT callback_json FROM delegate_callbacks WHERE callback_id=? AND status='committed'",
      )
      .get(action.callbackId) as { callback_json: string } | undefined;
    if (!row) throw new Error('repair_failure_callback_missing');
    const callback = delegateCallbackSchema.parse(JSON.parse(row.callback_json));
    if (
      callback.parentRunId !== action.runId ||
      callback.parentTaskId !== action.taskId ||
      callback.headSha !== action.headSha ||
      callback.terminalStatus !== 'repair' ||
      !['test_runner', 'code_reviewer'].includes(callback.delegateRole)
    )
      throw new Error('repair_failure_callback_rejected');
    const execution = this.#store.getSchedulerExecution(callback.delegationId);
    const terminal = specialistTerminalResult(execution?.result);
    const evidence = this.#store.getSecureEvidence(
      callback.resultArtifactDigest,
      action.runId,
      action.taskId,
    );
    if (
      !terminal ||
      !evidence ||
      evidence.deletedAtMs !== null ||
      evidence.headSha !== action.headSha
    )
      throw new Error('repair_failure_evidence_missing');
    const coordinator = DurableRepairCoordinator.createForWorkflow({
      store: this.#store,
      contract: this.#contract,
      ownerId: this.#owner,
      fence: () => fence,
      workspaceRoot: this.#root,
      runId: action.runId,
      gitPin: this.#gitPin,
    });
    const summary = terminal.findings[0]?.summary ?? terminal.summary;
    const hypothesis = terminal.findings[0]?.repairHypothesis;
    if (!hypothesis) throw new Error('repair_hypothesis_missing');
    for (const prior of this.#store.listActiveRepairDispatches(action.runId, action.taskId))
      if (prior.id !== dispatchId) coordinator.cancel(prior.id, 'later_verification_failed');
    assertAuthority();
    const observation = repairFindingSchema.parse({
      id: terminal.findings[0]?.id ?? `verification-${action.taskId}`,
      runId: action.runId,
      taskId: action.taskId,
      source: callback.delegateRole === 'test_runner' ? 'test' : 'review',
      producerRole: callback.delegateRole,
      severity: terminal.findings[0]?.severity ?? 'high',
      summary,
      ...(terminal.acceptanceCriteria.failed[0]
        ? { acceptanceCriterion: terminal.acceptanceCriteria.failed[0] }
        : {}),
      evidence: [
        evidenceReferenceSchema.parse({
          digest: evidence.digest,
          mediaType: evidence.mediaType,
          sizeBytes: evidence.sizeBytes,
          kind: evidence.kind,
        }),
      ],
    });
    const earliest = this.#db
      .prepare(
        `SELECT packet_json FROM repair_dispatches
      WHERE run_id=? AND task_id=? AND finding_id=? ORDER BY finding_attempt LIMIT 1`,
      )
      .get(action.runId, action.taskId, observation.id) as { packet_json: string } | undefined;
    const original = earliest
      ? repairDispatchPacketSchema.parse(JSON.parse(earliest.packet_json)).canonicalFinding
      : undefined;
    if (earliest && !original) throw new Error('repair_original_finding_unavailable');
    const decision = coordinator.dispatch({
      dispatchId,
      finding: original ?? observation,
      ...(original ? { observation } : {}),
      hypothesis,
      change: { kind: 'hypothesis', value: hypothesis },
    });
    if (decision.kind !== 'dispatch') throw new Error('repair_budget_exhausted');
    this.#transition(
      action,
      fence,
      transitionId,
      'repair',
      'implementing',
      'internal.repair_dispatched',
      {
        arguments: { taskId: action.taskId, dispatchId: decision.dispatch.id },
        result: { headSha: action.headSha },
      },
    );
    return { kind: 'repair', dispatchId: decision.dispatch.id, transitionId };
  }

  acceptRepairResult(
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    terminal: import('./contracts.js').AgentResult,
    reference: import('./contracts.js').EvidenceReference,
  ): void {
    const active = this.#store.listActiveRepairDispatches(action.runId, action.taskId);
    if (active.length === 0) return;
    const role = action.phase === 'task_verification' ? 'test_runner' : 'code_reviewer';
    const coordinator = DurableRepairCoordinator.createForWorkflow({
      store: this.#store,
      contract: this.#contract,
      ownerId: this.#owner,
      fence: () => fence,
      workspaceRoot: this.#root,
      runId: action.runId,
      gitPin: this.#gitPin,
    });
    const git = new TrustedSourceGit(
      this.#store.getImplementationWorkspace(action.runId, this.#root),
      this.#gitPin.path,
      this.#gitPin.digest,
    );
    for (const dispatch of active) {
      const packet = repairDispatchPacketSchema.parse(dispatch.packet);
      if (packet.producerRole !== role) continue;
      const changedFiles = git
        .run(['diff', '--name-only', '-z', `${dispatch.failureHeadSha}...${action.headSha}`])
        .toString()
        .split('\0')
        .filter(Boolean);
      coordinator.accept(dispatch.id, { ...terminal, changedFiles, evidence: [reference] });
    }
  }

  async #acceptTask(
    job: PhaseJob,
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    assertAuthority: () => void,
    beadsBroker: JournaledBeadsDoltBroker,
    beads: ReturnType<typeof createProductionBeadsDoltPort>,
  ): Promise<CoordinatorProof> {
    const closer = new JournaledBeadsTaskCloser(beadsBroker, beads);
    const gate = LocalExactHeadIntegrationGate.create({
      workspaceRoot: this.#store.getImplementationWorkspace(action.runId, this.#root),
      gitPin: this.#gitPin,
      admission: { assertAuthority, signal: this.#abort.signal },
      approvedParentShas: this.#config.approvedParentShas,
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
      await this.#closeTask(action, fence, gate, orchestrator, closeTransitionId);
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
    if (this.#store.getTransition(integrationTransitionId)?.status !== 'committed') {
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
        {
          arguments: { taskId: action.taskId },
          result: {
            headSha: action.headSha,
            evidenceDigests: verified.evidence.map((item) => item.digest),
          },
        },
      );
    }
    return { kind: 'task_acceptance', closeTransitionId, integrationTransitionId };
  }

  async #closeTask(
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    gate: LocalExactHeadIntegrationGate,
    orchestrator: WorkflowOrchestrator,
    closeTransitionId: string,
  ): Promise<void> {
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
  }
  async #pipeline(
    job: PhaseJob,
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    delivery: DurableDeliveryBroker,
    binding: ReturnType<typeof coordinatorBinding>,
  ): Promise<CoordinatorProof> {
    const ref = `refs/heads/task/${action.taskId}`;
    const pushed = this.#db
      .prepare(
        `SELECT published_sha FROM delivery_approved_heads WHERE run_id=? AND task_id=?
        UNION ALL SELECT published_sha FROM repair_approved_heads WHERE run_id=? AND task_id=?`,
      )
      .get(action.runId, action.taskId, action.runId, action.taskId) as {
      published_sha: string | null;
    };
    // Reuse the original CAS condition after an acknowledged or uncertain push.
    const previousPush = this.#db
      .prepare(
        `SELECT request_json FROM delivery_operations
      WHERE run_id=? AND task_id=? AND kind='git.push'
      AND json_extract(request_json,'$.newSha')=? ORDER BY created_at_ms DESC LIMIT 1`,
      )
      .get(action.runId, action.taskId, action.headSha) as { request_json: string } | undefined;
    const expectedRemoteSha = previousPush
      ? (JSON.parse(previousPush.request_json) as { expectedRemoteSha: string | null })
          .expectedRemoteSha
      : pushed.published_sha;
    await delivery.execute(
      {
        ...binding,
        kind: 'git.push',
        ref,
        expectedRemoteSha,
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
    const checks = await this.#awaitChecks(action, fence, delivery, binding, number);
    const transitionId = `${job.execution_id}:pipeline`;
    this.#transition(
      action,
      fence,
      transitionId,
      'pipeline',
      'delivery',
      'internal.pipeline_verified',
      {
        arguments: { taskId: action.taskId, checksOperationId: checks.id },
        result: { headSha: action.headSha },
      },
    );
    return { kind: 'pipeline', checksOperationId: checks.id, transitionId };
  }

  async #awaitChecks(
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    delivery: DurableDeliveryBroker,
    binding: ReturnType<typeof coordinatorBinding>,
    pullRequestNumber: number,
  ) {
    const checkId = deriveDeliveryRequestDigest([
      binding.repository,
      pullRequestNumber,
      action.headSha,
      this.#contract.authority.github.base,
      this.#config.protectionDigest,
    ]);
    // A passed observation removes its wait; retain the terminal operation as the replay anchor.
    const passed = this.#db
      .prepare(
        `SELECT id FROM delivery_operations WHERE run_id=? AND task_id=?
      AND kind='github.checks' AND status='committed'
      AND json_extract(request_json,'$.headSha')=? ORDER BY created_at_ms DESC`,
      )
      .all(action.runId, action.taskId, action.headSha) as Array<{ id: string }>;
    for (const row of passed) {
      const operation = this.#store.getDeliveryOperation(row.id)!;
      const request = operation.request as {
        pullRequestNumber: number;
        protectionDigest: string;
        base: string;
        requiredChecks: string[];
      };
      const result = operation.result as { checks: Record<string, string> };
      if (
        request.pullRequestNumber === pullRequestNumber &&
        request.protectionDigest === this.#config.protectionDigest &&
        request.base === this.#contract.authority.github.base &&
        isDeepStrictEqual(request.requiredChecks, this.#contract.authority.github.requiredChecks) &&
        request.requiredChecks.every((name) => result.checks[name] === 'success')
      ) {
        const outstanding = this.#store.getWait(action.runId, checkId);
        if (outstanding) {
          if (Date.now() >= outstanding.absoluteDeadlineMs) {
            delivery.expirePipelineWait({
              runId: action.runId,
              taskId: action.taskId,
              checkId,
              eventIdentity: outstanding.eventIdentity,
              fence,
            });
            throw new Error('coordinator_pipeline_deadline_exhausted');
          }
          const settled = delivery.recordPipelineObservation({
            operationId: operation.id,
            fence,
            nextPollAtMs: outstanding.nextPollAtMs,
            absoluteDeadlineMs: outstanding.absoluteDeadlineMs,
          });
          if (settled.kind !== 'passed') throw new Error('coordinator_pipeline_replay_conflict');
        }
        return operation;
      }
    }
    for (;;) {
      const persisted = this.#store.getWait(action.runId, checkId);
      if (persisted && Date.now() >= persisted.absoluteDeadlineMs) {
        delivery.expirePipelineWait({
          runId: action.runId,
          taskId: action.taskId,
          checkId,
          eventIdentity: persisted.eventIdentity,
          fence,
        });
        throw new Error('coordinator_pipeline_deadline_exhausted');
      }
      if (persisted && persisted.nextPollAtMs > Date.now())
        await wait(persisted.nextPollAtMs - Date.now(), undefined, { signal: this.#abort.signal });
      const checks = await delivery.execute(
        {
          ...binding,
          kind: 'github.checks',
          pullRequestNumber,
          headSha: action.headSha,
          base: this.#contract.authority.github.base,
          requiredChecks: this.#contract.authority.github.requiredChecks,
          protectionDigest: this.#config.protectionDigest,
          pollAttempt: persisted?.backoffCount ?? 0,
        },
        fence,
      );
      const deadline =
        persisted?.absoluteDeadlineMs ??
        checks.createdAtMs + this.#contract.retryPolicy.waitDeadlineSeconds * 1000;
      const now = Date.now();
      const delay = Math.min(60000, 1000 * 2 ** Math.min(persisted?.backoffCount ?? 0, 6));
      const decision = delivery.recordPipelineObservation({
        operationId: checks.id,
        fence,
        nextPollAtMs: now + Math.min(delay, Math.max(1, deadline - now - 1)),
        absoluteDeadlineMs: deadline,
      });
      if (decision.kind === 'passed') return checks;
      if (decision.kind === 'failed') throw new Error('coordinator_pipeline_checks_failed');
    }
  }

  async #delivery(
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    delivery: DurableDeliveryBroker,
    binding: ReturnType<typeof coordinatorBinding>,
    github: ReturnType<typeof createProductionGitHubDeliveryPort>,
  ): Promise<CoordinatorProof> {
    const body = `Verified workflow task ${action.taskId}. Head: ${action.headSha}.`;
    const pr = await github.observe({
      ...binding,
      kind: 'github.pr',
      headRef: `task/${action.taskId}`,
      headSha: action.headSha,
      base: this.#contract.authority.github.base,
      title: `${action.taskId}: verified task`,
      body,
      bodyDigest: `sha256:${createHash('sha256').update(body).digest('hex')}`,
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

  async #finalizing(
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    beadsBroker: JournaledBeadsDoltBroker,
  ): Promise<CoordinatorProof> {
    const finalizer = new FeatureFinalizationCoordinator({
      store: this.#store,
      contract: this.#contract,
      broker: beadsBroker,
    });
    const lease = this.#store.acquireLease('closeout', action.runId, this.#owner, 30000);
    const renewal = setInterval(() => {
      try {
        this.#store.assertResourceLease(
          'closeout',
          action.runId,
          this.#owner,
          lease.epoch,
          Date.now(),
        );
        this.#store.acquireLease('closeout', action.runId, this.#owner, 30000);
      } catch {
        this.abort();
      }
    }, 5000);
    try {
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
    } finally {
      clearInterval(renewal);
    }
  }
  #transition(
    action: ExecutePhaseAction,
    fence: DeliveryFence,
    id: string,
    from: 'integration' | 'pipeline' | 'repair',
    to: 'feature_evaluation' | 'delivery' | 'implementing',
    operation: string,
    effect: { arguments: unknown; result: unknown },
  ): void {
    const existing = this.#store.getTransition(id);
    if (existing?.status === 'committed') return;
    if (existing) {
      if (
        existing.status !== 'prepared' ||
        existing.runId !== action.runId ||
        existing.from !== from ||
        existing.to !== to ||
        existing.operation !== operation ||
        existing.contractVersion !== action.contractVersion ||
        existing.policyDigest !== action.policyDigest ||
        !isDeepStrictEqual(existing.externalArguments, effect.arguments)
      )
        throw new Error('coordinator_transition_recovery_conflict');
      if (existing.leaseOwnerId !== this.#owner || existing.leaseEpoch !== fence.runLeaseEpoch)
        this.#store.adoptPreparedTransition(id, this.#owner, fence.runLeaseEpoch, Date.now(), {
          workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
          taskLeaseEpoch: fence.taskLeaseEpoch,
        });
      this.#store.commitTransition(id, this.#owner, fence.runLeaseEpoch, effect.result, Date.now());
      return;
    }
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
      externalArguments: effect.arguments,
      nowMs: Date.now(),
    });
    this.#store.commitTransition(id, this.#owner, fence.runLeaseEpoch, effect.result, Date.now());
  }
}

function coordinatorBinding(contract: ExecutionContract, action: ExecutePhaseAction) {
  return {
    workspaceId: action.workspaceId,
    runId: action.runId,
    taskId: action.taskId,
    repository: contract.authority.github.repository,
    actorRole: 'workflow_orchestrator' as const,
    contractVersion: action.contractVersion,
    policyDigest: action.policyDigest,
  };
}
