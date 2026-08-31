import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  JournaledBeadsDoltBroker,
  JournaledMutationBroker,
  OfficialBeadsDoltPort,
  WorkflowStore,
  compareBeadsAuthoritativeState,
  deriveTransitionIdempotencyKey,
  resolveWorkflowControlPaths,
  type ExecutionContract,
  type FaultBoundary,
  type JournaledMutationPort,
  type OfficialBeadsDoltClient,
  type PrepareTransitionInput,
} from '../src/index.js';

const roots: string[] = [];
const digest = `sha256:${'c'.repeat(64)}`;
const contract: ExecutionContract = {
  featureId: 'feature-persistence',
  contractVersion: 1,
  policyDigest: digest,
  workspaceId: digest,
  objective: 'Persist safely',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['recovery is deterministic'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['beads.mutate'],
    github: {
      repository: 'owner/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: [],
    },
  },
  tasks: [
    {
      id: 'feature-persistence.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'workflow_orchestrator',
      branchParent: 'feature/feature-persistence',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['beads.mutate'],
    },
  ],
  qualityGates: [],
  retryPolicy: {
    implementationAttempts: 3,
    findingAttempts: 2,
    infrastructureAttempts: 3,
    waitDeadlineSeconds: 3600,
  },
  repairTaskPolicy: {
    idPattern: 'feature-persistence.repair.<sequence>',
    maxChildren: 1,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createStore(): Promise<{ store: WorkflowStore; input: PrepareTransitionInput }> {
  const root = await mkdtemp(join(tmpdir(), 'workflow-store-'));
  roots.push(root);
  const store = new WorkflowStore(join(root, 'workflow.sqlite'));
  const contractId = store.createContract(contract, 1000);
  const run = store.createRun(contractId, 'approved', 'run-1');
  const workspaceLease = store.acquireLease(
    'workspace',
    contract.workspaceId,
    'owner-1',
    100,
    1000,
  );
  const lease = store.acquireLease('run', run.id, 'owner-1', 100, 1000);
  const input = {
    id: 'transition-1',
    runId: run.id,
    from: 'approved',
    to: 'scheduling',
    operation: 'beads.task_claim',
    expectedRunVersion: 0,
    idempotencyKey: '',
    actorRole: 'workflow_orchestrator',
    contractVersion: 1,
    policyDigest: digest,
    leaseOwnerId: lease.ownerId,
    leaseEpoch: lease.epoch,
    transitionContext: { workspaceLeaseEpoch: workspaceLease.epoch },
    expectedExternalState: { status: 'claimed' },
    externalArguments: { taskId: 'feature-persistence.1' },
    nowMs: 1000,
  } satisfies PrepareTransitionInput;
  input.idempotencyKey = deriveTransitionIdempotencyKey({
    runId: input.runId,
    transitionId: input.id,
    operation: input.operation,
    expectedVersion: input.expectedRunVersion,
  });
  return {
    store,
    input,
  };
}

function withCanonicalKey(
  input: PrepareTransitionInput,
  overrides: Partial<PrepareTransitionInput>,
): PrepareTransitionInput {
  const next = { ...input, ...overrides };
  return {
    ...next,
    idempotencyKey: deriveTransitionIdempotencyKey({
      runId: next.runId,
      transitionId: next.id,
      operation: next.operation,
      expectedVersion: next.expectedRunVersion,
    }),
  };
}

class FakeMutationPort implements JournaledMutationPort {
  state: 'unchanged' | 'expected' | 'conflict' = 'unchanged';
  mutations = 0;

  async observe() {
    if (this.state === 'expected')
      return { kind: 'expected' as const, result: { status: 'claimed' } };
    if (this.state === 'conflict')
      return { kind: 'conflict' as const, result: { status: 'closed' } };
    return { kind: 'unchanged' as const, result: { status: 'open' } };
  }

  async mutate() {
    this.mutations += 1;
    this.state = 'expected';
    return { status: 'claimed' };
  }
}

class FakeBeadsDoltClient implements OfficialBeadsDoltClient {
  issueStatus: 'open' | 'in_progress' | 'closed' = 'open';
  syncStatus: 'pending' | 'synced' | 'conflict' = 'pending';
  calls: Array<{ operation: string; workspaceRoot: string; idempotencyKey: string }> = [];

  async readIssue() {
    return { status: this.issueStatus, blockingDependencies: [] };
  }

  async claimIssue(workspaceRoot: string, _taskId: string, idempotencyKey: string) {
    this.calls.push({ operation: 'claim', workspaceRoot, idempotencyKey });
    this.issueStatus = 'in_progress';
    return { status: this.issueStatus };
  }

  async closeIssue(
    workspaceRoot: string,
    _taskId: string,
    _reason: string,
    idempotencyKey: string,
  ) {
    this.calls.push({ operation: 'close', workspaceRoot, idempotencyKey });
    this.issueStatus = 'closed';
    return { status: this.issueStatus };
  }

  async readDoltSync() {
    return this.syncStatus;
  }

  async pushDolt(workspaceRoot: string, idempotencyKey: string) {
    this.calls.push({ operation: 'dolt_push', workspaceRoot, idempotencyKey });
    this.syncStatus = 'synced';
    return { status: this.syncStatus };
  }
}

describe('WorkflowStore', () => {
  it('uses the canonical workspace hash beneath Codex home', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-paths-'));
    roots.push(root);
    const codexHome = join(root, 'codex-home');
    const workspace = join(root, 'workspace');
    await Promise.all([mkdir(codexHome), mkdir(workspace)]);
    const paths = await resolveWorkflowControlPaths(codexHome, workspace);
    expect(paths.workspaceId).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(paths.root).toBe(join(codexHome, 'workflow-control', paths.workspaceId.slice(7)));
    expect(paths.artifacts.startsWith(paths.root)).toBe(true);
  });

  it('reopens an idempotently migrated durable database', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-reopen-'));
    roots.push(root);
    const path = join(root, 'workflow.sqlite');
    const first = new WorkflowStore(path);
    const contractId = first.createContract(contract);
    first.createRun(contractId, 'approved', 'durable-run');
    first.close();
    const reopened = new WorkflowStore(path);
    expect(reopened.getRun('durable-run')).toMatchObject({ state: 'approved', version: 0 });
    reopened.close();
  });

  it('uses CAS versions, idempotency keys, and fenced commits', async () => {
    const { store, input } = await createStore();
    const prepared = store.prepareTransition(input);
    expect(prepared.status).toBe('prepared');
    expect(() =>
      store.recordEvidence({
        digest,
        mediaType: 'application/json',
        sizeBytes: 12,
        kind: 'external',
        producer: 'beads-broker',
        producerRole: 'workflow_orchestrator',
        workspaceId: contract.workspaceId,
        runId: input.runId,
        transitionId: input.id,
        contractVersion: 1,
        policyDigest: digest,
      }),
    ).not.toThrow();
    expect(store.getRun(input.runId)).toMatchObject({ state: 'approved', version: 1 });
    expect(store.prepareTransition(input)).toEqual(prepared);
    expect(() =>
      store.prepareTransition({
        ...input,
        externalArguments: { taskId: 'feature-persistence.2' },
      }),
    ).toThrow('idempotency key collision');
    expect(() =>
      store.prepareTransition(
        withCanonicalKey(input, {
          id: 'transition-2',
          expectedRunVersion: 1,
        }),
      ),
    ).toThrow('already has a prepared transition');
    expect(() => store.commitTransition(input.id, 'other', input.leaseEpoch, {})).toThrow(
      'fencing token',
    );
    const committed = store.commitTransition(
      input.id,
      input.leaseOwnerId,
      input.leaseEpoch,
      { status: 'claimed' },
      1000,
    );
    expect(committed.status).toBe('committed');
    expect(store.getRun(input.runId)).toMatchObject({ state: 'scheduling', version: 2 });
    expect(store.commitTransition(input.id, 'stale', 0, {})).toEqual(committed);
    store.close();
  });

  it('fences expired owners with monotonically increasing epochs', async () => {
    const { store, input } = await createStore();
    store.prepareTransition(input);
    expect(() => store.acquireLease('run', input.runId, 'owner-2', 100, 1050)).toThrow(
      'another owner',
    );
    const recoveryWorkspace = store.acquireLease(
      'workspace',
      contract.workspaceId,
      'owner-2',
      100,
      1100,
    );
    const recovery = store.acquireLease('run', input.runId, 'owner-2', 100, 1100);
    expect(recovery.epoch).toBeGreaterThan(input.leaseEpoch);
    expect(() =>
      store.commitTransition(input.id, input.leaseOwnerId, input.leaseEpoch, {}),
    ).toThrow('fencing token');
    expect(
      store.adoptPreparedTransition(input.id, recovery.ownerId, recovery.epoch, 1100, {
        workspaceLeaseEpoch: recoveryWorkspace.epoch,
      }),
    ).toMatchObject({ leaseOwnerId: 'owner-2', leaseEpoch: recovery.epoch });
    store.close();
  });

  it('renews the current owner without invalidating its fencing token', async () => {
    const { store, input } = await createStore();
    const renewed = store.acquireLease('run', input.runId, input.leaseOwnerId, 200, 1050);
    expect(renewed.epoch).toBe(input.leaseEpoch);
    expect(renewed.expiresAtMs).toBe(1250);
    expect(() => store.prepareTransition(input)).not.toThrow();
    store.close();
  });

  it('rejects stale contract and policy metadata at the durable boundary', async () => {
    const { store, input } = await createStore();
    expect(() =>
      store.prepareTransition({ ...input, policyDigest: `sha256:${'e'.repeat(64)}` }),
    ).toThrow('contract or policy is stale');
    store.close();
  });

  it('rejects non-normative state changes at the durable boundary', async () => {
    const { store, input } = await createStore();
    expect(() =>
      store.prepareTransition({
        ...input,
        to: 'closed',
      }),
    ).toThrow('invalid workflow transition');
    store.close();
  });

  it('keeps retry scopes separate and wait deadlines immutable', async () => {
    const { store, input } = await createStore();
    expect(
      store.recordAttempt({
        runId: input.runId,
        scope: 'task',
        scopeId: 'task-1',
        maxAttempts: 2,
        hypothesis: 'initial',
      }),
    ).toBe(1);
    expect(
      store.recordAttempt({
        runId: input.runId,
        scope: 'finding',
        scopeId: 'finding-1',
        maxAttempts: 1,
        hypothesis: 'initial',
      }),
    ).toBe(1);
    expect(() =>
      store.recordAttempt({
        runId: input.runId,
        scope: 'finding',
        scopeId: 'finding-1',
        maxAttempts: 1,
        hypothesis: 'retry',
      }),
    ).toThrow('exhausted');
    store.putWait({
      runId: input.runId,
      checkId: 'verify',
      eventIdentity: 'event-1',
      nextPollAtMs: 1200,
      absoluteDeadlineMs: 2000,
      backoffCount: 0,
    });
    expect(() =>
      store.putWait({
        runId: input.runId,
        checkId: 'verify',
        eventIdentity: 'event-1',
        nextPollAtMs: 2100,
        absoluteDeadlineMs: 3000,
        backoffCount: 1,
      }),
    ).toThrow('absolute deadline');
    expect(store.listDueWaits(2000)).toEqual([
      { runId: input.runId, checkId: 'verify', deadlineReached: true },
    ]);
    store.close();
  });
});

