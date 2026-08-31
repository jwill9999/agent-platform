import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FeatureDeliveryApprovalBroker,
  OfficialFeatureDeliveryApprovalPort,
  WorkflowStore,
  deriveFeatureDeliveryContractDigest,
  deriveFeatureDeliveryMaterialDigest,
  deriveTransitionIdempotencyKey,
  type ExecutionContract,
  type FeatureDeliveryContract,
  type FeatureDeliveryIdentityClient,
} from '../src/index.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;
const taskHeadSha = '1'.repeat(40);
const integratedHeadSha = '2'.repeat(40);
const originOperationId = `sha256:${'c'.repeat(64)}`;
const originResult = {
  pullRequestNumber: 1,
  mergeSha: integratedHeadSha,
  headSha: taskHeadSha,
  base: 'feature/approval-feature',
  mergeMethod: 'squash',
  eventIdentity: 'origin-event-1',
};
const originAttestationDigest = `sha256:${createHash('sha256')
  .update(JSON.stringify(originResult))
  .digest('hex')}`;
const intentEvidence = {
  digest: `sha256:${'8'.repeat(64)}`,
  mediaType: 'application/json' as const,
  sizeBytes: 8,
  kind: 'review' as const,
};
const evidence = {
  digest: `sha256:${'e'.repeat(64)}`,
  mediaType: 'application/json' as const,
  sizeBytes: 10,
  kind: 'review' as const,
};
const executionContract: ExecutionContract = {
  featureId: 'approval-feature',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'approve exact feature delivery',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['approved'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read'],
    github: {
      repository: 'example/repository',
      base: 'feature/approval-feature',
      mergeMethod: 'squash',
      requiredChecks: ['test'],
    },
  },
  tasks: [
    {
      id: 'approval-feature.1',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/approval-feature',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.read'],
    },
  ],
  qualityGates: ['test'],
  retryPolicy: {
    implementationAttempts: 1,
    findingAttempts: 1,
    infrastructureAttempts: 1,
    waitDeadlineSeconds: 60,
  },
  repairTaskPolicy: {
    idPattern: 'approval-feature.repair.<sequence>',
    maxChildren: 0,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};
const executionContractDigest = `sha256:${createHash('sha256')
  .update(JSON.stringify(executionContract))
  .digest('hex')}`;
