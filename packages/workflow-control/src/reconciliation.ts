import type { PrepareTransitionInput, TransitionRecord, WorkflowStore } from './storage.js';

export type ExternalObservation =
  | { kind: 'expected'; result: unknown }
  | { kind: 'unchanged'; result: unknown }
  | { kind: 'conflict'; result: unknown };

export interface JournaledMutationPort {
  observe(transition: TransitionRecord): Promise<ExternalObservation>;
  mutate(transition: TransitionRecord): Promise<unknown>;
}

export type FaultBoundary =
  | 'before_prepare'
  | 'after_prepare'
  | 'before_external_mutation'
  | 'after_external_mutation'
  | 'before_local_commit'
  | 'after_local_commit';

export type FaultInjector = (boundary: FaultBoundary, transition: TransitionRecord) => void;

export class JournaledMutationBroker {
  readonly #store: WorkflowStore;
  readonly #port: JournaledMutationPort;
  readonly #fault: FaultInjector;
  readonly #clock: () => number;

  constructor(
    store: WorkflowStore,
    port: JournaledMutationPort,
    fault: FaultInjector = () => undefined,
    clock: () => number = Date.now,
  ) {
    this.#store = store;
    this.#port = port;
    this.#fault = fault;
    this.#clock = clock;
  }

  async execute(input: PrepareTransitionInput): Promise<TransitionRecord> {
    this.#fault('before_prepare', { ...input, status: 'prepared', result: null });
    let transition = this.#store.prepareTransition(input);
    if (transition.status === 'committed' || transition.status === 'escalated') return transition;
    this.#fault('after_prepare', transition);
    const before = await this.#port.observe(transition);
    if (before.kind === 'conflict') {
      this.#store.escalateTransition(
        transition.id,
        transition.leaseOwnerId,
        transition.leaseEpoch,
        before.result,
        this.#clock(),
      );
      return this.#store.getTransition(transition.id)!;
    }
    if (before.kind === 'unchanged') {
      this.#fault('before_external_mutation', transition);
      this.#store.assertRunLease(
        transition.runId,
        transition.leaseOwnerId,
        transition.leaseEpoch,
        this.#clock(),
      );
      await this.#port.mutate(transition);
      this.#fault('after_external_mutation', transition);
    }
    const after = await this.#port.observe(transition);
    if (after.kind !== 'expected') {
      if (after.kind === 'conflict') {
        this.#store.escalateTransition(
          transition.id,
          transition.leaseOwnerId,
          transition.leaseEpoch,
          after.result,
          this.#clock(),
        );
      }
      throw new Error('external mutation result remains ambiguous');
    }
    this.#fault('before_local_commit', transition);
    transition = this.#store.commitTransition(
      transition.id,
      transition.leaseOwnerId,
      transition.leaseEpoch,
      after.result,
      this.#clock(),
    );
    this.#fault('after_local_commit', transition);
    return transition;
  }

  async reconcilePrepared(input: {
    runId: string;
    recoveryOwnerId: string;
    recoveryLeaseEpoch: number;
    currentContractVersion: number;
    currentPolicyDigest: string;
    nowMs: number;
  }): Promise<TransitionRecord[]> {
    const reconciled: TransitionRecord[] = [];
    for (const prepared of this.#store.listPreparedTransitions(input.runId)) {
      const transition = this.#store.adoptPreparedTransition(
        prepared.id,
        input.recoveryOwnerId,
        input.recoveryLeaseEpoch,
        input.nowMs,
      );
      if (
        transition.contractVersion !== input.currentContractVersion ||
        transition.policyDigest !== input.currentPolicyDigest
      ) {
        this.#store.escalateTransition(
          transition.id,
          input.recoveryOwnerId,
          input.recoveryLeaseEpoch,
          { reason: 'contract_or_policy_changed_during_recovery' },
          input.nowMs,
        );
        reconciled.push(this.#store.getTransition(transition.id)!);
        continue;
      }
      const observed = await this.#port.observe(transition);
      if (observed.kind === 'expected') {
        reconciled.push(
          this.#store.commitTransition(
            transition.id,
            input.recoveryOwnerId,
            input.recoveryLeaseEpoch,
            observed.result,
            input.nowMs,
          ),
        );
      } else if (observed.kind === 'unchanged') {
        this.#store.assertRunLease(
          transition.runId,
          input.recoveryOwnerId,
          input.recoveryLeaseEpoch,
          this.#clock(),
        );
        await this.#port.mutate(transition);
        const replayed = await this.#port.observe(transition);
        if (replayed.kind !== 'expected') {
          if (replayed.kind === 'conflict') {
            this.#store.escalateTransition(
              transition.id,
              input.recoveryOwnerId,
              input.recoveryLeaseEpoch,
              replayed.result,
              input.nowMs,
            );
          }
          throw new Error('replayed external mutation remains ambiguous');
        }
        reconciled.push(
          this.#store.commitTransition(
            transition.id,
            input.recoveryOwnerId,
            input.recoveryLeaseEpoch,
            replayed.result,
            input.nowMs,
          ),
        );
      } else {
        this.#store.escalateTransition(
          transition.id,
          input.recoveryOwnerId,
          input.recoveryLeaseEpoch,
          observed.result,
          input.nowMs,
        );
        reconciled.push(this.#store.getTransition(transition.id)!);
      }
    }
    return reconciled;
  }
}