describe('JournaledMutationBroker recovery', () => {
  it.each([
    'before_prepare',
    'after_prepare',
    'before_external_mutation',
    'after_external_mutation',
    'before_local_commit',
    'after_local_commit',
  ] as const)('recovers fault boundary %s without duplicate mutation', async (boundary) => {
    const { store, input } = await createStore();
    const port = new FakeMutationPort();
    const broker = new JournaledMutationBroker(
      store,
      port,
      (current: FaultBoundary) => {
        if (current === boundary) throw new Error(`fault:${boundary}`);
      },
      () => 1000,
    );
    await expect(broker.execute(input)).rejects.toThrow(`fault:${boundary}`);
    if (boundary === 'after_local_commit') {
      expect(store.getTransition(input.id)).toMatchObject({ status: 'committed' });
      const replay = await new JournaledMutationBroker(store, port, undefined, () => 1000).execute(
        input,
      );
      expect(replay.status).toBe('committed');
      expect(port.mutations).toBe(1);
      store.close();
      return;
    }
    const mutationsBeforeRecovery = port.mutations;
    const recoveryWorkspaceLease = store.acquireLease(
      'workspace',
      contract.workspaceId,
      'recovery-owner',
      100,
      1100,
    );
    const recoveryLease = store.acquireLease('run', input.runId, 'recovery-owner', 100, 1100);
    const recoveryBroker = new JournaledMutationBroker(store, port, undefined, () => 1100);
    if (boundary === 'before_prepare') {
      const result = await recoveryBroker.execute({
        ...input,
        leaseOwnerId: recoveryLease.ownerId,
        leaseEpoch: recoveryLease.epoch,
        transitionContext: { workspaceLeaseEpoch: recoveryWorkspaceLease.epoch },
        nowMs: 1100,
      });
      expect(result.status).toBe('committed');
      expect(port.mutations).toBe(1);
      store.close();
      return;
    }
    const result = await recoveryBroker.reconcilePrepared({
      runId: input.runId,
      recoveryOwnerId: recoveryLease.ownerId,
      recoveryLeaseEpoch: recoveryLease.epoch,
      recoveryWorkspaceLeaseEpoch: recoveryWorkspaceLease.epoch,
      currentContractVersion: 1,
      currentPolicyDigest: digest,
      nowMs: 1100,
    });
    expect(result).toEqual([expect.objectContaining({ status: 'committed' })]);
    expect(port.mutations).toBe(
      boundary === 'after_prepare' || boundary === 'before_external_mutation'
        ? 1
        : mutationsBeforeRecovery,
    );
    expect(port.mutations).toBe(1);
    store.close();
  });

  it('commits an externally applied close without repeating it and escalates contradictions', async () => {
    const first = await createStore();
    const applied = new FakeMutationPort();
    applied.state = 'expected';
    const broker = new JournaledMutationBroker(first.store, applied, undefined, () => 1000);
    expect(await broker.execute(first.input)).toMatchObject({ status: 'committed' });
    expect(applied.mutations).toBe(0);
    first.store.close();

    const second = await createStore();
    const conflict = new FakeMutationPort();
    conflict.state = 'conflict';
    const conflictBroker = new JournaledMutationBroker(
      second.store,
      conflict,
      undefined,
      () => 1000,
    );
    expect(await conflictBroker.execute(second.input)).toMatchObject({ status: 'escalated' });
    expect(second.store.getRun(second.input.runId)?.state).toBe('escalated');
    expect(conflict.mutations).toBe(0);
    second.store.close();
  });

  it('escalates recovery when the approved contract or policy changed', async () => {
    const { store, input } = await createStore();
    store.prepareTransition(input);
    const recoveryWorkspaceLease = store.acquireLease(
      'workspace',
      contract.workspaceId,
      'recovery-owner',
      100,
      1100,
    );
    const recoveryLease = store.acquireLease('run', input.runId, 'recovery-owner', 100, 1100);
    const port = new FakeMutationPort();
    const broker = new JournaledMutationBroker(store, port, undefined, () => 1100);

    const result = await broker.reconcilePrepared({
      runId: input.runId,
      recoveryOwnerId: recoveryLease.ownerId,
      recoveryLeaseEpoch: recoveryLease.epoch,
      recoveryWorkspaceLeaseEpoch: recoveryWorkspaceLease.epoch,
      currentContractVersion: 2,
      currentPolicyDigest: digest,
      nowMs: 1100,
    });

    expect(result).toEqual([expect.objectContaining({ status: 'escalated' })]);
    expect(port.mutations).toBe(0);
    expect(store.getRun(input.runId)?.state).toBe('escalated');
    store.close();
  });

  it('requires the exclusive Beads and Dolt writer port marker', async () => {
    const { store } = await createStore();
    const port = new FakeMutationPort();
    expect(
      () =>
        new JournaledBeadsDoltBroker(store, {
          ...port,
          writerKind: 'untrusted-writer',
        } as never),
    ).toThrow('exclusive official broker port');
    store.close();
  });

  it.each([
    ['beads.task_claim', 'open', 'in_progress', 'claim'],
    ['beads.task_close', 'in_progress', 'closed', 'close'],
    ['beads.dolt_push', 'pending', 'synced', 'dolt_push'],
  ] as const)(
    'brokers %s through the pinned official adapter',
    async (operation, before, after, call) => {
      const { store, input } = await createStore();
      const client = new FakeBeadsDoltClient();
      if (operation === 'beads.dolt_push') client.syncStatus = before;
      else client.issueStatus = before;
      const port = new OfficialBeadsDoltPort('/repo/root', client);
      const broker = new JournaledBeadsDoltBroker(store, port, undefined, () => 1000);
      const result = await broker.execute(
        withCanonicalKey(input, {
          operation,
          expectedExternalState: { status: after },
          externalArguments: { taskId: 'feature-persistence.1', reason: 'accepted' },
        }),
      );

      expect(result.status).toBe('committed');
      expect(client.calls).toEqual([
        { operation: call, workspaceRoot: '/repo/root', idempotencyKey: result.idempotencyKey },
      ]);
      store.close();
    },
  );

  it('rejects caller-defined Beads close success states', async () => {
    const { store, input } = await createStore();
    const client = new FakeBeadsDoltClient();
    client.issueStatus = 'open';
    const broker = new JournaledBeadsDoltBroker(
      store,
      new OfficialBeadsDoltPort('/repo/root', client),
      undefined,
      () => 1000,
    );
    await expect(
      broker.execute(
        withCanonicalKey(input, {
          operation: 'beads.task_close',
          expectedExternalState: { status: 'open' },
          externalArguments: { taskId: 'feature-persistence.1', reason: 'accepted' },
        }),
      ),
    ).rejects.toThrow('invalid expected external state');
    expect(client.calls).toEqual([]);
    store.close();
  });

  it('fails closed when the official Beads snapshot omits dependency data', async () => {
    const client = new FakeBeadsDoltClient();
    client.readIssue = async () => ({ status: 'open' }) as never;
    const port = new OfficialBeadsDoltPort('/repo/root', client);
    await expect(port.readTaskSnapshots(['feature-persistence.1'])).rejects.toThrow(
      'missing dependencies',
    );
  });

  it('treats Beads as lifecycle authority and blocks unmatched closes', () => {
    expect(
      compareBeadsAuthoritativeState({
        beadsStatus: 'open',
        workflowAccepted: true,
        acceptanceEvidencePresent: true,
        matchingCloseTransitionPresent: false,
      }),
    ).toMatchObject({ action: 'reconcile_open' });
    expect(
      compareBeadsAuthoritativeState({
        beadsStatus: 'closed',
        workflowAccepted: false,
        acceptanceEvidencePresent: false,
        matchingCloseTransitionPresent: false,
      }),
    ).toMatchObject({ action: 'block_dependents' });
    expect(
      compareBeadsAuthoritativeState({
        beadsStatus: 'closed',
        workflowAccepted: true,
        acceptanceEvidencePresent: true,
        matchingCloseTransitionPresent: false,
      }),
    ).toMatchObject({ action: 'escalate' });
    expect(
      compareBeadsAuthoritativeState({
        beadsStatus: 'closed',
        workflowAccepted: true,
        acceptanceEvidencePresent: true,
        matchingCloseTransitionPresent: true,
      }),
    ).toEqual({ action: 'consistent' });
  });
});
