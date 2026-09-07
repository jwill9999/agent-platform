import { describe, expect, it } from 'vitest';

import {
  deriveFeatureDeliveryContractDigest,
  deriveFeatureDeliveryIntentMaterialDigest,
  deriveFeatureDeliveryMaterialDigest,
  executionContractSchema,
  featureDeliveryApprovalSchema,
  featureDeliveryContractSchema,
  type ExecutionContract,
  type FeatureDeliveryContract,
} from '../src/index.js';

const executionContract: ExecutionContract = {
  featureId: 'bounded-delivery',
  contractVersion: 1,
  policyDigest: `sha256:${'a'.repeat(64)}`,
  workspaceId: `sha256:${'b'.repeat(64)}`,
  objective: 'Preserve the v1 execution identity',
  requirements: ['deliver through exact authorities'],
  nonGoals: [],
  acceptanceCriteria: ['v1 remains readable'],
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

function sha(value: string): string {
  return `sha256:${value.repeat(64)}`;
}

const featureContract: FeatureDeliveryContract = {
  contractVersion: 1,
  executionContractDigest: sha('c'),
  featureId: executionContract.featureId,
  workspaceId: executionContract.workspaceId,
  policyDigest: executionContract.policyDigest,
  origin: {
    executionContractVersion: 1,
    repository: 'example/repository',
    taskId: 'bounded-delivery.1',
    taskRef: 'task/bounded-delivery.1',
    taskHeadSha: '1'.repeat(40),
    integrationPullRequestNumber: 11,
    integrationMergeOperationId: sha('e'),
    integrationMergeAttestationDigest: sha('f'),
    featureRef: 'feature/bounded-delivery',
    integratedHeadSha: '2'.repeat(40),
    mergeMethod: 'squash',
  },
  authority: {
    actorRole: 'workflow_orchestrator',
    repository: 'example/repository',
    headRef: 'feature/bounded-delivery',
    headSha: '2'.repeat(40),
    base: 'staging',
    requiredChecks: ['build', 'test'],
    protectionDigest: sha('9'),
    mergeMethod: 'squash',
    adminBypass: false,
  },
};

describe('featureDeliveryContractSchema', () => {
  it('keeps stored ExecutionContract v1 parsing unchanged', () => {
    expect(executionContractSchema.parse(executionContract)).toEqual(executionContract);
  });

  it('represents an immutable, independently digestible feature-to-staging authority', () => {
    expect(featureDeliveryContractSchema.parse(featureContract)).toEqual(featureContract);
    expect(deriveFeatureDeliveryContractDigest(featureContract)).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(deriveFeatureDeliveryMaterialDigest(featureContract)).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('requires a human approval with coherent active or invalidated status', () => {
    const approval = {
      approvalVersion: 1,
      approvalId: 'approval-1',
      runId: 'run-1',
      reviewId: 'critic-review-1',
      taskId: 'feature-1.1',
      approverId: 'owner-1',
      approverRole: 'human_approver',
      featureContractVersion: 1,
      featureContractDigest: deriveFeatureDeliveryContractDigest(featureContract),
      materialDigest: deriveFeatureDeliveryMaterialDigest(featureContract),
      policyDigest: featureContract.policyDigest,
      status: 'active',
      approvedAtMs: 1000,
      invalidatedAtMs: null,
      invalidationReason: null,
      evidence: [
        {
          digest: `sha256:${'e'.repeat(64)}`,
          mediaType: 'application/json',
          sizeBytes: 1,
          kind: 'review',
        },
      ],
    };
    expect(featureDeliveryApprovalSchema.parse(approval)).toEqual(approval);
    expect(() =>
      featureDeliveryApprovalSchema.parse({ ...approval, approverRole: 'workflow_orchestrator' }),
    ).toThrow();
    expect(() =>
      featureDeliveryApprovalSchema.parse({
        ...approval,
        status: 'invalidated',
        invalidatedAtMs: null,
        invalidationReason: null,
      }),
    ).toThrow();
  });

  it.each([
    ['checks', { requiredChecks: ['build', 'test', 'security'] }],
    ['protection', { protectionDigest: sha('8') }],
    ['task head', { taskHeadSha: '3'.repeat(40) }],
    [
      'evidence',
      {
        evidence: [
          {
            digest: sha('7'),
            mediaType: 'application/json',
            sizeBytes: 2,
            kind: 'review',
          },
        ],
      },
    ],
  ])('binds changed intent %s into the authenticated material digest', (_label, change) => {
    const intent = {
      intentVersion: 1,
      intentId: 'intent-1',
      runId: 'run-1',
      taskId: 'bounded-delivery.1',
      executionContractVersion: 1,
      executionContractDigest: featureContract.executionContractDigest,
      featureId: featureContract.featureId,
      workspaceId: featureContract.workspaceId,
      policyDigest: featureContract.policyDigest,
      repository: featureContract.origin.repository,
      taskRef: featureContract.origin.taskRef,
      taskHeadSha: featureContract.origin.taskHeadSha,
      featureRef: featureContract.origin.featureRef,
      destination: 'staging',
      requiredChecks: featureContract.authority.requiredChecks,
      protectionDigest: featureContract.authority.protectionDigest,
      mergeMethod: 'squash',
      adminBypass: false,
      decidedAtMs: 100,
      evidence: [
        {
          digest: sha('6'),
          mediaType: 'application/json',
          sizeBytes: 1,
          kind: 'review',
        },
      ],
    };
    expect(deriveFeatureDeliveryIntentMaterialDigest({ ...intent, ...change })).not.toBe(
      deriveFeatureDeliveryIntentMaterialDigest(intent),
    );
    expect(
      deriveFeatureDeliveryIntentMaterialDigest({
        ...intent,
        ownerId: 'authenticated-owner-is-not-request-material',
        ownerRole: 'human_approver',
      }),
    ).toBe(deriveFeatureDeliveryIntentMaterialDigest(intent));
  });

  it.each([
    ['repository', { authority: { ...featureContract.authority, repository: 'other/repository' } }],
    ['head', { authority: { ...featureContract.authority, headSha: '3'.repeat(40) } }],
    ['base', { authority: { ...featureContract.authority, base: 'main' } }],
    ['merge method', { authority: { ...featureContract.authority, mergeMethod: 'merge' } }],
    ['admin bypass', { authority: { ...featureContract.authority, adminBypass: true } }],
  ])('rejects changed %s authority', (_label, change) => {
    expect(() => featureDeliveryContractSchema.parse({ ...featureContract, ...change })).toThrow();
  });
});
