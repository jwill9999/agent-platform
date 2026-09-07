import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BootstrapCoordinator, bootstrapPreflight, type BootstrapFault } from '../src/bootstrap.js';
import { BootstrapJournal } from '../src/bootstrapJournal.js';
import { LocalGitDeliveryPort } from '../src/gitDeliveryPort.js';
import {
  bootstrapDigest,
  bootstrapPolicySchema,
  observeBootstrapCandidate,
  type BootstrapPolicy,
} from '../src/bootstrapPolicy.js';
import { WorkflowStore, workflowDeliveryMutationCapability } from '../src/storage.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import {
  evidenceReferenceSchema,
  executionContractSchema,
  type ExecutionContract,
} from '../src/contracts.js';
import { ContentAddressedArtifactStore, JournaledArtifactRecorder } from '../src/artifacts.js';

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function git(root: string, args: string[]): string {
  return execFileSync('/usr/bin/git', ['-C', root, ...args], {
    encoding: 'utf8',
    env: {
      PATH: '/usr/bin:/bin',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
    },
  }).trim();
}
function digest(content: Uint8Array | string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}
async function fixture(changePolicy?: (policy: BootstrapPolicy) => void) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bootstrap-')));
  roots.push(root);
  const canonical = join(root, 'canonical');
  mkdirSync(canonical);
  git(canonical, ['init', '-q']);
  mkdirSync(join(canonical, 'packages/workflow-control'), { recursive: true });
  writeFileSync(join(canonical, 'packages/workflow-control/value.txt'), 'before\n');
  git(canonical, ['add', '.']);
  git(canonical, ['commit', '-qm', 'base']);
  const initial = git(canonical, ['rev-parse', 'HEAD']);
  const source = join(root, 'source');
  git(canonical, ['worktree', 'add', '-q', '-b', 'task/bootstrap.task', source]);
  writeFileSync(join(canonical, 'owner-note.txt'), 'not task content');
  writeFileSync(join(source, 'packages/workflow-control/value.txt'), 'after\n');
  const remote = join(root, 'remote.git');
  mkdirSync(remote);
  git(remote, ['init', '--bare', '-q']);
  git(canonical, ['remote', 'add', 'origin', remote]);
  const beads = {
    id: 'bootstrap.task',
    status: 'in_progress',
    notes: 'unchanged',
    dependencies: [],
  };
  const beadsPath = join(root, 'beads.json');
  writeFileSync(beadsPath, JSON.stringify(beads));
  const adapter = join(root, 'adapter.mjs');
  writeFileSync(
    adapter,
    `#!${process.execPath}\nimport {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';const r=JSON.parse(readFileSync(0,'utf8'));let out;if(r.kind==='beads.read')out=JSON.parse(readFileSync(${JSON.stringify(beadsPath)},'utf8'));else if(r.kind==='git.observe_ref'){let raw=execFileSync('/usr/bin/git',['ls-remote','--refs',r.remoteUrl,r.ref],{encoding:'utf8'}).trim();out={sha:raw?raw.split(/\\s+/)[0]:null};}else if(r.kind==='git.push'){execFileSync('/usr/bin/git',['-C',r.workspaceRoot,'push',r.remoteUrl,r.newSha+':'+r.ref,'--force-with-lease='+r.ref+':'+(r.expectedOldSha??'')],{stdio:'pipe'});out={sha:r.newSha};}else throw Error('unknown operation');process.stdout.write(JSON.stringify(out));\n`,
    { mode: 0o700 },
  );
  const testContent = Buffer.from('fixture test command exited zero');
  const reviewContent = Buffer.from('fixture independent review passed');
  const evidence = [
    {
      digest: digest(testContent),
      mediaType: 'text/plain',
      sizeBytes: testContent.length,
      kind: 'test' as const,
      producer: 'fixture-tester',
      producerRole: 'test_runner' as const,
      candidateTreeSha: 'a'.repeat(40),
    },
    {
      digest: digest(reviewContent),
      mediaType: 'text/plain',
      sizeBytes: reviewContent.length,
      kind: 'review' as const,
      producer: 'fixture-reviewer',
      producerRole: 'code_reviewer' as const,
      candidateTreeSha: 'a'.repeat(40),
    },
  ];
  const policy: BootstrapPolicy = {
    kind: 'bootstrap_task_artifact',
    canonicalRoot: canonical,
    sourceRoot: source,
    gitCommonDirectory: join(canonical, '.git'),
    repository: 'owner/repo',
    taskId: 'bootstrap.task',
    ref: 'refs/heads/task/bootstrap.task',
    initialHeadSha: initial,
    treeSha: 'a'.repeat(40),
    diffDigest: `sha256:${'b'.repeat(64)}`,
    diffFormat: 'name-status-z-no-renames',
    manifest: [
      { path: 'packages/workflow-control/value.txt', digest: digest('after\n'), mode: '100644' },
    ],
    remoteName: 'origin',
    remoteUrl: remote,
    expectedRemoteSha: null,
    adapters: {
      remoteBinary: adapter,
      remoteBinaryDigest: digest(readFileSync(adapter)),
      beadsReadBinary: adapter,
      beadsReadBinaryDigest: digest(readFileSync(adapter)),
    },
    author: {
      name: 'Fixture',
      email: 'fixture@example.com',
      authoredAtUnix: 1700000000,
      message: 'bootstrap.task fix fixture',
    },
    beadsSnapshot: beads,
    evidence,
    allowedPaths: ['packages/workflow-control'],
    prohibitedActions: ['beads.mutate', 'github.deliver', 'notification.approval'],
  };
  const observed = observeBootstrapCandidate(policy);
  policy.treeSha = observed.treeSha;
  policy.diffDigest = observed.diffDigest;
  policy.manifest = observed.manifest;
  for (const item of policy.evidence) item.candidateTreeSha = policy.treeSha;
  changePolicy?.(policy);
  bootstrapPolicySchema.parse(policy);
  const contract: ExecutionContract = {
    featureId: 'bootstrap-feature',
    contractVersion: 1,
    workspaceId: digest(canonical),
    policyDigest: bootstrapDigest(policy),
    objective: 'task-only bootstrap',
    requirements: ['exact reviewed artifact'],
    nonGoals: ['external delivery'],
    acceptanceCriteria: ['published task artifact'],
    constraints: { architecture: [], security: [], allowedPaths: policy.allowedPaths },
    authority: {
      deliveryTarget: 'feature/test',
      allowedActions: [
        'workspace.read',
        'artifact.write',
        'workflow.transition',
        'beads.read',
        'git.read',
        'git.commit',
        'git.push',
      ],
      github: {
        repository: policy.repository,
        base: 'feature/test',
        mergeMethod: 'squash',
        requiredChecks: [],
      },
    },
    tasks: [
      {
        id: policy.taskId,
        dependsOn: [],
        risk: 'high',
        assignedRole: 'implementation_worker',
        branchParent: 'feature/test',
        allowedPaths: policy.allowedPaths,
        allowedOperations: [
          'workspace.read',
          'artifact.write',
          'workflow.transition',
          'beads.read',
          'git.read',
          'git.commit',
          'git.push',
        ],
      },
    ],
    qualityGates: ['tests', 'review'],
    retryPolicy: {
      implementationAttempts: 1,
      findingAttempts: 1,
      infrastructureAttempts: 2,
      waitDeadlineSeconds: 60,
    },
    repairTaskPolicy: {
      idPattern: 'bootstrap.task.fix.<sequence>',
      maxChildren: 0,
      allowedRoles: ['implementation_worker'],
      allowedPaths: policy.allowedPaths,
      authorityMayExpand: false,
    },
    escalationPolicy: ['fail closed'],
  };
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  store.createRun(
    store.createContract(executionContractSchema.parse(contract)),
    'approved',
    'bootstrap-run',
  );
  const recorder = new JournaledArtifactRecorder(
    new ContentAddressedArtifactStore(join(root, 'artifacts')),
    store,
  );
  for (const [index, content] of [testContent, reviewContent].entries())
    await recorder.record(content, {
      mediaType: 'text/plain',
      kind: policy.evidence[index]!.kind,
      producer: policy.evidence[index]!.producer,
      producerRole: policy.evidence[index]!.producerRole,
      workspaceId: contract.workspaceId,
      runId: 'bootstrap-run',
      taskId: policy.taskId,
      contractVersion: 1,
      policyDigest: contract.policyDigest,
      headSha: initial,
    });
  const references = policy.evidence.map(({ digest, mediaType, sizeBytes, kind }) =>
    evidenceReferenceSchema.parse({ digest, mediaType, sizeBytes, kind }),
  );
  store.recordCriticReview({
    reviewId: 'critic',
    runId: 'bootstrap-run',
    plannerId: 'planner',
    criticId: 'independent',
    contractVersion: 1,
    policyDigest: contract.policyDigest,
    materialDigest: deriveContractMaterialDigest(contract),
    verdict: 'approved',
    summary: 'fixture plan approval',
    evidence: references,
    findings: [],
    humanDecision: null,
  });
  store.createPlanApproval({
    approvalId: 'owner',
    runId: 'bootstrap-run',
    approverId: 'fixture-owner',
    contract,
    evidence: references,
  });
  store.close();
  const expire = () => {
    const raw = new Database(database);
    raw.prepare('UPDATE leases SET expires_at_ms=0').run();
    raw.close();
  };
  return {
    root,
    source,
    canonical,
    remote,
    database,
    policy,
    contract,
    beadsPath,
    adapter,
    expire,
  };
}

