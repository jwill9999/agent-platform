import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';

import {
  OfficialCancellationCleanupPort,
  SecureEvidenceVault,
  WorkflowCancellationCoordinator,
  WorkflowCancellationRecoveryDriver,
  WorkflowStore,
  deriveTransitionIdempotencyKey,
  type CancellationCleanupClient,
  type ExecutionContract,
} from '../src/index.js';

const roots: string[] = [];
const workspaceId = `sha256:${'b'.repeat(64)}`;
const policyDigest = `sha256:${'a'.repeat(64)}`;
const contract: ExecutionContract = {
  featureId: 'recovery-feature',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'recover and cancel durably',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['recovery is exact'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read', 'artifact.write'],
    github: {
      repository: 'example/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: [],
    },
  },
  tasks: [
    {
      id: 'recovery-feature.9',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/recovery-feature',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.read', 'artifact.write'],
    },
  ],
  qualityGates: [],
  retryPolicy: {
    implementationAttempts: 2,
    findingAttempts: 2,
    infrastructureAttempts: 2,
    waitDeadlineSeconds: 60,
  },
  repairTaskPolicy: {
    idPattern: 'recovery-feature.repair.<sequence>',
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

async function createStore(state: 'pipeline' | 'implementing') {
  const root = await mkdtemp(join(tmpdir(), 'workflow-recovery-'));
  roots.push(root);
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  const contractId = store.createContract(contract, 100);
  store.createRun(contractId, state, 'run-recovery');
  store.seedApprovedTaskHeadForTest({
    workspaceId,
    runId: 'run-recovery',
    taskId: 'recovery-feature.9',
    headSha: '1'.repeat(40),
    nowMs: 100,
  });
  const vault = new SecureEvidenceVault({ store, contract, clock: () => 101 });
  const evidence = await vault.record({
    content: Buffer.from(JSON.stringify({ summary: 'recovery evidence' })),
    mediaType: 'application/json',
    kind: 'external',
    producer: 'recovery-fixture',
    producerRole: 'workflow_orchestrator',
    workspaceId,
    runId: 'run-recovery',
    taskId: 'recovery-feature.9',
    contractVersion: 1,
    policyDigest,
    headSha: '1'.repeat(40),
  });
  vault.accept({
    digest: evidence.reference.digest,
    runId: 'run-recovery',
    taskId: 'recovery-feature.9',
    actorRole: 'workflow_orchestrator',
  });
  const raw = new Database(database);
  raw
    .prepare(
      `INSERT INTO transitions
     (id, run_id, from_state, to_state, operation, expected_run_version, idempotency_key,
      status, actor_role, contract_version, policy_digest, lease_owner_id, lease_epoch,
      transition_context_json, expected_external_state_json, external_arguments_json,
      result_json, created_at_ms, updated_at_ms)
     VALUES ('state-predecessor', 'run-recovery', 'waiting', ?, 'internal.fixture', 0, ?,
      'committed', 'workflow_orchestrator', 1, ?, 'fixture', 0, '{}', '{}', '{}', '{}', 99, 99)`,
    )
    .run(state, `sha256:${'f'.repeat(64)}`, policyDigest);
  raw.prepare('UPDATE runs SET version = 2 WHERE id = ?').run('run-recovery');
  raw.close();
  return { root, database, store, evidence: evidence.reference };
}

describe('durable workflow recovery', () => {
  it('persists the interrupted target and rejects caller-selected resume states after restart', async () => {
    const fixture = await createStore('pipeline');
    const ownerId = 'owner-1';
    const workspaceLeaseEpoch = fixture.store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = fixture.store.acquireLease(
      'run',
      'run-recovery',
      ownerId,
      1000,
      1000,
    ).epoch;
    const enterId = 'enter-recovery';
    const prepared = fixture.store.prepareTransition({
      id: enterId,
      runId: 'run-recovery',
      from: 'pipeline',
      to: 'recovering',
      operation: 'internal.recovery',
      expectedRunVersion: fixture.store.getRun('run-recovery')!.version,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'run-recovery',
        transitionId: enterId,
        operation: 'internal.recovery',
        expectedVersion: fixture.store.getRun('run-recovery')!.version,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      leaseOwnerId: ownerId,
      leaseEpoch: runLeaseEpoch,
      transitionContext: { workspaceLeaseEpoch, recoveryTarget: 'pipeline' },
      expectedExternalState: { status: 'internal' },
      externalArguments: {
        interruptedTransitionId: 'state-predecessor',
        evidenceDigests: [fixture.evidence.digest],
      },
      nowMs: 1000,
    });
    fixture.store.commitTransition(prepared.id, ownerId, runLeaseEpoch, { recovered: true }, 1001);
    fixture.store.close();

    const recovered = new WorkflowStore(fixture.database);
    const nextOwner = 'owner-2';
    const nextWorkspaceLease = recovered.acquireLease(
      'workspace',
      workspaceId,
      nextOwner,
      1000,
      2100,
    ).epoch;
    const nextRunLease = recovered.acquireLease('run', 'run-recovery', nextOwner, 1000, 2100).epoch;
    const request = (target: 'pipeline' | 'scheduling') => ({
      id: `resume-${target}`,
      runId: 'run-recovery',
      from: 'recovering' as const,
      to: target,
      operation: 'internal.resume',
      expectedRunVersion: recovered.getRun('run-recovery')!.version,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'run-recovery',
        transitionId: `resume-${target}`,
        operation: 'internal.resume',
        expectedVersion: recovered.getRun('run-recovery')!.version,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1 as const,
      policyDigest,
      leaseOwnerId: nextOwner,
      leaseEpoch: nextRunLease,
      transitionContext: { workspaceLeaseEpoch: nextWorkspaceLease, recoveryTarget: target },
      expectedExternalState: { status: 'internal' },
      externalArguments: {},
      nowMs: 2100,
    });
    expect(() => recovered.prepareTransition(request('scheduling'))).toThrow(
      'durable recovery target',
    );
    const resumed = recovered.prepareTransition(request('pipeline'));
    recovered.commitTransition(resumed.id, nextOwner, nextRunLease, { resumed: true }, 2101);
    expect(recovered.getRun('run-recovery')?.state).toBe('pipeline');
    recovered.close();
  });

  it('terminalizes the recovery record when entry reconciliation escalates', async () => {
    const fixture = await createStore('pipeline');
    const ownerId = 'owner-entry-escalation';
    const workspaceLeaseEpoch = fixture.store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = fixture.store.acquireLease(
      'run',
      'run-recovery',
      ownerId,
      1000,
      1000,
    ).epoch;
    const expectedRunVersion = fixture.store.getRun('run-recovery')!.version;
    const id = 'entry-escalation';
    fixture.store.prepareTransition({
      id,
      runId: 'run-recovery',
      from: 'pipeline',
      to: 'recovering',
      operation: 'internal.recovery',
      expectedRunVersion,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'run-recovery',
        transitionId: id,
        operation: 'internal.recovery',
        expectedVersion: expectedRunVersion,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      leaseOwnerId: ownerId,
      leaseEpoch: runLeaseEpoch,
      transitionContext: { workspaceLeaseEpoch, recoveryTarget: 'pipeline' },
      expectedExternalState: { status: 'internal' },
      externalArguments: {
        interruptedTransitionId: 'state-predecessor',
        evidenceDigests: [fixture.evidence.digest],
      },
      nowMs: 1000,
    });
    fixture.store.escalateTransition(id, ownerId, runLeaseEpoch, { conflict: true }, 1001);
    fixture.store.close();

    const raw = new Database(fixture.database, { readonly: true });
    expect(
      raw
        .prepare(
          'SELECT resumed_at_ms, terminal_outcome FROM recovery_records WHERE transition_id = ?',
        )
        .get(id),
    ).toMatchObject({ resumed_at_ms: 1001, terminal_outcome: 'escalated' });
    raw.close();
  });
});

class IdempotentCleanupPort implements CancellationCleanupClient {
  readonly stopped = new Set<string>();
  readonly cleaned = new Set<string>();
  incomplete = false;

  async stopOwnedWork(input: { cancellationId: string }) {
    this.stopped.add(input.cancellationId);
    return { stopped: !this.incomplete, incomplete: this.incomplete ? ['specialist'] : [] };
  }

  async cleanupPreparedEffects(input: { cancellationId: string }) {
    this.cleaned.add(input.cancellationId);
    return { incomplete: this.incomplete ? ['prepared-effects'] : [] };
  }
}

class HangingCleanupPort implements CancellationCleanupClient {
  async stopOwnedWork(): Promise<never> {
    return new Promise(() => undefined);
  }

  async cleanupPreparedEffects(): Promise<never> {
    return new Promise(() => undefined);
  }
}

describe('WorkflowCancellationCoordinator', () => {
  it('persists intent before cleanup and resumes idempotently after a crash', async () => {
    const fixture = await createStore('implementing');
    const ownerId = 'owner-1';
    const workspaceLeaseEpoch = fixture.store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      5000,
      1000,
    ).epoch;
    const runLeaseEpoch = fixture.store.acquireLease(
      'run',
      'run-recovery',
      ownerId,
      5000,
      1000,
    ).epoch;
    const port = new IdempotentCleanupPort();
    let crash = true;
    const coordinator = WorkflowCancellationCoordinator.createForTest({
      store: fixture.store,
      contract,
      port: OfficialCancellationCleanupPort.createForTest(port),
      clock: () => 1100,
      fault(boundary) {
        if (crash && boundary === 'after_request_commit') {
          crash = false;
          throw new Error('seeded cancellation crash');
        }
      },
    });
    const request = {
      id: 'cancel-1',
      runId: 'run-recovery',
      requestedBy: 'operator',
      reason: 'stop requested',
      stopDeadlineMs: 2000,
      retainedEvidence: [fixture.evidence],
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
    };
    await expect(coordinator.cancel(request)).rejects.toThrow('seeded');
    expect(fixture.store.getRun('run-recovery')?.state).toBe('cancelling');
    const recoveredCoordinator = WorkflowCancellationCoordinator.createForTest({
      store: fixture.store,
      contract,
      port: OfficialCancellationCleanupPort.createForTest(port),
      clock: () => 1100,
    });
    const recoveryDriver = new WorkflowCancellationRecoveryDriver({
      store: fixture.store,
      coordinator: recoveredCoordinator,
      fenceProvider: async () => ({ ownerId, workspaceLeaseEpoch, runLeaseEpoch }),
    });
    await expect(recoveryDriver.recoverRequested()).resolves.toMatchObject({
      errors: [],
      recovered: [{ status: 'cancelled' }],
    });
    expect(port.stopped).toEqual(new Set(['cancel-1']));
    expect(port.cleaned).toEqual(new Set(['cancel-1']));
    expect(fixture.store.getRun('run-recovery')?.state).toBe('cancelled');
    fixture.store.close();
  });

  it('escalates incomplete cleanup exactly once only after the absolute stop deadline', async () => {
    const fixture = await createStore('implementing');
    const ownerId = 'owner-1';
    const workspaceLeaseEpoch = fixture.store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      5000,
      1000,
    ).epoch;
    const runLeaseEpoch = fixture.store.acquireLease(
      'run',
      'run-recovery',
      ownerId,
      5000,
      1000,
    ).epoch;
    const port = new IdempotentCleanupPort();
    port.incomplete = true;
    let nowMs = 1500;
    const coordinator = WorkflowCancellationCoordinator.createForTest({
      store: fixture.store,
      contract,
      port: OfficialCancellationCleanupPort.createForTest(port),
      clock: () => nowMs,
    });
    const request = {
      id: 'cancel-deadline',
      runId: 'run-recovery',
      requestedBy: 'operator',
      reason: 'stop requested',
      stopDeadlineMs: 2000,
      retainedEvidence: [fixture.evidence],
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
    };
    await expect(coordinator.cancel(request)).resolves.toMatchObject({ status: 'requested' });
    nowMs = 2000;
    await expect(coordinator.cancel(request)).resolves.toMatchObject({ status: 'escalated' });
    await expect(coordinator.cancel(request)).resolves.toMatchObject({ status: 'escalated' });
    expect(fixture.store.getRun('run-recovery')?.state).toBe('escalated');
    fixture.store.close();
  });

  it('bounds hanging cleanup calls by the durable stop deadline', async () => {
    const fixture = await createStore('implementing');
    const ownerId = 'owner-hung';
    const nowMs = Date.now();
    const workspaceLeaseEpoch = fixture.store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      2000,
      nowMs,
    ).epoch;
    const runLeaseEpoch = fixture.store.acquireLease(
      'run',
      'run-recovery',
      ownerId,
      2000,
      nowMs,
    ).epoch;
    const coordinator = WorkflowCancellationCoordinator.createForTest({
      store: fixture.store,
      contract,
      port: OfficialCancellationCleanupPort.createForTest(new HangingCleanupPort()),
      clock: Date.now,
    });

    await expect(
      coordinator.cancel({
        id: 'cancel-hung',
        runId: 'run-recovery',
        requestedBy: 'operator',
        reason: 'hung cleanup must terminate',
        stopDeadlineMs: nowMs + 25,
        retainedEvidence: [fixture.evidence],
        ownerId,
        workspaceLeaseEpoch,
        runLeaseEpoch,
      }),
    ).resolves.toMatchObject({
      status: 'escalated',
      incompleteCleanup: expect.arrayContaining([
        'stop-owned-work-timeout',
        'cleanup-prepared-effects-timeout',
      ]),
    });
    fixture.store.close();
  });

  it('isolates a hung recovery fence so later requested cancellations still run', async () => {
    const records = ['run-hung', 'run-next'].map((runId) => ({
      id: `cancel-${runId}`,
      runId,
      requestedBy: 'operator',
      reason: 'restart',
      requestedAtMs: 1,
      stopDeadlineMs: 1,
      status: 'requested' as const,
      ownedWorkStopped: false,
      incompleteCleanup: [],
      retainedEvidence: [],
      completedAtMs: null,
    }));
    const resumed: string[] = [];
    const driver = new WorkflowCancellationRecoveryDriver({
      store: {
        listRequestedWorkflowCancellations: () => records,
      } as never,
      coordinator: {
        async resume(input: { runId: string }) {
          resumed.push(input.runId);
          return { ...records[1]!, runId: input.runId, status: 'cancelled' as const };
        },
      } as never,
      fenceProvider: (runId) =>
        runId === 'run-hung'
          ? new Promise(() => undefined)
          : Promise.resolve({ ownerId: 'owner', workspaceLeaseEpoch: 1, runLeaseEpoch: 1 }),
    });

    await expect(driver.recoverRequested()).resolves.toMatchObject({
      recovered: [{ runId: 'run-next', status: 'cancelled' }],
      errors: [{ runId: 'run-hung', message: 'cancellation recovery fence acquisition timed out' }],
    });
    expect(resumed).toEqual(['run-next']);
  });
});
