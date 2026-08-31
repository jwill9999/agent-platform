import { randomUUID } from 'node:crypto';

import {
  agentResultSchema,
  assertTaskPacketWithinContract,
  type AgentResult,
  type EvidenceReference,
  type ExecutionContract,
  type TaskPacket,
  type WorkflowRole,
} from './contracts.js';
import { LocalExactHeadIntegrationGate } from './integrationGate.js';
import { deriveTransitionIdempotencyKey } from './lifecycle.js';
import { JournaledBeadsTaskCloser } from './reconciliation.js';
import { DockerIsolatedSpecialistLauncher } from './specialistLauncher.js';
import type { SchedulerExecutionRecord, WorkflowStore } from './storage.js';

export interface BeadsTaskSnapshot {
  id: string;
  status: 'open' | 'in_progress' | 'closed';
  blockingDependencies: string[];
}

export interface SpecialistReservation {
  id: string;
  role: WorkflowRole;
  mode: 'read_only' | 'mutating';
  deadlineMs: number;
  cancelled: boolean;
}

const MUTATING_OPERATIONS = new Set([
  'workspace.patch',
  'beads.mutate',
  'git.commit',
  'git.push',
  'github.deliver',
]);

function pathWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export function selectBeadsReadyTasks(
  contract: ExecutionContract,
  snapshots: readonly BeadsTaskSnapshot[],
): string[] {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return contract.tasks
    .filter((task) => {
      const snapshot = byId.get(task.id);
      if (snapshot?.status !== 'open') return false;
      const dependencies = new Set([...task.dependsOn, ...snapshot.blockingDependencies]);
      return [...dependencies].every((id) => byId.get(id)?.status === 'closed');
    })
    .map((task) => task.id);
}

export class PilotConcurrencyController {
  readonly #reservations = new Map<string, SpecialistReservation>();

  reserve(input: {
    role: WorkflowRole;
    mode: SpecialistReservation['mode'];
    deadlineMs: number;
    nowMs?: number;
  }): SpecialistReservation {
    const nowMs = input.nowMs ?? Date.now();
    this.reapExpired(nowMs);
    const active = [...this.#reservations.values()].filter((reservation) => !reservation.cancelled);
    if (
      input.mode === 'mutating' &&
      active.some((reservation) => reservation.mode === 'mutating')
    ) {
      throw new Error('pilot permits only one mutating specialist');
    }
    if (active.length >= 4) {
      throw new Error('specialist concurrency limit reached');
    }
    if (input.deadlineMs <= nowMs) throw new Error('specialist deadline has elapsed');
    const reservation: SpecialistReservation = {
      id: randomUUID(),
      role: input.role,
      mode: input.mode,
      deadlineMs: input.deadlineMs,
      cancelled: false,
    };
    this.#reservations.set(reservation.id, reservation);
    return reservation;
  }

  cancel(id: string): SpecialistReservation {
    const reservation = this.#reservations.get(id);
    if (reservation === undefined) throw new Error('specialist reservation not found');
    reservation.cancelled = true;
    return { ...reservation };
  }

  release(id: string, nowMs = Date.now()): void {
    const reservation = this.#reservations.get(id);
    if (reservation === undefined) throw new Error('specialist reservation not found');
    if (reservation.cancelled) throw new Error('specialist reservation was cancelled');
    if (reservation.deadlineMs <= nowMs) {
      this.#reservations.delete(id);
      throw new Error('specialist reservation timed out');
    }
    this.#reservations.delete(id);
  }

  reapExpired(nowMs: number): SpecialistReservation[] {
    const expired = [...this.#reservations.values()].filter(
      (reservation) => reservation.deadlineMs <= nowMs,
    );
    for (const reservation of expired) this.#reservations.delete(reservation.id);
    return expired;
  }
}

export class WorkflowOrchestrator {
  readonly #contract: ExecutionContract;
  readonly #store: WorkflowStore;
  readonly #closer: JournaledBeadsTaskCloser;
  readonly #launcher: DockerIsolatedSpecialistLauncher;
  readonly #integrationGate: LocalExactHeadIntegrationGate;
  readonly #ownerId: string;
  readonly #clock: () => number;

