import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DurableDeliveryBroker,
  DurableFeatureDeliveryBroker,
  ContentAddressedArtifactStore,
  DockerIsolatedSpecialistLauncher,
  FeatureDeliveryRecoveryDriver,
  JournaledArtifactRecorder,
  JournaledBeadsDoltBroker,
  JournaledBeadsTaskCloser,
  LocalExactHeadIntegrationGate,
  OfficialBeadsDoltPort,
  RevocableSpecialistCredentialBroker,
  WorkflowOrchestrator,
  WorkflowStore,
  deriveFeatureDeliveryContractDigest,
  deriveFeatureDeliveryMaterialDigest,
  deriveTransitionIdempotencyKey,
  type ExecutionContract,
  type DeliveryMutationPort,
  type DeliveryRequest,
  type ExternalObservation,
  type FeatureDeliveryContract,
  type FeatureDeliveryMutationPort,
  type FeatureDeliveryRequest,
  type OfficialBeadsDoltClient,
} from '../src/index.js';

const roots: string[] = [];
const workspaceId = `sha256:${'b'.repeat(64)}`;
const policyDigest = `sha256:${'a'.repeat(64)}`;
const taskHeadSha = '1'.repeat(40);
const featureHeadSha = '2'.repeat(40);
const originOperationId = `sha256:${'e'.repeat(64)}`;
const protectionDigest = `sha256:${'9'.repeat(64)}`;

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function textDigest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const executionContract: ExecutionContract = {
  featureId: 'bounded-delivery',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'Deliver the bounded feature',
  requirements: ['use separate delivery authorities'],
  nonGoals: ['production promotion'],
  acceptanceCriteria: ['staging delivery is exact'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'feature/bounded-delivery',
    allowedActions: ['github.read', 'github.deliver'],
    github: {
      repository: 'example/repository',
      base: 'feature/bounded-delivery',
      mergeMethod: 'squash',
      requiredChecks: ['integration'],
    },
  },
  tasks: [
    {
      id: 'bounded-delivery.1',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'workflow_orchestrator',
      branchParent: 'feature/bounded-delivery',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['github.read', 'github.deliver'],
    },
  ],
  qualityGates: ['integration'],
  retryPolicy: {
    implementationAttempts: 1,
    findingAttempts: 1,
    infrastructureAttempts: 1,
    waitDeadlineSeconds: 300,
  },
  repairTaskPolicy: {
    idPattern: 'bounded-delivery.repair.<sequence>',
    maxChildren: 1,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: ['stop'],
};

const originResult = {
  pullRequestNumber: 11,
  mergeSha: featureHeadSha,
  headSha: taskHeadSha,
  base: 'feature/bounded-delivery',
  mergeMethod: 'squash',
  eventIdentity: 'integration-event-11',
};

const featureContract: FeatureDeliveryContract = {
  contractVersion: 1,
  executionContractDigest: digest(executionContract),
  featureId: executionContract.featureId,
  workspaceId,
  policyDigest,
  origin: {
    executionContractVersion: 1,
    repository: 'example/repository',
    taskId: 'bounded-delivery.1',
    taskRef: 'task/bounded-delivery.1',
    taskHeadSha,
    integrationPullRequestNumber: 11,
    integrationMergeOperationId: originOperationId,
    integrationMergeAttestationDigest: digest(originResult),
    featureRef: 'feature/bounded-delivery',
    integratedHeadSha: featureHeadSha,
    mergeMethod: 'squash',
  },
  authority: {
    actorRole: 'workflow_orchestrator',
    repository: 'example/repository',
    headRef: 'feature/bounded-delivery',
    headSha: featureHeadSha,
    base: 'staging',
    requiredChecks: ['build', 'test'],
    protectionDigest,
    mergeMethod: 'squash',
    adminBypass: false,
  },
};

class FakeFeaturePort implements FeatureDeliveryMutationPort {
  mutated = false;
  mutationCount = 0;
  conflict: unknown | undefined;
  crashAfterMutation: (() => void) | undefined;

  async observe(request: FeatureDeliveryRequest): Promise<ExternalObservation> {
    if (this.conflict !== undefined) return { kind: 'conflict', result: this.conflict };
    if (request.kind === 'feature.github.checks') {
      return {
        kind: 'expected',
        result: {
          checks: { build: 'success', test: 'success' },
          eventIdentity: 'checks-12',
        },
      };
    }
    if (!this.mutated) return { kind: 'unchanged', result: { exists: false } };
    if (request.kind === 'feature.github.merge') {
      return {
        kind: 'expected',
        result: {
          pullRequestNumber: request.pullRequestNumber,
          mergeSha: '3'.repeat(40),
          headSha: request.headSha,
          base: request.base,
          mergeMethod: request.mergeMethod,
          eventIdentity: 'staging-merge-12',
        },
      };
    }
    return { kind: 'expected', result: { number: 12, headSha: request.headSha } };
  }

  async mutate(): Promise<unknown> {
    this.mutated = true;
    this.mutationCount += 1;
    this.crashAfterMutation?.();
    return { changed: true };
  }
}

class IntegratedOriginPort implements DeliveryMutationPort {
  async observe(request: DeliveryRequest): Promise<ExternalObservation> {
    if (request.kind !== 'github.merge') throw new Error('unexpected origin request');
    return {
      kind: 'expected',
      result: {
        pullRequestNumber: request.pullRequestNumber,
        mergeSha: featureHeadSha,
        headSha: request.headSha,
        base: request.base,
        mergeMethod: request.mergeMethod,
        eventIdentity: 'origin-merge-11',
      },
    };
  }

  async mutate(): Promise<unknown> {
    throw new Error('origin is already merged');
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup(input?: {
  contract?: FeatureDeliveryContract;
  fault?: Parameters<typeof DurableFeatureDeliveryBroker.createForTest>[0]['fault'];
  nowMs?: number;
  approval?: false | Record<string, unknown>;
}) {
  const root = await mkdtemp(join(tmpdir(), 'feature-delivery-'));
  roots.push(root);
  const databasePath = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(databasePath);
  const contractId = store.createContract(executionContract, 1000);
  const run = store.createRun(contractId, 'finalizing', 'run-feature-delivery');
  const selectedContract = input?.contract ?? featureContract;
  if (input?.approval !== false) {
    store.createFeatureDeliveryApprovalForTest(
      {
        approvalVersion: 1,
        approvalId: 'feature-approval',
        runId: run.id,
        approverId: 'owner-approver',
        approverRole: 'human_approver',
        featureContractVersion: 1,
        featureContractDigest: deriveFeatureDeliveryContractDigest(selectedContract),
        materialDigest: deriveFeatureDeliveryMaterialDigest(selectedContract),
        policyDigest: selectedContract.policyDigest,
        status: 'active',
        approvedAtMs: 950,
        invalidatedAtMs: null,
        invalidationReason: null,
        ...input?.approval,
      },
      selectedContract,
    );
  }
  const database = new Database(databasePath);
  const originRequest = {
    kind: 'github.merge',
    pullRequestNumber: 11,
    headSha: taskHeadSha,
    base: 'feature/bounded-delivery',
    mergeMethod: 'squash',
  };
  database
    .prepare(
      `INSERT INTO delivery_operations
       (id, workspace_id, run_id, task_id, kind, actor_role, request_digest, request_json, status,
        owner_id, workspace_lease_epoch, run_lease_epoch, task_lease_epoch, result_json,
        created_at_ms, updated_at_ms)
       VALUES (?, ?, ?, ?, 'github.merge', 'workflow_orchestrator', ?, ?, 'committed',
        'origin-owner', 1, 1, 1, ?, 900, 900)`,
    )
    .run(
      originOperationId,
      workspaceId,
      run.id,
      'bounded-delivery.1',
      originOperationId,
      JSON.stringify(originRequest),
      JSON.stringify(originResult),
    );
  database.close();
  const nowMs = input?.nowMs ?? 1000;
  const ownerId = 'feature-owner';
  const fence = {
    ownerId,
    workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, ownerId, 1000, nowMs).epoch,
    runLeaseEpoch: store.acquireLease('run', run.id, ownerId, 1000, nowMs).epoch,
    taskLeaseEpoch: store.acquireLease('task', 'bounded-delivery.1', ownerId, 1000, nowMs).epoch,
  };
  const port = new FakeFeaturePort();
  const broker = DurableFeatureDeliveryBroker.createForTest({
    store,
    executionContract,
    contract: selectedContract,
    port,
    clock: () => nowMs,
    fault: input?.fault,
  });
  return { store, run, databasePath, fence, port, broker, contract: selectedContract };
}

async function createRecoveryOrchestrator(input: {
  root: string;
  store: WorkflowStore;
  driver: FeatureDeliveryRecoveryDriver;
  ownerId: string;
  nowMs: number;
}) {
  const sourceRoot = join(input.root, 'recovery-source');
  await mkdir(join(sourceRoot, 'packages', 'workflow-control'), { recursive: true });
  await writeFile(join(sourceRoot, 'packages', 'workflow-control', 'source.ts'), 'export {};\n');
  const credentialBroker = RevocableSpecialistCredentialBroker.createForTest({
    store: input.store,
    issue: async () => {
      throw new Error('not used during feature recovery');
    },
    revoke: async () => undefined,
    observe: async () => 'revoked',
    conformance: async () => 'feature-recovery-test',
  });
  const launcher = DockerIsolatedSpecialistLauncher.createForTest({
    sourceRoot,
    image: 'workflow-codex:test',
    credentialBroker,
    egressNetwork: 'workflow-model-egress',
    containerUser: '501:20',
    executor: async () => ({ stdout: '', stderr: '' }),
    clock: () => input.nowMs,
  });
  const client: OfficialBeadsDoltClient = {
    async readIssue() {
      return { status: 'closed', blockingDependencies: [] };
    },
    async claimIssue() {
      return { status: 'in_progress' };
    },
    async closeIssue() {
      return { status: 'closed' };
    },
    async readDoltSync() {
      return 'synced';
    },
    async pushDolt() {
      return { status: 'synced' };
    },
  };
  const beadsPort = OfficialBeadsDoltPort.createForTest(sourceRoot, client);
  const closer = new JournaledBeadsTaskCloser(
    JournaledBeadsDoltBroker.createForTest(input.store, beadsPort, undefined, () => input.nowMs),
    beadsPort,
  );
  const integrationGate = LocalExactHeadIntegrationGate.createForTest({
    workspaceRoot: sourceRoot,
    artifacts: new JournaledArtifactRecorder(
      new ContentAddressedArtifactStore(join(input.root, 'recovery-artifacts')),
      input.store,
    ),
    checkCommands: { test: ['pnpm', 'test'] },
    executor: async () => ({ stdout: '', stderr: '' }),
  });
  return new WorkflowOrchestrator({
    contract: executionContract,
    store: input.store,
    closer,
    launcher,
    integrationGate,
    ownerId: input.ownerId,
    clock: () => input.nowMs,
    featureDeliveryRecovery: input.driver,
  });
}

function commonRequest(contract = featureContract) {
  return {
    workspaceId,
    runId: 'run-feature-delivery',
    taskId: 'bounded-delivery.1',
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator' as const,
    executionContractVersion: 1 as const,
    policyDigest,
    featureContractVersion: 1 as const,
    featureContractDigest: deriveFeatureDeliveryContractDigest(contract),
    originMergeOperationId: originOperationId,
    originMergeAttestationDigest: digest(originResult),
    originPullRequestNumber: 11,
    originTaskHeadSha: taskHeadSha,
    headRef: 'feature/bounded-delivery',
    headSha: featureHeadSha,
    base: 'staging' as const,
  };
}

function pullRequest(contract = featureContract): FeatureDeliveryRequest {
  const body = 'Exact feature delivery evidence';
  return {
    ...commonRequest(contract),
    kind: 'feature.github.pr',
    title: 'Deliver bounded feature',
    body,
    bodyDigest: textDigest(body),
  };
}

function mergeRequest(contract = featureContract): FeatureDeliveryRequest {
  return {
    ...commonRequest(contract),
    kind: 'feature.github.merge',
    pullRequestNumber: 12,
    requiredChecks: [...contract.authority.requiredChecks],
    protectionDigest: contract.authority.protectionDigest,
    reviewDecision: 'approved',
    mergeMethod: 'squash',
    adminBypass: false,
  };
}

function checksRequest(contract = featureContract): FeatureDeliveryRequest {
  return {
    ...commonRequest(contract),
    kind: 'feature.github.checks',
    pullRequestNumber: 12,
    requiredChecks: [...contract.authority.requiredChecks],
    protectionDigest: contract.authority.protectionDigest,
    pollAttempt: 0,
  };
}

describe('DurableFeatureDeliveryBroker', () => {
  it('consumes an origin attestation committed by the v1 task delivery broker', async () => {
    const root = await mkdtemp(join(tmpdir(), 'feature-delivery-e2e-'));
    roots.push(root);
    const store = new WorkflowStore(join(root, 'workflow.sqlite'));
    const contractId = store.createContract(executionContract, 900);
    const run = store.createRun(contractId, 'delivery', 'run-feature-delivery-e2e');
    const ownerId = 'e2e-owner';
    const fence = {
      ownerId,
      workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, ownerId, 5000, 1000).epoch,
      runLeaseEpoch: store.acquireLease('run', run.id, ownerId, 5000, 1000).epoch,
      taskLeaseEpoch: store.acquireLease('task', 'bounded-delivery.1', ownerId, 5000, 1000).epoch,
    };
    store.seedApprovedTaskHeadForTest({
      workspaceId,
      runId: run.id,
      taskId: 'bounded-delivery.1',
      headSha: taskHeadSha,
      nowMs: 999,
    });
    const originRequest: DeliveryRequest = {
      kind: 'github.merge',
      workspaceId,
      runId: run.id,
      taskId: 'bounded-delivery.1',
      repository: 'example/repository',
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      pullRequestNumber: 11,
      headSha: taskHeadSha,
      base: 'feature/bounded-delivery',
      requiredChecks: ['integration'],
      protectionDigest,
      reviewDecision: 'approved',
      mergeMethod: 'squash',
      adminBypass: false,
    };
    const origin = await DurableDeliveryBroker.createForTest({
      store,
      contract: executionContract,
      port: new IntegratedOriginPort(),
      policy: {
        authorName: 'Agent Platform',
        authorEmail: 'agent@example.com',
        approvedParentShas: { 'bounded-delivery.1': '0'.repeat(40) },
        approvedProtectionDigest: protectionDigest,
      },
      clock: () => 1000,
    }).execute(originRequest, fence);
    expect(origin).toMatchObject({ status: 'committed', kind: 'github.merge' });
    expect(store.getRun(run.id)).toMatchObject({ state: 'finalizing', mergeVerified: true });

    const exactFeatureContract: FeatureDeliveryContract = {
      ...featureContract,
      origin: {
        ...featureContract.origin,
        integrationMergeOperationId: origin.id,
        integrationMergeAttestationDigest: digest(origin.result),
      },
    };
    store.createFeatureDeliveryApprovalForTest(
      {
        approvalVersion: 1,
        approvalId: 'e2e-feature-approval',
        runId: run.id,
        approverId: 'feature-owner',
        approverRole: 'human_approver',
        featureContractVersion: 1,
        featureContractDigest: deriveFeatureDeliveryContractDigest(exactFeatureContract),
        materialDigest: deriveFeatureDeliveryMaterialDigest(exactFeatureContract),
        policyDigest,
        status: 'active',
        approvedAtMs: 1001,
        invalidatedAtMs: null,
        invalidationReason: null,
      },
      exactFeatureContract,
    );
    const port = new FakeFeaturePort();
    const broker = DurableFeatureDeliveryBroker.createForTest({
      store,
      executionContract,
      contract: exactFeatureContract,
      port,
      clock: () => 1002,
    });
    const request = {
      ...mergeRequest(exactFeatureContract),
      runId: run.id,
      originMergeOperationId: origin.id,
      originMergeAttestationDigest: digest(origin.result),
    };
    await expect(broker.execute(request, fence)).resolves.toMatchObject({ status: 'committed' });
    expect(port.mutationCount).toBe(1);
    store.close();
  });

  it('requires an active human approval bound to the exact run, material, and policy', async () => {
    const missing = await setup({ approval: false });
    await expect(missing.broker.execute(mergeRequest(), missing.fence)).rejects.toThrow(
      'active feature delivery approval',
    );

    const approvalFor = (overrides: Record<string, unknown> = {}) => ({
      approvalVersion: 1,
      approvalId: 'manual-feature-approval',
      runId: 'run-feature-delivery',
      approverId: 'owner-approver',
      approverRole: 'human_approver',
      featureContractVersion: 1,
      featureContractDigest: deriveFeatureDeliveryContractDigest(featureContract),
      materialDigest: deriveFeatureDeliveryMaterialDigest(featureContract),
      policyDigest,
      status: 'active',
      approvedAtMs: 950,
      invalidatedAtMs: null,
      invalidationReason: null,
      ...overrides,
    });
    expect(() =>
      missing.store.createFeatureDeliveryApprovalForTest(
        approvalFor({ featureContractDigest: `sha256:${'0'.repeat(64)}` }),
        featureContract,
      ),
    ).toThrow('different material');
    expect(() =>
      missing.store.createFeatureDeliveryApprovalForTest(
        approvalFor({ policyDigest: `sha256:${'0'.repeat(64)}` }),
        featureContract,
      ),
    ).toThrow('stale');
    expect(() =>
      missing.store.createFeatureDeliveryApprovalForTest(
        approvalFor({ runId: 'another-run' }),
        featureContract,
      ),
    ).toThrow('workflow run not found');

    const invalidated = await setup();
    await invalidated.broker.execute(checksRequest(), invalidated.fence);
    invalidated.store.invalidateFeatureDeliveryApproval(
      'feature-approval',
      'delivery material changed',
      975,
    );
    await expect(invalidated.broker.execute(pullRequest(), invalidated.fence)).rejects.toThrow(
      'active feature delivery approval',
    );

    expect(() =>
      missing.store.createFeatureDeliveryApproval(approvalFor(), featureContract),
    ).toThrow('authenticated approval adapter');
  });

  it('refuses approval invalidation while an external feature effect is prepared', async () => {
    const fixture = await setup({
      fault(boundary) {
        if (boundary === 'after_prepare') throw new Error('seeded prepared feature effect');
      },
    });
    await expect(fixture.broker.execute(pullRequest(), fixture.fence)).rejects.toThrow(
      'seeded prepared feature effect',
    );
    expect(() =>
      fixture.store.invalidateFeatureDeliveryApproval('feature-approval', 'material changed', 1001),
    ).toThrow('effect is prepared');
  });

  it('revalidates the exact critic authority before every external effect', async () => {
    const fixture = await setup();
    const database = new Database(fixture.databasePath);
    database
      .prepare(`UPDATE feature_delivery_approvals SET review_id = 'forged-stale-review'`)
      .run();
    database.close();
    await expect(fixture.broker.execute(pullRequest(), fixture.fence)).rejects.toThrow(
      'active feature delivery approval',
    );
    expect(fixture.port.mutationCount).toBe(0);
  });

  it('allows exactly one invalidation CAS across two store connections', async () => {
    const fixture = await setup();
    const competingStore = new WorkflowStore(fixture.databasePath);
    const outcomes = [fixture.store, competingStore].map((store, index) => {
      try {
        store.invalidateFeatureDeliveryApproval(
          'feature-approval',
          `competing invalidation ${index}`,
          1001 + index,
        );
        return 'won';
      } catch {
        return 'lost';
      }
    });
    expect(outcomes.sort()).toEqual(['lost', 'won']);
    competingStore.close();
  });

  it('journals and commits the exact feature-to-staging merge without closing the run', async () => {
    const { broker, fence, port, store, run } = await setup();
    const operation = await broker.execute(mergeRequest(), fence);

    expect(operation).toMatchObject({ status: 'committed', kind: 'feature.github.merge' });
    expect(port.mutationCount).toBe(1);
    expect(store.getRun(run.id)).toMatchObject({ state: 'finalizing', mergeVerified: false });
    await expect(broker.execute(mergeRequest(), fence)).resolves.toEqual(operation);
    expect(port.mutationCount).toBe(1);
  });

  it.each([
    ['stale head', { headSha: '4'.repeat(40) }],
    ['wrong base', { base: 'main' }],
    ['wrong repository', { repository: 'other/repository' }],
    ['wrong checks', { requiredChecks: ['build'] }],
    ['wrong protection', { protectionDigest: `sha256:${'8'.repeat(64)}` }],
    ['administrative bypass', { adminBypass: true }],
    ['non-squash merge', { mergeMethod: 'merge' }],
  ])('rejects %s before any external mutation', async (_label, change) => {
    const { broker, fence, port } = await setup();
    await expect(broker.execute({ ...mergeRequest(), ...change }, fence)).rejects.toThrow();
    expect(port.mutationCount).toBe(0);
  });

  it('rejects cross-contract replay even when repository and refs are unchanged', async () => {
    const secondContract = {
      ...featureContract,
      authority: { ...featureContract.authority, requiredChecks: ['build', 'test', 'review'] },
    };
    const fixture = await setup();
    await fixture.broker.execute(mergeRequest(featureContract), fixture.fence);
    const replayBroker = DurableFeatureDeliveryBroker.createForTest({
      store: fixture.store,
      executionContract,
      contract: secondContract,
      port: fixture.port,
      clock: () => 1000,
    });
    await expect(replayBroker.execute(mergeRequest(secondContract), fixture.fence)).rejects.toThrow(
      'active feature delivery approval',
    );
    expect(fixture.port.mutationCount).toBe(1);
  });

  it('fails closed when the committed task-to-feature attestation is changed', async () => {
    const { broker, fence, port, databasePath } = await setup();
    const database = new Database(databasePath);
    database
      .prepare('UPDATE delivery_operations SET result_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...originResult, mergeSha: '5'.repeat(40) }), originOperationId);
    database.close();

    await expect(broker.execute(mergeRequest(), fence)).rejects.toThrow(
      'exact committed integration attestation',
    );
    expect(port.mutationCount).toBe(0);
  });

  it('recovers a prepared operation after an external mutation without repeating it', async () => {
    const first = await setup({
      fault(boundary) {
        if (boundary === 'after_mutation') throw new Error('seeded crash');
      },
    });
    await expect(first.broker.execute(pullRequest(), first.fence)).rejects.toThrow('seeded crash');
    expect(first.port.mutationCount).toBe(1);
    first.store.close();

    const recoveredStore = new WorkflowStore(first.databasePath);

    const recoveryOwner = 'feature-recovery';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: recoveredStore.acquireLease(
        'workspace',
        workspaceId,
        recoveryOwner,
        1000,
        2001,
      ).epoch,
      runLeaseEpoch: recoveredStore.acquireLease('run', first.run.id, recoveryOwner, 1000, 2001)
        .epoch,
      taskLeaseEpoch: recoveredStore.acquireLease(
        'task',
        'bounded-delivery.1',
        recoveryOwner,
        1000,
        2001,
      ).epoch,
    };
    const recovered = DurableFeatureDeliveryBroker.createForTest({
      store: recoveredStore,
      executionContract,
      contract: featureContract,
      port: first.port,
      clock: () => 2001,
    });
    await expect(
      recovered.reconcilePrepared({ runId: first.run.id, fence: recoveryFence }),
    ).resolves.toMatchObject({ operations: [{ status: 'committed' }], errors: [] });
    expect(first.port.mutationCount).toBe(1);
    recoveredStore.close();
  });

  it.each([
    ['PR after prepare', 'pr', 'after_prepare'],
    ['PR after external mutation', 'pr', 'after_mutation'],
    ['checks after prepare', 'checks', 'after_prepare'],
    ['checks after external observation', 'checks', 'before_commit'],
    ['merge after prepare', 'merge', 'after_prepare'],
    ['merge after external mutation', 'merge', 'after_mutation'],
  ] as const)(
    'production recovery driver reconciles %s after restart',
    async (_label, kind, crashAt) => {
      const request =
        kind === 'pr' ? pullRequest() : kind === 'checks' ? checksRequest() : mergeRequest();
      const first = await setup({
        fault(boundary) {
          if (boundary === crashAt) throw new Error('seeded feature recovery crash');
        },
      });
      await expect(first.broker.execute(request, first.fence)).rejects.toThrow(
        'seeded feature recovery crash',
      );
      const mutationsBeforeRecovery = first.port.mutationCount;
      first.store.close();

      const recoveredStore = new WorkflowStore(first.databasePath);
      const recoveryOwner = `recovery-${kind}-${crashAt}`;
      const recoveryFence = {
        ownerId: recoveryOwner,
        workspaceLeaseEpoch: recoveredStore.acquireLease(
          'workspace',
          workspaceId,
          recoveryOwner,
          1000,
          2001,
        ).epoch,
        runLeaseEpoch: recoveredStore.acquireLease('run', first.run.id, recoveryOwner, 1000, 2001)
          .epoch,
        taskLeaseEpoch: recoveredStore.acquireLease(
          'task',
          'bounded-delivery.1',
          recoveryOwner,
          1000,
          2001,
        ).epoch,
      };
      const recoveredBroker = DurableFeatureDeliveryBroker.createForTest({
        store: recoveredStore,
        executionContract,
        contract: featureContract,
        port: first.port,
        clock: () => 2001,
      });
      const driver = FeatureDeliveryRecoveryDriver.createForTest({
        store: recoveredStore,
        broker: recoveredBroker,
        executionContract,
        fenceProvider: async () => recoveryFence,
      });
      expect(Object.isFrozen(driver)).toBe(true);
      const orchestrator = await createRecoveryOrchestrator({
        root: dirname(first.databasePath),
        store: recoveredStore,
        driver,
        ownerId: recoveryOwner,
        nowMs: 2001,
      });
      await expect(
        orchestrator.reconcileAfterRestart({
          workspaceLeaseEpoch: recoveryFence.workspaceLeaseEpoch,
          runLeaseTtlMs: 1000,
          taskLeaseTtlMs: 1000,
        }),
      ).resolves.toEqual([]);
      expect(recoveredStore.listPreparedFeatureDeliveryOperations(first.run.id)).toEqual([]);
      expect(first.port.mutationCount).toBe(
        kind === 'checks' ? 0 : Math.max(1, mutationsBeforeRecovery),
      );
      recoveredStore.close();
    },
  );

  it('prevents a finalizing recovery transition from bypassing prepared feature delivery', async () => {
    const fixture = await setup({
      fault(boundary) {
        if (boundary === 'after_prepare') throw new Error('seeded prepared operation');
      },
    });
    await expect(fixture.broker.execute(pullRequest(), fixture.fence)).rejects.toThrow(
      'seeded prepared operation',
    );
    const expectedRunVersion = fixture.store.getRun(fixture.run.id)!.version;
    const id = 'bypass-feature-recovery';
    expect(() =>
      fixture.store.prepareTransition({
        id,
        runId: fixture.run.id,
        from: 'finalizing',
        to: 'recovering',
        operation: 'internal.recovery',
        expectedRunVersion,
        idempotencyKey: deriveTransitionIdempotencyKey({
          runId: fixture.run.id,
          transitionId: id,
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
          interruptedTransitionId: originOperationId,
          evidenceDigests: [`sha256:${'f'.repeat(64)}`],
        },
        nowMs: 1000,
      }),
    ).toThrow('prepared merge must be reconciled');
    fixture.store.close();
  });

  it('rejects forged and cross-store recovery drivers before restart', async () => {
    const fixture = await setup();
    expect(Object.isFrozen(DurableFeatureDeliveryBroker.prototype)).toBe(true);
    expect(Object.isFrozen(FeatureDeliveryRecoveryDriver.prototype)).toBe(true);
    expect(() =>
      Object.defineProperty(DurableFeatureDeliveryBroker.prototype, 'execute', {
        value: async () => ({}),
      }),
    ).toThrow();
    expect(() =>
      Object.defineProperty(FeatureDeliveryRecoveryDriver.prototype, 'reconcileFinalizing', {
        value: async () => [],
      }),
    ).toThrow();
    class BrokerSubclass extends (DurableFeatureDeliveryBroker as unknown as new () => DurableFeatureDeliveryBroker) {}
    expect(() =>
      Reflect.construct(
        DurableFeatureDeliveryBroker as unknown as new (...arguments_: unknown[]) => object,
        [{}],
        BrokerSubclass,
      ),
    ).toThrow('subclasses are forbidden');
    const subclassBroker = Object.create(BrokerSubclass.prototype) as DurableFeatureDeliveryBroker;
    expect(() =>
      FeatureDeliveryRecoveryDriver.createForTest({
        store: fixture.store,
        broker: subclassBroker,
        executionContract,
        fenceProvider: async () => fixture.fence,
      }),
    ).toThrow('exact store or contract');
    const brokerLookalike = Object.create(
      DurableFeatureDeliveryBroker.prototype,
    ) as DurableFeatureDeliveryBroker;
    expect(() =>
      FeatureDeliveryRecoveryDriver.createForTest({
        store: fixture.store,
        broker: brokerLookalike,
        executionContract,
        fenceProvider: async () => fixture.fence,
      }),
    ).toThrow();
    await expect(
      createRecoveryOrchestrator({
        root: dirname(fixture.databasePath),
        store: fixture.store,
        driver: {} as FeatureDeliveryRecoveryDriver,
        ownerId: 'forged-recovery',
        nowMs: 1000,
      }),
    ).rejects.toThrow('registered exact feature recovery driver');
    class DriverSubclass extends (FeatureDeliveryRecoveryDriver as unknown as new () => FeatureDeliveryRecoveryDriver) {}
    expect(() =>
      Reflect.construct(
        FeatureDeliveryRecoveryDriver as unknown as new (...arguments_: unknown[]) => object,
        [{}],
        DriverSubclass,
      ),
    ).toThrow('subclasses are forbidden');
    const subclassDriver = Object.create(DriverSubclass.prototype) as FeatureDeliveryRecoveryDriver;
    await expect(
      createRecoveryOrchestrator({
        root: dirname(fixture.databasePath),
        store: fixture.store,
        driver: subclassDriver,
        ownerId: 'subclass-recovery',
        nowMs: 1000,
      }),
    ).rejects.toThrow('registered exact feature recovery driver');
    const otherRoot = await mkdtemp(join(tmpdir(), 'feature-recovery-other-'));
    roots.push(otherRoot);
    const otherStore = new WorkflowStore(join(otherRoot, 'workflow.sqlite'));
    expect(() =>
      FeatureDeliveryRecoveryDriver.createForTest({
        store: otherStore,
        broker: fixture.broker,
        executionContract,
        fenceProvider: async () => fixture.fence,
      }),
    ).toThrow('exact store or contract');
    otherStore.close();
  });

  it('continues real orchestrator recovery after one prepared feature operation fails', async () => {
    const fixture = await setup({
      fault(boundary) {
        if (boundary === 'after_prepare') throw new Error('seeded multi-operation crash');
      },
    });
    await expect(fixture.broker.execute(pullRequest(), fixture.fence)).rejects.toThrow(
      'seeded multi-operation crash',
    );
    await expect(fixture.broker.execute(checksRequest(), fixture.fence)).rejects.toThrow(
      'seeded multi-operation crash',
    );
    const database = new Database(fixture.databasePath);
    const firstPrepared = database
      .prepare(
        `SELECT id FROM delivery_operations
         WHERE run_id = ? AND kind = 'feature.github.pr' AND status = 'prepared'`,
      )
      .get(fixture.run.id) as { id: string };
    const secondPrepared = database
      .prepare(
        `SELECT id FROM delivery_operations
         WHERE run_id = ? AND kind = 'feature.github.checks' AND status = 'prepared'`,
      )
      .get(fixture.run.id) as { id: string };
    database
      .prepare(`UPDATE delivery_operations SET request_json = '{' WHERE id = ?`)
      .run(firstPrepared.id);
    database.close();
    const recoveryOwner = 'continuing-recovery';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: fixture.store.acquireLease(
        'workspace',
        workspaceId,
        recoveryOwner,
        1000,
        2001,
      ).epoch,
      runLeaseEpoch: fixture.store.acquireLease('run', fixture.run.id, recoveryOwner, 1000, 2001)
        .epoch,
      taskLeaseEpoch: fixture.store.acquireLease(
        'task',
        'bounded-delivery.1',
        recoveryOwner,
        1000,
        2001,
      ).epoch,
    };
    const recoveryBroker = DurableFeatureDeliveryBroker.createForTest({
      store: fixture.store,
      executionContract,
      contract: featureContract,
      port: fixture.port,
      clock: () => 2001,
    });
    const driver = FeatureDeliveryRecoveryDriver.createForTest({
      store: fixture.store,
      broker: recoveryBroker,
      executionContract,
      fenceProvider: async () => recoveryFence,
    });
    const orchestrator = await createRecoveryOrchestrator({
      root: dirname(fixture.databasePath),
      store: fixture.store,
      driver,
      ownerId: recoveryOwner,
      nowMs: 2001,
    });
    const recovery = orchestrator.reconcileAfterRestart({
      workspaceLeaseEpoch: recoveryFence.workspaceLeaseEpoch,
      runLeaseTtlMs: 1000,
      taskLeaseTtlMs: 1000,
    });
    await expect(recovery).rejects.toThrow('workflow effects require recovery');
    expect(fixture.store.listPreparedFeatureDeliveryOperations(fixture.run.id)).toEqual([]);
    expect(fixture.store.getDeliveryOperation(firstPrepared.id)).toMatchObject({
      status: 'escalated',
    });
    expect(fixture.store.getDeliveryOperation(secondPrepared.id)).toMatchObject({
      kind: 'feature.github.checks',
      status: 'committed',
    });
  });
});
