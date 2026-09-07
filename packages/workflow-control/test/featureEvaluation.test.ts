import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ContractEvaluator,
  DurableRepairChildBroker,
  OfficialBeadsDoltPort,
  OfficialRepairChildPort,
  SecureEvidenceVault,
  WorkflowStore,
  deriveEvaluationDigest,
  deriveTransitionIdempotencyKey,
  type ExecutionContract,
  type OfficialRepairChildClient,
  type OfficialRepairChildSnapshot,
  type OfficialBeadsDoltClient,
  type RepairChildMutationPort,
  type RepairChildRequest,
} from '../src/index.js';
import { createProductionBeadsDoltPort } from '../src/reconciliation.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;
const headSha = '1'.repeat(40);
const contract: ExecutionContract = {
  featureId: 'feature-evaluation',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'evaluate the feature securely',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['behavior works', 'security boundary holds'],
  constraints: {
    architecture: [],
    security: [],
    allowedPaths: ['packages/workflow-control'],
  },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: [
      'workspace.patch',
      'process.test',
      'artifact.write',
      'beads.mutate',
      'git.commit',
    ],
    github: {
      repository: 'example/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: [],
    },
  },
  tasks: [
    {
      id: 'feature-evaluation.8',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'qa_evaluator',
      branchParent: 'task/feature-evaluation.7',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['artifact.write'],
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
    idPattern: 'feature-evaluation.repair.<sequence>',
    maxChildren: 2,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'feature-evaluation-'));
  roots.push(root);
  const store = new WorkflowStore(join(root, 'workflow.sqlite'));
  const contractId = store.createContract(contract, 100);
  store.createRun(contractId, 'feature_evaluation', 'run-evaluation');
  store.seedApprovedTaskHeadForTest({
    workspaceId,
    runId: 'run-evaluation',
    taskId: 'feature-evaluation.8',
    headSha,
    nowMs: 90,
  });
  const vault = new SecureEvidenceVault({
    store,
    contract,
    clock: () => 1000,
  });
  return { store, vault };
}

async function evidence(
  vault: SecureEvidenceVault,
  content: string,
  producerRole: 'qa_evaluator' | 'test_runner' | 'implementation_worker' = 'qa_evaluator',
) {
  return (
    await vault.record({
      content: Buffer.from(content),
      mediaType: 'text/plain',
      kind: 'test',
      producer: `${producerRole}-1`,
      producerRole,
      workspaceId,
      runId: 'run-evaluation',
      taskId: 'feature-evaluation.8',
      contractVersion: 1,
      policyDigest,
      headSha,
    })
  ).reference;
}

function evaluationRequest(references: Awaited<ReturnType<typeof evidence>>[]) {
  return {
    workspaceId,
    runId: 'run-evaluation',
    taskId: 'feature-evaluation.8',
    headSha,
    contractVersion: 1 as const,
    policyDigest,
    evaluatorRole: 'feature_evaluator' as const,
    summary: 'evaluated exact head',
    criteria: [
      {
        criterion: 'behavior works',
        status: 'passed' as const,
        summary: 'behavior passed',
        evidence: [references[0]!],
      },
      {
        criterion: 'security boundary holds',
        status: 'failed' as const,
        summary: 'repair required',
        evidence: [references[1]!],
      },
    ],
  };
}

