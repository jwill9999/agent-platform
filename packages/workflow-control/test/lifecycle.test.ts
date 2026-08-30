import { describe, expect, it } from 'vitest';

import {
  assertContractRevisionIsNotAuthorityExpansion,
  assertRepairChildWithinContract,
  assertTransitionIdempotencyKey,
  attemptCounterSchema,
  cancellationRecordSchema,
  deriveTransitionIdempotencyKey,
  finalizationRecordSchema,
  recoveryRecordSchema,
  waitRecordSchema,
} from '../src/index.js';

const digest = `sha256:${'b'.repeat(64)}`;
const evidence = [
  { digest, mediaType: 'application/json', sizeBytes: 12, kind: 'external' as const },
];
const contract = {
  featureId: 'feature-one',
  contractVersion: 1,
  policyDigest: digest,
  workspaceId: digest,
  objective: 'Ship safely',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['accepted'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read', 'workspace.patch'],
    github: {
      repository: 'owner/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: ['verify'],
    },
  },
  tasks: [
    {
      id: 'feature-one.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/feature-one',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.read', 'workspace.patch'],
    },
  ],
  qualityGates: ['verify'],
  retryPolicy: {
    implementationAttempts: 3,
    findingAttempts: 2,
    infrastructureAttempts: 3,
    waitDeadlineSeconds: 3600,
  },
  repairTaskPolicy: {
    idPattern: 'feature-one.repair.<sequence>',
    maxChildren: 2,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
} as const;

describe('lifecycle schemas', () => {
  it('counts the initial attempt and rejects ambiguous hypotheses', () => {
    expect(
      attemptCounterSchema.parse({ attemptsUsed: 1, maxAttempts: 3, hypotheses: ['initial'] }),
    ).toBeDefined();
    expect(() =>
      attemptCounterSchema.parse({ attemptsUsed: 2, maxAttempts: 3, hypotheses: ['only one'] }),
    ).toThrow('exactly one hypothesis');
    expect(() =>
      attemptCounterSchema.parse({
        attemptsUsed: 4,
        maxAttempts: 3,
        hypotheses: ['one', 'two', 'three', 'four'],
      }),
    ).toThrow('exhausted');
  });

  it('keeps the next poll before the immutable wait deadline', () => {
    const wait = {
      eventIdentity: 'check-run-1',
      nextPollAt: '2026-08-31T10:05:00.000Z',
      absoluteWaitDeadline: '2026-08-31T11:00:00.000Z',
      backoffCount: 2,
      checkId: 'verify',
      attempts: { attemptsUsed: 2, maxAttempts: 3, hypotheses: ['initial', 'runner retry'] },
    };
    expect(waitRecordSchema.parse(wait)).toEqual(wait);
    expect(() =>
      waitRecordSchema.parse({ ...wait, nextPollAt: wait.absoluteWaitDeadline }),
    ).toThrow('next poll');
  });

  it('requires cancellation deadlines to follow the request', () => {
    expect(() =>
      cancellationRecordSchema.parse({
        requestedAt: '2026-08-31T10:00:00.000Z',
        requestedBy: 'owner',
        reason: 'stop safely',
        stopDeadline: '2026-08-31T09:59:00.000Z',
        ownedWorkStopped: false,
        incompleteCleanup: [],
        retainedEvidence: [],
      }),
    ).toThrow('precedes');
  });

  it('requires exact fenced recovery and finalizing after merge', () => {
    const recovery = {
      interruptedState: 'pipeline',
      recoveryTarget: 'pipeline',
      interruptedTransitionId: 'transition-1',
      previousLeaseEpoch: 4,
      recoveryLeaseEpoch: 5,
      mergeVerified: false,
      evidence,
    } as const;
    expect(recoveryRecordSchema.parse(recovery)).toEqual(recovery);
    expect(() => recoveryRecordSchema.parse({ ...recovery, recoveryTarget: 'waiting' })).toThrow(
      'exact interrupted state',
    );
    expect(() => recoveryRecordSchema.parse({ ...recovery, mergeVerified: true })).toThrow(
      'only target finalizing',
    );
    expect(
      recoveryRecordSchema.parse({
        ...recovery,
        interruptedState: 'delivery',
        recoveryTarget: 'finalizing',
        mergeVerified: true,
      }),
    ).toBeDefined();
  });

  it('rejects closed until all finalization evidence is verified', () => {
    const verified = { verified: true, evidence };
    const incomplete = { verified: false, evidence: [] };
    expect(() =>
      finalizationRecordSchema.parse({
        status: 'closed',
        merge: verified,
        epicClosure: verified,
        doltRemoteSync: incomplete,
        finalEvidence: verified,
      }),
    ).toThrow('closed requires');
    expect(
      finalizationRecordSchema.parse({
        status: 'closed',
        merge: verified,
        epicClosure: verified,
        doltRemoteSync: verified,
        finalEvidence: verified,
      }),
    ).toBeDefined();
  });

  it('rejects authority expansion across contract revisions', () => {
    expect(() => assertContractRevisionIsNotAuthorityExpansion(contract, contract)).not.toThrow();
    expect(() =>
      assertContractRevisionIsNotAuthorityExpansion(contract, {
        ...contract,
        authority: {
          ...contract.authority,
          allowedActions: [...contract.authority.allowedActions, 'github.deliver'],
        },
      }),
    ).toThrow('expands allowed actions');
    expect(() =>
      assertContractRevisionIsNotAuthorityExpansion(contract, {
        ...contract,
        constraints: {
          ...contract.constraints,
          allowedPaths: [...contract.constraints.allowedPaths, 'apps/api'],
        },
      }),
    ).toThrow('expands allowed paths');
  });

  it('keeps repair children inside the frozen contract', () => {
    const repair = {
      featureId: 'feature-one',
      id: 'feature-one.repair.1',
      sequence: 1,
      parentEpicId: 'feature-one',
      dependsOn: 'feature-one.1',
      finding: {
        id: 'finding-1',
        severity: 'high',
        summary: 'A source-owned check failed',
        evidence,
      },
      assignedRole: 'implementation_worker',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.patch'],
      authorityExpanded: false,
    } as const;
    expect(() => assertRepairChildWithinContract(contract, repair)).not.toThrow();
    expect(() =>
      assertRepairChildWithinContract(contract, {
        ...repair,
        sequence: 3,
        id: 'feature-one.repair.3',
      }),
    ).toThrow('budget is exhausted');
    expect(() =>
      assertRepairChildWithinContract(contract, { ...repair, allowedPaths: ['apps/api'] }),
    ).toThrow('paths exceed');
  });

  it('derives a stable transition idempotency key from canonical identity', () => {
    const identity = {
      runId: 'run-1',
      transitionId: 'transition-1',
      operation: 'workflow.transition',
      expectedVersion: 4,
    };
    const request = {
      ...identity,
      contractVersion: 1,
      policyDigest: digest,
      from: 'implementing',
      to: 'task_verification',
      workspaceLeaseEpoch: 3,
      taskLeaseEpoch: 2,
      idempotencyKey: deriveTransitionIdempotencyKey(identity),
    };
    expect(() => assertTransitionIdempotencyKey(request)).not.toThrow();
    expect(() =>
      assertTransitionIdempotencyKey({ ...request, expectedVersion: request.expectedVersion + 1 }),
    ).toThrow('canonical transition identity');
  });
});