  constructor(input: {
    contract: ExecutionContract;
    store: WorkflowStore;
    closer: JournaledBeadsTaskCloser;
    launcher: DockerIsolatedSpecialistLauncher;
    integrationGate: LocalExactHeadIntegrationGate;
    ownerId: string;
    clock?: () => number;
  }) {
    if (!(input.closer instanceof JournaledBeadsTaskCloser)) {
      throw new Error('orchestrator requires the exclusive journaled Beads task closer');
    }
    if (!(input.launcher instanceof DockerIsolatedSpecialistLauncher)) {
      throw new Error('orchestrator requires the concrete Docker-isolated specialist launcher');
    }
    if (!(input.integrationGate instanceof LocalExactHeadIntegrationGate)) {
      throw new Error('orchestrator requires the trusted local exact-head integration gate');
    }
    this.#contract = input.contract;
    this.#store = input.store;
    this.#closer = input.closer;
    this.#launcher = input.launcher;
    this.#integrationGate = input.integrationGate;
    this.#ownerId = input.ownerId;
    this.#clock = input.clock ?? Date.now;
  }

  acquireWorkspace(ttlMs: number, nowMs = Date.now()): number {
    return this.#store.acquireLease(
      'workspace',
      this.#contract.workspaceId,
      this.#ownerId,
      ttlMs,
      nowMs,
    ).epoch;
  }

  acquireRun(runId: string, ttlMs: number, nowMs = Date.now()): number {
    this.#store.assertRunUsesContract(runId, this.#contract);
    return this.#store.acquireLease('run', runId, this.#ownerId, ttlMs, nowMs).epoch;
  }

  acquireTask(taskId: string, ttlMs: number, nowMs = Date.now()): number {
    if (!this.#contract.tasks.some((task) => task.id === taskId)) {
      throw new Error('task is not in the approved contract');
    }
    return this.#store.acquireLease('task', taskId, this.#ownerId, ttlMs, nowMs).epoch;
  }