const contract: FeatureDeliveryContract = {
  contractVersion: 1,
  executionContractDigest,
  featureId: executionContract.featureId,
  workspaceId,
  policyDigest,
  origin: {
    executionContractVersion: 1,
    repository: 'example/repository',
    taskId: 'approval-feature.1',
    taskRef: 'task/approval-feature.1',
    taskHeadSha,
    integrationPullRequestNumber: 1,
    integrationMergeOperationId: originOperationId,
    integrationMergeAttestationDigest: originAttestationDigest,
    featureRef: 'feature/approval-feature',
    integratedHeadSha,
    mergeMethod: 'squash',
  },
  authority: {
    actorRole: 'workflow_orchestrator',
    repository: 'example/repository',
    headRef: 'feature/approval-feature',
    headSha: integratedHeadSha,
    base: 'staging',
    requiredChecks: ['test'],
    protectionDigest: `sha256:${'f'.repeat(64)}`,
    mergeMethod: 'squash',
    adminBypass: false,
  },
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup(authenticateOverride?: FeatureDeliveryIdentityClient['authenticate']) {
  const root = await mkdtemp(join(tmpdir(), 'feature-approval-'));
  roots.push(root);
  const store = new WorkflowStore(join(root, 'workflow.sqlite'));
  const contractId = store.createContract(executionContract);
  store.createRun(contractId, 'integration', 'approval-run');
  store.seedApprovedTaskHeadForTest({
    workspaceId,
    runId: 'approval-run',
    taskId: 'approval-feature.1',
    headSha: taskHeadSha,
    nowMs: 99,
  });
  store.recordEvidence({
    ...intentEvidence,
    producer: 'critic-auth-boundary',
    producerRole: 'plan_critic',
    workspaceId,
    runId: 'approval-run',
    taskId: 'approval-feature.1',
    contractVersion: 1,
    policyDigest,
    headSha: taskHeadSha,
    createdAtMs: 100,
  });
  const database = new Database(join(root, 'workflow.sqlite'));
  database
    .prepare(
      `INSERT INTO delivery_operations
       (id, workspace_id, run_id, task_id, kind, actor_role, request_digest, request_json, status,
        owner_id, workspace_lease_epoch, run_lease_epoch, task_lease_epoch, result_json,
        created_at_ms, updated_at_ms)
       VALUES (?, ?, 'approval-run', 'approval-feature.1', 'github.merge',
        'workflow_orchestrator', ?, ?, 'committed', 'origin-owner', 1, 1, 1, ?, 102, 102)`,
    )
    .run(
      originOperationId,
      workspaceId,
      originOperationId,
      JSON.stringify({
        kind: 'github.merge',
        pullRequestNumber: 1,
        headSha: taskHeadSha,
        base: 'feature/approval-feature',
        mergeMethod: 'squash',
      }),
      JSON.stringify(originResult),
    );
  database.close();
  store.recordEvidence({
    ...evidence,
    producer: 'critic-auth-boundary',
    producerRole: 'plan_critic',
    workspaceId,
    runId: 'approval-run',
    taskId: 'approval-feature.1',
    operationId: originOperationId,
    contractVersion: 1,
    policyDigest,
    headSha: integratedHeadSha,
    createdAtMs: 103,
  });
  let role: 'human_approver' | 'plan_critic' = 'human_approver';
  const client: FeatureDeliveryIdentityClient = {
    authenticate:
      authenticateOverride ??
      (async (input) => ({
        subjectId: role === 'plan_critic' ? 'critic-1' : 'owner-1',
        role,
        materialDigest: input.materialDigest,
      })),
  };
  const port = OfficialFeatureDeliveryApprovalPort.create(store, client);
  const broker = new FeatureDeliveryApprovalBroker(store, port);
  return { root, store, client, port, broker, setRole: (next: typeof role) => (role = next) };
}

function intentInput() {
  return {
    intentVersion: 1 as const,
    intentId: 'intent-1',
    runId: 'approval-run',
    taskId: 'approval-feature.1',
    executionContractVersion: 1 as const,
    executionContractDigest,
    featureId: executionContract.featureId,
    workspaceId,
    policyDigest,
    repository: 'example/repository',
    taskRef: 'task/approval-feature.1',
    taskHeadSha,
    featureRef: 'feature/approval-feature',
    destination: 'staging' as const,
    requiredChecks: ['test'],
    protectionDigest: contract.authority.protectionDigest,
    mergeMethod: 'squash' as const,
    adminBypass: false as const,
    decidedAtMs: 101,
    evidence: [intentEvidence],
  };
}

function reviewInput() {
  return {
    reviewVersion: 1 as const,
    reviewId: 'feature-review-1',
    runId: 'approval-run',
    taskId: 'approval-feature.1',
    executionContractDigest,
    featureContractVersion: 1 as const,
    featureContractDigest: deriveFeatureDeliveryContractDigest(contract),
    materialDigest: deriveFeatureDeliveryMaterialDigest(contract),
    policyDigest,
    verdict: 'approved' as const,
    summary: 'exact feature delivery contract approved',
    evidence: [evidence],
    findings: [],
    reviewedAtMs: 102,
  };
}

function approvalInput() {
  return {
    approvalVersion: 1 as const,
    approvalId: 'approval-1',
    runId: 'approval-run',
    reviewId: 'feature-review-1',
    taskId: 'approval-feature.1',
    featureContractVersion: 1 as const,
    featureContractDigest: deriveFeatureDeliveryContractDigest(contract),
    materialDigest: deriveFeatureDeliveryMaterialDigest(contract),
    policyDigest,
    status: 'active' as const,
    approvedAtMs: 103,
    invalidatedAtMs: null,
    invalidationReason: null,
    evidence: [evidence],
  };
}

describe('FeatureDeliveryApprovalBroker', () => {
  it('authenticates a canonical intent snapshot and ignores caller mutation after authentication starts', async () => {
    const mutable = intentInput();
    let authenticatedDigest = '';
    const fixture = await setup(async (input) => {
      authenticatedDigest = input.materialDigest;
      mutable.requiredChecks.push('forged-check');
      mutable.protectionDigest = `sha256:${'1'.repeat(64)}`;
      mutable.taskHeadSha = '9'.repeat(40);
      mutable.evidence.push({
        digest: `sha256:${'9'.repeat(64)}`,
        mediaType: 'application/json',
        sizeBytes: 9,
        kind: 'review',
      });
      return { subjectId: 'owner-1', role: 'human_approver', materialDigest: input.materialDigest };
    });
    const stored = await fixture.broker.declareRequiredIntent(mutable);
    expect(stored).toMatchObject({
      materialDigest: authenticatedDigest,
      requiredChecks: ['test'],
      protectionDigest: contract.authority.protectionDigest,
      taskHeadSha,
      evidence: [intentEvidence],
    });
    fixture.store.close();

    const rejected = await setup(async () => ({
      subjectId: 'owner-1',
      role: 'human_approver',
      materialDigest: `sha256:${'0'.repeat(64)}`,
    }));
    await expect(rejected.broker.declareRequiredIntent(intentInput())).rejects.toThrow(
      'authenticated human owner',
    );
    rejected.store.close();
  });

  it('persists explicit intent, feature-specific critic review, and authenticated approval', async () => {
    const fixture = await setup();
    await expect(fixture.broker.declareRequiredIntent(intentInput())).resolves.toMatchObject({
      ownerId: 'owner-1',
    });
    expect(() => fixture.store.getApprovedFeatureDeliveryContract('approval-run')).toThrow(
      'lacks an active exact approval',
    );
    fixture.setRole('plan_critic');
    await fixture.broker.recordCriticReview(reviewInput(), contract);
    fixture.setRole('human_approver');
    const approval = await fixture.broker.approve(approvalInput(), contract);
    expect(approval).toMatchObject({ approverId: 'owner-1', reviewId: 'feature-review-1' });
    await expect(fixture.broker.approve(approvalInput(), contract)).resolves.toEqual(approval);
    await expect(
      fixture.broker.approve({ ...approvalInput(), approvedAtMs: 999 }, contract),
    ).rejects.toThrow('replay changes immutable identity');
    fixture.store.close();
  });

  it('rejects forged critic identity, wrong feature material, findings, and forged approver identity', async () => {
    const fixture = await setup();
    await fixture.broker.declareRequiredIntent(intentInput());
    await expect(fixture.broker.recordCriticReview(reviewInput(), contract)).rejects.toThrow(
      'authenticated plan critic',
    );
    fixture.setRole('plan_critic');
    await expect(
      fixture.broker.recordCriticReview(
        { ...reviewInput(), materialDigest: `sha256:${'0'.repeat(64)}` },
        contract,
      ),
    ).rejects.toThrow('different material');
    await fixture.broker.recordCriticReview(
      {
        ...reviewInput(),
        reviewId: 'feature-review-correction',
        verdict: 'correction_required',
        findings: [
          {
            id: 'finding-1',
            severity: 'high',
            summary: 'approval is not ready',
            evidence: [evidence],
          },
        ],
        reviewedAtMs: 103,
      },
      contract,
    );
    fixture.setRole('human_approver');
    await expect(fixture.broker.approve(approvalInput(), contract)).rejects.toThrow(
      'latest approved critic review',
    );
    fixture.setRole('plan_critic');
    await fixture.broker.recordCriticReview(
      { ...reviewInput(), reviewId: 'feature-review-2', reviewedAtMs: 104 },
      contract,
    );
    await expect(
      fixture.broker.approve({ ...approvalInput(), reviewId: 'feature-review-2' }, contract),
    ).rejects.toThrow('authenticated human owner');
    fixture.store.close();
  });

  it('rejects missing feature review, forged identity, cross-store use, and method replacement', async () => {
    const fixture = await setup();
    await fixture.broker.declareRequiredIntent(intentInput());
    await expect(fixture.broker.approve(approvalInput(), contract)).rejects.toThrow(
      'latest approved critic review',
    );
    fixture.setRole('plan_critic');
    await expect(fixture.broker.declareRequiredIntent(intentInput())).rejects.toThrow(
      'authenticated human owner',
    );
    const otherRoot = await mkdtemp(join(tmpdir(), 'feature-approval-other-'));
    roots.push(otherRoot);
    const other = new WorkflowStore(join(otherRoot, 'workflow.sqlite'));
    expect(() => new FeatureDeliveryApprovalBroker(other, fixture.port)).toThrow(
      'not registered for this workflow store',
    );
    expect(Object.isFrozen(fixture.port)).toBe(true);
    expect(() =>
      Object.defineProperty(fixture.port, 'approve', { value: async () => ({}) }),
    ).toThrow();
    fixture.client.authenticate = async (input) => ({
      subjectId: 'forged',
      role: 'human_approver',
      materialDigest: input.materialDigest,
    });
    fixture.setRole('human_approver');
    await expect(fixture.broker.declareRequiredIntent(intentInput())).resolves.toMatchObject({
      ownerId: 'owner-1',
    });
    other.close();
    fixture.store.close();
  });

  it('rejects feature review evidence from the task head, before the origin, or another operation', async () => {
    const fixture = await setup();
    await fixture.broker.declareRequiredIntent(intentInput());
    fixture.setRole('plan_critic');
    const cases = [
      {
        suffix: 'task-head',
        headSha: taskHeadSha,
        operationId: originOperationId,
        createdAtMs: 103,
      },
      {
        suffix: 'pre-origin',
        headSha: integratedHeadSha,
        operationId: originOperationId,
        createdAtMs: 101,
      },
      {
        suffix: 'wrong-operation',
        headSha: integratedHeadSha,
        operationId: `sha256:${'d'.repeat(64)}`,
        createdAtMs: 103,
      },
    ] as const;
    for (const [index, candidate] of cases.entries()) {
      const reference = {
        digest: `sha256:${String(index + 3).repeat(64)}`,
        mediaType: 'application/json' as const,
        sizeBytes: 11 + index,
        kind: 'review' as const,
      };
      fixture.store.recordEvidence({
        ...reference,
        producer: 'critic-auth-boundary',
        producerRole: 'plan_critic',
        workspaceId,
        runId: 'approval-run',
        taskId: 'approval-feature.1',
        operationId: candidate.operationId,
        contractVersion: 1,
        policyDigest,
        headSha: candidate.headSha,
        createdAtMs: candidate.createdAtMs,
      });
      await expect(
        fixture.broker.recordCriticReview(
          {
            ...reviewInput(),
            reviewId: `feature-review-${candidate.suffix}`,
            evidence: [reference],
          },
          contract,
        ),
      ).rejects.toThrow('integrated head and exact committed origin');
    }
    fixture.store.close();
  });

  it('atomically fences intent persistence against a competing delivery transition', async () => {
    const first = await setup();
    const competing = new WorkflowStore(join(first.root, 'workflow.sqlite'));
    const database = new Database(join(first.root, 'workflow.sqlite'));
    database.prepare("UPDATE runs SET state = 'pipeline' WHERE id = 'approval-run'").run();
    database.close();
    const ownerId = 'transition-owner';
    const workspaceLease = competing.acquireLease('workspace', workspaceId, ownerId, 1000, 200);
    const runLease = competing.acquireLease('run', 'approval-run', ownerId, 1000, 200);
    await expect(first.broker.declareRequiredIntent(intentInput())).resolves.toMatchObject({
      intentId: 'intent-1',
    });
    expect(first.store.getRun('approval-run')).toMatchObject({ state: 'pipeline', version: 0 });
    const transitionId = 'intent-race-transition';
    const transition = competing.prepareTransition({
      id: transitionId,
      runId: 'approval-run',
      from: 'pipeline',
      to: 'delivery',
      operation: 'github.delivery',
      expectedRunVersion: 0,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'approval-run',
        transitionId,
        operation: 'github.delivery',
        expectedVersion: 0,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      leaseOwnerId: ownerId,
      leaseEpoch: runLease.epoch,
      transitionContext: { workspaceLeaseEpoch: workspaceLease.epoch },
      expectedExternalState: { status: 'ready' },
      externalArguments: {},
      nowMs: 200,
    });
    competing.commitTransition(
      transition.id,
      ownerId,
      runLease.epoch,
      { status: 'delivered' },
      201,
    );
    expect(first.store.getRun('approval-run')).toMatchObject({ state: 'delivery', version: 2 });
    expect(first.store.getTransition(transition.id)).toMatchObject({ status: 'committed' });
    expect(first.store.listPreparedTransitions('approval-run')).toEqual([]);
    for (const state of ['delivery', 'finalizing', 'closed'] as const) {
      const replayDatabase = new Database(join(first.root, 'workflow.sqlite'));
      replayDatabase.prepare('UPDATE runs SET state = ? WHERE id = ?').run(state, 'approval-run');
      replayDatabase.close();
      await expect(first.broker.declareRequiredIntent(intentInput())).resolves.toMatchObject({
        intentId: 'intent-1',
      });
    }
    await expect(
      first.broker.declareRequiredIntent({ ...intentInput(), requiredChecks: ['different-check'] }),
    ).rejects.toThrow('immutable feature delivery intent already differs');
    competing.close();
    first.store.close();

    const second = await setup();
    const winner = new WorkflowStore(join(second.root, 'workflow.sqlite'));
    const secondDatabase = new Database(join(second.root, 'workflow.sqlite'));
    secondDatabase.prepare("UPDATE runs SET state = 'pipeline' WHERE id = 'approval-run'").run();
    secondDatabase.close();
    const secondWorkspaceLease = winner.acquireLease('workspace', workspaceId, ownerId, 1000, 200);
    const secondRunLease = winner.acquireLease('run', 'approval-run', ownerId, 1000, 200);
    const preparedId = 'delivery-race-transition';
    const prepared = winner.prepareTransition({
      id: preparedId,
      runId: 'approval-run',
      from: 'pipeline',
      to: 'delivery',
      operation: 'github.delivery',
      expectedRunVersion: 0,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'approval-run',
        transitionId: preparedId,
        operation: 'github.delivery',
        expectedVersion: 0,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      leaseOwnerId: ownerId,
      leaseEpoch: secondRunLease.epoch,
      transitionContext: { workspaceLeaseEpoch: secondWorkspaceLease.epoch },
      expectedExternalState: { status: 'ready' },
      externalArguments: {},
      nowMs: 200,
    });
    await expect(second.broker.declareRequiredIntent(intentInput())).rejects.toThrow(
      'cannot race a prepared workflow transition',
    );
    expect(second.store.getFeatureDeliveryRequiredIntent('approval-run')).toBeUndefined();
    winner.commitTransition(
      prepared.id,
      ownerId,
      secondRunLease.epoch,
      { status: 'delivered' },
      201,
    );
    expect(winner.getTransition(prepared.id)).toMatchObject({ status: 'committed' });
    expect(winner.getRun('approval-run')).toMatchObject({ state: 'delivery', version: 2 });
    expect(winner.listPreparedTransitions('approval-run')).toEqual([]);
    winner.close();
    second.store.close();
  });

  it('rejects prototype substitution, subclasses, and unregistered lookalikes', async () => {
    const fixture = await setup();
    expect(Object.isFrozen(OfficialFeatureDeliveryApprovalPort.prototype)).toBe(true);
    expect(Object.isFrozen(FeatureDeliveryApprovalBroker.prototype)).toBe(true);
    expect(() =>
      Object.defineProperty(OfficialFeatureDeliveryApprovalPort.prototype, 'approve', {
        value: async () => ({}),
      }),
    ).toThrow();
    class Subclass extends (OfficialFeatureDeliveryApprovalPort as unknown as new () => OfficialFeatureDeliveryApprovalPort) {}
    expect(() =>
      Reflect.construct(
        OfficialFeatureDeliveryApprovalPort as unknown as new (...arguments_: unknown[]) => object,
        [fixture.store, fixture.client],
        Subclass,
      ),
    ).toThrow('subclasses are forbidden');
    const subclass = Object.create(Subclass.prototype) as OfficialFeatureDeliveryApprovalPort;
    expect(() => new FeatureDeliveryApprovalBroker(fixture.store, subclass)).toThrow(
      'not registered for this workflow store',
    );
    const lookalike = Object.create(
      OfficialFeatureDeliveryApprovalPort.prototype,
    ) as OfficialFeatureDeliveryApprovalPort;
    expect(() => new FeatureDeliveryApprovalBroker(fixture.store, lookalike)).toThrow();
    class BrokerSubclass extends FeatureDeliveryApprovalBroker {}
    expect(() => new BrokerSubclass(fixture.store, fixture.port)).toThrow(
      'subclasses are forbidden',
    );
    fixture.store.close();
  });
});
