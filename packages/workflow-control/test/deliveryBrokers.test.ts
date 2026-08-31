import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DurableDeliveryBroker,
  WorkflowStore,
  deriveDeliveryRequestDigest,
  type DeliveryMutationPort,
  type DeliveryRequest,
  type ExecutionContract,
  type ExternalObservation,
} from '../src/index.js';
import { workflowDeliveryMutationCapability } from '../src/storage.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;
const parentSha = '1'.repeat(40);
const headSha = '2'.repeat(40);

const contract: ExecutionContract = {
  featureId: 'delivery-feature',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'Deliver only approved exact content',
  requirements: ['Broker every Git and GitHub mutation'],
  nonGoals: [],
  acceptanceCriteria: ['delivery is fenced and idempotent'],
  constraints: {
    architecture: [],
    security: [],
    allowedPaths: ['packages/workflow-control'],
  },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['git.read', 'git.commit', 'git.push', 'github.read', 'github.deliver'],
    github: {
      repository: 'example/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: ['test', 'review'],
    },
  },
  tasks: [
    {
      id: 'delivery-feature.7',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'workflow_orchestrator',
      branchParent: 'task/delivery-feature.6',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['git.read', 'git.commit', 'git.push', 'github.read', 'github.deliver'],
    },
  ],
  qualityGates: ['test', 'review'],
  retryPolicy: {
    implementationAttempts: 3,
    findingAttempts: 2,
    infrastructureAttempts: 2,
    waitDeadlineSeconds: 300,
  },
  repairTaskPolicy: {
    idPattern: 'delivery-feature.repair.<sequence>',
    maxChildren: 1,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: ['stop delivery'],
};

class FakeDeliveryPort implements DeliveryMutationPort {
  mutated = false;
  mutationCount = 0;
  conflict: unknown | undefined;
  forcedObservation: ExternalObservation | undefined;
  onMutate: (() => void) | undefined;
  resultSha = headSha;

  async observe(request: DeliveryRequest): Promise<ExternalObservation> {
    if (this.forcedObservation !== undefined) return this.forcedObservation;
    if (this.conflict !== undefined) return { kind: 'conflict', result: this.conflict };
    return this.mutated
      ? {
          kind: 'expected',
          result: {
            kind: request.kind,
            sha: request.kind === 'git.create_ref' ? request.parentSha : this.resultSha,
          },
        }
      : { kind: 'unchanged', result: { kind: request.kind } };
  }