  createTaskPacket(input: {
    runId: string;
    taskId: string;
    evidence: EvidenceReference[];
  }): TaskPacket {
    this.#store.assertRunUsesContract(input.runId, this.#contract);
    if (
      input.evidence.length === 0 ||
      input.evidence.some(
        (item) =>
          !this.#store.hasRunEvidenceBinding({
            digest: item.digest,
            workspaceId: this.#contract.workspaceId,
            runId: input.runId,
            contractVersion: this.#contract.contractVersion,
            policyDigest: this.#contract.policyDigest,
            allowedProducerRoles: [
              'planner',
              'plan_critic',
              'repo_explorer',
              'workflow_orchestrator',
            ],
          }),
      )
    ) {
      throw new Error('task packet evidence is not recorded');
    }
    const task = this.#contract.tasks.find((candidate) => candidate.id === input.taskId);
    if (task === undefined) throw new Error('task is not in the approved contract');
    const packet: TaskPacket = {
      runId: input.runId,
      taskId: task.id,
      contractVersion: this.#contract.contractVersion,
      policyDigest: this.#contract.policyDigest,
      assignedRole: task.assignedRole,
      objective: this.#contract.objective,
      acceptanceCriteria: this.#contract.acceptanceCriteria,
      allowedPaths: task.allowedPaths,
      allowedOperations: task.allowedOperations,
      retryBudget: this.#contract.retryPolicy,
      evidence: input.evidence,
    };
    assertTaskPacketWithinContract(this.#contract, packet);
    return packet;
  }

  async launchTask(input: {
    packet: TaskPacket;
    workspaceLeaseEpoch: number;
    runLeaseEpoch: number;
    claimTransitionId: string;
    deadlineMs: number;
  }): Promise<unknown> {
    assertTaskPacketWithinContract(this.#contract, input.packet);
    this.#store.assertRunUsesContract(input.packet.runId, this.#contract);
    const run = this.#store.getRun(input.packet.runId);
    if (run?.state !== 'scheduling') {
      throw new Error('workflow run is not in the scheduling state');
    }
    const beadsSnapshots = await this.#closer.readTaskSnapshots(
      this.#contract.tasks.map((task) => task.id),
    );
    if (!selectBeadsReadyTasks(this.#contract, beadsSnapshots).includes(input.packet.taskId)) {
      throw new Error('task is not ready in authoritative Beads state');
    }
    const nowMs = this.#clock();
    this.#store.assertResourceLease(
      'workspace',
      this.#contract.workspaceId,
      this.#ownerId,
      input.workspaceLeaseEpoch,
      nowMs,
    );
    this.#store.assertResourceLease(
      'run',
      input.packet.runId,
      this.#ownerId,
      input.runLeaseEpoch,
      nowMs,
    );
    const mode = input.packet.allowedOperations.some((operation) =>
      MUTATING_OPERATIONS.has(operation),
    )
      ? 'mutating'
      : 'read_only';
    const taskLeaseEpoch = this.acquireTask(
      input.packet.taskId,
      input.deadlineMs - nowMs + 1,
      nowMs,
    );
    const reservation: SpecialistReservation = {
      id: randomUUID(),
      role: input.packet.assignedRole,
      mode,
      deadlineMs: input.deadlineMs,
      cancelled: false,
    };
    this.#store.createSchedulerExecution({
      ...reservation,
      workspaceId: this.#contract.workspaceId,
      runId: input.packet.runId,
      taskId: input.packet.taskId,
      ownerId: this.#ownerId,
      workspaceLeaseEpoch: input.workspaceLeaseEpoch,
      runLeaseEpoch: input.runLeaseEpoch,
      taskLeaseEpoch,
      processIdentity: this.#launcher.processIdentity(reservation),
      credentialLeaseId: this.#launcher.credentialLeaseId(reservation),
      packet: input.packet,
      nowMs: this.#clock(),
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let launchStarted = false;
    try {
      this.#store.recordAttempt({
        runId: input.packet.runId,
        scope: 'task',
        scopeId: input.packet.taskId,
        maxAttempts: input.packet.retryBudget.implementationAttempts,
        hypothesis: input.packet.objective,
        nowMs: this.#clock(),
      });
      await this.#closer.claimTask({
        transitionId: input.claimTransitionId,
        runId: input.packet.runId,
        taskId: input.packet.taskId,
        expectedRunVersion: run.version,
        contractVersion: this.#contract.contractVersion,
        policyDigest: this.#contract.policyDigest,
        leaseOwnerId: this.#ownerId,
        runLeaseEpoch: input.runLeaseEpoch,
        workspaceLeaseEpoch: input.workspaceLeaseEpoch,
        taskLeaseEpoch,
        nowMs: this.#clock(),
      });
      const launchPromise = this.#launcher.launch(input.packet, reservation);
      launchStarted = true;
      const result = await Promise.race([
        launchPromise,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('specialist reservation timed out')),
            Math.max(1, input.deadlineMs - nowMs),
          );
        }),
      ]);
      if (timeout !== undefined) clearTimeout(timeout);
      const finishedAtMs = this.#clock();
      this.#store.finishSchedulerExecution({
        id: reservation.id,
        status: 'completed',
        ownerId: this.#ownerId,
        workspaceLeaseEpoch: input.workspaceLeaseEpoch,
        runLeaseEpoch: input.runLeaseEpoch,
        taskLeaseEpoch,
        result: result ?? null,
        nowMs: finishedAtMs,
      });
      return result;
    } catch (error) {
      if (timeout !== undefined) clearTimeout(timeout);
      reservation.cancelled = true;
      const timedOut = error instanceof Error && error.message.includes('timed out');
      let cancellationFailed = false;
      try {
        await this.#launcher.cancel(reservation);
      } catch {
        cancellationFailed = true;
      }
      try {
        await this.#launcher.revokeCredential(reservation.id);
      } catch {
        cancellationFailed = true;
      }
      if (launchStarted && !(await this.#launcher.waitForSettlement(reservation))) {
        cancellationFailed = true;
      }
      const execution = this.#store.getSchedulerExecution(reservation.id)!;
      const currentRun = this.#store.getRun(execution.runId);
      if (currentRun?.state === 'implementing' || currentRun?.state === 'recovering') {
        this.#escalateRecoveredRun(execution, input.workspaceLeaseEpoch, cancellationFailed);
      } else if (this.#store.listPreparedTransitions(execution.runId).length > 0) {
        throw error;
      }
      if (cancellationFailed) throw error;
      const finishedAtMs = this.#clock();
      this.#store.finishSchedulerExecution({
        id: reservation.id,
        status: 'escalated',
        ownerId: this.#ownerId,
        workspaceLeaseEpoch: input.workspaceLeaseEpoch,
        runLeaseEpoch: input.runLeaseEpoch,
        taskLeaseEpoch,
        result: {
          reason: timedOut ? 'specialist_deadline_elapsed' : 'specialist_launch_failed',
          cancellationFailed,
        },
        nowMs: finishedAtMs,
      });
      throw error;
    }
  }

  async reconcileAfterRestart(input: {
    workspaceLeaseEpoch: number;
    runLeaseTtlMs: number;
    taskLeaseTtlMs: number;
  }): Promise<SchedulerExecutionRecord[]> {
    const reconciled: SchedulerExecutionRecord[] = [];
    const failures: unknown[] = [];
    for (const execution of this.#store.listActiveSchedulerExecutions(this.#contract.workspaceId)) {
      try {
        const adopted = this.#store.adoptSchedulerExecution({
          id: execution.id,
          ownerId: this.#ownerId,
          workspaceLeaseEpoch: input.workspaceLeaseEpoch,
          runLeaseTtlMs: input.runLeaseTtlMs,
          taskLeaseTtlMs: input.taskLeaseTtlMs,
          nowMs: this.#clock(),
        });
        if (adopted === undefined) continue;
        let cleanupFailed = false;
        try {
          await this.#launcher.cancelProcessIdentity(adopted.processIdentity);
        } catch {
          cleanupFailed = true;
        }
        try {
          await this.#launcher.revokeCredential(adopted.id);
        } catch {
          cleanupFailed = true;
        }
        if (cleanupFailed) {
          throw new Error('recovered specialist cleanup could not be confirmed');
        }
        let reconciliationTimeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            this.#closer.reconcilePreparedTaskTransition({
              runId: adopted.runId,
              recoveryOwnerId: this.#ownerId,
              recoveryRunLeaseEpoch: adopted.runLeaseEpoch,
              recoveryWorkspaceLeaseEpoch: input.workspaceLeaseEpoch,
              taskId: adopted.taskId,
              recoveryTaskLeaseEpoch: adopted.taskLeaseEpoch,
              contractVersion: this.#contract.contractVersion,
              policyDigest: this.#contract.policyDigest,
              nowMs: this.#clock(),
            }),
            new Promise<never>((_resolve, reject) => {
              reconciliationTimeout = setTimeout(
                () => reject(new Error('Beads recovery reconciliation timed out')),
                Math.max(1, Math.min(input.runLeaseTtlMs, input.taskLeaseTtlMs)),
              );
            }),
          ]);
        } finally {
          if (reconciliationTimeout !== undefined) clearTimeout(reconciliationTimeout);
        }
        const currentRun = this.#store.getRun(adopted.runId);
        if (currentRun?.state === 'implementing' || currentRun?.state === 'recovering') {
          this.#escalateRecoveredRun(adopted, input.workspaceLeaseEpoch, false);
        } else if (currentRun?.state !== 'scheduling' && currentRun?.state !== 'escalated') {
          throw new Error('recovered scheduler intent has an unexpected run state');
        }
        reconciled.push(
          this.#store.finishSchedulerExecution({
            id: adopted.id,
            status: 'escalated',
            ownerId: this.#ownerId,
            workspaceLeaseEpoch: input.workspaceLeaseEpoch,
            runLeaseEpoch: adopted.runLeaseEpoch,
            taskLeaseEpoch: adopted.taskLeaseEpoch,
            result: {
              reason:
                adopted.deadlineMs <= this.#clock()
                  ? 'specialist_deadline_elapsed_during_restart'
                  : 'specialist_process_lost_during_restart',
              processIdentity: adopted.processIdentity,
              cancellationFailed: false,
            },
            nowMs: this.#clock(),
          }),
        );
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'one or more scheduler executions require recovery');
    }
    return reconciled;
  }

  async acceptAndCloseTask(input: {
    packet: TaskPacket;
    result: unknown;
    workspaceLeaseEpoch: number;
    runLeaseEpoch: number;
    taskLeaseEpoch: number;
    transitionId: string;
  }): Promise<AgentResult> {
    assertTaskPacketWithinContract(this.#contract, input.packet);
    this.#store.assertRunUsesContract(input.packet.runId, this.#contract);
    const nowMs = this.#clock();
    this.#store.assertResourceLease(
      'workspace',
      this.#contract.workspaceId,
      this.#ownerId,
      input.workspaceLeaseEpoch,
      nowMs,
    );
    this.#store.assertResourceLease(
      'run',
      input.packet.runId,
      this.#ownerId,
      input.runLeaseEpoch,
      nowMs,
    );
    this.#store.assertResourceLease(
      'task',
      input.packet.taskId,
      this.#ownerId,
      input.taskLeaseEpoch,
      nowMs,
    );
    const run = this.#store.getRun(input.packet.runId);
    if (run?.state !== 'task_accepted') throw new Error('run is not ready for brokered task close');
    const result = agentResultSchema.parse(input.result);
    const authoritativeSnapshots = await this.#closer.readTaskSnapshots(
      this.#contract.tasks.map((task) => task.id),
    );
    const snapshots = new Map(authoritativeSnapshots.map((snapshot) => [snapshot.id, snapshot]));
    if (snapshots.get(input.packet.taskId)?.status !== 'in_progress') {
      throw new Error('accepted task is not in progress in authoritative Beads state');
    }
    const nextState = this.#contract.tasks.every(
      (task) => task.id === input.packet.taskId || snapshots.get(task.id)?.status === 'closed',
    )
      ? 'integration'
      : 'scheduling';
    if (result.status !== 'passed' || result.acceptanceCriteria.failed.length > 0) {
      throw new Error('task result is not accepted');
    }
    const passedCriteria = new Set(result.acceptanceCriteria.passed);
    if (
      this.#contract.acceptanceCriteria.some((criterion) => !passedCriteria.has(criterion)) ||
      result.acceptanceCriteria.passed.some(
        (criterion) => !this.#contract.acceptanceCriteria.includes(criterion),
      )
    ) {
      throw new Error('task result does not prove every approved acceptance criterion');
    }
    if (
      result.findings.length > 0 ||
      result.remainingRisks.length > 0 ||
      result.recommendedTransition !== 'integrate'
    ) {
      throw new Error('task result has unresolved findings, risks, or transition intent');
    }
    const gate = await this.#integrationGate.verify({
      contract: this.#contract,
      runId: input.packet.runId,
      taskId: input.packet.taskId,
    });
    const reportedFiles = new Set(result.changedFiles);
    const observedFiles = new Set(gate.changedFiles);
    if (
      reportedFiles.size !== observedFiles.size ||
      [...observedFiles].some((path) => !reportedFiles.has(path))
    ) {
      throw new Error('task result changed files do not match the exact-head Git diff');
    }
    if (
      gate.changedFiles.some(
        (path) => !input.packet.allowedPaths.some((root) => pathWithin(path, root)),
      )
    ) {
      throw new Error('exact-head Git diff contains files outside the assigned packet');
    }
    if (gate.evidence.length === 0 || result.evidence.length === 0) {
      throw new Error('task acceptance requires evidence');
    }
    const allEvidence = [...result.evidence, ...gate.evidence];
    if (
      allEvidence.some(
        (reference) =>
          !this.#store.hasTaskEvidenceAtHead({
            digest: reference.digest,
            workspaceId: this.#contract.workspaceId,
            runId: input.packet.runId,
            taskId: input.packet.taskId,
            headSha: gate.headSha,
            contractVersion: this.#contract.contractVersion,
            policyDigest: this.#contract.policyDigest,
          }),
      )
    ) {
      throw new Error('task acceptance evidence is not recorded at the exact head');
    }
    await this.#closer.closeTask({
      transitionId: input.transitionId,
      runId: input.packet.runId,
      taskId: input.packet.taskId,
      reason: result.summary,
      evidenceDigests: allEvidence.map((reference) => reference.digest),
      expectedRunVersion: run.version,
      nextState,
      contractVersion: this.#contract.contractVersion,
      policyDigest: this.#contract.policyDigest,
      leaseOwnerId: this.#ownerId,
      runLeaseEpoch: input.runLeaseEpoch,
      workspaceLeaseEpoch: input.workspaceLeaseEpoch,
      taskLeaseEpoch: input.taskLeaseEpoch,
      nowMs: this.#clock(),
    });
    return result;
  }

  #escalateRecoveredRun(
    execution: SchedulerExecutionRecord,
    workspaceLeaseEpoch: number,
    cancellationFailed: boolean,
  ): void {
    let run = this.#store.getRun(execution.runId);
    if (run?.state === 'implementing') {
      this.#commitInternalTransition({
        execution,
        workspaceLeaseEpoch,
        from: 'implementing',
        to: 'recovering',
        expectedRunVersion: run.version,
        operation: 'internal.specialist_recovery',
        transitionContext: {
          workspaceLeaseEpoch,
          taskLeaseEpoch: execution.taskLeaseEpoch,
          recoveryTarget: 'implementing',
        },
        result: { processIdentity: execution.processIdentity, cancellationFailed },
      });
      run = this.#store.getRun(execution.runId);
    }
    if (run?.state !== 'recovering') {
      throw new Error('lost specialist run is not in a recoverable state');
    }
    this.#commitInternalTransition({
      execution,
      workspaceLeaseEpoch,
      from: 'recovering',
      to: 'escalated',
      expectedRunVersion: run.version,
      operation: 'internal.specialist_recovery_escalate',
      transitionContext: { workspaceLeaseEpoch, recoveryTarget: 'implementing' },
      result: { processIdentity: execution.processIdentity, cancellationFailed },
    });
  }

  #commitInternalTransition(input: {
    execution: SchedulerExecutionRecord;
    workspaceLeaseEpoch: number;
    from: 'implementing' | 'finalizing' | 'recovering';
    to: 'recovering' | 'escalated';
    expectedRunVersion: number;
    operation: string;
    transitionContext: {
      workspaceLeaseEpoch: number;
      taskLeaseEpoch?: number;
      recoveryTarget: 'implementing';
    };
    result: unknown;
  }): void {
    const transitionId = `${input.execution.id}:${input.operation}`;
    const idempotencyKey = deriveTransitionIdempotencyKey({
      runId: input.execution.runId,
      transitionId,
      operation: input.operation,
      expectedVersion: input.expectedRunVersion,
    });
    const existing = this.#store.getTransition(transitionId);
    if (existing?.status === 'committed') return;
    if (existing?.status === 'prepared') {
      const prepared =
        existing.leaseOwnerId === this.#ownerId &&
        existing.leaseEpoch === input.execution.runLeaseEpoch
          ? existing
          : this.#store.adoptPreparedTransition(
              transitionId,
              this.#ownerId,
              input.execution.runLeaseEpoch,
              this.#clock(),
              input.transitionContext,
            );
      this.#store.commitTransition(
        prepared.id,
        this.#ownerId,
        input.execution.runLeaseEpoch,
        input.result,
        this.#clock(),
      );
      return;
    }
    const interrupted =
      input.to === 'recovering'
        ? (this.#store.getLatestCommittedTransitionInto(input.execution.runId, input.from) ??
          (input.from === 'finalizing'
            ? this.#store.getCommittedMergeAttestation(input.execution.runId)
            : undefined))
        : undefined;
    if (input.to === 'recovering' && interrupted !== undefined) {
      for (const reference of (input.execution.packet as TaskPacket).evidence) {
        this.#store.recordEvidence({
          ...reference,
          producer: 'workflow-recovery-checkpoint',
          producerRole: 'workflow_orchestrator',
          workspaceId: this.#contract.workspaceId,
          runId: input.execution.runId,
          taskId: input.execution.taskId,
          transitionId: interrupted.id,
          contractVersion: this.#contract.contractVersion,
          policyDigest: this.#contract.policyDigest,
          createdAtMs: this.#clock(),
        });
      }
    }
    const prepared = this.#store.prepareTransition({
      id: transitionId,
      runId: input.execution.runId,
      from: input.from,
      to: input.to,
      operation: input.operation,
      expectedRunVersion: input.expectedRunVersion,
      idempotencyKey,
      actorRole: 'workflow_orchestrator',
      contractVersion: this.#contract.contractVersion,
      policyDigest: this.#contract.policyDigest,
      leaseOwnerId: this.#ownerId,
      leaseEpoch: input.execution.runLeaseEpoch,
      transitionContext: input.transitionContext,
      expectedExternalState: { status: 'internal' },
      externalArguments: {
        taskId: input.execution.taskId,
        processIdentity: input.execution.processIdentity,
        ...(input.to === 'recovering'
          ? {
              interruptedTransitionId: interrupted?.id ?? '',
              evidenceDigests: (input.execution.packet as TaskPacket).evidence.map(
                (reference) => reference.digest,
              ),
            }
          : {}),
      },
      nowMs: this.#clock(),
    });
    this.#store.commitTransition(
      prepared.id,
      this.#ownerId,
      input.execution.runLeaseEpoch,
      input.result,
      this.#clock(),
    );
  }
}
