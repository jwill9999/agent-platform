import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DurableDeliveryBroker,
  ContractEvaluator,
  FeatureFinalizationCoordinator,
  JournaledBeadsDoltBroker,
  JournaledBeadsTaskCloser,
  OfficialBeadsDoltPort,
  SecureEvidenceVault,
  WorkflowStore,
  deriveFeatureDeliveryContractDigest,
  deriveFeatureDeliveryMaterialDigest,
  deriveTransitionIdempotencyKey,
  type DeliveryMutationPort,
  type DeliveryRequest,
  type ExecutionContract,
  type ExternalObservation,
  type FeatureDeliveryContract,
  type FaultBoundary,
  type OfficialBeadsDoltClient,
} from '../src/index.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;
const headSha = '2'.repeat(40);
const mergeSha = '3'.repeat(40);
const stagingMergeSha = '4'.repeat(40);
const taskId = 'closeout-feature.9';
const contract: ExecutionContract = {
  featureId: 'closeout-feature',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'close a delivered feature exactly once',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['closeout is restart safe'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read', 'artifact.write', 'github.deliver'],
    github: {
      repository: 'example/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: [],
    },
  },
  tasks: [
    {
      id: taskId,
      dependsOn: [],
      risk: 'high',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/closeout-feature',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.read', 'artifact.write', 'github.deliver'],
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
    idPattern: 'closeout-feature.repair.<sequence>',
    maxChildren: 1,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

const featureDeliveryContract: FeatureDeliveryContract = {
  contractVersion: 1,
  executionContractDigest: digest(contract),
  featureId: contract.featureId,
  workspaceId,
  policyDigest,
  origin: {
    executionContractVersion: 1,
    repository: 'example/repository',
    taskId,
    taskRef: `task/${taskId}`,
    taskHeadSha: headSha,
    integrationPullRequestNumber: 9,
    integrationMergeOperationId: `sha256:${'e'.repeat(64)}`,
    integrationMergeAttestationDigest: `sha256:${'f'.repeat(64)}`,
    featureRef: 'feature/closeout-feature',
    integratedHeadSha: mergeSha,
    mergeMethod: 'squash',
  },
  authority: {
    actorRole: 'workflow_orchestrator',
    repository: 'example/repository',
    headRef: 'feature/closeout-feature',
    headSha: mergeSha,
    base: 'staging',
    requiredChecks: [],
    protectionDigest: `sha256:${'7'.repeat(64)}`,
    mergeMethod: 'squash',
    adminBypass: false,
  },
};

function insertFeatureDeliveryContract(databasePath: string): void {
  const database = new Database(databasePath);
  database
    .prepare(
      `INSERT INTO feature_delivery_contracts
       (run_id, feature_contract_version, contract_digest, execution_contract_digest,
        body_json, created_at_ms)
       VALUES ('run-closeout', 1, ?, ?, ?, 1004)`,
    )
    .run(
      deriveFeatureDeliveryContractDigest(featureDeliveryContract),
      featureDeliveryContract.executionContractDigest,
      JSON.stringify(featureDeliveryContract),
    );
  database.close();
}

function insertFeatureDeliveryAttestation(databasePath: string): {
  operationId: string;
  result: Record<string, unknown>;
} {
  const request = {
    kind: 'feature.github.merge',
    workspaceId,
    runId: 'run-closeout',
    taskId,
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator',
    executionContractVersion: 1,
    policyDigest,
    featureContractVersion: 1,
    featureContractDigest: deriveFeatureDeliveryContractDigest(featureDeliveryContract),
    originMergeOperationId: featureDeliveryContract.origin.integrationMergeOperationId,
    originMergeAttestationDigest: featureDeliveryContract.origin.integrationMergeAttestationDigest,
    originPullRequestNumber: 9,
    originTaskHeadSha: headSha,
    headRef: 'feature/closeout-feature',
    headSha: mergeSha,
    base: 'staging',
    pullRequestNumber: 10,
    requiredChecks: [],
    protectionDigest: featureDeliveryContract.authority.protectionDigest,
    reviewDecision: 'approved',
    mergeMethod: 'squash',
    adminBypass: false,
  };
  const result = {
    pullRequestNumber: 10,
    mergeSha: stagingMergeSha,
    headSha: mergeSha,
    base: 'staging',
    mergeMethod: 'squash',
    eventIdentity: 'staging-event-10',
  };
  const operationId = digest(request);
  const database = new Database(databasePath);
  database
    .prepare(
      `INSERT INTO delivery_operations
       (id, workspace_id, run_id, task_id, kind, actor_role, request_digest, request_json, status,
        owner_id, workspace_lease_epoch, run_lease_epoch, task_lease_epoch, result_json,
        created_at_ms, updated_at_ms)
       VALUES (?, ?, 'run-closeout', ?, 'feature.github.merge', 'workflow_orchestrator', ?, ?,
        'committed', 'owner-1', 1, 1, 1, ?, 1004, 1004)`,
    )
    .run(
      operationId,
      workspaceId,
      taskId,
      operationId,
      JSON.stringify(request),
      JSON.stringify(result),
    );
  database.close();
  return { operationId, result };
}

class MergePort implements DeliveryMutationPort {
  async observe(request: DeliveryRequest): Promise<ExternalObservation> {
    if (request.kind !== 'github.merge') throw new Error('unexpected delivery request');
    return {
      kind: 'expected',
      result: {
        pullRequestNumber: request.pullRequestNumber,
        mergeSha,
        headSha: request.headSha,
        base: request.base,
        mergeMethod: request.mergeMethod,
        eventIdentity: 'merge-event-1',
      },
    };
  }

  async mutate(): Promise<unknown> {
    throw new Error('already merged');
  }
}

class BeadsClient implements OfficialBeadsDoltClient {
  readonly statuses = new Map<string, 'open' | 'in_progress' | 'closed'>([
    [taskId, 'in_progress'],
    [contract.featureId, 'in_progress'],
  ]);
  closeCalls = 0;
  doltPushCalls = 0;
  doltStatus: 'pending' | 'synced' = 'pending';

  async readIssue(_root: string, id: string) {
    const status = this.statuses.get(id);
    if (status === undefined) throw new Error(`unknown issue ${id}`);
    return { status, blockingDependencies: [] };
  }

  async claimIssue(): Promise<unknown> {
    throw new Error('claim is outside closeout');
  }

  async closeIssue(_root: string, id: string): Promise<unknown> {
    this.closeCalls += 1;
    this.statuses.set(id, 'closed');
    return { status: 'closed' };
  }

  async readDoltSync(): Promise<'pending' | 'synced'> {
    return this.doltStatus;
  }

  async pushDolt(): Promise<unknown> {
    this.doltPushCalls += 1;
    this.doltStatus = 'synced';
    return { status: 'synced' };
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup(options: { evaluate?: boolean; multipleEvidence?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'workflow-finalization-'));
  roots.push(root);
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  const contractId = store.createContract(contract, 100);
  store.createRun(contractId, 'task_accepted', 'run-closeout');
  const ownerId = 'owner-1';
  const workspaceLeaseEpoch = store.acquireLease(
    'workspace',
    workspaceId,
    ownerId,
    20_000,
    1000,
  ).epoch;
  const runLeaseEpoch = store.acquireLease('run', 'run-closeout', ownerId, 20_000, 1000).epoch;
  const taskLeaseEpoch = store.acquireLease('task', taskId, ownerId, 20_000, 1000).epoch;
  const client = new BeadsClient();
  const port = OfficialBeadsDoltPort.createForTest(root, client);
  const beads = JournaledBeadsDoltBroker.createForTest(store, port, undefined, () => 1000);
  const closer = new JournaledBeadsTaskCloser(beads, port);
  await closer.closeTask({
    transitionId: 'close-child',
    runId: 'run-closeout',
    taskId,
    reason: 'accepted',
    evidenceDigests: [],
    expectedRunVersion: 0,
    nextState: 'integration',
    contractVersion: 1,
    policyDigest,
    leaseOwnerId: ownerId,
    runLeaseEpoch,
    workspaceLeaseEpoch,
    taskLeaseEpoch,
    nowMs: 1000,
  });
  const raw = new Database(database);
  raw.prepare("UPDATE runs SET state = 'delivery' WHERE id = 'run-closeout'").run();
  raw.close();
  store.seedApprovedTaskHeadForTest({
    workspaceId,
    runId: 'run-closeout',
    taskId,
    headSha,
    nowMs: 1001,
  });
  const delivery = DurableDeliveryBroker.createForTest({
    store,
    contract,
    port: new MergePort(),
    policy: {
      authorName: 'Agent Platform',
      authorEmail: 'agent@example.com',
      approvedParentShas: { [taskId]: '1'.repeat(40) },
      approvedProtectionDigest: `sha256:${'c'.repeat(64)}`,
    },
    clock: () => 1002,
  });
  await delivery.execute(
    {
      kind: 'github.merge',
      workspaceId,
      runId: 'run-closeout',
      taskId,
      repository: 'example/repository',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      pullRequestNumber: 9,
      headSha,
      base: 'staging',
      requiredChecks: [],
      protectionDigest: `sha256:${'c'.repeat(64)}`,
      reviewDecision: 'approved',
      mergeMethod: 'squash',
      adminBypass: false,
    },
    { ownerId, workspaceLeaseEpoch, runLeaseEpoch, taskLeaseEpoch },
  );
  expect(store.getRun('run-closeout')).toMatchObject({ state: 'finalizing', mergeVerified: true });
  const vault = new SecureEvidenceVault({ store, contract, clock: () => 1003 });
  const evidence = await vault.record({
    content: Buffer.from('closeout verified'),
    mediaType: 'text/plain',
    kind: 'evaluation',
    producer: 'feature-evaluator',
    producerRole: 'feature_evaluator',
    workspaceId,
    runId: 'run-closeout',
    taskId,
    contractVersion: 1,
    policyDigest,
    headSha,
  });
  vault.accept({
    digest: evidence.reference.digest,
    runId: 'run-closeout',
    taskId,
    actorRole: 'feature_evaluator',
  });
  let evaluationEvidence = [evidence.reference];
  if (options.multipleEvidence === true) {
    const review = await vault.record({
      content: Buffer.from('independent review passed'),
      mediaType: 'text/plain',
      kind: 'review',
      producer: 'code-reviewer',
      producerRole: 'code_reviewer',
      workspaceId,
      runId: 'run-closeout',
      taskId,
      contractVersion: 1,
      policyDigest,
      headSha,
    });
    vault.accept({
      digest: review.reference.digest,
      runId: 'run-closeout',
      taskId,
      actorRole: 'feature_evaluator',
    });
    evaluationEvidence = [...evaluationEvidence, review.reference];
  }
  if (options.evaluate !== false) {
    new ContractEvaluator({ store, contract }).evaluate(
      {
        workspaceId,
        runId: 'run-closeout',
        taskId,
        headSha,
        contractVersion: 1,
        policyDigest,
        evaluatorRole: 'feature_evaluator',
        summary: 'closeout evaluation passed',
        criteria: [
          {
            criterion: 'closeout is restart safe',
            status: 'passed',
            summary: 'finalization implementation and restart tests',
            evidence: evaluationEvidence,
          },
        ],
      },
      1004,
    );
  }
  const closeoutLeaseEpoch = store.acquireLease(
    'closeout',
    'run-closeout',
    ownerId,
    20_000,
    1004,
  ).epoch;
  return {
    root,
    database,
    store,
    client,
    port,
    evidence: evidence.reference,
    fence: { ownerId, workspaceLeaseEpoch, runLeaseEpoch, closeoutLeaseEpoch },
  };
}

function finalizationInput(setupResult: Awaited<ReturnType<typeof setup>>) {
  return {
    runId: 'run-closeout',
    epicId: contract.featureId,
    fence: setupResult.fence,
  };
}

describe('FeatureFinalizationCoordinator', () => {
  it('derives durable feature authority and blocks omission of the staging attestation', async () => {
    const fixture = await setup();
    fixture.store.createFeatureDeliveryApprovalForTest(
      {
        approvalVersion: 1,
        approvalId: 'closeout-feature-approval',
        runId: 'run-closeout',
        approverId: 'feature-owner',
        approverRole: 'human_approver',
        featureContractVersion: 1,
        featureContractDigest: deriveFeatureDeliveryContractDigest(featureDeliveryContract),
        materialDigest: deriveFeatureDeliveryMaterialDigest(featureDeliveryContract),
        policyDigest,
        status: 'active',
        approvedAtMs: 1004,
        invalidatedAtMs: null,
        invalidationReason: null,
      },
      featureDeliveryContract,
    );
    insertFeatureDeliveryContract(fixture.database);
    const integratedVault = new SecureEvidenceVault({
      store: fixture.store,
      contract,
      clock: () => 1004,
    });
    const integratedEvidence = await integratedVault.record({
      content: Buffer.from('integrated feature evaluation'),
      mediaType: 'text/plain',
      kind: 'evaluation',
      producer: 'feature-evaluator',
      producerRole: 'feature_evaluator',
      workspaceId,
      runId: 'run-closeout',
      taskId,
      contractVersion: 1,
      policyDigest,
      headSha: mergeSha,
    });
    integratedVault.accept({
      digest: integratedEvidence.reference.digest,
      runId: 'run-closeout',
      taskId,
      actorRole: 'feature_evaluator',
    });
    new ContractEvaluator({ store: fixture.store, contract }).evaluate(
      {
        workspaceId,
        runId: 'run-closeout',
        taskId,
        headSha: mergeSha,
        contractVersion: 1,
        policyDigest,
        evaluatorRole: 'feature_evaluator',
        summary: 'integrated feature evaluation passed',
        criteria: [
          {
            criterion: 'closeout is restart safe',
            status: 'passed',
            summary: 'integrated feature head verified',
            evidence: [integratedEvidence.reference],
          },
        ],
      },
      1004,
    );
    const createCoordinator = () =>
      FeatureFinalizationCoordinator.createForTest({
        store: fixture.store,
        contract,
        broker: JournaledBeadsDoltBroker.createForTest(
          fixture.store,
          fixture.port,
          undefined,
          () => 1005,
        ),
        clock: () => 1005,
      });

    await expect(createCoordinator().finalize(finalizationInput(fixture))).rejects.toThrow(
      'committed staging delivery attestation',
    );
    expect(fixture.client.statuses.get(contract.featureId)).toBe('in_progress');
    insertFeatureDeliveryAttestation(fixture.database);
    const result = await createCoordinator().finalize(finalizationInput(fixture));
    expect(result.report).toMatchObject({
      destination: 'staging',
      mergeSha: stagingMergeSha,
      mergeEventIdentity: 'staging-event-10',
    });
    fixture.store.close();
  });

  it('closes only after exact merge, child close, epic close, Dolt sync, and final evidence', async () => {
    const fixture = await setup();
    const coordinator = FeatureFinalizationCoordinator.createForTest({
      store: fixture.store,
      contract,
      broker: JournaledBeadsDoltBroker.createForTest(
        fixture.store,
        fixture.port,
        undefined,
        () => 1005,
      ),
      clock: () => 1005,
    });
    const result = await coordinator.finalize(finalizationInput(fixture));
    expect(result).toMatchObject({ status: 'closed', featureId: contract.featureId });
    expect(fixture.store.getRun('run-closeout')).toMatchObject({ state: 'closed' });
    expect(fixture.client.closeCalls).toBe(2);
    expect(fixture.client.doltPushCalls).toBe(1);
    expect(result.report).toMatchObject({
      mergedHeadSha: headSha,
      mergeSha,
      acceptance: [{ criterion: 'closeout is restart safe' }],
    });
    fixture.store.close();
  });

  it.each([
    ['beads.task_close', 'after_external_mutation'],
    ['beads.dolt_push', 'after_external_mutation'],
  ] as const)(
    'recovers %s after its external effect without duplication',
    async (operation, boundary) => {
      const fixture = await setup();
      let injected = false;
      const fault = (seen: FaultBoundary, transition: { operation: string }) => {
        if (!injected && seen === boundary && transition.operation === operation) {
          injected = true;
          throw new Error('seeded closeout crash');
        }
      };
      const crashing = FeatureFinalizationCoordinator.createForTest({
        store: fixture.store,
        contract,
        broker: JournaledBeadsDoltBroker.createForTest(
          fixture.store,
          fixture.port,
          fault,
          () => 1005,
        ),
        clock: () => 1005,
      });
      await expect(crashing.finalize(finalizationInput(fixture))).rejects.toThrow('seeded');
      fixture.store.close();

      const recoveredStore = new WorkflowStore(fixture.database);
      const ownerId = 'owner-2';
      const fence = {
        ownerId,
        workspaceLeaseEpoch: recoveredStore.acquireLease(
          'workspace',
          workspaceId,
          ownerId,
          20_000,
          22_000,
        ).epoch,
        runLeaseEpoch: recoveredStore.acquireLease('run', 'run-closeout', ownerId, 20_000, 22_000)
          .epoch,
        closeoutLeaseEpoch: recoveredStore.acquireLease(
          'closeout',
          'run-closeout',
          ownerId,
          20_000,
          22_000,
        ).epoch,
      };
      const recovered = FeatureFinalizationCoordinator.createForTest({
        store: recoveredStore,
        contract,
        broker: JournaledBeadsDoltBroker.createForTest(
          recoveredStore,
          fixture.port,
          undefined,
          () => 22_001,
        ),
        clock: () => 22_001,
      });
      const result = await recovered.finalize({ ...finalizationInput(fixture), fence });
      expect(result.status).toBe('closed');
      expect(fixture.client.closeCalls).toBe(2);
      expect(fixture.client.doltPushCalls).toBe(1);
      recoveredStore.close();
    },
  );

  it('replays a crash after report persistence and never closes with missing evidence', async () => {
    const fixture = await setup();
    let crash = true;
    const coordinator = FeatureFinalizationCoordinator.createForTest({
      store: fixture.store,
      contract,
      broker: JournaledBeadsDoltBroker.createForTest(
        fixture.store,
        fixture.port,
        undefined,
        () => 1005,
      ),
      clock: () => 1005,
      fault(boundary) {
        if (crash && boundary === 'after_report_commit') {
          crash = false;
          throw new Error('seeded report crash');
        }
      },
    });
    await expect(coordinator.finalize(finalizationInput(fixture))).rejects.toThrow('report crash');
    expect(fixture.store.getRun('run-closeout')?.state).toBe('finalizing');
    expect(fixture.store.getFeatureFinalization('run-closeout')?.status).toBe('prepared');
    await expect(coordinator.finalize(finalizationInput(fixture))).resolves.toMatchObject({
      status: 'closed',
    });
    fixture.store.close();
  });

  it('rejects missing exact-head evaluation before any epic or Dolt mutation', async () => {
    const fixture = await setup({ evaluate: false });
    const coordinator = FeatureFinalizationCoordinator.createForTest({
      store: fixture.store,
      contract,
      broker: JournaledBeadsDoltBroker.createForTest(
        fixture.store,
        fixture.port,
        undefined,
        () => 1005,
      ),
      clock: () => 1005,
    });

    await expect(coordinator.finalize(finalizationInput(fixture))).rejects.toThrow(
      'passed feature evaluation at the merged head is unavailable',
    );
    expect(fixture.client.closeCalls).toBe(1);
    expect(fixture.client.doltPushCalls).toBe(0);
    expect(fixture.client.statuses.get(contract.featureId)).toBe('in_progress');
    expect(fixture.store.getFeatureFinalization('run-closeout')).toBeUndefined();
    fixture.store.close();
  });

  it('preserves every accepted evidence reference from a passed criterion', async () => {
    const fixture = await setup({ multipleEvidence: true });
    const coordinator = FeatureFinalizationCoordinator.createForTest({
      store: fixture.store,
      contract,
      broker: JournaledBeadsDoltBroker.createForTest(
        fixture.store,
        fixture.port,
        undefined,
        () => 1005,
      ),
      clock: () => 1005,
    });

    const result = await coordinator.finalize(finalizationInput(fixture));
    expect(result.report).toMatchObject({ acceptance: [{ evidence: [{}, {}] }] });
    fixture.store.close();
  });

  it('rejects a legitimate broker backed by a different journal store', async () => {
    const fixture = await setup();
    const foreignDatabase = join(fixture.root, 'foreign.sqlite');
    const foreignStore = new WorkflowStore(foreignDatabase);
    expect(
      () =>
        new FeatureFinalizationCoordinator({
          store: fixture.store,
          contract,
          broker: JournaledBeadsDoltBroker.createForTest(
            foreignStore,
            fixture.port,
            undefined,
            () => 1005,
          ),
        }),
    ).toThrow('different workflow store');
    foreignStore.close();
    fixture.store.close();
  });

  it('seals the verified broker against post-construction method or prototype replacement', async () => {
    const fixture = await setup();
    const broker = JournaledBeadsDoltBroker.createForTest(
      fixture.store,
      fixture.port,
      undefined,
      () => 1005,
    );
    FeatureFinalizationCoordinator.createForTest({
      store: fixture.store,
      contract,
      broker,
      clock: () => 1005,
    });

    expect(() =>
      Object.defineProperty(broker, 'execute', { value: async () => undefined }),
    ).toThrow();
    expect(() => Object.setPrototypeOf(broker, {})).toThrow();
    expect(() =>
      Object.defineProperty(fixture.port, 'observe', { value: async () => undefined }),
    ).toThrow();
    expect(() => Object.setPrototypeOf(fixture.port, {})).toThrow();
    expect(() =>
      Object.defineProperty(OfficialBeadsDoltPort.prototype, 'observe', {
        value: async () => undefined,
      }),
    ).toThrow();
    fixture.store.close();
  });

  it('uses the committed merge as the immediate finalizing recovery predecessor', async () => {
    const fixture = await setup();
    const merge = fixture.store.getCommittedMergeAttestation('run-closeout')!;
    const expectedRunVersion = fixture.store.getRun('run-closeout')!.version;
    const entryId = 'post-merge-recovery';
    const entry = fixture.store.prepareTransition({
      id: entryId,
      runId: 'run-closeout',
      from: 'finalizing',
      to: 'recovering',
      operation: 'internal.recovery',
      expectedRunVersion,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'run-closeout',
        transitionId: entryId,
        operation: 'internal.recovery',
        expectedVersion: expectedRunVersion,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      leaseOwnerId: fixture.fence.ownerId,
      leaseEpoch: fixture.fence.runLeaseEpoch,
      transitionContext: {
        workspaceLeaseEpoch: fixture.fence.workspaceLeaseEpoch,
        recoveryTarget: 'finalizing',
      },
      expectedExternalState: { status: 'internal' },
      externalArguments: {
        taskId,
        interruptedTransitionId: merge.id,
        evidenceDigests: [fixture.evidence.digest],
      },
      nowMs: 1005,
    });
    fixture.store.commitTransition(
      entry.id,
      fixture.fence.ownerId,
      fixture.fence.runLeaseEpoch,
      { recovered: true },
      1005,
    );
    expect(fixture.store.getRun('run-closeout')?.state).toBe('recovering');
    fixture.store.close();
  });

  it('prefers and binds the committed staging merge after a finalizing crash', async () => {
    const fixture = await setup();
    fixture.store.createFeatureDeliveryApprovalForTest(
      {
        approvalVersion: 1,
        approvalId: 'recovery-feature-approval',
        runId: 'run-closeout',
        approverId: 'feature-owner',
        approverRole: 'human_approver',
        featureContractVersion: 1,
        featureContractDigest: deriveFeatureDeliveryContractDigest(featureDeliveryContract),
        materialDigest: deriveFeatureDeliveryMaterialDigest(featureDeliveryContract),
        policyDigest,
        status: 'active',
        approvedAtMs: 1004,
        invalidatedAtMs: null,
        invalidationReason: null,
      },
      featureDeliveryContract,
    );
    insertFeatureDeliveryContract(fixture.database);
    const staging = insertFeatureDeliveryAttestation(fixture.database);
    fixture.store.recordEvidence({
      ...fixture.evidence,
      producer: 'workflow-recovery-checkpoint',
      producerRole: 'workflow_orchestrator',
      workspaceId,
      runId: 'run-closeout',
      taskId,
      transitionId: staging.operationId,
      contractVersion: 1,
      policyDigest,
      headSha: mergeSha,
      createdAtMs: 1005,
    });
    fixture.store.close();

    const recovered = new WorkflowStore(fixture.database);
    const ownerId = 'post-staging-recovery-owner';
    const workspaceLeaseEpoch = recovered.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      22_000,
    ).epoch;
    const runLeaseEpoch = recovered.acquireLease(
      'run',
      'run-closeout',
      ownerId,
      1000,
      22_000,
    ).epoch;
    const expectedRunVersion = recovered.getRun('run-closeout')!.version;
    const entryId = 'post-staging-merge-recovery';
    const request = {
      id: entryId,
      runId: 'run-closeout',
      from: 'finalizing' as const,
      to: 'recovering' as const,
      operation: 'internal.recovery',
      expectedRunVersion,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'run-closeout',
        transitionId: entryId,
        operation: 'internal.recovery',
        expectedVersion: expectedRunVersion,
      }),
      actorRole: 'workflow_orchestrator' as const,
      contractVersion: 1 as const,
      policyDigest,
      leaseOwnerId: ownerId,
      leaseEpoch: runLeaseEpoch,
      transitionContext: { workspaceLeaseEpoch, recoveryTarget: 'finalizing' as const },
      expectedExternalState: { status: 'internal' },
      externalArguments: {
        taskId,
        interruptedTransitionId: staging.operationId,
        evidenceDigests: [fixture.evidence.digest],
        featureContractDigest: deriveFeatureDeliveryContractDigest(featureDeliveryContract),
        featureDeliveryAttestationDigest: digest(staging.result),
      },
      nowMs: 22_000,
    };
    expect(() =>
      recovered.prepareTransition({
        ...request,
        externalArguments: { ...request.externalArguments, featureContractDigest: policyDigest },
      }),
    ).toThrow('predecessor binding is stale');
    const prepared = recovered.prepareTransition(request);
    recovered.commitTransition(prepared.id, ownerId, runLeaseEpoch, { recovered: true }, 22_001);
    expect(recovered.getRun('run-closeout')?.state).toBe('recovering');
    recovered.close();
  });
});
