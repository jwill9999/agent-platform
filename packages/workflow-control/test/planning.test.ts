import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  WorkflowStore,
  approvalInvalidationReason,
  criticReviewSchema,
  deriveContractMaterialDigest,
  type ExecutionContract,
} from '../src/index.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const evidenceDigest = `sha256:${'b'.repeat(64)}`;
const evidence = [
  {
    digest: evidenceDigest,
    mediaType: 'application/json',
    sizeBytes: 12,
    kind: 'review' as const,
  },
];
const contract: ExecutionContract = {
  featureId: 'planning-feature',
  contractVersion: 1,
  policyDigest,
  workspaceId: `sha256:${'c'.repeat(64)}`,
  objective: 'Produce an approved plan',
  requirements: ['use maker-checker'],
  nonGoals: ['runtime product agents'],
  acceptanceCriteria: ['critic approval is recorded'],
  constraints: {
    architecture: ['repository-local control plane'],
    security: ['critic remains read-only'],
    allowedPaths: ['packages/workflow-control'],
  },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read'],
    github: {
      repository: 'owner/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: ['test'],
    },
  },
  tasks: [
    {
      id: 'planning-feature.1',
      dependsOn: [],
      risk: 'low',
      assignedRole: 'feature_planner',
      branchParent: 'feature/planning',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.read'],
    },
  ],
  qualityGates: ['test'],
  retryPolicy: {
    implementationAttempts: 2,
    findingAttempts: 2,
    infrastructureAttempts: 2,
    waitDeadlineSeconds: 300,
  },
  repairTaskPolicy: {
    idPattern: 'planning-feature.repair.<sequence>',
    maxChildren: 1,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: ['ask the owner'],
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'workflow-planning-'));
  roots.push(root);
  const path = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(path);
  const contractId = store.createContract(contract, 1000);
  store.createRun(contractId, 'planning', 'run-planning');
  store.recordEvidence({
    digest: evidenceDigest,
    mediaType: 'application/json',
    sizeBytes: 12,
    kind: 'review',
    producer: 'planning-fixture',
    producerRole: 'plan_critic',
    workspaceId: contract.workspaceId,
    runId: 'run-planning',
    contractVersion: 1,
    policyDigest,
  });
  return { path, store };
}

function review(
  verdict: 'approved' | 'correction_required' | 'rejected' | 'human_decision_required',
  findings: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    requiresHumanDecision: boolean;
  }> = [],
) {
  return {
    reviewId: `review-${verdict}-${findings.length}`,
    runId: 'run-planning',
    plannerId: 'planner-1',
    criticId: 'critic-1',
    contractVersion: 1 as const,
    policyDigest,
    materialDigest: deriveContractMaterialDigest(contract),
    verdict,
    summary: verdict,
    evidence,
    findings: findings.map((finding) => ({
      ...finding,
      summary: `finding ${finding.id}`,
      requirement: 'execution contract completeness',
      evidence,
      proposedCorrection: 'add the missing constraint',
    })),
    humanDecision:
      verdict === 'human_decision_required'
        ? {
            question: 'Which delivery constraint should apply?',
            findingIds: findings
              .filter((finding) => finding.requiresHumanDecision)
              .map((finding) => finding.id),
            options: [
              { label: 'Keep staging', impact: 'Preserves the approved delivery boundary.' },
              { label: 'Revise plan', impact: 'Requires a new contract and approval.' },
            ],
          }
        : null,
  };
}