describe('approved bootstrap task artifact production composition', () => {
  it('checks pinned adapter dependencies before constructing a production coordinator or preflight', async () => {
    let dependency = '';
    const f = await fixture((policy) => {
      dependency = `${policy.adapters.remoteBinary}.dependency`;
      writeFileSync(dependency, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
      policy.adapters.dependencies = [
        { path: dependency, digest: digest(readFileSync(dependency)) },
      ];
    });
    expect(bootstrapPreflight(f.database, 'bootstrap-run', f.policy).ready).toBe(true);
    writeFileSync(dependency, '#!/bin/sh\nexit 1\n');
    expect(() => bootstrapPreflight(f.database, 'bootstrap-run', f.policy)).toThrow('dependency');
    expect(() => BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy)).toThrow(
      'dependency',
    );
    expect(git(f.source, ['rev-parse', 'HEAD'])).toBe(f.policy.initialHeadSha);
  });
  it.each(['commit', 'push'] as const)(
    'reconciles a real %s effect with a lost acknowledgement under a new owner',
    async (effect) => {
      let countPath = '';
      const f = await fixture((policy) => {
        if (effect !== 'push') return;
        countPath = `${policy.remoteUrl}.push-count`;
        const script = readFileSync(policy.adapters.remoteBinary, 'utf8')
          .replace('import {readFileSync}', 'import {readFileSync,appendFileSync,existsSync}')
          .replace(
            'out={sha:r.newSha};',
            `const first=!existsSync(${JSON.stringify(countPath)});appendFileSync(${JSON.stringify(countPath)},'push\\n');if(first)process.exit(1);out={sha:r.newSha};`,
          );
        writeFileSync(policy.adapters.remoteBinary, script);
        policy.adapters.remoteBinaryDigest = digest(script);
        policy.adapters.beadsReadBinaryDigest = digest(script);
      });
      const original = LocalGitDeliveryPort.prototype.mutate;
      let loseCommit = effect === 'commit';
      let commits = 0;
      vi.spyOn(LocalGitDeliveryPort.prototype, 'mutate').mockImplementation(async function (
        this: LocalGitDeliveryPort,
        request,
      ) {
        const result = await original.call(this, request);
        if (request.kind === 'git.commit') {
          commits++;
          if (loseCommit) {
            loseCommit = false;
            throw new Error('commit acknowledgement lost');
          }
        }
        return result;
      });
      const first = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
      await expect(first.commitAndPush()).rejects.toThrow();
      first.close();
      const raw = new Database(f.database);
      expect(
        raw.prepare("SELECT kind,status FROM delivery_operations WHERE status='prepared'").all(),
      ).toEqual([{ kind: `git.${effect}`, status: 'prepared' }]);
      const head = git(f.source, ['rev-parse', 'HEAD']);
      expect(head).not.toBe(f.policy.initialHeadSha);
      if (effect === 'push') expect(git(f.remote, ['rev-parse', f.policy.ref])).toBe(head);
      f.expire();
      const next = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
      await next.commitAndPush();
      next.close();
      expect(
        raw.prepare('SELECT current_sha,published_sha FROM delivery_approved_heads').get(),
      ).toEqual({ current_sha: head, published_sha: head });
      expect(
        raw.prepare("SELECT 1 FROM delivery_operations WHERE status='prepared'").get(),
      ).toBeUndefined();
      expect(raw.prepare('SELECT status FROM bootstrap_artifacts').get()).toEqual({
        status: 'attested',
      });
      expect(commits).toBe(1);
      if (effect === 'push') expect(readFileSync(countPath, 'utf8')).toBe('push\n');
      raw.close();
    },
  );
  it.each(['adoption', 'commit', 'push'] as const)(
    'rejects lease expiry during the final %s observation before dispatch',
    async (stage) => {
      const f = await fixture();
      let now = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      let insideMutation = false;
      let afterCommit = false;
      let expired = false;
      let pushes = 0;
      const original = BootstrapJournal.prototype.withMutation;
      vi.spyOn(BootstrapJournal.prototype, 'withMutation').mockImplementation(function (
        this: BootstrapJournal,
        runId,
        policy,
        fence,
        operation,
      ) {
        return original.call(this, runId, policy, fence, () => {
          insideMutation = true;
          try {
            return operation();
          } finally {
            insideMutation = false;
          }
        });
      });
      if (stage === 'adoption') {
        const advance = BootstrapJournal.prototype.advance;
        vi.spyOn(BootstrapJournal.prototype, 'advance').mockImplementation(function (
          this: BootstrapJournal,
          runId,
          policy,
          observation,
          fence,
          nowMs,
          observe,
        ) {
          return advance.call(this, runId, policy, observation, fence, nowMs, () => {
            observe();
            now += 60_001;
            expired = true;
          });
        });
      }
      const coordinator = BootstrapCoordinator.createForTest(
        f.database,
        'bootstrap-run',
        f.policy,
        {
          readBeads: () => {
            if (
              insideMutation &&
              !expired &&
              (stage === 'commit' || (stage === 'push' && afterCommit))
            ) {
              now += 60_001;
              expired = true;
            }
            return f.policy.beadsSnapshot;
          },
          observeRemote: () => null,
          pushRemote: () => {
            pushes++;
          },
        },
        (boundary) => {
          if (boundary === 'after_commit') afterCommit = true;
        },
      );
      await expect(coordinator.commitAndPush()).rejects.toThrow('fence');
      expect(expired).toBe(true);
      expect(pushes).toBe(0);
      if (stage !== 'push')
        expect(git(f.source, ['rev-parse', 'HEAD'])).toBe(f.policy.initialHeadSha);
      const raw = new Database(f.database);
      if (stage === 'adoption') {
        expect(raw.prepare('SELECT state,version FROM runs').get()).toEqual({
          state: 'approved',
          version: 0,
        });
        expect(raw.prepare('SELECT count(*) n FROM delivery_approved_heads').get()).toEqual({
          n: 0,
        });
      }
      raw.close();
      coordinator.close();
    },
  );
  it('rejects a successor takeover during push observation before any remote dispatch', async () => {
    const f = await fixture();
    const successor = new WorkflowStore(f.database);
    let takeover = false;
    let pushes = 0;
    const coordinator = BootstrapCoordinator.createForTest(
      f.database,
      'bootstrap-run',
      f.policy,
      {
        readBeads: () => {
          if (takeover) {
            takeover = false;
            f.expire();
            successor.acquireLease('workspace', f.contract.workspaceId, 'successor', 60_000);
            successor.acquireLease('run', 'bootstrap-run', 'successor', 60_000);
            successor.acquireLease('task', f.policy.taskId, 'successor', 60_000);
          }
          return f.policy.beadsSnapshot;
        },
        observeRemote: () => null,
        pushRemote: () => {
          pushes++;
        },
      },
      (boundary) => {
        if (boundary === 'after_commit') takeover = true;
      },
    );
    await expect(coordinator.commitAndPush()).rejects.toThrow('fence');
    expect(pushes).toBe(0);
    successor.close();
    coordinator.close();
  });
  it('crosses real adapter subprocesses, commits only source checkout, attests and cancels with fenced leases', async () => {
    const f = await fixture();
    expect(bootstrapPreflight(f.database, 'bootstrap-run', f.policy).mutations).toBe(false);
    const coordinator = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
    const evidence = await coordinator.commitAndPush();
    const head = git(f.source, ['rev-parse', 'HEAD']);
    expect(head).not.toBe(f.policy.initialHeadSha);
    expect(git(f.remote, ['rev-parse', f.policy.ref])).toBe(head);
    expect(git(f.source, ['rev-parse', `${head}^{tree}`])).toBe(f.policy.treeSha);
    expect(readFileSync(join(f.canonical, 'owner-note.txt'), 'utf8')).toBe('not task content');
    expect(git(f.source, ['ls-tree', '-r', '--name-only', head])).not.toContain('owner-note');
    const result = await coordinator.terminalize('fixture-owner');
    expect(result.status).toBe('cancelled');
    expect(result.retainedEvidence[0]?.digest).toBe(evidence.digest);
    coordinator.close();
    const raw = new Database(f.database);
    expect(
      raw.prepare('SELECT 1 FROM leases WHERE expires_at_ms>?').get(Date.now()),
    ).toBeUndefined();
    expect(
      raw.prepare('SELECT operation FROM transitions ORDER BY expected_run_version').all(),
    ).toEqual([
      { operation: 'workflow.bootstrap_task_observed' },
      { operation: 'workflow.bootstrap_candidate_adopted' },
    ]);
    expect(
      raw
        .prepare(
          "SELECT count(*) n FROM delivery_operations WHERE kind='git.preexisting_ref_observed'",
        )
        .get(),
    ).toEqual({ n: 1 });
    raw.close();
  });
  it.each([
    'after_task_observation',
    'after_candidate_adoption',
    'after_commit',
    'after_push',
    'after_attestation',
  ] as BootstrapFault[])(
    'recovers response loss at %s without duplicate transitions or push',
    async (boundary) => {
      const f = await fixture();
      let remote: string | null = null;
      let pushes = 0;
      const clients = {
        readBeads: () => f.policy.beadsSnapshot,
        observeRemote: () => remote,
        pushRemote: ({
          expectedOldSha,
          newSha,
        }: {
          expectedOldSha: string | null;
          newSha: string;
        }) => {
          if (remote !== expectedOldSha) throw Error('CAS conflict');
          remote = newSha;
          pushes++;
        },
      };
      let crash = true;
      const first = BootstrapCoordinator.createForTest(
        f.database,
        'bootstrap-run',
        f.policy,
        clients,
        (at) => {
          if (crash && at === boundary) {
            crash = false;
            throw Error('response lost');
          }
        },
      );
      await expect(first.commitAndPush()).rejects.toThrow('response lost');
      first.close();
      f.expire();
      const next = BootstrapCoordinator.createForTest(
        f.database,
        'bootstrap-run',
        f.policy,
        clients,
      );
      await next.commitAndPush();
      next.close();
      expect(pushes).toBe(1);
      const raw = new Database(f.database);
      expect(raw.prepare('SELECT count(*) n FROM transitions').get()).toEqual({ n: 2 });
      expect(raw.prepare('SELECT status FROM bootstrap_artifacts').get()).toEqual({
        status: 'attested',
      });
      raw.close();
    },
  );
  it('rejects changed observations between the two real lifecycle transitions', async () => {
    const f = await fixture();
    let calls = 0;
    const coordinator = BootstrapCoordinator.createForTest(
      f.database,
      'bootstrap-run',
      f.policy,
      {
        readBeads: () => f.policy.beadsSnapshot,
        observeRemote: () => null,
        pushRemote: () => {
          throw Error('must not push');
        },
      },
      () => {
        if (++calls === 1)
          writeFileSync(join(f.source, 'packages/workflow-control/value.txt'), 'tampered');
      },
    );
    expect(() => coordinator.adopt()).toThrow('candidate');
    coordinator.close();
    const raw = new Database(f.database);
    expect(raw.prepare('SELECT state,version FROM runs').get()).toEqual({
      state: 'scheduling',
      version: 1,
    });
    expect(raw.prepare('SELECT count(*) n FROM delivery_approved_heads').get()).toEqual({ n: 0 });
    raw.close();
  });
  it.each([
    'author',
    'source',
    'tree',
    'manifest',
    'remote',
    'beads',
    'binary',
    'evidence',
  ] as const)('rejects policy substitution: %s', async (kind) => {
    const f = await fixture();
    const policy = structuredClone(f.policy);
    if (kind === 'author') policy.author.name = 'Other';
    if (kind === 'source') policy.sourceRoot = f.canonical;
    if (kind === 'tree') {
      policy.treeSha = 'f'.repeat(40);
      for (const item of policy.evidence) item.candidateTreeSha = policy.treeSha;
    }
    if (kind === 'manifest') policy.manifest[0]!.digest = digest('other');
    if (kind === 'remote') policy.remoteUrl = '/other';
    if (kind === 'beads') policy.beadsSnapshot.notes = 'other';
    if (kind === 'binary') policy.adapters.remoteBinaryDigest = digest('other');
    if (kind === 'evidence') policy.evidence[0]!.producer = 'other';
    expect(() => BootstrapCoordinator.create(f.database, 'bootstrap-run', policy)).toThrow(
      'policy',
    );
    expect(git(f.source, ['rev-parse', 'HEAD'])).toBe(f.policy.initialHeadSha);
  });
  it.each(['beads', 'source', 'ref', 'adapter'] as const)(
    'fails fresh authority observation before mutation: %s',
    async (kind) => {
      const f = await fixture();
      const coordinator = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
      coordinator.adopt();
      if (kind === 'beads')
        writeFileSync(f.beadsPath, JSON.stringify({ ...f.policy.beadsSnapshot, notes: 'changed' }));
      if (kind === 'source')
        writeFileSync(join(f.source, 'packages/workflow-control/value.txt'), 'changed');
      if (kind === 'ref') git(f.source, ['symbolic-ref', 'HEAD', 'refs/heads/other']);
      if (kind === 'adapter') chmodSync(f.adapter, 0o777);
      await expect(coordinator.commitAndPush()).rejects.toThrow();
      coordinator.close();
      expect(git(f.canonical, ['rev-parse', f.policy.ref])).toBe(f.policy.initialHeadSha);
    },
  );
  it('rejects stale owners and missing approval/evidence without preparing anything', async () => {
    const f = await fixture();
    const first = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
    first.adopt();
    const second = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
    expect(() => second.adopt()).toThrow('lease');
    second.close();
    first.close();
    const raw = new Database(f.database);
    raw.prepare("UPDATE plan_approvals SET status='invalidated'").run();
    raw.close();
    expect(() => BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy)).toThrow(
      'approval',
    );
  });
  it('retains the full hash-bound policy and rejects database payload substitution', async () => {
    const f = await fixture();
    const coordinator = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
    coordinator.adopt();
    const raw = new Database(f.database);
    const stored = raw.prepare('SELECT policy_json FROM bootstrap_artifacts').get() as {
      policy_json: string;
    };
    expect(JSON.parse(stored.policy_json)).toEqual(f.policy);
    const changed = JSON.parse(stored.policy_json) as BootstrapPolicy;
    changed.author.name = 'Other';
    raw.prepare('UPDATE bootstrap_artifacts SET policy_json=?').run(JSON.stringify(changed));
    raw.close();
    await expect(coordinator.commitAndPush()).rejects.toThrow('stored');
    coordinator.close();
  });
  it('preflight remains read-only, including an old journal without bootstrap schema', async () => {
    const f = await fixture();
    const raw = new Database(f.database);
    raw.exec('DROP TABLE bootstrap_artifacts');
    const before = raw.prepare('SELECT max(version) v FROM schema_migrations').get();
    raw.close();
    expect(bootstrapPreflight(f.database, 'bootstrap-run', f.policy).ready).toBe(true);
    const check = new Database(f.database, { readonly: true });
    expect(
      check.prepare("SELECT 1 FROM sqlite_master WHERE name='bootstrap_artifacts'").get(),
    ).toBeUndefined();
    expect(check.prepare('SELECT max(version) v FROM schema_migrations').get()).toEqual(before);
    check.close();
  });
  it('does not fabricate an artifact receipt when owned work remains', async () => {
    const f = await fixture();
    const journal = new BootstrapJournal(f.database);
    journal.database
      .prepare(
        "INSERT INTO approval_notifications(event_id,run_id,task_id,event_json,state,created_at_ms,updated_at_ms) VALUES('pending','bootstrap-run','bootstrap.task','{}','delivery_pending',1,1)",
      )
      .run();
    expect(journal.pendingWork('bootstrap-run')).toEqual(['approval-delivery']);
    journal.close();
    const coordinator = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
    await expect(coordinator.commitAndPush()).rejects.toThrow('settled published head');
    const raw = new Database(f.database);
    expect(raw.prepare('SELECT attestation_digest,status FROM bootstrap_artifacts').get()).toEqual({
      attestation_digest: null,
      status: 'adopted',
    });
    raw.close();
    await expect(coordinator.terminalize('fixture-owner')).rejects.toThrow();
    coordinator.close();
  });
  it('rolls back the adoption receipt, head ledger and second transition together on storage failure', async () => {
    const f = await fixture();
    const raw = new Database(f.database);
    raw.exec(
      "CREATE TRIGGER fail_bootstrap_head BEFORE INSERT ON delivery_approved_heads BEGIN SELECT RAISE(ABORT,'fixture disk failure'); END",
    );
    const coordinator = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
    expect(() => coordinator.adopt()).toThrow('fixture disk failure');
    expect(raw.prepare('SELECT state,version FROM runs').get()).toEqual({
      state: 'scheduling',
      version: 1,
    });
    expect(raw.prepare('SELECT count(*) n FROM transitions').get()).toEqual({ n: 1 });
    expect(raw.prepare('SELECT count(*) n FROM delivery_operations').get()).toEqual({ n: 0 });
    expect(raw.prepare('SELECT status FROM bootstrap_artifacts').get()).toEqual({
      status: 'prepared',
    });
    raw.exec('DROP TRIGGER fail_bootstrap_head');
    coordinator.adopt();
    expect(raw.prepare('SELECT state,version FROM runs').get()).toEqual({
      state: 'implementing',
      version: 2,
    });
    expect(raw.prepare('SELECT count(*) n FROM delivery_approved_heads').get()).toEqual({ n: 1 });
    coordinator.close();
    raw.close();
  });
  it('rejects a substituted commit before preparing even with internal delivery capability', async () => {
    const f = await fixture();
    const coordinator = BootstrapCoordinator.create(f.database, 'bootstrap-run', f.policy);
    coordinator.adopt();
    const store = new WorkflowStore(f.database);
    expect(() =>
      store.prepareDeliveryOperation(
        {
          id: 'invalid',
          workspaceId: f.contract.workspaceId,
          runId: 'bootstrap-run',
          taskId: f.policy.taskId,
          kind: 'git.commit',
          actorRole: 'workflow_orchestrator',
          requestDigest: digest('invalid'),
          request: {
            kind: 'git.commit',
            runId: 'bootstrap-run',
            taskId: f.policy.taskId,
            workspaceId: f.contract.workspaceId,
            policyDigest: f.contract.policyDigest,
            repository: f.policy.repository,
            ref: f.policy.ref,
            parentSha: f.policy.initialHeadSha,
            treeSha: 'f'.repeat(40),
          },
          contractVersion: 1,
          policyDigest: f.contract.policyDigest,
          ownerId: 'invalid',
          workspaceLeaseEpoch: 1,
          runLeaseEpoch: 1,
          taskLeaseEpoch: 1,
          nowMs: Date.now(),
        },
        workflowDeliveryMutationCapability,
      ),
    ).toThrow('stored policy');
    expect(store.getDeliveryOperation('invalid')).toBeUndefined();
    store.close();
    coordinator.close();
  });
});