describe('ContractEvaluator', () => {
  it('maps every criterion to secure exact-head evidence and freezes accepted evidence', async () => {
    const { store, vault } = await setup();
    const references = await Promise.all([
      evidence(vault, 'behavior'),
      evidence(vault, 'security'),
    ]);
    const request = evaluationRequest(references);
    const result = new ContractEvaluator({ store, contract }).evaluate(request, 2000);
    expect(result).toMatchObject({
      id: deriveEvaluationDigest(request),
      verdict: 'needs_repair',
      failedCriteria: ['security boundary holds'],
    });
    expect(
      store.getSecureEvidence(references[0]!.digest, 'run-evaluation', 'feature-evaluation.8'),
    ).toMatchObject({ acceptedAtMs: 2000, headSha });
    expect(
      new ContractEvaluator({ store, contract }).evaluate(request, 3000).record.createdAtMs,
    ).toBe(2000);
    const later = new ContractEvaluator({ store, contract }).evaluate(
      { ...request, evaluatorRole: 'qa_evaluator' },
      3000,
    );
    expect(later.record.createdAtMs).toBe(3000);
    expect(
      store.getSecureEvidence(references[0]!.digest, 'run-evaluation', 'feature-evaluation.8'),
    ).toMatchObject({ acceptedAtMs: 2000 });
  });

  it('rejects incomplete, stale-head, and unauthorized-producer evidence', async () => {
    const { store, vault } = await setup();
    const references = await Promise.all([
      evidence(vault, 'behavior'),
      evidence(vault, 'security'),
    ]);
    const evaluator = new ContractEvaluator({ store, contract });
    expect(() =>
      evaluator.evaluate({
        ...evaluationRequest(references),
        criteria: [evaluationRequest(references).criteria[0]],
      }),
    ).toThrow('every approved acceptance criterion');
    expect(() =>
      evaluator.evaluate({ ...evaluationRequest(references), headSha: '2'.repeat(40) }),
    ).toThrow('broker-approved exact task head');
    const unauthorized = await evidence(vault, 'worker-only', 'implementation_worker');
    store.recordEvidence({
      ...unauthorized,
      producer: 'forged-qa',
      producerRole: 'qa_evaluator',
      workspaceId,
      runId: 'run-evaluation',
      taskId: 'feature-evaluation.8',
      contractVersion: 1,
      policyDigest,
      headSha,
      createdAtMs: 1100,
    });
    expect(() => evaluator.evaluate(evaluationRequest([unauthorized, references[1]!]))).toThrow(
      'exact evaluated head',
    );
  });
});

class MemoryRepairPort implements RepairChildMutationPort {
  state: 'normal' | 'conflict' = 'normal';
  readonly created = new Set<string>();
  readonly mutate = vi.fn(async (request: RepairChildRequest) => {
    this.created.add(request.id);
    return { created: true };
  });

  async observe(request: RepairChildRequest) {
    if (this.state === 'conflict') return { kind: 'conflict' as const, result: { mismatch: true } };
    if (this.created.has(request.id)) {
      return { kind: 'expected' as const, result: { created: true } };
    }
    return { kind: 'unchanged' as const, result: { absent: true } };
  }
}

function repairRequest(overrides: Partial<RepairChildRequest> = {}): RepairChildRequest {
  const finding = {
    id: 'finding-1',
    severity: 'high' as const,
    summary: 'security criterion failed',
    acceptanceCriterion: 'security boundary holds',
    evidence: [
      {
        digest: `sha256:${'c'.repeat(64)}`,
        mediaType: 'text/plain',
        sizeBytes: 10,
        kind: 'evaluation' as const,
      },
    ],
    repairHypothesis: 'tighten the boundary',
  };
  return {
    workspaceId,
    runId: 'run-evaluation',
    featureId: 'feature-evaluation',
    id: 'feature-evaluation.repair.1',
    sequence: 1,
    parentEpicId: 'feature-evaluation',
    dependsOn: 'feature-evaluation.8',
    chainTipTaskId: 'feature-evaluation.8',
    branchParent: 'task/feature-evaluation.8',
    branchParentSha: headSha,
    evaluationId: `sha256:${'d'.repeat(64)}`,
    finding,
    findingDigest: deriveEvaluationDigest(finding),
    remainingRetryBudget: {
      implementationAttempts: 1,
      findingAttempts: 1,
      infrastructureAttempts: 2,
      waitDeadlineSeconds: 60,
    },
    assignedRole: 'implementation_worker',
    allowedPaths: ['packages/workflow-control'],
    allowedOperations: ['workspace.patch', 'process.test', 'artifact.write'],
    authorityExpanded: false,
    actorRole: 'workflow_orchestrator',
    contractVersion: 1,
    policyDigest,
    ...overrides,
  };
}