  async mutate(): Promise<unknown> {
    this.onMutate?.();
    this.mutated = true;
    this.mutationCount += 1;
    return { headSha };
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup(input?: {
  clock?: () => number;
  fault?: Parameters<typeof DurableDeliveryBroker.createForTest>[0]['fault'];
  state?: Parameters<WorkflowStore['createRun']>[1];
}) {
  const root = await mkdtemp(join(tmpdir(), 'workflow-delivery-'));
  roots.push(root);
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  const contractId = store.createContract(contract, 1000);
  const run = store.createRun(contractId, input?.state ?? 'implementing', 'run-delivery');
  const ownerId = 'delivery-owner';
  const fence = {
    ownerId,
    workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, ownerId, 1000, 1000).epoch,
    runLeaseEpoch: store.acquireLease('run', run.id, ownerId, 1000, 1000).epoch,
    taskLeaseEpoch: store.acquireLease('task', 'delivery-feature.7', ownerId, 1000, 1000).epoch,
  };
  const port = new FakeDeliveryPort();
  const broker = DurableDeliveryBroker.createForTest({
    store,
    contract,
    port,
    policy: {
      authorName: 'Agent Platform',
      authorEmail: 'agent@example.com',
      approvedParentShas: { 'delivery-feature.7': parentSha },
      approvedProtectionDigest: `sha256:${'e'.repeat(64)}`,
    },
    clock: input?.clock ?? (() => 1000),
    fault: input?.fault,
  });
  return { root, database, store, run, fence, port, broker };
}

function createRefRequest(): DeliveryRequest {
  return {
    kind: 'git.create_ref',
    workspaceId,
    runId: 'run-delivery',
    taskId: 'delivery-feature.7',
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator',
    contractVersion: 1,
    policyDigest,
    ref: 'refs/heads/task/delivery-feature.7',
    parentRef: 'task/delivery-feature.6',
    parentSha,
  };
}

function commitRequest(): DeliveryRequest {
  return {
    kind: 'git.commit',
    workspaceId,
    runId: 'run-delivery',
    taskId: 'delivery-feature.7',
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator',
    contractVersion: 1,
    policyDigest,
    ref: 'refs/heads/task/delivery-feature.7',
    parentSha,
    treeSha: '3'.repeat(40),
    diffDigest: `sha256:${'d'.repeat(64)}`,
    changedFiles: ['packages/workflow-control/src/deliveryBrokers.ts'],
    message: 'delivery-feature.7 feat add broker',
    authorName: 'Agent Platform',
    authorEmail: 'agent@example.com',
    authoredAtUnix: 1_700_000_000,
  };
}

function pushRequest(): DeliveryRequest {
  return {
    kind: 'git.push',
    workspaceId,
    runId: 'run-delivery',
    taskId: 'delivery-feature.7',
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator',
    contractVersion: 1,
    policyDigest,
    ref: 'refs/heads/task/delivery-feature.7',
    expectedRemoteSha: parentSha,
    newSha: headSha,
  };
}

function checksRequest(pollAttempt: number): DeliveryRequest {
  return {
    kind: 'github.checks',
    workspaceId,
    runId: 'run-delivery',
    taskId: 'delivery-feature.7',
    repository: 'example/repository',
    actorRole: 'workflow_orchestrator',
    contractVersion: 1,
    policyDigest,
    pullRequestNumber: 7,
    headSha,
    base: 'staging',
    requiredChecks: ['test', 'review'],
    protectionDigest: `sha256:${'e'.repeat(64)}`,
    pollAttempt,
  };
}

const brokerPolicy = {
  authorName: 'Agent Platform',
  authorEmail: 'agent@example.com',
  approvedParentShas: { 'delivery-feature.7': parentSha },
  approvedProtectionDigest: `sha256:${'e'.repeat(64)}`,
} as const;

describe('DurableDeliveryBroker', () => {
  it('journals an approved mutation and replays it without a second side effect', async () => {
    const { broker, database, fence, port } = await setup();
    const first = await broker.execute(createRefRequest(), fence);
    const direct = new Database(database);
    direct.prepare("UPDATE runs SET state = 'closed' WHERE id = 'run-delivery'").run();
    direct.close();
    const replay = await broker.execute(createRefRequest(), fence);

    expect(first.status).toBe('committed');
    expect(replay).toEqual(first);
    expect(port.mutationCount).toBe(1);
  });

  it.each([
    ['wrong repository', { repository: 'attacker/repository' }],
    ['protected ref', { ref: 'refs/heads/staging' }],
    ['wrong task ref', { ref: 'refs/heads/task/another-task' }],
    ['changed parent', { parentRef: 'main' }],
  ])('rejects %s before mutation', async (_name, override) => {
    const { broker, fence, port } = await setup();
    await expect(broker.execute({ ...createRefRequest(), ...override }, fence)).rejects.toThrow();
    expect(port.mutationCount).toBe(0);
  });

  it('rejects changed paths and an unapproved commit identity', async () => {
    const { broker, fence, port } = await setup();
    const request = {
      ...createRefRequest(),
      kind: 'git.commit' as const,
      parentSha,
      treeSha: '3'.repeat(40),
      diffDigest: `sha256:${'d'.repeat(64)}`,
      changedFiles: ['outside/secret.ts'],
      message: 'delivery-feature.7 feat add broker',
      authorName: 'Attacker',
      authorEmail: 'attacker@example.com',
      authoredAtUnix: 1_700_000_000,
    };
    delete (request as { parentRef?: string }).parentRef;

    await expect(broker.execute(request, fence)).rejects.toThrow();
    expect(port.mutationCount).toBe(0);
  });

  it('requires durable broker-approved head lineage for every commit and push', async () => {
    const unownedCommit = await setup();
    await expect(
      unownedCommit.broker.execute(commitRequest(), unownedCommit.fence),
    ).rejects.toThrow('broker-approved task head');
    expect(unownedCommit.port.mutationCount).toBe(0);

    const unownedPush = await setup();
    await expect(unownedPush.broker.execute(pushRequest(), unownedPush.fence)).rejects.toThrow(
      'broker-approved task head',
    );
    expect(unownedPush.port.mutationCount).toBe(0);

    const owned = await setup();
    await owned.broker.execute(createRefRequest(), owned.fence);
    await owned.broker.execute(commitRequest(), owned.fence);
    await expect(owned.broker.execute(pushRequest(), owned.fence)).resolves.toMatchObject({
      status: 'committed',
    });

    const unpublished = await setup({ state: 'pipeline' });
    unpublished.port.forcedObservation = {
      kind: 'expected',
      result: { checks: { test: 'success', review: 'success' }, eventIdentity: 'unowned' },
    };
    await expect(unpublished.broker.execute(checksRequest(0), unpublished.fence)).rejects.toThrow(
      'current published',
    );

    const ownedDatabase = new Database(owned.database);
    ownedDatabase.prepare("UPDATE runs SET state = 'pipeline' WHERE id = ?").run(owned.run.id);
    owned.port.forcedObservation = {
      kind: 'expected',
      result: { checks: { test: 'success', review: 'success' }, eventIdentity: 'owned' },
    };
    await expect(owned.broker.execute(checksRequest(0), owned.fence)).resolves.toMatchObject({
      status: 'committed',
    });

    const advancedSha = '4'.repeat(40);
    ownedDatabase.prepare("UPDATE runs SET state = 'implementing' WHERE id = ?").run(owned.run.id);
    owned.port.forcedObservation = undefined;
    owned.port.resultSha = advancedSha;
    await owned.broker.execute(
      { ...commitRequest(), parentSha: headSha, treeSha: '5'.repeat(40) },
      owned.fence,
    );
    ownedDatabase.prepare("UPDATE runs SET state = 'pipeline' WHERE id = ?").run(owned.run.id);
    owned.port.forcedObservation = {
      kind: 'expected',
      result: { checks: { test: 'success', review: 'success' }, eventIdentity: 'stale' },
    };
    await expect(owned.broker.execute(checksRequest(1), owned.fence)).rejects.toThrow(
      'current published',
    );
    ownedDatabase.close();
  });

  it('rejects changed checks, bases, merge methods, and admin bypass', async () => {
    const { broker, fence, port } = await setup();
    const request = {
      kind: 'github.merge' as const,
      workspaceId,
      runId: 'run-delivery',
      taskId: 'delivery-feature.7',
      repository: 'example/repository',
      actorRole: 'workflow_orchestrator' as const,
      contractVersion: 1 as const,
      policyDigest,
      pullRequestNumber: 7,
      headSha,
      base: 'main',
      requiredChecks: ['test'],
      protectionDigest: `sha256:${'e'.repeat(64)}`,
      reviewDecision: 'approved' as const,
      mergeMethod: 'merge' as const,
      adminBypass: true,
    };

    await expect(broker.execute(request, fence)).rejects.toThrow();
    expect(port.mutationCount).toBe(0);
  });

  it('escalates a stale external state exactly once without mutation', async () => {
    const { broker, fence, port } = await setup();
    port.conflict = { reason: 'remote ref changed' };

    const first = await broker.execute(createRefRequest(), fence);
    const replay = await broker.execute(createRefRequest(), fence);

    expect(first.status).toBe('escalated');
    expect(replay).toEqual(first);
    expect(port.mutationCount).toBe(0);
  });

  it('recovers a crash after the external mutation without repeating it', async () => {
    const first = await setup({
      fault(boundary) {
        if (boundary === 'after_mutation') throw new Error('seeded crash');
      },
    });
    await expect(first.broker.execute(createRefRequest(), first.fence)).rejects.toThrow(
      'seeded crash',
    );
    expect(first.port.mutationCount).toBe(1);

    const recoveryOwner = 'recovery-owner';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: first.store.acquireLease(
        'workspace',
        workspaceId,
        recoveryOwner,
        1000,
        2001,
      ).epoch,
      runLeaseEpoch: first.store.acquireLease('run', first.run.id, recoveryOwner, 1000, 2001).epoch,
      taskLeaseEpoch: first.store.acquireLease(
        'task',
        'delivery-feature.7',
        recoveryOwner,
        1000,
        2001,
      ).epoch,
    };
    const recovered = DurableDeliveryBroker.createForTest({
      store: first.store,
      contract,
      port: first.port,
      policy: {
        authorName: 'Agent Platform',
        authorEmail: 'agent@example.com',
        approvedParentShas: { 'delivery-feature.7': parentSha },
        approvedProtectionDigest: `sha256:${'e'.repeat(64)}`,
      },
      clock: () => 2001,
    });

    await expect(
      recovered.reconcilePrepared({ runId: first.run.id, fence: recoveryFence }),
    ).resolves.toMatchObject({ operations: [{ status: 'committed' }], errors: [] });
    expect(first.port.mutationCount).toBe(1);
  });

  it('rechecks leases immediately before mutation', async () => {
    const times = [1000, 1000, 2001];
    const { broker, fence, port } = await setup({ clock: () => times.shift() ?? 2001 });

    await expect(broker.execute(createRefRequest(), fence)).rejects.toThrow('stale or expired');
    expect(port.mutationCount).toBe(0);
  });

  it('requires atomic recovery adoption before a higher-fence execute replay', async () => {
    const first = await setup({
      fault(boundary) {
        if (boundary === 'after_prepare') throw new Error('seeded prepare crash');
      },
    });
    await expect(first.broker.execute(createRefRequest(), first.fence)).rejects.toThrow(
      'seeded prepare crash',
    );
    const recoveryOwner = 'takeover-owner';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: first.store.acquireLease(
        'workspace',
        workspaceId,
        recoveryOwner,
        1000,
        2001,
      ).epoch,
      runLeaseEpoch: first.store.acquireLease('run', first.run.id, recoveryOwner, 1000, 2001).epoch,
      taskLeaseEpoch: first.store.acquireLease(
        'task',
        'delivery-feature.7',
        recoveryOwner,
        1000,
        2001,
      ).epoch,
    };
    const takeover = DurableDeliveryBroker.createForTest({
      store: first.store,
      contract,
      port: first.port,
      policy: brokerPolicy,
      clock: () => 2001,
    });

    await expect(takeover.execute(createRefRequest(), recoveryFence)).rejects.toThrow(
      'requires recovery adoption',
    );
    expect(first.port.mutationCount).toBe(0);
  });