export type BeadsAuthorityComparison =
  | { action: 'consistent' }
  | { action: 'reconcile_open'; reason: string }
  | { action: 'block_dependents'; reason: string }
  | { action: 'escalate'; reason: string };

export function compareBeadsAuthoritativeState(input: {
  beadsStatus: 'open' | 'in_progress' | 'closed';
  workflowAccepted: boolean;
  acceptanceEvidencePresent: boolean;
  matchingCloseTransitionPresent: boolean;
}): BeadsAuthorityComparison {
  if (input.beadsStatus !== 'closed' && input.workflowAccepted) {
    return { action: 'reconcile_open', reason: 'Beads remains lifecycle-authoritative' };
  }
  if (input.beadsStatus === 'closed' && !input.acceptanceEvidencePresent) {
    return { action: 'block_dependents', reason: 'closed task lacks workflow acceptance evidence' };
  }
  if (input.beadsStatus === 'closed' && !input.matchingCloseTransitionPresent) {
    return { action: 'escalate', reason: 'closed task lacks a journaled close transition' };
  }
  return { action: 'consistent' };
}

export interface OfficialBeadsDoltClient {
  readIssue(
    workspaceRoot: string,
    taskId: string,
  ): Promise<{ status: 'open' | 'in_progress' | 'closed' }>;
  claimIssue(workspaceRoot: string, taskId: string, idempotencyKey: string): Promise<unknown>;
  closeIssue(
    workspaceRoot: string,
    taskId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<unknown>;
  readDoltSync(
    workspaceRoot: string,
    idempotencyKey: string,
  ): Promise<'pending' | 'synced' | 'conflict'>;
  pushDolt(workspaceRoot: string, idempotencyKey: string): Promise<unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('broker arguments must be an object');
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`broker argument ${key} is required`);
  }
  return value;
}

export class OfficialBeadsDoltPort implements JournaledMutationPort {
  readonly #workspaceRoot: string;
  readonly #client: OfficialBeadsDoltClient;

  constructor(workspaceRoot: string, client: OfficialBeadsDoltClient) {
    if (workspaceRoot.trim() === '') throw new Error('workspace root is required');
    this.#workspaceRoot = workspaceRoot;
    this.#client = client;
  }

  async observe(transition: TransitionRecord): Promise<ExternalObservation> {
    if (transition.operation === 'beads.dolt_push') {
      const state = await this.#client.readDoltSync(this.#workspaceRoot, transition.idempotencyKey);
      if (state === 'synced') return { kind: 'expected', result: { status: state } };
      if (state === 'pending') return { kind: 'unchanged', result: { status: state } };
      return { kind: 'conflict', result: { status: state } };
    }
    const arguments_ = asRecord(transition.externalArguments);
    const taskId = requiredString(arguments_, 'taskId');
    const issue = await this.#client.readIssue(this.#workspaceRoot, taskId);
    const expected = asRecord(transition.expectedExternalState).status;
    if (issue.status === expected) return { kind: 'expected', result: issue };
    const validBefore =
      transition.operation === 'beads.task_claim'
        ? issue.status === 'open'
        : transition.operation === 'beads.task_close'
          ? issue.status === 'in_progress'
          : false;
    return validBefore ? { kind: 'unchanged', result: issue } : { kind: 'conflict', result: issue };
  }

  async mutate(transition: TransitionRecord): Promise<unknown> {
    const arguments_ = asRecord(transition.externalArguments);
    if (transition.operation === 'beads.task_claim') {
      return this.#client.claimIssue(
        this.#workspaceRoot,
        requiredString(arguments_, 'taskId'),
        transition.idempotencyKey,
      );
    }
    if (transition.operation === 'beads.task_close') {
      return this.#client.closeIssue(
        this.#workspaceRoot,
        requiredString(arguments_, 'taskId'),
        requiredString(arguments_, 'reason'),
        transition.idempotencyKey,
      );
    }
    if (transition.operation === 'beads.dolt_push') {
      return this.#client.pushDolt(this.#workspaceRoot, transition.idempotencyKey);
    }
    throw new Error(`unsupported Beads/Dolt broker operation: ${transition.operation}`);
  }
}

export class JournaledBeadsDoltBroker extends JournaledMutationBroker {
  constructor(
    store: WorkflowStore,
    port: OfficialBeadsDoltPort,
    fault?: FaultInjector,
    clock?: () => number,
  ) {
    if (!(port instanceof OfficialBeadsDoltPort)) {
      throw new Error('Beads/Dolt mutations require the exclusive official broker port');
    }
    super(store, port, fault, clock);
  }
}