async function repairSetup(port = new MemoryRepairPort()) {
  const { store, vault } = await setup();
  const references = await Promise.all([
    evidence(vault, 'behavior'),
    evidence(vault, 'security failure'),
  ]);
  const evaluation = new ContractEvaluator({ store, contract }).evaluate(
    evaluationRequest(references),
    1500,
  );
  const ownerId = 'orchestrator-1';
  const workspace = store.acquireLease('workspace', workspaceId, ownerId, 10_000, 1000);
  const run = store.acquireLease('run', 'run-evaluation', ownerId, 10_000, 1000);
  const transitionId = 'enter-repair-planning';
  const transition = store.prepareTransition({
    id: transitionId,
    runId: 'run-evaluation',
    from: 'feature_evaluation',
    to: 'repair_planning',
    operation: 'workflow.transition',
    expectedRunVersion: 0,
    idempotencyKey: deriveTransitionIdempotencyKey({
      runId: 'run-evaluation',
      transitionId,
      operation: 'workflow.transition',
      expectedVersion: 0,
    }),
    actorRole: 'workflow_orchestrator',
    contractVersion: 1,
    policyDigest,
    leaseOwnerId: ownerId,
    leaseEpoch: run.epoch,
    transitionContext: { workspaceLeaseEpoch: workspace.epoch },
    expectedExternalState: {},
    externalArguments: {},
    nowMs: 1600,
  });
  store.commitTransition(transition.id, ownerId, run.epoch, { entered: true }, 1700);
  const task = store.acquireLease('task', 'feature-evaluation.8', ownerId, 10_000, 1000);
  const fence = {
    ownerId,
    workspaceLeaseEpoch: workspace.epoch,
    runLeaseEpoch: run.epoch,
    taskLeaseEpoch: task.epoch,
  };
  const broker = DurableRepairChildBroker.createForTest({
    store,
    contract,
    port,
    clock: () => 2000,
  });
  const finding = {
    ...repairRequest().finding,
    evidence: [references[1]!],
  };
  const request = repairRequest({
    evaluationId: evaluation.id,
    finding,
    findingDigest: deriveEvaluationDigest(finding),
  });
  return { store, port, fence, broker, request };
}