  it('retries recovery idempotently after crashing immediately after adoption', async () => {
    const first = await setup({
      fault(boundary) {
        if (boundary === 'after_prepare') throw new Error('seeded prepare crash');
      },
    });
    await expect(first.broker.execute(createRefRequest(), first.fence)).rejects.toThrow();
    const recoveryOwner = 'recovery-owner';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: first.store.acquireLease(
        'workspace',
        workspaceId,
        recoveryOwner,
        1000,
        2001,
      ).epoch,
      runLeaseEpoch: first.store.acquireLease('run', first.run.id, recoveryOwner, 1000, 2001).epoch,
      taskLeaseEpoch: first.store.acquireLease(
        'task',
        'delivery-feature.7',
        recoveryOwner,
        1000,
        2001,
      ).epoch,
    };
    const crashingRecovery = DurableDeliveryBroker.createForTest({
      store: first.store,
      contract,
      port: first.port,
      policy: brokerPolicy,
      clock: () => 2001,
      fault(boundary) {
        if (boundary === 'after_adoption') throw new Error('seeded adoption crash');
      },
    });
    const failed = await crashingRecovery.reconcilePrepared({
      runId: first.run.id,
      fence: recoveryFence,
    });
    expect(failed.errors).toHaveLength(1);

    const retry = DurableDeliveryBroker.createForTest({
      store: first.store,
      contract,
      port: first.port,
      policy: brokerPolicy,
      clock: () => 2001,
    });
    await expect(
      retry.reconcilePrepared({ runId: first.run.id, fence: recoveryFence }),
    ).resolves.toMatchObject({ operations: [{ status: 'committed' }], errors: [] });
    expect(first.port.mutationCount).toBe(1);
  });

  it('rejects preparation and commit outside the operation state matrix', async () => {
    const closed = await setup({ state: 'closed' });
    await expect(closed.broker.execute(createRefRequest(), closed.fence)).rejects.toThrow(
      'not allowed while run is closed',
    );
    expect(closed.port.mutationCount).toBe(0);

    const active = await setup();
    active.port.onMutate = () => {
      const database = new Database(active.database);
      database.prepare("UPDATE runs SET state = 'cancelled' WHERE id = ?").run(active.run.id);
      database.close();
    };
    await expect(active.broker.execute(createRefRequest(), active.fence)).rejects.toThrow(
      'not allowed while run is cancelled',
    );
    expect(active.port.mutationCount).toBe(1);
    expect(active.store.listPreparedDeliveryOperations(active.run.id)).toHaveLength(1);
  });

  it('binds actor role and branch-protection identity to broker policy', async () => {
    const { broker, fence, port } = await setup();
    await expect(
      broker.execute({ ...createRefRequest(), actorRole: 'implementation_worker' }, fence),
    ).rejects.toThrow();
    await expect(
      broker.execute(
        {
          kind: 'github.checks',
          workspaceId,
          runId: 'run-delivery',
          taskId: 'delivery-feature.7',
          repository: 'example/repository',
          actorRole: 'workflow_orchestrator',
          contractVersion: 1,
          policyDigest,
          pullRequestNumber: 7,
          headSha,
          base: 'staging',
          requiredChecks: ['test', 'review'],
          protectionDigest: `sha256:${'f'.repeat(64)}`,
          pollAttempt: 0,
        },
        fence,
      ),
    ).rejects.toThrow('protection snapshot');
    expect(port.mutationCount).toBe(0);
  });

  it('escalates corrupt journal rows without suppressing later recovery', async () => {
    const first = await setup();
    await first.broker.execute(createRefRequest(), first.fence);
    await first.broker.execute(commitRequest(), first.fence);
    await first.broker.execute(pushRequest(), first.fence);
    const stateDatabase = new Database(first.database);
    stateDatabase.prepare("UPDATE runs SET state = 'pipeline' WHERE id = ?").run(first.run.id);
    stateDatabase.close();
    const faultingBroker = DurableDeliveryBroker.createForTest({
      store: first.store,
      contract,
      port: first.port,
      policy: brokerPolicy,
      clock: () => 1000,
      fault(boundary) {
        if (boundary === 'after_prepare') throw new Error('seeded prepare crash');
      },
    });
    const requests = [checksRequest(0), checksRequest(1), checksRequest(2)];
    for (const request of requests) {
      await expect(faultingBroker.execute(request, first.fence)).rejects.toThrow();
    }
    const database = new Database(first.database);
    database
      .prepare(
        `UPDATE delivery_operations SET result_json = '{not-json'
         WHERE json_extract(request_json, '$.pollAttempt') = 1`,
      )
      .run();
    database
      .prepare(
        `UPDATE delivery_operations SET request_json = '{not-json'
         WHERE json_extract(request_json, '$.pollAttempt') = 0`,
      )
      .run();
    database.close();
    const recoveryOwner = 'digest-recovery-owner';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: first.store.acquireLease(
        'workspace',
        workspaceId,
        recoveryOwner,
        1000,
        2001,
      ).epoch,
      runLeaseEpoch: first.store.acquireLease('run', first.run.id, recoveryOwner, 1000, 2001).epoch,
      taskLeaseEpoch: first.store.acquireLease(
        'task',
        'delivery-feature.7',
        recoveryOwner,
        1000,
        2001,
      ).epoch,
    };
    const recovery = DurableDeliveryBroker.createForTest({
      store: first.store,
      contract,
      port: first.port,
      policy: brokerPolicy,
      clock: () => 2001,
    });

    const result = await recovery.reconcilePrepared({ runId: first.run.id, fence: recoveryFence });
    expect(result.errors).toEqual([]);
    expect(result.operations.map((operation) => operation.status).sort()).toEqual([
      'committed',
      'escalated',
      'escalated',
    ]);
  });

  it('keeps the delivery journal capability internal', async () => {
    const { store, fence } = await setup();
    const request = createRefRequest();
    expect(() =>
      store.prepareDeliveryOperation({
        id: 'direct-write',
        workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        kind: request.kind,
        actorRole: request.actorRole,
        requestDigest: `sha256:${'9'.repeat(64)}`,
        request,
        contractVersion: 1,
        policyDigest,
        ...fence,
        nowMs: 1000,
      }),
    ).toThrow('internal delivery broker capability');
    const internal = store.prepareDeliveryOperation(
      {
        id: `sha256:${'8'.repeat(64)}`,
        workspaceId,
        runId: request.runId,
        taskId: request.taskId,
        kind: request.kind,
        actorRole: request.actorRole,
        requestDigest: `sha256:${'8'.repeat(64)}`,
        request,
        contractVersion: 1,
        policyDigest,
        ...fence,
        nowMs: 1000,
      },
      workflowDeliveryMutationCapability,
    );
    expect(() =>
      store.commitDeliveryOperation(
        {
          id: internal.id,
          ...fence,
          result: undefined,
          assertExternalState: () => undefined,
          clock: () => 1000,
        },
        workflowDeliveryMutationCapability,
      ),
    ).toThrow('JSON-compatible');
    expect(workflowDeliveryMutationCapability).toBeTypeOf('symbol');
  });

  it('durably escalates undefined and cyclic port results instead of wedging prepared work', async () => {
    const undefinedResult = await setup();
    undefinedResult.port.forcedObservation = { kind: 'expected', result: undefined };
    await expect(
      undefinedResult.broker.execute(createRefRequest(), undefinedResult.fence),
    ).resolves.toMatchObject({
      status: 'escalated',
      result: { reason: 'delivery_port_result_not_json' },
    });

    const cyclicResult = await setup();
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    cyclicResult.port.forcedObservation = { kind: 'conflict', result: cycle };
    await expect(
      cyclicResult.broker.execute(createRefRequest(), cyclicResult.fence),
    ).resolves.toMatchObject({
      status: 'escalated',
      result: { reason: 'delivery_port_result_not_json' },
    });
  });

  it('persists pipeline backoff, completes on success, and escalates an expired wait once', async () => {
    let nowMs = 1000;
    const pending = await setup({ clock: () => nowMs });
    await pending.broker.execute(createRefRequest(), pending.fence);
    await pending.broker.execute(commitRequest(), pending.fence);
    await pending.broker.execute(pushRequest(), pending.fence);
    const pendingDatabase = new Database(pending.database);
    pendingDatabase.prepare("UPDATE runs SET state = 'pipeline' WHERE id = ?").run(pending.run.id);
    pendingDatabase.close();
    pending.port.forcedObservation = {
      kind: 'expected',
      result: {
        checks: { test: 'success', review: 'pending' },
        eventIdentity: 'checks-event-1',
      },
    };
    const firstObservation = await pending.broker.execute(checksRequest(0), pending.fence);
    const wrongContractBroker = DurableDeliveryBroker.createForTest({
      store: pending.store,
      contract: { ...contract, featureId: 'wrong-delivery-feature' },
      port: pending.port,
      policy: brokerPolicy,
      clock: () => nowMs,
    });
    expect(() =>
      wrongContractBroker.recordPipelineObservation({
        operationId: firstObservation.id,
        fence: pending.fence,
        nextPollAtMs: 1100,
        absoluteDeadlineMs: 2200,
      }),
    ).toThrow('approved execution contract');
    const waiting = pending.broker.recordPipelineObservation({
      operationId: firstObservation.id,
      fence: pending.fence,
      nextPollAtMs: 1100,
      absoluteDeadlineMs: 2200,
    });
    expect(waiting).toMatchObject({ kind: 'waiting', backoffCount: 1 });
    expect(
      pending.broker.recordPipelineObservation({
        operationId: firstObservation.id,
        fence: pending.fence,
        nextPollAtMs: 1100,
        absoluteDeadlineMs: 2200,
      }),
    ).toEqual(waiting);
    expect(pending.store.listDueWaits(1099)).toEqual([]);
    expect(pending.store.listDueWaits(1100)).toMatchObject([
      { runId: pending.run.id, deadlineReached: false },
    ]);

    nowMs = 2001;
    const recoveryOwner = 'wait-recovery-owner';
    const recoveryFence = {
      ownerId: recoveryOwner,
      workspaceLeaseEpoch: pending.store.acquireLease(
        'workspace',
        workspaceId,
        recoveryOwner,
        1000,
        nowMs,
      ).epoch,
      runLeaseEpoch: pending.store.acquireLease('run', pending.run.id, recoveryOwner, 1000, nowMs)
        .epoch,
      taskLeaseEpoch: pending.store.acquireLease(
        'task',
        'delivery-feature.7',
        recoveryOwner,
        1000,
        nowMs,
      ).epoch,
    };
    const recoveryBroker = DurableDeliveryBroker.createForTest({
      store: pending.store,
      contract,
      port: pending.port,
      policy: brokerPolicy,
      clock: () => nowMs,
    });
    expect(() =>
      pending.broker.recordPipelineObservation({
        operationId: firstObservation.id,
        fence: pending.fence,
        nextPollAtMs: 1100,
        absoluteDeadlineMs: 2200,
      }),
    ).toThrow('fencing token');
    expect(
      recoveryBroker.recordPipelineObservation({
        operationId: firstObservation.id,
        fence: recoveryFence,
        nextPollAtMs: 1100,
        absoluteDeadlineMs: 2200,
      }),
    ).toEqual(waiting);

    pending.port.forcedObservation = {
      kind: 'expected',
      result: {
        checks: { test: 'success', review: 'pending' },
        eventIdentity: 'checks-event-2',
      },
    };
    const secondObservation = await recoveryBroker.execute(checksRequest(1), recoveryFence);
    const clampedWaiting = recoveryBroker.recordPipelineObservation({
      operationId: secondObservation.id,
      fence: recoveryFence,
      nextPollAtMs: 2100,
      absoluteDeadlineMs: 2300,
    });
    expect(clampedWaiting).toMatchObject({
      kind: 'waiting',
      absoluteDeadlineMs: 2200,
      backoffCount: 2,
    });
    expect(
      recoveryBroker.recordPipelineObservation({
        operationId: secondObservation.id,
        fence: recoveryFence,
        nextPollAtMs: 2100,
        absoluteDeadlineMs: 2300,
      }),
    ).toEqual(clampedWaiting);

    pending.port.forcedObservation = {
      kind: 'expected',
      result: {
        checks: { test: 'success', review: 'success' },
        eventIdentity: 'checks-event-3',
      },
    };
    const passedObservation = await recoveryBroker.execute(checksRequest(2), recoveryFence);
    expect(
      recoveryBroker.recordPipelineObservation({
        operationId: passedObservation.id,
        fence: recoveryFence,
        nextPollAtMs: 2100,
        absoluteDeadlineMs: 2200,
      }),
    ).toMatchObject({ kind: 'passed' });
    expect(pending.store.listDueWaits(2000)).toEqual([]);

    nowMs = 1000;
    const expiring = await setup({ clock: () => nowMs });
    await expiring.broker.execute(createRefRequest(), expiring.fence);
    await expiring.broker.execute(commitRequest(), expiring.fence);
    await expiring.broker.execute(pushRequest(), expiring.fence);
    const expiringDatabase = new Database(expiring.database);
    expiringDatabase
      .prepare("UPDATE runs SET state = 'pipeline' WHERE id = ?")
      .run(expiring.run.id);
    expiringDatabase.close();
    expiring.port.forcedObservation = {
      kind: 'expected',
      result: {
        checks: { test: 'pending', review: 'pending' },
        eventIdentity: 'checks-expiring',
      },
    };
    const expiringObservation = await expiring.broker.execute(checksRequest(0), expiring.fence);
    const expiringCheckId = deriveDeliveryRequestDigest([
      'example/repository',
      7,
      headSha,
      'staging',
      `sha256:${'e'.repeat(64)}`,
    ]);
    expiring.store.putWait({
      runId: expiring.run.id,
      checkId: expiringCheckId,
      eventIdentity: 'generic-squat',
      nextPollAtMs: 1050,
      absoluteDeadlineMs: 1190,
      backoffCount: 99,
    });
    const expiringWait = expiring.broker.recordPipelineObservation({
      operationId: expiringObservation.id,
      fence: expiring.fence,
      nextPollAtMs: 1100,
      absoluteDeadlineMs: 1200,
    });
    if (expiringWait.kind !== 'waiting') throw new Error('expected waiting decision');
    expect(expiring.store.getWait(expiring.run.id, expiringCheckId)).toMatchObject({
      workspaceId,
      taskId: 'delivery-feature.7',
      eventIdentity: 'checks-expiring',
      backoffCount: 1,
    });
    expect(() =>
      expiring.store.putWait({
        runId: expiring.run.id,
        checkId: expiringWait.checkId,
        eventIdentity: 'generic-overwrite',
        nextPollAtMs: 1101,
        absoluteDeadlineMs: 1200,
        backoffCount: 99,
      }),
    ).toThrow('generic wait API');
    nowMs = 1200;
    expiring.port.forcedObservation = {
      kind: 'expected',
      result: {
        checks: { test: 'success', review: 'success' },
        eventIdentity: 'checks-too-late',
      },
    };
    const lateObservation = await expiring.broker.execute(checksRequest(1), expiring.fence);
    expect(() =>
      expiring.broker.recordPipelineObservation({
        operationId: lateObservation.id,
        fence: expiring.fence,
        nextPollAtMs: 1250,
        absoluteDeadlineMs: 1300,
      }),
    ).toThrow('deadline expired');
    const wrongExpiryBroker = DurableDeliveryBroker.createForTest({
      store: expiring.store,
      contract: { ...contract, featureId: 'wrong-delivery-feature' },
      port: expiring.port,
      policy: brokerPolicy,
      clock: () => nowMs,
    });
    expect(() =>
      wrongExpiryBroker.expirePipelineWait({
        runId: expiring.run.id,
        taskId: 'delivery-feature.7',
        checkId: expiringWait.checkId,
        eventIdentity: expiringWait.eventIdentity,
        fence: expiring.fence,
      }),
    ).toThrow('approved execution contract');
    const firstEscalation = expiring.broker.expirePipelineWait({
      runId: expiring.run.id,
      taskId: 'delivery-feature.7',
      checkId: expiringWait.checkId,
      eventIdentity: expiringWait.eventIdentity,
      fence: expiring.fence,
    });
    const replayedEscalation = expiring.broker.expirePipelineWait({
      runId: expiring.run.id,
      taskId: 'delivery-feature.7',
      checkId: expiringWait.checkId,
      eventIdentity: expiringWait.eventIdentity,
      fence: expiring.fence,
    });
    expect(replayedEscalation).toEqual(firstEscalation);
    expect(expiring.store.listDueWaits(nowMs)).toEqual([]);
    expect(() =>
      expiring.broker.recordPipelineObservation({
        operationId: expiringObservation.id,
        fence: expiring.fence,
        nextPollAtMs: 1300,
        absoluteDeadlineMs: 1400,
      }),
    ).toThrow('terminally escalated');
  });

  it('rejects reconciliation through a broker bound to a different exact contract', async () => {
    const first = await setup({
      fault(boundary) {
        if (boundary === 'after_prepare') throw new Error('seeded prepare crash');
      },
    });
    await expect(first.broker.execute(createRefRequest(), first.fence)).rejects.toThrow();
    const mismatchedContract = { ...contract, featureId: 'another-feature' };
    const wrongBroker = DurableDeliveryBroker.createForTest({
      store: first.store,
      contract: mismatchedContract,
      port: first.port,
      policy: brokerPolicy,
      clock: () => 1000,
    });

    await expect(
      wrongBroker.reconcilePrepared({ runId: first.run.id, fence: first.fence }),
    ).rejects.toThrow('does not use the approved execution contract');
    expect(first.port.mutationCount).toBe(0);
  });
});
