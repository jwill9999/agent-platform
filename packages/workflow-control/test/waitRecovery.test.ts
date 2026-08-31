import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DurableDeliveryBroker,
  PipelineWaitRecoveryDriver,
  WorkflowStore,
  type DeliveryMutationPort,
  type DeliveryRequest,
  type ExecutionContract,
  type ExternalObservation,
} from '../src/index.js';

const roots: string[] = [];
const workspaceId = `sha256:${'b'.repeat(64)}`;
const policyDigest = `sha256:${'a'.repeat(64)}`;
const protectionDigest = `sha256:${'c'.repeat(64)}`;
const repairTaskId = 'wait-feature.repair.1';
const headSha = '2'.repeat(40);
const contract: ExecutionContract = {
  featureId: 'wait-feature',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'recover a repair-child pipeline wait',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['wait recovery succeeds'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['github.read'],
    github: {
      repository: 'example/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: ['test'],
    },
  },
  tasks: [
    {
      id: 'wait-feature.9',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/wait-feature',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['github.read'],
    },
  ],
  qualityGates: ['test'],
  retryPolicy: {
    implementationAttempts: 2,
    findingAttempts: 2,
    infrastructureAttempts: 2,
    waitDeadlineSeconds: 60,
  },
  repairTaskPolicy: {
    idPattern: 'wait-feature.repair.<sequence>',
    maxChildren: 1,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

class ChecksPort implements DeliveryMutationPort {
  observations = 0;

  async observe(request: DeliveryRequest): Promise<ExternalObservation> {
    if (request.kind !== 'github.checks') throw new Error('unexpected request');
    this.observations += 1;
    return {
      kind: 'expected',
      result: {
        checks: { test: request.pollAttempt === 0 ? 'pending' : 'success' },
        eventIdentity: `checks-${request.pollAttempt}`,
      },
    };
  }

  async mutate(): Promise<unknown> {
    throw new Error('checks are read-only');
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function checksRequest(pollAttempt: number) {
  return {
    kind: 'github.checks' as const,
    workspaceId,
    runId: 'run-wait',
    taskId: repairTaskId,
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator' as const,
    contractVersion: 1 as const,
    policyDigest,
    pullRequestNumber: 10,
    headSha,
    base: 'staging',
    requiredChecks: ['test'],
    protectionDigest,
    pollAttempt,
  };
}

describe('PipelineWaitRecoveryDriver', () => {
  it('restarts a committed repair-child wait and completes it at the exact head', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wait-recovery-'));
    roots.push(root);
    const database = join(root, 'workflow.sqlite');
    let store = new WorkflowStore(database);
    const contractId = store.createContract(contract, 100);
    store.createRun(contractId, 'pipeline', 'run-wait');
    const raw = new Database(database);
    const request = JSON.stringify({
      id: repairTaskId,
      assignedRole: 'implementation_worker',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['github.read'],
      branchParentSha: '1'.repeat(40),
    });
    raw
      .prepare(
        `INSERT INTO repair_child_intents
       (id, workspace_id, run_id, sequence, finding_digest, chain_tip_task_id, request_json,
        status, owner_id, workspace_lease_epoch, run_lease_epoch, task_lease_epoch, result_json,
        created_at_ms, updated_at_ms)
       VALUES (?, ?, 'run-wait', 1, ?, 'wait-feature.9', ?, 'committed',
        'fixture', 0, 0, 0, '{}', 100, 100)`,
      )
      .run(repairTaskId, workspaceId, `sha256:${'d'.repeat(64)}`, request);
    raw
      .prepare(
        `INSERT INTO repair_approved_heads
       (intent_id, workspace_id, run_id, task_id, ref, base_sha, current_sha, published_sha,
        updated_at_ms) VALUES (?, ?, 'run-wait', ?, ?, ?, ?, ?, 100)`,
      )
      .run(
        repairTaskId,
        workspaceId,
        repairTaskId,
        `refs/heads/task/${repairTaskId}`,
        '1'.repeat(40),
        headSha,
        headSha,
      );
    raw.close();
    const ownerId = 'owner-1';
    const workspaceLeaseEpoch = store.acquireLease(
      'workspace',
      workspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    const runLeaseEpoch = store.acquireLease('run', 'run-wait', ownerId, 1000, 1000).epoch;
    const taskLeaseEpoch = store.acquireLease('task', repairTaskId, ownerId, 1000, 1000).epoch;
    let nowMs = 1000;
    const port = new ChecksPort();
    const policy = {
      authorName: 'Agent Platform',
      authorEmail: 'agent@example.com',
      approvedParentShas: { 'wait-feature.9': '1'.repeat(40) },
      approvedProtectionDigest: protectionDigest,
    };
    let broker = DurableDeliveryBroker.createForTest({
      store,
      contract,
      port,
      policy,
      clock: () => nowMs,
    });
    const operation = await broker.execute(checksRequest(0), {
      ownerId,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
    });
    const waiting = broker.recordPipelineObservation({
      operationId: operation.id,
      fence: { ownerId, workspaceLeaseEpoch, runLeaseEpoch, taskLeaseEpoch },
      nextPollAtMs: 1100,
      absoluteDeadlineMs: 5000,
    });
    expect(waiting.kind).toBe('waiting');
    store.close();

    store = new WorkflowStore(database);
    nowMs = 2100;
    const recoveryOwner = 'owner-2';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, recoveryOwner, 1000, nowMs)
        .epoch,
      runLeaseEpoch: store.acquireLease('run', 'run-wait', recoveryOwner, 1000, nowMs).epoch,
      taskLeaseEpoch: store.acquireLease('task', repairTaskId, recoveryOwner, 1000, nowMs).epoch,
    };
    broker = DurableDeliveryBroker.createForTest({
      store,
      contract,
      port,
      policy,
      clock: () => nowMs,
    });
    const driver = new PipelineWaitRecoveryDriver({
      store,
      broker,
      clock: () => nowMs,
      fenceProvider: async () => recoveryFence,
    });
    const result = await driver.recoverDue();
    expect(result.errors).toEqual([]);
    expect(result.recovered).toHaveLength(1);
    expect(result.recovered[0]?.decision.kind).toBe('passed');
    expect(store.listDueWaits(nowMs)).toEqual([]);

    nowMs = 2200;
    const repeated = await broker.execute(checksRequest(0), recoveryFence);
    broker.recordPipelineObservation({
      operationId: repeated.id,
      fence: recoveryFence,
      nextPollAtMs: nowMs + 1,
      absoluteDeadlineMs: 5000,
    });
    nowMs += 2;
    const hungDriver = new PipelineWaitRecoveryDriver({
      store,
      broker,
      clock: () => nowMs,
      operationTimeoutMs: 10,
      fenceProvider: () => new Promise(() => undefined),
    });
    const hung = await hungDriver.recoverDue();
    expect(hung.recovered).toEqual([]);
    expect(hung.errors).toEqual([
      expect.objectContaining({ message: 'pipeline wait recovery operation timed out' }),
    ]);
    store.close();
  });
});