describe('DurableRepairChildBroker', () => {
  it('creates an in-envelope append-only repair child idempotently', async () => {
    const { broker, port, fence, request } = await repairSetup();
    await expect(broker.execute(request, fence)).resolves.toMatchObject({
      id: 'feature-evaluation.repair.1',
      status: 'committed',
      chainTipTaskId: 'feature-evaluation.8',
    });
    await expect(broker.execute(request, fence)).resolves.toMatchObject({
      status: 'committed',
    });
    expect(port.mutate).toHaveBeenCalledTimes(1);
  });

  it('carries approved-head lineage and decremented retry authority into a second repair', async () => {
    const { store, port, fence, broker, request } = await repairSetup();
    await broker.execute(request, fence);
    const repairHeadSha = '2'.repeat(40);
    store.seedAcceptedRepairTaskForTest({
      workspaceId,
      runId: 'run-evaluation',
      taskId: 'feature-evaluation.repair.1',
      headSha: repairHeadSha,
      nowMs: 2100,
    });
    const repairVault = new SecureEvidenceVault({ store, contract, clock: () => 2200 });
    const repairEvidence = await repairVault.record({
      content: Buffer.from('repair one still fails security'),
      mediaType: 'text/plain',
      kind: 'test',
      producer: 'qa-2',
      producerRole: 'qa_evaluator',
      workspaceId,
      runId: 'run-evaluation',
      taskId: 'feature-evaluation.repair.1',
      contractVersion: 1,
      policyDigest,
      headSha: repairHeadSha,
    });
    const secondEvaluation = new ContractEvaluator({ store, contract }).evaluate(
      {
        ...evaluationRequest([repairEvidence.reference, repairEvidence.reference]),
        taskId: 'feature-evaluation.repair.1',
        headSha: repairHeadSha,
      },
      2300,
    );
    const repairTaskLease = store.acquireLease(
      'task',
      'feature-evaluation.repair.1',
      fence.ownerId,
      10_000,
      2000,
    );
    const finding = {
      ...request.finding,
      id: 'finding-2',
      evidence: [repairEvidence.reference],
    };
    const second = repairRequest({
      id: 'feature-evaluation.repair.2',
      sequence: 2,
      dependsOn: 'feature-evaluation.repair.1',
      chainTipTaskId: 'feature-evaluation.repair.1',
      branchParent: 'task/feature-evaluation.repair.1',
      branchParentSha: repairHeadSha,
      evaluationId: secondEvaluation.id,
      finding,
      findingDigest: deriveEvaluationDigest(finding),
      remainingRetryBudget: {
        implementationAttempts: 0,
        findingAttempts: 0,
        infrastructureAttempts: 2,
        waitDeadlineSeconds: 60,
      },
    });
    await expect(
      broker.execute(second, { ...fence, taskLeaseEpoch: repairTaskLease.epoch }),
    ).resolves.toMatchObject({ id: 'feature-evaluation.repair.2', status: 'committed' });
    expect(port.mutate).toHaveBeenCalledTimes(2);
  });

  it('rejects a second child until its predecessor advances and is accepted and closed', async () => {
    const { store, port, fence, broker, request } = await repairSetup();
    await broker.execute(request, fence);
    const repairTaskLease = store.acquireLease(
      'task',
      'feature-evaluation.repair.1',
      fence.ownerId,
      10_000,
      2000,
    );
    await expect(
      broker.execute(
        repairRequest({
          id: 'feature-evaluation.repair.2',
          sequence: 2,
          dependsOn: 'feature-evaluation.repair.1',
          chainTipTaskId: 'feature-evaluation.repair.1',
          branchParent: 'task/feature-evaluation.repair.1',
          remainingRetryBudget: {
            implementationAttempts: 0,
            findingAttempts: 0,
            infrastructureAttempts: 2,
            waitDeadlineSeconds: 60,
          },
        }),
        { ...fence, taskLeaseEpoch: repairTaskLease.epoch },
      ),
    ).rejects.toThrow('accepted, Beads-closed, and advanced');
    expect(port.mutate).toHaveBeenCalledTimes(1);
  });

  it('derives child authority from durable attempts and rejects an exhausted aggregate budget', async () => {
    const { store, port, fence, broker, request } = await repairSetup();
    await broker.execute(request, fence);
    const repairHeadSha = '2'.repeat(40);
    store.seedAcceptedRepairTaskForTest({
      workspaceId,
      runId: 'run-evaluation',
      taskId: 'feature-evaluation.repair.1',
      headSha: repairHeadSha,
      nowMs: 2100,
    });
    for (const hypothesis of ['initial repair execution', 'changed repair hypothesis']) {
      store.recordAttempt({
        runId: 'run-evaluation',
        scope: 'task',
        scopeId: 'feature-evaluation.repair.1',
        maxAttempts: 2,
        hypothesis,
        nowMs: 2200,
      });
      store.recordAttempt({
        runId: 'run-evaluation',
        scope: 'finding',
        scopeId: request.finding.id,
        maxAttempts: 2,
        hypothesis,
        nowMs: 2200,
      });
    }
    const repairTaskLease = store.acquireLease(
      'task',
      'feature-evaluation.repair.1',
      fence.ownerId,
      10_000,
      2000,
    );
    await expect(
      broker.execute(
        repairRequest({
          id: 'feature-evaluation.repair.2',
          sequence: 2,
          dependsOn: 'feature-evaluation.repair.1',
          chainTipTaskId: 'feature-evaluation.repair.1',
          branchParent: 'task/feature-evaluation.repair.1',
          branchParentSha: repairHeadSha,
          remainingRetryBudget: {
            implementationAttempts: 0,
            findingAttempts: 0,
            infrastructureAttempts: 2,
            waitDeadlineSeconds: 60,
          },
        }),
        { ...fence, taskLeaseEpoch: repairTaskLease.epoch },
      ),
    ).rejects.toThrow('retry budget is exhausted');
    expect(port.mutate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['count', { id: 'feature-evaluation.repair.3', sequence: 3 }],
    ['path', { allowedPaths: ['apps/api'] }],
    ['role', { assignedRole: 'feature_planner' }],
    ['authority', { allowedOperations: ['github.deliver'] }],
    ['dependency', { dependsOn: 'feature-evaluation.7' }],
    ['retry budget', { remainingRetryBudget: { ...contract.retryPolicy, findingAttempts: 99 } }],
  ])('rejects repair %s expansion before mutation', async (_name, overrides) => {
    const { broker, port, fence, request } = await repairSetup();
    await expect(
      broker.execute({ ...request, ...(overrides as Partial<RepairChildRequest>) }, fence),
    ).rejects.toThrow();
    expect(port.mutate).not.toHaveBeenCalled();
  });

  it('durably escalates conflicting external state without mutation', async () => {
    const port = new MemoryRepairPort();
    port.state = 'conflict';
    const { broker, fence, request } = await repairSetup(port);
    await expect(broker.execute(request, fence)).resolves.toMatchObject({
      status: 'escalated',
    });
    expect(port.mutate).not.toHaveBeenCalled();
  });

  it('reconciles a crash after external mutation without duplicating the effect', async () => {
    const port = new MemoryRepairPort();
    let crash = true;
    const { store, fence, request } = await repairSetup(port);
    const broker = DurableRepairChildBroker.createForTest({
      store,
      contract,
      port,
      clock: () => 2000,
      fault(boundary) {
        if (boundary === 'after_mutation' && crash) {
          crash = false;
          throw new Error('injected crash');
        }
      },
    });
    await expect(broker.execute(request, fence)).rejects.toThrow('injected crash');
    await expect(broker.execute(request, fence)).resolves.toMatchObject({
      status: 'committed',
    });
    expect(port.mutate).toHaveBeenCalledTimes(1);
  });

  it('adopts a prepared intent after lease-owner rollover without duplicating the effect', async () => {
    const port = new MemoryRepairPort();
    let crash = true;
    const { store, fence, request } = await repairSetup(port);
    const interrupted = DurableRepairChildBroker.createForTest({
      store,
      contract,
      port,
      clock: () => 2000,
      fault(boundary) {
        if (boundary === 'after_mutation' && crash) {
          crash = false;
          throw new Error('injected crash');
        }
      },
    });
    await expect(interrupted.execute(request, fence)).rejects.toThrow('injected crash');
    const ownerId = 'orchestrator-2';
    const workspace = store.acquireLease('workspace', workspaceId, ownerId, 10_000, 12_000);
    const run = store.acquireLease('run', 'run-evaluation', ownerId, 10_000, 12_000);
    const task = store.acquireLease('task', 'feature-evaluation.8', ownerId, 10_000, 12_000);
    const recovered = DurableRepairChildBroker.createForTest({
      store,
      contract,
      port,
      clock: () => 12_500,
    });
    await expect(
      recovered.execute(request, {
        ownerId,
        workspaceLeaseEpoch: workspace.epoch,
        runLeaseEpoch: run.epoch,
        taskLeaseEpoch: task.epoch,
      }),
    ).resolves.toMatchObject({ status: 'committed', ownerId });
    expect(port.mutate).toHaveBeenCalledTimes(1);
  });

  it('rejects a fabricated evaluation and a run outside repair_planning', async () => {
    const first = await repairSetup();
    await expect(
      first.broker.execute(
        { ...first.request, evaluationId: `sha256:${'e'.repeat(64)}` },
        first.fence,
      ),
    ).rejects.toThrow('authoritative failed exact-head evaluation');
    expect(first.port.mutate).not.toHaveBeenCalled();

    const transitionId = 'leave-repair-planning';
    const transition = first.store.prepareTransition({
      id: transitionId,
      runId: 'run-evaluation',
      from: 'repair_planning',
      to: 'implementing',
      operation: 'workflow.transition',
      expectedRunVersion: 2,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: 'run-evaluation',
        transitionId,
        operation: 'workflow.transition',
        expectedVersion: 2,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: 1,
      policyDigest,
      leaseOwnerId: first.fence.ownerId,
      leaseEpoch: first.fence.runLeaseEpoch,
      transitionContext: { workspaceLeaseEpoch: first.fence.workspaceLeaseEpoch },
      expectedExternalState: {},
      externalArguments: {},
      nowMs: 2100,
    });
    first.store.commitTransition(
      transition.id,
      first.fence.ownerId,
      first.fence.runLeaseEpoch,
      { entered: true },
      2200,
    );
    await expect(first.broker.execute(first.request, first.fence)).rejects.toThrow(
      'repair_planning',
    );
    expect(first.port.mutate).not.toHaveBeenCalled();
  });
});

describe('OfficialRepairChildPort', () => {
  it('rejects caller-forged production Beads adapter construction', async () => {
    const root = await mkdtemp(join(tmpdir(), 'repair-child-forged-port-'));
    roots.push(root);
    const fake = {} as OfficialBeadsDoltClient;
    expect(() => new OfficialBeadsDoltPort(root, fake, Symbol('forged'))).toThrow(
      'package bootstrap capability',
    );
  });

  it('captures the registered production Beads client before caller method replacement', async () => {
    let originalCalls = 0;
    let redirectedCalls = 0;
    const client: OfficialBeadsDoltClient = {
      async readIssue() {
        return { status: 'open', blockingDependencies: [] };
      },
      async claimIssue() {},
      async closeIssue() {},
      async readDoltSync() {
        return 'synced';
      },
      async pushDolt() {},
      async readRepairChild() {
        return null;
      },
      async createRepairChild() {
        originalCalls += 1;
      },
    };
    const port = createProductionBeadsDoltPort('/repo/root', client);
    client.createRepairChild = async () => {
      redirectedCalls += 1;
    };
    await port.createRepairChild(repairRequest(), 'repair-key');
    expect(originalCalls).toBe(1);
    expect(redirectedCalls).toBe(0);
  });

  it('recovers a partial Beads-child write before creating the exact chained ref', async () => {
    const root = await mkdtemp(join(tmpdir(), 'repair-child-port-'));
    roots.push(root);
    let child: OfficialRepairChildSnapshot | null = null;
    let refSha: string | null = null;
    let failRef = true;
    const client: OfficialRepairChildClient = {
      async readChild() {
        return child;
      },
      async createChild(_workspaceRoot, request) {
        child = {
          id: request.id,
          issueType: 'task',
          status: 'open',
          specId: `docs/tasks/${request.id}.md`,
          parentEpicId: request.parentEpicId,
          blockingDependencies: [request.dependsOn],
          assignedRole: request.assignedRole,
          allowedPaths: request.allowedPaths,
          allowedOperations: request.allowedOperations,
          findingDigest: request.findingDigest,
          remainingRetryBudget: request.remainingRetryBudget,
        };
      },
      async readTaskRef() {
        return refSha;
      },
      async createTaskRefCas({ expectedOldSha, newSha: parentSha }) {
        expect(expectedOldSha).toBeNull();
        if (failRef) {
          failRef = false;
          throw new Error('injected ref failure');
        }
        refSha = parentSha;
      },
    };
    const port = OfficialRepairChildPort.createForTest(root, client);
    let redirected = false;
    client.createChild = async () => {
      redirected = true;
    };
    client.createTaskRefCas = async () => {
      redirected = true;
    };
    (OfficialRepairChildPort.prototype as { mutate?: () => Promise<unknown> }).mutate =
      async () => {
        redirected = true;
        return {};
      };
    try {
      expect(Object.isFrozen(port)).toBe(true);
      await expect(port.mutate(repairRequest())).rejects.toThrow('injected ref failure');
      expect(child).not.toBeNull();
      await expect(port.mutate(repairRequest())).resolves.toMatchObject({ refSha: headSha });
      await expect(port.observe(repairRequest())).resolves.toMatchObject({ kind: 'expected' });
      expect(redirected).toBe(false);
    } finally {
      delete (OfficialRepairChildPort.prototype as { mutate?: () => Promise<unknown> }).mutate;
    }
  });

  it('uses create-only CAS and preserves a concurrently created divergent ref', async () => {
    const root = await mkdtemp(join(tmpdir(), 'repair-child-port-race-'));
    roots.push(root);
    const request = repairRequest();
    const child: OfficialRepairChildSnapshot = {
      id: request.id,
      issueType: 'task',
      status: 'open',
      specId: `docs/tasks/${request.id}.md`,
      parentEpicId: request.parentEpicId,
      blockingDependencies: [request.dependsOn],
      assignedRole: request.assignedRole,
      allowedPaths: request.allowedPaths,
      allowedOperations: request.allowedOperations,
      findingDigest: request.findingDigest,
      remainingRetryBudget: request.remainingRetryBudget,
    };
    let refSha: string | null = null;
    const client: OfficialRepairChildClient = {
      async readChild() {
        return child;
      },
      async createChild() {
        throw new Error('not used');
      },
      async readTaskRef() {
        return refSha;
      },
      async createTaskRefCas({ expectedOldSha }) {
        expect(expectedOldSha).toBeNull();
        refSha = '2'.repeat(40);
        throw new Error('create-only ref CAS failed');
      },
    };
    const port = OfficialRepairChildPort.createForTest(root, client);
    await expect(port.mutate(request)).rejects.toThrow('create-only ref CAS failed');
    expect(refSha).toBe('2'.repeat(40));
    await expect(port.observe(request)).resolves.toMatchObject({ kind: 'conflict' });
  });
});
