import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PilotConcurrencyController,
  WorkflowOrchestrator,
  WorkflowStore,
  selectBeadsReadyTasks,
  type BrokeredTaskCloser,
  type EvidenceReference,
  type ExecutionContract,
} from '../src/index.js';

const roots: string[] = [];
const digest = `sha256:${'a'.repeat(64)}`;
const evidence: EvidenceReference[] = [
  { digest, mediaType: 'application/json', sizeBytes: 10, kind: 'test' },
];
const contract: ExecutionContract = {
  featureId: 'schedule-feature',
  contractVersion: 1,
  policyDigest: digest,
  workspaceId: `sha256:${'b'.repeat(64)}`,
  objective: 'schedule safely',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['all checks pass'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read', 'workspace.patch', 'process.test', 'beads.mutate'],
    github: {
      repository: 'owner/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: ['test'],
    },
  },
  tasks: [
    {
      id: 'schedule-feature.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/schedule',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.patch', 'process.test'],
    },
    {
      id: 'schedule-feature.2',
      dependsOn: ['schedule-feature.1'],
      risk: 'standard',
      assignedRole: 'implementation_worker',
      branchParent: 'task/schedule-feature.1',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.patch', 'process.test'],
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
    idPattern: 'schedule-feature.repair.<sequence>',
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

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'workflow-orchestrator-'));
  roots.push(root);
  const store = new WorkflowStore(join(root, 'workflow.sqlite'));
  const contractId = store.createContract(contract);
  store.createRun(contractId, 'scheduling', 'run-schedule');
  const closed: string[] = [];
  const closer: BrokeredTaskCloser = {
    async closeTask(input) {
      closed.push(input.taskId);
    },
  };
  return {
    store,
    closed,
    orchestrator: new WorkflowOrchestrator({ contract, store, closer, ownerId: 'owner-1' }),
  };
}

describe('Beads-authoritative scheduling', () => {
  it('schedules only tasks whose complete dependency set is closed', () => {
    expect(
      selectBeadsReadyTasks(contract, [
        { id: 'schedule-feature.1', status: 'open', blockingDependencies: [] },
        {
          id: 'schedule-feature.2',
          status: 'open',
          blockingDependencies: ['schedule-feature.1'],
        },
      ]),
    ).toEqual(['schedule-feature.1']);
    expect(
      selectBeadsReadyTasks(contract, [
        { id: 'schedule-feature.1', status: 'closed', blockingDependencies: [] },
        {
          id: 'schedule-feature.2',
          status: 'open',
          blockingDependencies: ['schedule-feature.1'],
        },
      ]),
    ).toEqual(['schedule-feature.2']);
  });

  it('fences a second orchestrator while the workspace lease is live', async () => {
    const { store, orchestrator } = await setup();
    expect(orchestrator.acquireWorkspace(100, 1000)).toBe(1);
    const second = new WorkflowOrchestrator({
      contract,
      store,
      closer: { closeTask: async () => undefined },
      ownerId: 'owner-2',
    });
    expect(() => second.acquireWorkspace(100, 1050)).toThrow('another owner');
    expect(second.acquireWorkspace(100, 1100)).toBe(2);
    store.close();
  });

  it('allows one mutating and at most four read-only specialists', () => {
    const concurrency = new PilotConcurrencyController();
    concurrency.reserve({
      role: 'implementation_worker',
      mode: 'mutating',
      deadlineMs: 2000,
      nowMs: 1000,
    });
    expect(() =>
      concurrency.reserve({
        role: 'implementation_worker',
        mode: 'mutating',
        deadlineMs: 2000,
        nowMs: 1000,
      }),
    ).toThrow('only one mutating');
    for (let index = 0; index < 4; index += 1) {
      concurrency.reserve({
        role: 'code_reviewer',
        mode: 'read_only',
        deadlineMs: 2000,
        nowMs: 1000,
      });
    }
    expect(() =>
      concurrency.reserve({
        role: 'test_runner',
        mode: 'read_only',
        deadlineMs: 2000,
        nowMs: 1000,
      }),
    ).toThrow('concurrency limit');
  });

  it('cancels and times out reservations deterministically', () => {
    const concurrency = new PilotConcurrencyController();
    const cancelled = concurrency.reserve({
      role: 'repo_explorer',
      mode: 'read_only',
      deadlineMs: 2000,
      nowMs: 1000,
    });
    concurrency.cancel(cancelled.id);
    expect(() => concurrency.release(cancelled.id, 1100)).toThrow('cancelled');
    const expired = concurrency.reserve({
      role: 'test_runner',
      mode: 'read_only',
      deadlineMs: 1200,
      nowMs: 1100,
    });
    expect(() => concurrency.release(expired.id, 1200)).toThrow('timed out');
  });

  it('closes only accepted exact-head results through the injected broker', async () => {
    const { store, closed, orchestrator } = await setup();
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      retryBudget: contract.retryPolicy,
      evidence,
    });
    const result = {
      status: 'passed' as const,
      summary: 'accepted',
      changedFiles: ['packages/workflow-control/src/orchestrator.ts'],
      acceptanceCriteria: { passed: ['all checks pass'], failed: [] },
      evidence,
      findings: [],
      remainingRisks: [],
      recommendedTransition: 'integrate' as const,
    };
    await expect(
      orchestrator.acceptAndCloseTask({
        packet,
        result: { ...result, changedFiles: ['apps/api/src/index.ts'] },
        gate: {
          expectedHeadSha: 'abc',
          observedHeadSha: 'abc',
          requiredChecks: ['test'],
          passedChecks: ['test'],
          evidence,
        },
      }),
    ).rejects.toThrow('outside the assigned packet');
    await orchestrator.acceptAndCloseTask({
      packet,
      result,
      gate: {
        expectedHeadSha: 'abc',
        observedHeadSha: 'abc',
        requiredChecks: ['test'],
        passedChecks: ['test'],
        evidence,
      },
    });
    expect(closed).toEqual(['schedule-feature.1']);
    store.close();
  });

  it('launches bounded packets through the isolated launcher and releases capacity', async () => {
    const { store, orchestrator } = await setup();
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      retryBudget: contract.retryPolicy,
      evidence,
    });
    const concurrency = new PilotConcurrencyController();
    const seen: string[] = [];
    const output = await orchestrator.launchTask({
      packet,
      concurrency,
      launcher: {
        async launch(received, reservation) {
          seen.push(`${received.taskId}:${reservation.mode}`);
          return { status: 'launched' };
        },
      },
      deadlineMs: 2000,
      nowMs: 1000,
    });
    expect(output).toEqual({ status: 'launched' });
    expect(seen).toEqual(['schedule-feature.1:mutating']);
    expect(() =>
      concurrency.reserve({
        role: 'implementation_worker',
        mode: 'mutating',
        deadlineMs: 2000,
        nowMs: 1000,
      }),
    ).not.toThrow();
    store.close();
  });
});
