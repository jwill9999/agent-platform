import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DurableRepairCoordinator,
  LocalGitRepairHeadVerifier,
  WorkflowStore,
  type EvidenceReference,
  type ExecutionContract,
  type RepairFailureSource,
  type RepairHeadVerifier,
  type WorkflowRole,
} from '../src/index.js';
import { workflowRepairMutationCapability } from '../src/storage.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;
const failureHead = 'a'.repeat(40);
const repairedHead = 'b'.repeat(40);
const otherHead = 'c'.repeat(40);
const fakeHeadVerifier: RepairHeadVerifier = {
  assertCanonicalCommit(headSha) {
    if (!/^[a-f0-9]{40}$/u.test(headSha)) throw new Error('invalid test commit');
  },
  assertStrictDescendant(baseSha, candidateSha) {
    this.assertCanonicalCommit(baseSha);
    this.assertCanonicalCommit(candidateSha);
    if (baseSha === candidateSha) throw new Error('not a strict test descendant');
  },
  assertExactHead(headSha) {
    this.assertCanonicalCommit(headSha);
  },
  changedFiles() {
    return ['packages/workflow-control/src/example.ts'];
  },
};
let evidenceCreatedAtMs = 1000;

const contract: ExecutionContract = {
  featureId: 'repair-feature',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'Repair every verified failure within approved bounds',
  requirements: ['Route and bound repairs'],
  nonGoals: [],
  acceptanceCriteria: ['repair loop passes'],
  constraints: {
    architecture: [],
    security: [],
    allowedPaths: ['packages/workflow-control'],
  },
  authority: {
    deliveryTarget: 'feature/multi-agent-orchestration',
    allowedActions: ['workspace.read', 'workspace.patch', 'process.test', 'artifact.write'],
    github: {
      repository: 'example/repository',
      base: 'feature/multi-agent-orchestration',
      mergeMethod: 'squash',
      requiredChecks: [],
    },
  },
  tasks: [
    {
      id: 'repair-feature.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'implementation_worker',
      branchParent: 'task/repair-feature.0',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.read', 'workspace.patch', 'process.test'],
    },
  ],
  qualityGates: ['test'],
  retryPolicy: {
    implementationAttempts: 4,
    findingAttempts: 2,
    infrastructureAttempts: 2,
    waitDeadlineSeconds: 60,
  },
  repairTaskPolicy: {
    idPattern: 'repair-feature.repair.<sequence>',
    maxChildren: 2,
    allowedRoles: ['implementation_worker', 'test_runner'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: ['notify owner once'],
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup(overrides?: Partial<ExecutionContract['retryPolicy']>) {
  const root = await mkdtemp(join(tmpdir(), 'workflow-repair-loop-'));
  roots.push(root);
  const effectiveContract = {
    ...contract,
    retryPolicy: { ...contract.retryPolicy, ...overrides },
  };
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  const contractId = store.createContract(effectiveContract);
  const run = store.createRun(contractId, 'repair', 'run-repair');
  const ownerId = 'repair-owner';
  const fence = {
    workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, ownerId, 1000, 1000).epoch,
    runLeaseEpoch: store.acquireLease('run', run.id, ownerId, 1000, 1000).epoch,
    taskLeaseEpoch: store.acquireLease('task', 'repair-feature.1', ownerId, 1000, 1000).epoch,
  };
  return {
    root,
    database,
    store,
    run,
    ownerId,
    fence,
    contract: effectiveContract,
    coordinator: DurableRepairCoordinator.createForTest({
      store,
      contract: effectiveContract,
      ownerId,
      fence: () => fence,
      headVerifier: fakeHeadVerifier,
      clock: () => 1000,
    }),
  };
}

function evidence(character: string, kind: EvidenceReference['kind'] = 'test'): EvidenceReference {
  return {
    digest: `sha256:${character.repeat(64)}`,
    mediaType: 'text/plain',
    sizeBytes: 10,
    kind,
  };
}

function recordEvidence(
  store: WorkflowStore,
  reference: EvidenceReference,
  producerRole: WorkflowRole,
  binding: { runId?: string; taskId?: string; createdAtMs?: number; headSha?: string } = {},
): void {
  store.recordEvidence({
    ...reference,
    producer: `${producerRole}-1`,
    producerRole,
    workspaceId,
    runId: binding.runId ?? 'run-repair',
    taskId: binding.taskId ?? 'repair-feature.1',
    contractVersion: 1,
    policyDigest,
    headSha: binding.headSha ?? failureHead,
    createdAtMs: binding.createdAtMs ?? evidenceCreatedAtMs++,
  });
}

function finding(
  source: RepairFailureSource,
  producerRole: WorkflowRole,
  reference: EvidenceReference,
  id = `finding-${source}`,
) {
  return {
    id,
    runId: 'run-repair',
    taskId: 'repair-feature.1',
    source,
    producerRole,
    severity: source === 'security' ? ('critical' as const) : ('high' as const),
    summary: `seeded ${source} failure`,
    acceptanceCriterion: 'repair loop passes',
    evidence: [reference],
  };
}

function acceptedResult(reference: EvidenceReference) {
  return {
    status: 'passed' as const,
    summary: 'repair verified',
    changedFiles: ['packages/workflow-control/src/example.ts'],
    acceptanceCriteria: { passed: ['repair loop passes'], failed: [] },
    evidence: [reference],
    findings: [],
    remainingRisks: [],
    recommendedTransition: 'continue' as const,
  };
}

describe('DurableRepairCoordinator', () => {
  it('uses real Git ancestry and exact HEAD for trusted repair-head verification', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-repair-git-'));
    roots.push(root);
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git('init', '-q');
    await mkdir(join(root, 'outside'), { recursive: true });
    await mkdir(join(root, 'packages/workflow-control/src'), { recursive: true });
    await writeFile(join(root, 'fixture.txt'), 'base\n');
    await writeFile(join(root, 'outside/secret.ts'), 'outside to inside\n');
    await writeFile(join(root, 'packages/workflow-control/src/allowed.ts'), 'inside to outside\n');
    git('add', '-A');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    await rename(join(root, 'fixture.txt'), join(root, 'renamed.txt'));
    await rename(
      join(root, 'outside/secret.ts'),
      join(root, 'packages/workflow-control/src/secret.ts'),
    );
    await rename(
      join(root, 'packages/workflow-control/src/allowed.ts'),
      join(root, 'outside/moved.ts'),
    );
    await writeFile(join(root, 'renamed.txt'), 'descendant\n');
    await writeFile(join(root, 'line\nbreak.ts'), 'nul-delimited path\n');
    git('add', '-A');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'descendant');
    const descendant = git('rev-parse', 'HEAD');
    const tree = git('rev-parse', 'HEAD^{tree}');
    const unrelated = execFileSync('git', ['commit-tree', tree], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
      input: 'unrelated\n',
    }).trim();
    const verifier = new LocalGitRepairHeadVerifier(root);
    const previousGitDir = process.env.GIT_DIR;
    try {
      process.env.GIT_DIR = join(root, 'redirected-git-dir');
      expect(() => verifier.assertWorkspaceRoot(realpathSync(root))).not.toThrow();
    } finally {
      if (previousGitDir === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previousGitDir;
    }
    expect(() => verifier.assertStrictDescendant(base, descendant)).not.toThrow();
    expect(new Set(verifier.changedFiles(base, descendant))).toEqual(
      new Set([
        'fixture.txt',
        'renamed.txt',
        'line\nbreak.ts',
        'outside/secret.ts',
        'packages/workflow-control/src/secret.ts',
        'packages/workflow-control/src/allowed.ts',
        'outside/moved.ts',
      ]),
    );
    expect(() => verifier.assertExactHead(descendant)).not.toThrow();
    expect(() => verifier.assertStrictDescendant(descendant, base)).toThrow('not a descendant');
    expect(() => verifier.assertStrictDescendant(base, unrelated)).toThrow('not a descendant');
    expect(() => verifier.assertStrictDescendant(base, base)).toThrow('does not advance');
    expect(() => verifier.assertCanonicalCommit('abc123')).toThrow('full SHA');
    expect(() => verifier.assertExactHead(base)).toThrow('not at exact HEAD');
    await writeFile(join(root, 'renamed.txt'), 'dirty\n');
    expect(() => verifier.assertExactHead(descendant)).toThrow('clean exact HEAD');
    const timedOut = new LocalGitRepairHeadVerifier(root, () => {
      throw new Error('simulated timeout');
    });
    expect(() => timedOut.assertCanonicalCommit(descendant)).toThrow('failed or timed out');
    let headReads = 0;
    const raced = new LocalGitRepairHeadVerifier(root, (args) => {
      if (args[0] === 'rev-parse' && args[1] === '--verify') return `${descendant}\n`;
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        headReads += 1;
        return `${headReads === 1 ? descendant : base}\n`;
      }
      if (args[0] === 'status') return '';
      throw new Error('unexpected controlled Git command');
    });
    expect(() => raced.assertExactHead(descendant)).toThrow('changed during verification');
  });

  it('locks production construction to the contract workspace and the concrete verifier', async () => {
    const { root, store, contract: effectiveContract, ownerId, fence } = await setup();
    expect(() =>
      DurableRepairCoordinator.create({
        store,
        contract: effectiveContract,
        ownerId,
        fence: () => fence,
        workspaceRoot: root,
      }),
    ).toThrow('workspace root does not match');
    const previousNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() =>
        DurableRepairCoordinator.createForTest({
          store,
          contract: effectiveContract,
          ownerId,
          fence: () => fence,
          headVerifier: fakeHeadVerifier,
        }),
      ).toThrow('restricted to tests');
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
    store.close();
  });

  it.each([
    ['compile', 'test_runner'],
    ['test', 'test_runner'],
    ['review', 'code_reviewer'],
    ['security', 'code_reviewer'],
    ['sonar', 'code_reviewer'],
    ['qa', 'qa_evaluator'],
    ['evaluator', 'feature_evaluator'],
  ] as const)(
    'routes seeded %s failures to the implementation owner',
    async (source, producerRole) => {
      const { store, coordinator } = await setup();
      const reference = evidence('c');
      recordEvidence(store, reference, producerRole);
      store.recordAttempt({
        runId: 'run-repair',
        scope: 'task',
        scopeId: 'repair-feature.1',
        maxAttempts: 4,
        hypothesis: 'initial implementation',
      });

      const decision = coordinator.dispatch({
        dispatchId: `dispatch-${source}`,
        finding: finding(source, producerRole, reference),
        hypothesis: `repair ${source}`,
        change: { kind: 'hypothesis', value: `repair ${source}` },
      });

      expect(decision).toMatchObject({
        kind: 'dispatch',
        dispatch: { ownerRole: 'implementation_worker', taskAttempt: 2, findingAttempt: 1 },
        packet: {
          source,
          producerRole,
          ownerRole: 'implementation_worker',
          remainingBudget: { task: 2, finding: 1 },
          evidence: [reference],
        },
      });
      store.close();
    },
  );

  it('routes test-definition and environment failures to their non-code owners', async () => {
    const { store, coordinator } = await setup();
    const reviewEvidence = evidence('d', 'review');
    const environmentEvidence = evidence('e', 'external');
    const testChangeEvidence = evidence('7', 'test');
    const environmentChangeEvidence = evidence('8', 'artifact');
    recordEvidence(store, reviewEvidence, 'code_reviewer');
    recordEvidence(store, environmentEvidence, 'test_runner');
    recordEvidence(store, testChangeEvidence, 'test_runner', { headSha: repairedHead });
    recordEvidence(store, environmentChangeEvidence, 'workflow_orchestrator', {
      headSha: repairedHead,
    });
    const testDefinition = coordinator.dispatch({
      dispatchId: 'dispatch-test-definition',
      finding: finding('test_definition', 'code_reviewer', reviewEvidence),
      hypothesis: 'the assertion is incorrect',
      change: { kind: 'test', evidence: [testChangeEvidence] },
    });
    const environment = coordinator.dispatch({
      dispatchId: 'dispatch-environment',
      finding: finding('environment', 'test_runner', environmentEvidence),
      hypothesis: 'the runner image is stale',
      change: { kind: 'environment', evidence: [environmentChangeEvidence] },
    });
    expect(testDefinition).toMatchObject({
      kind: 'dispatch',
      dispatch: { ownerRole: 'test_runner' },
    });
    expect(environment).toMatchObject({
      kind: 'dispatch',
      dispatch: { ownerRole: 'workflow_orchestrator' },
    });
    store.close();
  });

  it('rejects an invalid producer role and unrecorded evidence', async () => {
    const { store, coordinator } = await setup();
    const reference = evidence('f');
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-wrong-producer',
        finding: finding('review', 'test_runner', reference),
        hypothesis: 'repair review',
        change: { kind: 'hypothesis', value: 'repair review' },
      }),
    ).toThrow('requires producer role');
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-unrecorded',
        finding: finding('test', 'test_runner', reference),
        hypothesis: 'repair test',
        change: { kind: 'hypothesis', value: 'repair test' },
      }),
    ).toThrow('unbound producer evidence');
    store.close();
  });

  it('rejects cross-run, cross-task, and wrong-producer evidence bindings', async () => {
    const { store, coordinator } = await setup();
    const contractId = store.createContract(contract);
    store.createRun(contractId, 'repair', 'other-run');
    const crossRun = evidence('9');
    const crossTask = evidence('a');
    const wrongProducer = evidence('b');
    const exactEvidence = evidence('c');
    recordEvidence(store, crossRun, 'code_reviewer', { runId: 'other-run' });
    recordEvidence(store, crossTask, 'code_reviewer', { taskId: 'other-task' });
    recordEvidence(store, wrongProducer, 'implementation_worker');
    recordEvidence(store, exactEvidence, 'code_reviewer');
    for (const [id, reference] of [
      ['cross-run', crossRun],
      ['cross-task', crossTask],
      ['wrong-producer', wrongProducer],
      ['wrong-metadata', { ...exactEvidence, sizeBytes: exactEvidence.sizeBytes + 1 }],
    ] as const) {
      expect(() =>
        coordinator.dispatch({
          dispatchId: `dispatch-${id}`,
          finding: finding('review', 'code_reviewer', reference, `finding-${id}`),
          hypothesis: `repair ${id}`,
          change: { kind: 'hypothesis', value: `repair ${id}` },
        }),
      ).toThrow('unbound producer evidence');
    }
    store.close();
  });

  it('rejects ambiguous failure baselines before charging repair budget', async () => {
    const { store, coordinator } = await setup();
    const first = evidence('6', 'review');
    const second = evidence('7', 'review');
    recordEvidence(store, first, 'code_reviewer', { headSha: failureHead });
    recordEvidence(store, second, 'code_reviewer', { headSha: otherHead });
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-ambiguous-baseline',
        finding: {
          ...finding('review', 'code_reviewer', first, 'finding-ambiguous-baseline'),
          evidence: [first, second],
        },
        hypothesis: 'repair ambiguous baseline',
        change: { kind: 'hypothesis', value: 'repair ambiguous baseline' },
      }),
    ).toThrow('one canonical failure head');
    store.close();
  });

  it('uses one canonical hypothesis and compares the first repair with the failed attempt', async () => {
    const { store, coordinator } = await setup();
    const reference = evidence('0');
    recordEvidence(store, reference, 'test_runner');
    const seededFinding = finding('test', 'test_runner', reference);
    store.recordAttempt({
      runId: 'run-repair',
      scope: 'task',
      scopeId: 'repair-feature.1',
      maxAttempts: 4,
      hypothesis: 'unchanged hypothesis ',
    });
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-decorative-hypothesis',
        finding: seededFinding,
        hypothesis: 'unchanged hypothesis',
        change: { kind: 'hypothesis', value: 'decorative different value' },
      }),
    ).toThrow('canonical attempt hypothesis');
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-unchanged-initial',
        finding: seededFinding,
        hypothesis: 'unchanged hypothesis',
        change: { kind: 'hypothesis', value: 'unchanged hypothesis' },
      }),
    ).toThrow('changed hypothesis');
    store.close();
  });

  it('requires evidence-based changes to advance monotonically beyond the failure baseline', async () => {
    const { store, coordinator } = await setup();
    const failureEvidence = evidence('7');
    const staleChange = evidence('8', 'artifact');
    const newChange = evidence('9', 'artifact');
    const historicAlternate = evidence('a', 'artifact');
    const futureAlternate = evidence('b', 'artifact');
    const emptyHeadChange = evidence('c', 'artifact');
    recordEvidence(store, failureEvidence, 'feature_evaluator', { createdAtMs: 100 });
    recordEvidence(store, staleChange, 'implementation_worker', {
      createdAtMs: 99,
      headSha: repairedHead,
    });
    recordEvidence(store, newChange, 'implementation_worker', {
      createdAtMs: 200,
      headSha: repairedHead,
    });
    recordEvidence(store, historicAlternate, 'implementation_worker', {
      createdAtMs: 150,
      headSha: repairedHead,
    });
    recordEvidence(store, futureAlternate, 'implementation_worker', {
      createdAtMs: 300,
      headSha: repairedHead,
    });
    recordEvidence(store, emptyHeadChange, 'implementation_worker', {
      createdAtMs: 250,
      headSha: '',
    });
    const seededFinding = finding('evaluator', 'feature_evaluator', failureEvidence);
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-stale-change',
        finding: seededFinding,
        hypothesis: 'apply an old artifact',
        change: { kind: 'implementation', evidence: [staleChange] },
      }),
    ).toThrow('newer changed condition');
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-mixed-empty-head',
        finding: seededFinding,
        hypothesis: 'mix bound and unbound heads',
        change: { kind: 'implementation', evidence: [emptyHeadChange, futureAlternate] },
      }),
    ).toThrow('nonempty repaired head');
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-all-empty-head',
        finding: seededFinding,
        hypothesis: 'use only an empty head',
        change: { kind: 'implementation', evidence: [emptyHeadChange] },
      }),
    ).toThrow('nonempty repaired head');
    expect(
      coordinator.dispatch({
        dispatchId: 'dispatch-new-change',
        finding: seededFinding,
        hypothesis: 'apply a new implementation',
        change: { kind: 'implementation', evidence: [newChange] },
      }),
    ).toMatchObject({ kind: 'dispatch' });
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-historic-alternate',
        finding: seededFinding,
        hypothesis: 'alternate to historic implementation',
        change: { kind: 'implementation', evidence: [historicAlternate] },
      }),
    ).toThrow('newer changed condition');
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-mixed-history',
        finding: seededFinding,
        hypothesis: 'mix historic and future implementation',
        change: { kind: 'implementation', evidence: [historicAlternate, futureAlternate] },
      }),
    ).toThrow('newer changed condition');
    recordEvidence(store, historicAlternate, 'implementation_worker', {
      createdAtMs: 400,
      headSha: otherHead,
    });
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-rebound-history',
        finding: seededFinding,
        hypothesis: 'rebind historic implementation',
        change: { kind: 'implementation', evidence: [historicAlternate] },
      }),
    ).toThrow('newer changed condition');
    store.close();
  });

  it('rejects an unapproved acceptance criterion before consuming budget', async () => {
    const { store, coordinator } = await setup();
    const reference = evidence('1', 'review');
    recordEvidence(store, reference, 'code_reviewer');
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-unknown-criterion',
        finding: {
          ...finding('review', 'code_reviewer', reference),
          acceptanceCriterion: 'not approved',
        },
        hypothesis: 'repair unknown criterion',
        change: { kind: 'hypothesis', value: 'repair unknown criterion' },
      }),
    ).toThrow('unapproved acceptance criterion');
    expect(
      coordinator.dispatch({
        dispatchId: 'dispatch-after-unknown-criterion',
        finding: finding('review', 'code_reviewer', reference),
        hypothesis: 'repair approved criterion',
        change: { kind: 'hypothesis', value: 'repair approved criterion' },
      }),
    ).toMatchObject({ kind: 'dispatch', dispatch: { taskAttempt: 1, findingAttempt: 1 } });
    store.close();
  });

  it('rejects identical retries and escalates a finding exactly once after its budget', async () => {
    const { store, coordinator } = await setup();
    const reference = evidence('1');
    recordEvidence(store, reference, 'test_runner');
    const seededFinding = finding('test', 'test_runner', reference);
    const first = coordinator.dispatch({
      dispatchId: 'dispatch-1',
      finding: seededFinding,
      hypothesis: 'first repair',
      change: { kind: 'hypothesis', value: 'first repair' },
    });
    expect(first).toMatchObject({ kind: 'dispatch', dispatch: { findingAttempt: 1 } });
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-identical',
        finding: seededFinding,
        hypothesis: 'first repair',
        change: { kind: 'hypothesis', value: 'first repair' },
      }),
    ).toThrow('identical repair retry');
    expect(
      coordinator.dispatch({
        dispatchId: 'dispatch-2',
        finding: seededFinding,
        hypothesis: 'second repair',
        change: { kind: 'hypothesis', value: 'second repair' },
      }),
    ).toMatchObject({ kind: 'dispatch', dispatch: { findingAttempt: 2 } });

    const escalated = coordinator.dispatch({
      dispatchId: 'dispatch-3',
      finding: seededFinding,
      hypothesis: 'third repair',
      change: { kind: 'hypothesis', value: 'third repair' },
    });
    const repeated = coordinator.dispatch({
      dispatchId: 'dispatch-4',
      finding: seededFinding,
      hypothesis: 'fourth repair',
      change: { kind: 'hypothesis', value: 'fourth repair' },
    });
    expect(escalated).toMatchObject({
      kind: 'escalated',
      escalation: { scope: 'finding', findingId: seededFinding.id },
    });
    expect(repeated).toEqual(escalated);
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-mutated-escalation',
        finding: { ...seededFinding, summary: 'mutated after escalation' },
        hypothesis: 'fifth repair',
        change: { kind: 'hypothesis', value: 'fifth repair' },
      }),
    ).toThrow('different immutable input');
    store.close();
  });

  it('shares the task budget across findings and emits one task escalation', async () => {
    const { store, coordinator } = await setup({ implementationAttempts: 1 });
    const firstEvidence = evidence('2');
    const secondEvidence = evidence('3');
    recordEvidence(store, firstEvidence, 'code_reviewer');
    recordEvidence(store, secondEvidence, 'qa_evaluator');
    expect(
      coordinator.dispatch({
        dispatchId: 'dispatch-task-budget-1',
        finding: finding('review', 'code_reviewer', firstEvidence, 'finding-review-budget'),
        hypothesis: 'repair review',
        change: { kind: 'hypothesis', value: 'repair review' },
      }),
    ).toMatchObject({ kind: 'dispatch', dispatch: { taskAttempt: 1 } });
    const escalated = coordinator.dispatch({
      dispatchId: 'dispatch-task-budget-2',
      finding: finding('qa', 'qa_evaluator', secondEvidence, 'finding-qa-budget'),
      hypothesis: 'repair qa',
      change: { kind: 'hypothesis', value: 'repair qa' },
    });
    const repeated = coordinator.dispatch({
      dispatchId: 'dispatch-task-budget-3',
      finding: finding('qa', 'qa_evaluator', secondEvidence, 'finding-qa-budget'),
      hypothesis: 'repair qa differently',
      change: { kind: 'hypothesis', value: 'repair qa differently' },
    });
    expect(escalated).toMatchObject({
      kind: 'escalated',
      escalation: { scope: 'task', scopeId: 'repair-feature.1' },
    });
    expect(repeated).toEqual(escalated);
    store.close();
  });

  it('accepts only criterion-proving, in-scope results with task-bound verifier evidence', async () => {
    const { store, coordinator } = await setup();
    const failureEvidence = evidence('d', 'review');
    const preRepairEvidence = evidence('e');
    const verifierEvidence = evidence('0');
    const otherHeadEvidence = evidence('1');
    const unrelatedEvidence = evidence('f');
    recordEvidence(store, failureEvidence, 'code_reviewer');
    recordEvidence(store, preRepairEvidence, 'code_reviewer', { createdAtMs: 900 });
    recordEvidence(store, unrelatedEvidence, 'test_runner', { taskId: 'other-task' });
    coordinator.dispatch({
      dispatchId: 'dispatch-acceptance-boundary',
      finding: finding('review', 'code_reviewer', failureEvidence, 'finding-acceptance'),
      hypothesis: 'repair the reviewed defect',
      change: { kind: 'hypothesis', value: 'repair the reviewed defect' },
    });
    expect(() =>
      coordinator.accept('dispatch-acceptance-boundary', acceptedResult(preRepairEvidence)),
    ).toThrow('predates');
    recordEvidence(store, verifierEvidence, 'code_reviewer', {
      createdAtMs: 1100,
      headSha: repairedHead,
    });
    recordEvidence(store, otherHeadEvidence, 'code_reviewer', {
      createdAtMs: 1101,
      headSha: otherHead,
    });
    const valid = acceptedResult(verifierEvidence);
    expect(() =>
      coordinator.accept('dispatch-acceptance-boundary', {
        ...valid,
        acceptanceCriteria: { passed: [], failed: [] },
      }),
    ).toThrow('affected acceptance criterion');
    expect(() =>
      coordinator.accept('dispatch-acceptance-boundary', {
        ...valid,
        changedFiles: ['outside/authority.ts'],
      }),
    ).toThrow('trusted Git diff');
    expect(() =>
      coordinator.accept('dispatch-acceptance-boundary', {
        ...valid,
        recommendedTransition: 'escalate',
      }),
    ).toThrow('not accepted');
    expect(() =>
      coordinator.accept('dispatch-acceptance-boundary', {
        ...valid,
        evidence: [unrelatedEvidence],
      }),
    ).toThrow('unbound verifier evidence');
    expect(() =>
      coordinator.accept('dispatch-acceptance-boundary', {
        ...valid,
        evidence: [verifierEvidence, otherHeadEvidence],
      }),
    ).toThrow('one repaired head');
    expect(coordinator.accept('dispatch-acceptance-boundary', valid).status).toBe('accepted');
    expect(() =>
      coordinator.accept('dispatch-acceptance-boundary', { ...valid, summary: 'different result' }),
    ).toThrow('immutable');
    store.close();
  });

  it.each([
    {
      name: 'omitted file',
      observed: [
        'packages/workflow-control/src/example.ts',
        'packages/workflow-control/src/omitted.ts',
      ],
      reported: ['packages/workflow-control/src/example.ts'],
      message: 'do not match',
    },
    {
      name: 'invented file',
      observed: ['packages/workflow-control/src/example.ts'],
      reported: [
        'packages/workflow-control/src/example.ts',
        'packages/workflow-control/src/invented.ts',
      ],
      message: 'do not match',
    },
    {
      name: 'out-of-authority file',
      observed: ['outside/authority.ts'],
      reported: ['outside/authority.ts'],
      message: 'exceeds task authority',
    },
  ])('rejects a trusted Git diff with an $name', async ({ observed, reported, message }) => {
    const { store, contract: effectiveContract, ownerId, fence } = await setup();
    const headVerifier: RepairHeadVerifier = {
      ...fakeHeadVerifier,
      changedFiles: () => observed,
    };
    const coordinator = DurableRepairCoordinator.createForTest({
      store,
      contract: effectiveContract,
      ownerId,
      fence: () => fence,
      headVerifier,
      clock: () => 1000,
    });
    const failureEvidence = evidence('2');
    const verifierEvidence = evidence('3');
    recordEvidence(store, failureEvidence, 'test_runner', { createdAtMs: 900 });
    coordinator.dispatch({
      dispatchId: `dispatch-diff-${message}-${reported.length}`,
      finding: finding('test', 'test_runner', failureEvidence, `finding-diff-${message}`),
      hypothesis: `repair ${message}`,
      change: { kind: 'hypothesis', value: `repair ${message}` },
    });
    recordEvidence(store, verifierEvidence, 'test_runner', {
      createdAtMs: 1100,
      headSha: repairedHead,
    });
    expect(() =>
      coordinator.accept('dispatch-diff-' + message + '-' + reported.length, {
        ...acceptedResult(verifierEvidence),
        changedFiles: reported,
      }),
    ).toThrow(message);
    store.close();
  });

  it('fences dispatch, acceptance, and cancellation to the current orchestrator owner', async () => {
    const { store, coordinator, contract: effectiveContract } = await setup();
    const failureEvidence = evidence('2');
    const verifierEvidence = evidence('3');
    recordEvidence(store, failureEvidence, 'test_runner', { createdAtMs: 900 });
    coordinator.dispatch({
      dispatchId: 'dispatch-fenced',
      finding: finding('test', 'test_runner', failureEvidence, 'finding-fenced'),
      hypothesis: 'repair under owner one',
      change: { kind: 'hypothesis', value: 'repair under owner one' },
    });
    recordEvidence(store, verifierEvidence, 'test_runner', {
      createdAtMs: 1100,
      headSha: repairedHead,
    });

    const ownerId = 'repair-owner-two';
    const fence = {
      workspaceLeaseEpoch: store.acquireLease('workspace', workspaceId, ownerId, 1000, 2001).epoch,
      runLeaseEpoch: store.acquireLease('run', 'run-repair', ownerId, 1000, 2001).epoch,
      taskLeaseEpoch: store.acquireLease('task', 'repair-feature.1', ownerId, 1000, 2001).epoch,
    };
    expect(() => coordinator.cancel('dispatch-fenced', 'stale owner')).toThrow(
      'stale or expired workspace',
    );
    expect(() => coordinator.accept('dispatch-fenced', acceptedResult(verifierEvidence))).toThrow(
      'stale or expired workspace',
    );
    expect(() =>
      coordinator.dispatch({
        dispatchId: 'dispatch-stale-owner',
        finding: finding('test', 'test_runner', failureEvidence, 'finding-stale-owner'),
        hypothesis: 'stale owner retry',
        change: { kind: 'hypothesis', value: 'stale owner retry' },
      }),
    ).toThrow('stale or expired workspace');

    const current = DurableRepairCoordinator.createForTest({
      store,
      contract: effectiveContract,
      ownerId,
      fence: () => fence,
      headVerifier: fakeHeadVerifier,
      clock: () => 2001,
    });
    expect(current.cancel('dispatch-fenced', 'current owner').status).toBe('cancelled');
    store.close();
  });

  it('rejects repair mutation when the orchestrator leases have expired', async () => {
    const { store, contract: effectiveContract, fence } = await setup();
    const expired = DurableRepairCoordinator.createForTest({
      store,
      contract: effectiveContract,
      ownerId: 'repair-owner',
      fence: () => fence,
      headVerifier: fakeHeadVerifier,
      clock: () => 2000,
    });
    const reference = evidence('4');
    recordEvidence(store, reference, 'qa_evaluator', { createdAtMs: 900 });
    expect(() =>
      expired.dispatch({
        dispatchId: 'dispatch-expired',
        finding: finding('qa', 'qa_evaluator', reference, 'finding-expired'),
        hypothesis: 'expired repair',
        change: { kind: 'hypothesis', value: 'expired repair' },
      }),
    ).toThrow('stale or expired workspace');
    store.close();
  });

  it('rechecks lease expiry after exact-head verification and before acceptance', async () => {
    const { store, contract: effectiveContract, ownerId, fence } = await setup();
    let nowMs = 1000;
    const expiringVerifier: RepairHeadVerifier = {
      ...fakeHeadVerifier,
      assertExactHead(headSha) {
        fakeHeadVerifier.assertExactHead(headSha);
        nowMs = 2000;
      },
    };
    const coordinator = DurableRepairCoordinator.createForTest({
      store,
      contract: effectiveContract,
      ownerId,
      fence: () => fence,
      headVerifier: expiringVerifier,
      clock: () => nowMs,
    });
    const failureEvidence = evidence('4');
    const verifierEvidence = evidence('5');
    recordEvidence(store, failureEvidence, 'test_runner', { createdAtMs: 900 });
    coordinator.dispatch({
      dispatchId: 'dispatch-expires-during-verification',
      finding: finding('test', 'test_runner', failureEvidence, 'finding-expiring-verification'),
      hypothesis: 'repair before the lease expires',
      change: { kind: 'hypothesis', value: 'repair before the lease expires' },
    });
    recordEvidence(store, verifierEvidence, 'test_runner', {
      createdAtMs: 1100,
      headSha: repairedHead,
    });
    expect(() =>
      coordinator.accept('dispatch-expires-during-verification', acceptedResult(verifierEvidence)),
    ).toThrow('stale or expired workspace');
    expect(store.getRepairDispatch('dispatch-expires-during-verification')?.status).toBe(
      'dispatched',
    );
    store.close();
  });

  it('rejects a backward-moving injected test clock', async () => {
    const { store, contract: effectiveContract, ownerId, fence } = await setup();
    let nowMs = 1000;
    const coordinator = DurableRepairCoordinator.createForTest({
      store,
      contract: effectiveContract,
      ownerId,
      fence: () => fence,
      headVerifier: fakeHeadVerifier,
      clock: () => nowMs,
    });
    const reference = evidence('6');
    recordEvidence(store, reference, 'qa_evaluator', { createdAtMs: 900 });
    coordinator.dispatch({
      dispatchId: 'dispatch-backward-clock',
      finding: finding('qa', 'qa_evaluator', reference, 'finding-backward-clock'),
      hypothesis: 'repair before clock regression',
      change: { kind: 'hypothesis', value: 'repair before clock regression' },
    });
    nowMs = 999;
    expect(() => coordinator.cancel('dispatch-backward-clock', 'clock regressed')).toThrow(
      'clock moved backwards',
    );
    expect(store.getRepairDispatch('dispatch-backward-clock')?.status).toBe('dispatched');
    store.close();
  });

  it('rejects an unrelated workspace fence at every direct storage mutation boundary', async () => {
    const { store, coordinator, ownerId, fence } = await setup();
    const unrelatedWorkspaceId = `sha256:${'d'.repeat(64)}`;
    const unrelatedWorkspaceLeaseEpoch = store.acquireLease(
      'workspace',
      unrelatedWorkspaceId,
      ownerId,
      1000,
      1000,
    ).epoch;
    expect(() =>
      store.planRepairDispatch(
        {
          id: 'direct-invalid-workspace',
          runId: 'run-repair',
          taskId: 'repair-feature.1',
          findingId: 'finding-direct-invalid-workspace',
          ownerRole: 'implementation_worker',
          findingDigest: `sha256:${'e'.repeat(64)}`,
          failureHeadSha: failureHead,
          hypothesis: 'direct invalid workspace',
          requiresHypothesisChange: true,
          changeDigest: `sha256:${'f'.repeat(64)}`,
          changeEvidenceMinAtMs: null,
          changeEvidenceAtMs: null,
          changeHeadSha: null,
          failureEvidenceAtMs: 900,
          packet: () => ({}),
          maxTaskAttempts: 4,
          maxFindingAttempts: 2,
          escalationReport: () => ({}),
          workspaceId: unrelatedWorkspaceId,
          ownerId,
          workspaceLeaseEpoch: unrelatedWorkspaceLeaseEpoch,
          runLeaseEpoch: fence.runLeaseEpoch,
          taskLeaseEpoch: fence.taskLeaseEpoch,
          nowMs: 1000,
        },
        workflowRepairMutationCapability,
      ),
    ).toThrow('workspace does not match');

    const reference = evidence('5');
    recordEvidence(store, reference, 'test_runner', { createdAtMs: 900 });
    coordinator.dispatch({
      dispatchId: 'dispatch-direct-boundary',
      finding: finding('test', 'test_runner', reference, 'finding-direct-boundary'),
      hypothesis: 'create direct boundary fixture',
      change: { kind: 'hypothesis', value: 'create direct boundary fixture' },
    });
    const mutationFence = {
      workspaceId: unrelatedWorkspaceId,
      ownerId,
      workspaceLeaseEpoch: unrelatedWorkspaceLeaseEpoch,
      runLeaseEpoch: fence.runLeaseEpoch,
      taskLeaseEpoch: fence.taskLeaseEpoch,
      nowMs: 1000,
    };
    expect(() =>
      store.cancelRepairDispatch({
        id: 'dispatch-direct-boundary',
        reason: {},
        ...mutationFence,
      }),
    ).toThrow('coordinator capability');
    expect(() =>
      store.acceptRepairDispatch({
        id: 'dispatch-direct-boundary',
        result: {},
        assertExternalState: () => undefined,
        workspaceId,
        ownerId,
        workspaceLeaseEpoch: fence.workspaceLeaseEpoch,
        runLeaseEpoch: fence.runLeaseEpoch,
        taskLeaseEpoch: fence.taskLeaseEpoch,
        clock: () => 1000,
      }),
    ).toThrow('coordinator capability');
    expect(() =>
      store.acceptRepairDispatch(
        {
          id: 'dispatch-direct-boundary',
          result: {},
          assertExternalState: () => undefined,
          workspaceId: unrelatedWorkspaceId,
          ownerId,
          workspaceLeaseEpoch: unrelatedWorkspaceLeaseEpoch,
          runLeaseEpoch: fence.runLeaseEpoch,
          taskLeaseEpoch: fence.taskLeaseEpoch,
          clock: () => 1000,
        },
        workflowRepairMutationCapability,
      ),
    ).toThrow('workspace does not match');
    expect(() =>
      store.cancelRepairDispatch(
        {
          id: 'dispatch-direct-boundary',
          reason: {},
          ...mutationFence,
        },
        workflowRepairMutationCapability,
      ),
    ).toThrow('workspace does not match');
    store.close();
  });

  it('preserves an accepted repair across cancellation and database recovery', async () => {
    const { database, store, contract: effectiveContract, coordinator } = await setup();
    const failureEvidence = evidence('4');
    const changedEvidence = evidence('5', 'artifact');
    const acceptanceEvidence = evidence('6');
    recordEvidence(store, failureEvidence, 'feature_evaluator', { createdAtMs: 900 });
    recordEvidence(store, changedEvidence, 'implementation_worker', {
      createdAtMs: 950,
      headSha: repairedHead,
    });
    const decision = coordinator.dispatch({
      dispatchId: 'dispatch-accepted',
      finding: finding('evaluator', 'feature_evaluator', failureEvidence),
      hypothesis: 'implementation misses evaluated behavior',
      change: { kind: 'implementation', evidence: [changedEvidence] },
    });
    expect(decision).toMatchObject({ kind: 'dispatch' });
    recordEvidence(store, acceptanceEvidence, 'feature_evaluator', {
      createdAtMs: 1100,
      headSha: repairedHead,
    });
    const accepted = coordinator.accept('dispatch-accepted', acceptedResult(acceptanceEvidence));
    expect(accepted.status).toBe('accepted');
    expect(coordinator.cancel('dispatch-accepted', 'late cancellation').status).toBe('accepted');
    store.close();

    const recoveredStore = new WorkflowStore(database);
    const recovered = DurableRepairCoordinator.createForTest({
      store: recoveredStore,
      contract: effectiveContract,
      ownerId: 'repair-owner',
      fence: () => ({ workspaceLeaseEpoch: 1, runLeaseEpoch: 1, taskLeaseEpoch: 1 }),
      headVerifier: fakeHeadVerifier,
      clock: () => 1000,
    }).recover('dispatch-accepted');
    expect(recovered).toMatchObject({
      status: 'accepted',
      result: { status: 'passed', evidence: [acceptanceEvidence] },
    });
    recoveredStore.close();
  });
});
