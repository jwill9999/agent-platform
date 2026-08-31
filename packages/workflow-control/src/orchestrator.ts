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
import type { WorkflowStore } from './storage.js';

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

export interface ExactHeadGate {
  expectedHeadSha: string;
  observedHeadSha: string;
  requiredChecks: string[];
  passedChecks: string[];
  evidence: EvidenceReference[];
}

export interface BrokeredTaskCloser {
  closeTask(input: {
    taskId: string;
    reason: string;
    evidence: EvidenceReference[];
  }): Promise<void>;
}

export interface IsolatedSpecialistLauncher {
  launch(packet: TaskPacket, reservation: SpecialistReservation): Promise<unknown>;
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
    if (
      input.mode === 'read_only' &&
      active.filter((reservation) => reservation.mode === 'read_only').length >= 4
    ) {
      throw new Error('read-only specialist concurrency limit reached');
    }
    if (input.deadlineMs <= nowMs) throw new Error('specialist deadline has elapsed');
    const reservation = {
      id: randomUUID(),
      role: input.role,
      mode: input.mode,
      deadlineMs: input.deadlineMs,
      cancelled: false,
    } satisfies SpecialistReservation;
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
  readonly #closer: BrokeredTaskCloser;
  readonly #ownerId: string;

  constructor(input: {
    contract: ExecutionContract;
    store: WorkflowStore;
    closer: BrokeredTaskCloser;
    ownerId: string;
  }) {
    this.#contract = input.contract;
    this.#store = input.store;
    this.#closer = input.closer;
    this.#ownerId = input.ownerId;
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

  createTaskPacket(input: {
    runId: string;
    taskId: string;
    retryBudget: TaskPacket['retryBudget'];
    evidence: EvidenceReference[];
  }): TaskPacket {
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
      retryBudget: input.retryBudget,
      evidence: input.evidence,
    };
    assertTaskPacketWithinContract(this.#contract, packet);
    return packet;
  }

  async launchTask(input: {
    packet: TaskPacket;
    concurrency: PilotConcurrencyController;
    launcher: IsolatedSpecialistLauncher;
    deadlineMs: number;
    nowMs?: number;
  }): Promise<unknown> {
    assertTaskPacketWithinContract(this.#contract, input.packet);
    const mode = input.packet.allowedOperations.some((operation) =>
      MUTATING_OPERATIONS.has(operation),
    )
      ? 'mutating'
      : 'read_only';
    const reservation = input.concurrency.reserve({
      role: input.packet.assignedRole,
      mode,
      deadlineMs: input.deadlineMs,
      nowMs: input.nowMs,
    });
    try {
      const result = await input.launcher.launch(input.packet, reservation);
      input.concurrency.release(reservation.id, input.nowMs ?? Date.now());
      return result;
    } catch (error) {
      input.concurrency.cancel(reservation.id);
      throw error;
    }
  }

  async acceptAndCloseTask(input: {
    packet: TaskPacket;
    result: unknown;
    gate: ExactHeadGate;
  }): Promise<AgentResult> {
    assertTaskPacketWithinContract(this.#contract, input.packet);
    const result = agentResultSchema.parse(input.result);
    if (result.status !== 'passed' || result.acceptanceCriteria.failed.length > 0) {
      throw new Error('task result is not accepted');
    }
    if (
      result.changedFiles.some(
        (path) => !input.packet.allowedPaths.some((root) => pathWithin(path, root)),
      )
    ) {
      throw new Error('task result changed files outside the assigned packet');
    }
    if (input.gate.observedHeadSha !== input.gate.expectedHeadSha) {
      throw new Error('exact-head integration gate is stale');
    }
    const passed = new Set(input.gate.passedChecks);
    if (input.gate.requiredChecks.some((check) => !passed.has(check))) {
      throw new Error('required integration gate did not pass');
    }
    if (input.gate.evidence.length === 0 || result.evidence.length === 0) {
      throw new Error('task acceptance requires evidence');
    }
    await this.#closer.closeTask({
      taskId: input.packet.taskId,
      reason: result.summary,
      evidence: [...result.evidence, ...input.gate.evidence],
    });
    return result;
  }
}