describe('planning maker-checker gate', () => {
  it('refuses to overwrite an immutable contract identity', async () => {
    const { store } = await setup();
    expect(() => store.createContract({ ...contract, objective: 'silent replacement' })).toThrow(
      'immutable contract identity',
    );
    store.close();
  });

  it('rejects self-review and inconsistent critic verdicts', () => {
    expect(() =>
      criticReviewSchema.parse({ ...review('approved'), criticId: 'planner-1' }),
    ).toThrow('planner and critic must differ');
    expect(() => criticReviewSchema.parse(review('correction_required'))).toThrow(
      'correction requires a finding',
    );
    expect(() =>
      criticReviewSchema.parse(
        review('human_decision_required', [
          { id: 'f1', severity: 'high', requiresHumanDecision: false },
        ]),
      ),
    ).toThrow('human decision requires a flagged finding');
    expect(() =>
      criticReviewSchema.parse(
        review('rejected', [{ id: 'f1', severity: 'high', requiresHumanDecision: false }]),
      ),
    ).toThrow('rejection requires a critical finding');
  });

  it('persists approved maker-checker evidence and survives restart', async () => {
    const { path, store } = await setup();
    store.recordCriticReview(review('approved'), 1100);
    const approval = store.createPlanApproval({
      approvalId: 'approval-1',
      runId: 'run-planning',
      approverId: 'human-owner',
      contract,
      evidence,
      approvedAtMs: 1200,
    });
    expect(approval.materialDigest).toBe(deriveContractMaterialDigest(contract));
    store.close();
    const reopened = new WorkflowStore(path);
    expect(reopened.getPlanApproval('approval-1')).toEqual(approval);
    reopened.close();
  });

  it('requires every correction to have a disposition before approval', async () => {
    const { store } = await setup();
    const correction = review('correction_required', [
      { id: 'missing-non-goal', severity: 'medium', requiresHumanDecision: false },
    ]);
    store.recordCriticReview(correction, 1100);
    store.recordCriticReview({ ...review('approved'), reviewId: 'review-approved-2' }, 1200);
    expect(() =>
      store.createPlanApproval({
        approvalId: 'approval-blocked',
        runId: 'run-planning',
        approverId: 'human-owner',
        contract,
        evidence,
      }),
    ).toThrow('findings remain unresolved');
    store.disposeCriticFinding({
      findingId: 'missing-non-goal',
      disposition: 'corrected',
      reason: 'the contract now names the non-goal',
      decidedBy: 'planner-1',
      evidence,
    });
    expect(
      store.createPlanApproval({
        approvalId: 'approval-corrected',
        runId: 'run-planning',
        approverId: 'human-owner',
        contract,
        evidence,
      }).status,
    ).toBe('active');
    store.close();
  });

  it('records focused human decisions before a corrected approval', async () => {
    const { store } = await setup();
    store.recordCriticReview(
      review('human_decision_required', [
        { id: 'delivery-choice', severity: 'high', requiresHumanDecision: true },
      ]),
      1100,
    );
    store.disposeCriticFinding({
      findingId: 'delivery-choice',
      disposition: 'dismissed_by_human',
      reason: 'owner explicitly accepts staging as the delivery target',
      decidedBy: 'human-owner',
      evidence,
    });
    store.recordCriticReview({ ...review('approved'), reviewId: 'review-after-decision' }, 1300);
    expect(
      store.createPlanApproval({
        approvalId: 'approval-human-decision',
        runId: 'run-planning',
        approverId: 'human-owner',
        contract,
        evidence,
      }).status,
    ).toBe('active');
    store.close();
  });

  it.each([
    ['policy_digest_changed', { ...contract, policyDigest: `sha256:${'d'.repeat(64)}` }],
    ['material_plan_changed', { ...contract, objective: 'Expanded objective' }],
    [
      'material_plan_changed',
      { ...contract, authority: { ...contract.authority, deliveryTarget: 'production' } },
    ],
  ] as const)('invalidates approval on %s', async (reason, changed) => {
    const { store } = await setup();
    store.recordCriticReview(review('approved'));
    const approval = store.createPlanApproval({
      approvalId: `approval-${reason}`,
      runId: 'run-planning',
      approverId: 'human-owner',
      contract,
      evidence,
    });
    expect(approvalInvalidationReason(approval, changed)).toBe(reason);
    expect(store.revalidatePlanApproval(approval.approvalId, changed, 1400)).toMatchObject({
      status: 'invalidated',
      invalidationReason: reason,
    });
    store.close();
  });
});
