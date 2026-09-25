import {
  WorkflowCancellationCoordinator,
  OfficialCancellationCleanupPort,
} from '../src/cancellation.js';
import { digestGovernedValue } from '../src/governedOperations.js';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import {
  WorkflowStore,
  workflowDeliveryMutationCapability,
  workflowEvaluationMutationCapability,
  workflowFinalizationMutationCapability,
  workflowRepairMutationCapability,
  workflowGovernedPersistenceCapability,
  workflowFeatureDeliveryApprovalCapability,
} from '../src/storage.js';
import { ContentAddressedArtifactStore } from '../src/artifacts.js';
import { publishPlanningDocumentObjects } from '../src/planningDocuments.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { executionContractSchema } from '../src/contracts.js';
import { initializeDocumentApprovalSchema } from '../src/documentApproval.js';
import { runCli } from '../src/cli.js';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WorkflowOrchestrator } from '../src/orchestrator.js';
import { JournaledArtifactRecorder } from '../src/artifacts.js';
import { LocalExactHeadIntegrationGate } from '../src/integrationGate.js';
import {
  OfficialBeadsDoltPort,
  JournaledBeadsDoltBroker,
  JournaledBeadsTaskCloser,
} from '../src/reconciliation.js';
import {
  DockerIsolatedSpecialistLauncher,
  RevocableSpecialistCredentialBroker,
} from '../src/specialistLauncher.js';

const roots: string[] = [];
const stores: WorkflowStore[] = [];
const databases: Database.Database[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.close();
  for (const d of databases.splice(0)) d.close();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function setup(options: { publish?: boolean; approve?: boolean } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'document-journal-')));
  roots.push(root);
  const sourceRoot = join(root, 'source');
  await mkdir(sourceRoot);
  await writeFile(join(sourceRoot, 'spec.md'), 'spec\n');
  await writeFile(join(sourceRoot, 'tests.md'), 'test\n');
  let sourceRevision = 'a'.repeat(40);
  {
    const git = (args: string[]) =>
      execFileSync('git', ['-C', sourceRoot, ...args], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Fixture',
          GIT_AUTHOR_EMAIL: 'fixture@example.com',
          GIT_COMMITTER_NAME: 'Fixture',
          GIT_COMMITTER_EMAIL: 'fixture@example.com',
        },
      }).trim();
    git(['init', '-q']);
    git(['add', '.']);
    git(['commit', '-qm', 'reviewed documents']);
    sourceRevision = git(['rev-parse', 'HEAD']);
  }
  const input = JSON.parse(
    await readFile(
      new URL('./fixtures/documentBindingLegacyContract.json', import.meta.url),
      'utf8',
    ),
  );
  input.workspaceId = `sha256:${createHash('sha256').update(sourceRoot).digest('hex')}`;
  execFileSync('git', [
    '-C',
    sourceRoot,
    'remote',
    'add',
    'origin',
    `https://github.com/${input.authority.github.repository}.git`,
  ]);
  const taskId = input.tasks[0].id;
  const artifactStore = new ContentAddressedArtifactStore(join(root, 'artifacts'));
  input.planningDocuments = await publishPlanningDocumentObjects({
    sourceRoot,
    workspaceId: input.workspaceId,
    repository: input.authority.github.repository,
    sourceRevision,
    documents: [
      { path: 'spec.md', kind: 'specification', taskIds: [taskId] },
      { path: 'tests.md', kind: 'verification', taskIds: [taskId] },
    ],
    artifacts: artifactStore,
  });
  const contract = executionContractSchema.parse(input);
  const path = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(path);
  stores.push(store);
  const contractId = store.createContract(contract);
  store.createRun(contractId, 'planning', 'run');
  if (options.publish !== false)
    store.recordPlanningDocumentPublication({ runId: 'run', sourceRoot });
  const database = new Database(path);
  databases.push(database);
  // Explicit synthetic critic/owner evidence in this disposable journal only.
  const evidence = [
    {
      digest: contract.planningDocuments!.files[0]!.digest,
      mediaType: 'text/markdown',
      sizeBytes: contract.planningDocuments!.files[0]!.sizeBytes,
      kind: 'review',
    },
  ];
  store.recordEvidence({
    ...evidence[0]!,
    producer: 'fixture-critic',
    producerRole: 'plan_critic',
    workspaceId: contract.workspaceId,
    runId: 'run',
    contractVersion: 1,
    policyDigest: contract.policyDigest,
  });
  store.recordCriticReview({
    reviewId: 'fixture-review',
    runId: 'run',
    plannerId: 'fixture-planner',
    criticId: 'fixture-critic',
    contractVersion: 1,
    policyDigest: contract.policyDigest,
    materialDigest: deriveContractMaterialDigest(contract),
    verdict: 'approved',
    summary: 'synthetic review',
    evidence,
    findings: [],
    humanDecision: null,
  });
  if (options.approve !== false)
    store.createPlanApproval({
      approvalId: 'approval',
      runId: 'run',
      approverId: 'fixture-owner',
      contract,
      evidence,
    });
  const epoch = store.acquireLease('run', 'run', 'owner', 100000).epoch;
  const boundary = {
    runId: 'run',
    taskId,
    boundary: 'test.start',
    ownerId: 'owner',
    runLeaseEpoch: epoch,
  };
  return { store, database, sourceRoot, path, boundary, contract, artifactStore, evidence };
}
async function tamperDocument(f: Awaited<ReturnType<typeof setup>>, fault: string) {
  if (fault === 'deleted') return rm(join(f.sourceRoot, 'spec.md'));
  if (fault === 'artifact') {
    const hash = f.contract.planningDocuments!.files[0]!.digest.slice(7);
    return writeFile(join(f.path, '..', 'artifacts', hash.slice(0, 2), hash), 'changed object');
  }
  return writeFile(join(f.sourceRoot, 'spec.md'), 'changed');
}
function boundaryFaults(boundaries: string[]) {
  return boundaries.flatMap((boundary) =>
    ['changed', 'deleted', 'artifact'].map((fault) => ({ boundary, fault })),
  );
}
function coordinator(f: Awaited<ReturnType<typeof setup>>, store = f.store) {
  // These outward adapters must never run during document validation or packet construction.
  const unused = async (): Promise<never> => {
    throw new Error('unexpected external effect');
  };
  const port = OfficialBeadsDoltPort.createForTest(f.sourceRoot, {
    readIssue: unused,
    claimIssue: unused,
    closeIssue: unused,
    readDoltSync: unused,
    pushDolt: unused,
  });
  const closer = new JournaledBeadsTaskCloser(
    JournaledBeadsDoltBroker.createForTest(store, port),
    port,
  );
  const credentialBroker = RevocableSpecialistCredentialBroker.createForTest({
    store,
    issue: unused,
    revoke: unused,
    observe: unused,
    conformance: unused,
  });
  const launcher = DockerIsolatedSpecialistLauncher.create({
    store,
    ownerId: 'owner',
    sourceRoot: f.sourceRoot,
    image: 'agent-platform-review:0.156.1-hardened',
    credentialBroker,
    egressNetwork: 'none',
  });
  const integrationGate = LocalExactHeadIntegrationGate.create({
    workspaceRoot: f.sourceRoot,
    artifacts: new JournaledArtifactRecorder(f.artifactStore, store),
    checkCommands: {},
  });
  return new WorkflowOrchestrator({
    store,
    contract: f.contract,
    closer,
    launcher,
    integrationGate,
    ownerId: 'owner',
  });
}
it('verifies unchanged journal and objects on repeated boundaries without new approval', async () => {
  const f = await setup();
  const first = f.store.verifyPlanningDocuments(f.boundary);
  const second = f.store.verifyPlanningDocuments({ ...f.boundary, boundary: 'test.resume' });
  expect(second).toEqual(first);
  expect(
    f.database
      .prepare("SELECT count(*) n FROM planning_document_attempts WHERE status='verified'")
      .get(),
  ).toEqual({ n: 3 });
});

it('validates persisted task material through the operator command and returns safe blocked reasons', async () => {
  const f = await setup();
  const args = ['validate-documents', f.path, 'run', f.boundary.taskId];
  expect(JSON.parse(runCli(args))).toMatchObject({
    passed: true,
    binding: { approvalId: 'approval' },
  });
  await writeFile(join(f.sourceRoot, 'tests.md'), 'synthetic-secret-marker');
  const denied = runCli(args);
  expect(JSON.parse(denied)).toEqual({ passed: false, reason: 'planning_documents_changed' });
  expect(denied).not.toContain(f.sourceRoot);
  expect(denied).not.toContain('synthetic-secret-marker');
  expect(JSON.parse(runCli(args))).toEqual({ passed: false, reason: 'document_approval_required' });
  expect(
    JSON.parse(
      runCli([
        'validate-documents',
        join(f.sourceRoot, 'missing.sqlite'),
        'run',
        f.boundary.taskId,
      ]),
    ),
  ).toEqual({ passed: false, reason: 'document_database_missing' });
});
it('invalidates matching-length changed bytes and never restores the old approval', async () => {
  const f = await setup();
  await writeFile(join(f.sourceRoot, 'spec.md'), 'edit\n');
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('planning_documents_changed');
  await writeFile(join(f.sourceRoot, 'spec.md'), 'spec\n');
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('document_approval_required');
  expect(f.database.prepare("SELECT status FROM plan_approvals WHERE id='approval'").get()).toEqual(
    { status: 'invalidated' },
  );
});
it('survives failed invalidation, restart and restored bytes with unresolved authority quarantined', async () => {
  const f = await setup();
  f.database.exec(
    "CREATE TRIGGER fail_invalidation BEFORE UPDATE ON plan_approvals BEGIN SELECT RAISE(ABORT,'injected'); END",
  );
  await writeFile(join(f.sourceRoot, 'spec.md'), 'edit\n');
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('injected');
  expect(
    f.database
      .prepare(
        'SELECT status FROM planning_document_attempts ORDER BY created_at_ms DESC,rowid DESC LIMIT 1',
      )
      .get(),
  ).toEqual({
    status: 'pending',
  });
  f.store.close();
  stores.splice(stores.indexOf(f.store), 1);
  await writeFile(join(f.sourceRoot, 'spec.md'), 'spec\n');
  f.database.exec('DROP TRIGGER fail_invalidation');
  const reopened = new WorkflowStore(f.path);
  stores.push(reopened);
  expect(() => reopened.verifyPlanningDocuments(f.boundary)).toThrow(
    'document_verification_unresolved',
  );
  expect(() => reopened.recoverPlanningDocumentVerification(f.boundary)).toThrow(
    'document_attempt_owner_live',
  );
  f.database.exec(
    "UPDATE leases SET expires_at_ms=0 WHERE resource_type='run' AND resource_id='run'",
  );
  const recoveryEpoch = reopened.acquireLease('run', 'run', 'recovery-owner', 60_000).epoch;
  reopened.recoverPlanningDocumentVerification({
    ...f.boundary,
    ownerId: 'recovery-owner',
    runLeaseEpoch: recoveryEpoch,
  });
  expect(() => reopened.verifyPlanningDocuments(f.boundary)).toThrow('document_approval_required');
  expect(
    f.database
      .prepare(
        'SELECT status FROM planning_document_attempts ORDER BY created_at_ms DESC,rowid DESC LIMIT 1',
      )
      .get(),
  ).toEqual({
    status: 'recovered',
  });
});
it.each(['before-read', 'failed-invalidation'])(
  'quarantines actual process death at %s, including restored bytes',
  async (mode) => {
    const f = await setup();
    f.store.close();
    stores.splice(stores.indexOf(f.store), 1);
    f.database.close();
    databases.splice(databases.indexOf(f.database), 1);
    const script = `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const open = fs.openSync;
    fs.openSync = function(path, ...args) {
      if (process.env.PROBE_MODE === 'before-read' && String(path) === process.env.PROBE_DOCUMENT) process.kill(process.pid, 'SIGKILL');
      return open.call(this, path, ...args);
    };
    syncBuiltinESMExports();
    const { WorkflowStore } = await import(process.env.PROBE_STORE);
    const store = new WorkflowStore(process.env.PROBE_DATABASE);
    if (process.env.PROBE_MODE === 'failed-invalidation') {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(process.env.PROBE_DATABASE);
      db.exec("CREATE TRIGGER fail_invalidation BEFORE UPDATE ON plan_approvals BEGIN SELECT RAISE(ABORT,'injected_invalidation'); END");
      db.close();
      fs.writeFileSync(process.env.PROBE_DOCUMENT, 'edit\\n');
    }
    try { store.verifyPlanningDocuments(JSON.parse(process.env.PROBE_BOUNDARY)); }
    catch (error) {
      if (process.env.PROBE_MODE === 'failed-invalidation' && error.message === 'injected_invalidation') process.kill(process.pid, 'SIGKILL');
      throw error;
    }

  `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: {
        ...process.env,
        PROBE_MODE: mode,
        PROBE_DOCUMENT: join(f.sourceRoot, 'spec.md'),
        PROBE_STORE: new URL('../dist/storage.js', import.meta.url).href,
        PROBE_DATABASE: f.path,
        PROBE_BOUNDARY: JSON.stringify(f.boundary),
      },
      stdio: 'ignore',
    });
    const outcome = await new Promise<{ code: number | null; signal: string | null }>(
      (resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve({ code, signal }));
      },
    );
    expect(outcome).toEqual({ code: null, signal: 'SIGKILL' });
    await writeFile(join(f.sourceRoot, 'spec.md'), 'spec\n');
    const reopened = new WorkflowStore(f.path);
    stores.push(reopened);
    expect(() => reopened.verifyPlanningDocuments(f.boundary)).toThrow(
      'document_verification_unresolved',
    );
    const raw = new Database(f.path);
    databases.push(raw);
    expect(
      raw.prepare("SELECT count(*) n FROM planning_document_attempts WHERE status='pending'").get(),
    ).toEqual({ n: 1 });
  },
);
it('prevents a second process from accepting a pending attempt and fences the old verifier after takeover', async () => {
  const f = await setup();
  const marker = join(f.sourceRoot, '..', 'verifier-paused');
  const script = `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const open = fs.openSync;
    let paused = false;
    fs.openSync = function(path, ...args) {
      if (!paused && String(path) === process.env.PROBE_DOCUMENT) {
        paused = true;
        fs.writeFileSync(process.env.PROBE_MARKER, 'pending');
        process.kill(process.pid, 'SIGSTOP');
      }
      return open.call(this, path, ...args);
    };
    syncBuiltinESMExports();
    const { WorkflowStore } = await import(process.env.PROBE_STORE);
    const store = new WorkflowStore(process.env.PROBE_DATABASE);
    try { store.verifyPlanningDocuments(JSON.parse(process.env.PROBE_BOUNDARY)); process.exitCode = 10; }
    catch { process.exitCode = 0; }
    finally { store.close(); }
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      PROBE_DOCUMENT: join(f.sourceRoot, 'spec.md'),
      PROBE_MARKER: marker,
      PROBE_STORE: new URL('../dist/storage.js', import.meta.url).href,
      PROBE_DATABASE: f.path,
      PROBE_BOUNDARY: JSON.stringify(f.boundary),
    },
    stdio: 'ignore',
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  try {
    let paused = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      paused = await readFile(marker, 'utf8').then(
        () => true,
        () => false,
      );
      if (paused) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(paused).toBe(true);
    expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow(
      'document_verification_unresolved',
    );
    f.database.exec(
      "UPDATE leases SET expires_at_ms=0 WHERE resource_type='run' AND resource_id='run'",
    );
    const epoch = f.store.acquireLease('run', 'run', 'replacement', 60_000).epoch;
    f.store.recoverPlanningDocumentVerification({
      ...f.boundary,
      ownerId: 'replacement',
      runLeaseEpoch: epoch,
    });
    child.kill('SIGCONT');
    expect(await exited).toBe(0);
    expect(
      f.database.prepare("SELECT status FROM plan_approvals WHERE id='approval'").get(),
    ).toEqual({ status: 'invalidated' });
    expect(
      f.database
        .prepare("SELECT status FROM planning_document_attempts WHERE boundary='test.start'")
        .get(),
    ).toEqual({ status: 'recovered' });
    expect(() =>
      f.store.verifyPlanningDocuments({
        ...f.boundary,
        ownerId: 'replacement',
        runLeaseEpoch: epoch,
      }),
    ).toThrow('document_approval_required');
  } finally {
    child.kill('SIGKILL');
    await exited;
  }
});

it('fails closed before checking bytes if attempt persistence fails; rejects missing objects and stale fences', async () => {
  const f = await setup();
  f.database.exec(
    "CREATE TRIGGER fail_intent BEFORE INSERT ON planning_document_attempts BEGIN SELECT RAISE(ABORT,'intent_failed'); END",
  );
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('intent_failed');
  expect(f.database.prepare('SELECT count(*) n FROM planning_document_attempts').get()).toEqual({
    n: 1,
  });
  f.database.exec('DROP TRIGGER fail_intent');
  expect(() => f.store.verifyPlanningDocuments({ ...f.boundary, runLeaseEpoch: 999 })).toThrow(
    'document_lease_stale',
  );
  const hash = createHash('sha256').update('spec\n').digest('hex');
  await rm(join(f.path, '..', 'artifacts', hash.slice(0, 2), hash));
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('planning_documents_changed');
});
it.each([false, true])(
  'keeps snapshot tamper denial durable when settlement fails: %s',
  async (failSettlement) => {
    const f = await setup();
    const task = f.contract.tasks[0]!;
    const documentBinding = f.store.verifyPlanningDocuments(f.boundary);
    const packet = {
      runId: 'run',
      taskId: task.id,
      contractVersion: f.contract.contractVersion,
      policyDigest: f.contract.policyDigest,
      assignedRole: task.assignedRole,
      objective: f.contract.objective,
      acceptanceCriteria: f.contract.acceptanceCriteria,
      allowedPaths: task.allowedPaths,
      allowedOperations: task.allowedOperations,
      retryBudget: f.contract.retryPolicy,
      evidence: [],
      documentBinding,
    };
    const destination = join(f.path, '..', 'snapshot');
    f.store.stageApprovedDocuments({
      ...f.boundary,
      packet,
      sourceRoot: f.sourceRoot,
      destination,
    });
    expect(await readFile(join(destination, 'documents', 'spec.md'), 'utf8')).toBe('spec\n');
    f.store.verifyApprovedDocumentSnapshot({ ...f.boundary, packet, destination });
    await chmod(join(destination, 'documents', 'spec.md'), 0o600);
    await writeFile(join(destination, 'documents', 'spec.md'), 'evil\n');
    if (failSettlement)
      f.database.exec(
        "CREATE TRIGGER fail_snapshot_settlement BEFORE UPDATE ON planning_document_attempts BEGIN SELECT RAISE(ABORT,'settlement_failed'); END",
      );
    expect(() =>
      f.store.verifyApprovedDocumentSnapshot({ ...f.boundary, packet, destination }),
    ).toThrow(failSettlement ? 'settlement_failed' : 'planning_documents_changed');
    if (failSettlement) f.database.exec('DROP TRIGGER fail_snapshot_settlement');
    await writeFile(join(destination, 'documents', 'spec.md'), 'spec\n');
    expect(() =>
      f.store.verifyApprovedDocumentSnapshot({ ...f.boundary, packet, destination }),
    ).toThrow(failSettlement ? 'document_verification_unresolved' : 'document_approval_required');

    await writeFile(join(f.sourceRoot, 'spec.md'), 'edit\n');
    expect(await readFile(join(destination, 'documents', 'spec.md'), 'utf8')).toBe('spec\n');
    expect(() =>
      f.store.stageApprovedDocuments({
        ...f.boundary,
        packet,
        sourceRoot: f.sourceRoot,
        destination: join(f.path, '..', 'next'),
      }),
    ).toThrow(failSettlement ? 'document_verification_unresolved' : 'document_approval_required');
  },
);
it('rejects wrong task, approval, source and packet identities before creating a snapshot', async () => {
  const f = await setup();
  const task = f.contract.tasks[0]!;
  const documentBinding = f.store.verifyPlanningDocuments(f.boundary);
  const packet = {
    runId: 'run',
    taskId: task.id,
    contractVersion: f.contract.contractVersion,
    policyDigest: f.contract.policyDigest,
    assignedRole: task.assignedRole,
    objective: f.contract.objective,
    acceptanceCriteria: f.contract.acceptanceCriteria,
    allowedPaths: task.allowedPaths,
    allowedOperations: task.allowedOperations,
    retryBudget: f.contract.retryPolicy,
    evidence: [],
    documentBinding,
  };
  const input = {
    ...f.boundary,
    packet,
    sourceRoot: f.sourceRoot,
    destination: join(f.path, '..', 'snapshot'),
  };
  expect(() =>
    f.store.stageApprovedDocuments({ ...input, packet: { ...packet, runId: 'other' } }),
  ).toThrow('document_snapshot_binding_rejected');
  expect(() =>
    f.store.stageApprovedDocuments({
      ...input,
      packet: { ...packet, documentBinding: { ...documentBinding, approvalId: 'other' } },
    }),
  ).toThrow('document_snapshot_binding_rejected');
  expect(() =>
    f.store.stageApprovedDocuments({ ...input, sourceRoot: join(f.path, '..') }),
  ).toThrow('planning_documents_changed');
  expect(() => f.store.stageApprovedDocuments({ ...input, taskId: 'unknown' })).toThrow(
    'document_task_unknown',
  );
});
it('rejects publication from an unrelated same-byte repository and unknown source revision', async () => {
  const f = await setup();
  const unrelated = join(f.sourceRoot, '..', 'unrelated');
  await mkdir(unrelated);
  execFileSync('git', ['-C', unrelated, 'init', '-q']);
  await writeFile(join(unrelated, 'spec.md'), 'spec\n');
  await writeFile(join(unrelated, 'tests.md'), 'test\n');
  expect(() =>
    f.store.recordPlanningDocumentPublication({ runId: 'run', sourceRoot: unrelated }),
  ).toThrow('document_workspace_identity_rejected');
  const altered = structuredClone(f.contract);
  altered.featureId += '-unknown-revision';
  altered.planningDocuments!.sourceRevision = 'f'.repeat(40);
  f.store.createRun(f.store.createContract(altered), 'planning', 'other-run');
  expect(() =>
    f.store.recordPlanningDocumentPublication({ runId: 'other-run', sourceRoot: f.sourceRoot }),
  ).toThrow();
});
it('returns bounded publication errors without repository paths or remote credentials', async () => {
  const f = await setup();
  execFileSync('git', ['-C', f.sourceRoot, 'remote', 'remove', 'origin']);
  expect(() =>
    f.store.recordPlanningDocumentPublication({ runId: 'run', sourceRoot: f.sourceRoot }),
  ).toThrow(/^document_source_git_unavailable$/);
  const fixtureRemote = new URL('https://example.invalid/private.git');
  fixtureRemote.username = 'fixture';
  fixtureRemote.password = randomUUID();
  execFileSync('git', ['-C', f.sourceRoot, 'remote', 'add', 'origin', fixtureRemote.href]);
  expect(() =>
    f.store.recordPlanningDocumentPublication({ runId: 'run', sourceRoot: f.sourceRoot }),
  ).toThrow(/^document_repository_identity_rejected$/);
});

it.each(['task', 'run', 'import'])(
  'checks accepted %s worktree bytes instead of publication bytes',
  async (mode) => {
    const f = await setup();
    const taskRoot = join(f.sourceRoot, '..', 'task-source');
    const ref = `refs/heads/task/${f.boundary.taskId}`;
    execFileSync('git', [
      '-C',
      f.sourceRoot,
      'worktree',
      'add',
      '-q',
      '-b',
      ref.slice(11),
      taskRoot,
    ]);
    // Seed only the accepted-head ledger; the runtime resolver and byte guard remain real.
    f.database.pragma('foreign_keys = OFF');
    f.database
      .prepare(
        `INSERT INTO delivery_approved_heads
    (workspace_id,run_id,task_id,ref,base_sha,current_sha,operation_id,updated_at_ms)
    VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        f.contract.workspaceId,
        'run',
        f.boundary.taskId,
        ref,
        f.contract.planningDocuments!.sourceRevision,
        f.contract.planningDocuments!.sourceRevision,
        'fixture-head',
        0,
      );
    if (mode === 'import') {
      f.database
        .prepare(
          `INSERT INTO lineage_approved_heads
      (workspace_id,run_id,task_id,ref,head_sha,tree_sha,artifact_digest,operation_id,created_at_ms)
      VALUES(?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          f.contract.workspaceId,
          'run',
          f.boundary.taskId,
          ref,
          f.contract.planningDocuments!.sourceRevision,
          f.contract.planningDocuments!.sourceRevision,
          'fixture-artifact',
          'fixture-import',
          0,
        );
      f.database.prepare('DELETE FROM delivery_approved_heads').run();
    }
    f.database.pragma('foreign_keys = ON');
    f.store.verifyPlanningDocuments({ ...f.boundary, expectedSourceRoot: taskRoot });
    await writeFile(join(taskRoot, 'tests.md'), 'changed task verification');
    expect(await readFile(join(f.sourceRoot, 'tests.md'), 'utf8')).toBe('test\n');
    expect(() =>
      f.store.verifyPlanningDocuments({
        ...f.boundary,
        taskId: mode === 'run' ? undefined : f.boundary.taskId,
      }),
    ).toThrow('planning_documents_changed');
  },
);
// These entry-point tests isolate document admission; existing positive module suites exercise
// the remaining business preconditions. No external adapter is invoked by these negative calls.
it.each(
  boundaryFaults([
    'transition.prepare',
    'scheduler.reserve',
    'repair.dispatch',
    'delivery.prepare',
    'delivery.ready',
    'delivery.contract',
    'evaluation.record',
    'evaluation.accept',
    'repair.child_prepare',
    'finalization.record',
    'finalization.close',
    'approval.resume',
    'approval.notification',
    'lineage.import',
    'feature.approval',
  ]),
)('rejects $fault material before $boundary can persist authority', async ({ boundary, fault }) => {
  const f = await setup();
  const input = {
    id: 'entry',
    runId: 'run',
    taskId: f.boundary.taskId,
    chainTipTaskId: f.boundary.taskId,
    workspaceId: f.contract.workspaceId,
    ownerId: 'owner',
    runLeaseEpoch: f.boundary.runLeaseEpoch,
    workspaceLeaseEpoch: 1,
    taskLeaseEpoch: 1,
    leaseOwnerId: 'owner',
    leaseEpoch: f.boundary.runLeaseEpoch,
    nowMs: Date.now(),
    createdAtMs: Date.now(),
    deadlineMs: Date.now() + 60000,
    to: 'implementing',
    evaluatorRole: 'feature_evaluator',
  };
  const tables = f.database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  const snapshot = () =>
    Object.fromEntries(
      tables
        .filter(({ name }) => !['plan_approvals', 'planning_document_attempts'].includes(name))
        .map(({ name }) => [name, f.database.prepare(`SELECT * FROM "${name}"`).all()]),
    );
  const before = snapshot();
  await tamperDocument(f, fault);
  const operations: Record<string, () => unknown> = {
    'transition.prepare': () => f.store.prepareTransition(input as never),
    'scheduler.reserve': () => f.store.createSchedulerExecution(input as never),
    'repair.dispatch': () =>
      f.store.planRepairDispatch(input as never, workflowRepairMutationCapability),
    'delivery.prepare': () =>
      f.store.prepareDeliveryOperation(input as never, workflowDeliveryMutationCapability),
    'delivery.ready': () =>
      f.store.assertDeliveryOperationReady(
        input as never,
        input,
        input.nowMs,
        workflowDeliveryMutationCapability,
      ),
    'delivery.contract': () =>
      f.store.recordFeatureDeliveryContract(input as never, workflowDeliveryMutationCapability),
    'evaluation.record': () =>
      f.store.recordEvaluation(input as never, workflowEvaluationMutationCapability),
    'evaluation.accept': () =>
      f.store.recordEvaluationWithEvidence(
        input as never,
        [],
        workflowEvaluationMutationCapability,
      ),
    'repair.child_prepare': () =>
      f.store.prepareRepairChildIntent(input as never, workflowEvaluationMutationCapability),
    'finalization.record': () =>
      f.store.recordFeatureFinalization(input as never, workflowFinalizationMutationCapability),
    'finalization.close': () =>
      f.store.closeFeatureFinalization(input as never, workflowFinalizationMutationCapability),
    'approval.resume': () => f.store.revalidatePlanApproval('approval', f.contract),
  };
  const hash = `sha256:${'a'.repeat(64)}`;
  operations['approval.notification'] = () => {
    const identity = {
      kind: 'notification.approval',
      workspaceId: f.contract.workspaceId,
      runId: 'run',
      taskId: f.boundary.taskId,
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest: f.contract.policyDigest,
      materialDigest: deriveContractMaterialDigest(f.contract),
      headSha: f.contract.planningDocuments!.sourceRevision,
      actionScopeDigest: hash,
      recipientIdentity: 'owner',
      destinationDigest: hash,
      allowedResponseDigest: hash,
      expiresAtMs: Date.now() + 60000,
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: f.boundary.runLeaseEpoch,
      taskLeaseEpoch: 1,
      maxAttempts: 3,
    };
    return f.store.prepareApprovalNotification(
      { ...identity, eventId: digestGovernedValue(identity) },
      input.nowMs,
      workflowGovernedPersistenceCapability,
    );
  };
  operations['lineage.import'] = () =>
    f.store.importWorkflowLineage(
      {
        ownerId: 'owner',
        operationId: 'import',
        nowMs: input.nowMs,
        request: {
          kind: 'workflow.lineage_import',
          sourceRunId: 'source',
          targetRunId: 'run',
          sourceTaskId: f.boundary.taskId,
          targetTaskId: f.boundary.taskId,
          sourceState: 'cancelled',
          targetState: 'approved',
          sourceFenced: true,
          sourcePreparedOperationCount: 0,
          ref: `refs/heads/task/${f.boundary.taskId}`,
          headSha: f.contract.planningDocuments!.sourceRevision,
          treeSha: 'b'.repeat(40),
          implementationArtifactDigest: hash,
          beadsSnapshotDigest: hash,
          contractDigest: hash,
          policyDigest: f.contract.policyDigest,
          materialDigest: deriveContractMaterialDigest(f.contract),
          workspaceLeaseEpoch: 1,
          runLeaseEpoch: f.boundary.runLeaseEpoch,
          taskLeaseEpoch: 1,
        },
      },
      workflowGovernedPersistenceCapability,
    );
  operations['feature.approval'] = () =>
    f.store.createFeatureDeliveryApproval(
      {
        approvalVersion: 1,
        approvalId: 'feature',
        reviewId: 'review',
        taskId: f.boundary.taskId,
        evidence: f.evidence,
        runId: 'run',
        approverId: 'owner',
        approverRole: 'human_approver',
        featureContractVersion: 1,
        featureContractDigest: hash,
        materialDigest: hash,
        policyDigest: f.contract.policyDigest,
        status: 'active',
        approvedAtMs: input.nowMs,
        invalidatedAtMs: null,
        invalidationReason: null,
      },
      {},
      workflowFeatureDeliveryApprovalCapability,
    );
  expect(operations[boundary]).toThrow('planning_documents_changed');
  expect(snapshot()).toEqual(before);
  expect(f.database.prepare("SELECT status FROM plan_approvals WHERE id='approval'").get()).toEqual(
    { status: 'invalidated' },
  );
});
// Persisted pending records are synthetic fixtures. These tests prove real public guard admission,
// while the module suites prove valid state transitions and external adapter behavior.
it.each(
  boundaryFaults([
    'transition.commit',
    'scheduler.result',
    'repair.accept',
    'delivery.commit',
    'delivery.merge_observation',
    'delivery.mutate',
    'repair.child_commit',
    'repair.child_effect',
    'repair.child_dispatch',
  ]),
)(
  'denies $fault material at persisted operation boundary $boundary',
  async ({ boundary, fault }) => {
    const f = await setup();
    const hash = `sha256:${'a'.repeat(64)}`;
    const seed = (table: string, row: Record<string, unknown>) => {
      const keys = Object.keys(row);
      f.database
        .prepare(
          `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        )
        .run(...Object.values(row));
    };
    const common = { id: 'pending', run_id: 'run', created_at_ms: 0, updated_at_ms: 0 };
    const fenced = {
      ...common,
      workspace_id: f.contract.workspaceId,
      owner_id: 'owner',
      workspace_lease_epoch: 1,
      run_lease_epoch: f.boundary.runLeaseEpoch,
      task_lease_epoch: 1,
    };
    if (boundary === 'transition.commit')
      seed('transitions', {
        ...common,
        from_state: 'approved',
        to_state: 'implementing',
        operation: 'workflow.transition',
        expected_run_version: 0,
        idempotency_key: 'pending',
        status: 'prepared',
        actor_role: 'workflow_orchestrator',
        contract_version: 1,
        policy_digest: f.contract.policyDigest,
        lease_owner_id: 'owner',
        lease_epoch: f.boundary.runLeaseEpoch,
        transition_context_json: '{}',
        expected_external_state_json: '{}',
        external_arguments_json: '{}',
      });
    if (boundary === 'scheduler.result')
      seed('scheduler_executions', {
        ...fenced,
        task_id: f.boundary.taskId,
        role: 'implementation_worker',
        mode: 'mutating',
        status: 'active',
        deadline_ms: Date.now() + 60000,
        process_identity: 'pending',
        credential_lease_id: 'pending',
        credential_status: 'pending',
        packet_json: '{}',
      });
    if (boundary === 'repair.accept')
      seed('repair_dispatches', {
        ...common,
        task_id: f.boundary.taskId,
        finding_id: 'finding',
        task_attempt: 1,
        finding_attempt: 1,
        owner_role: 'implementation_worker',
        finding_digest: hash,
        failure_head_sha: 'a'.repeat(40),
        change_digest: hash,
        packet_json: '{}',
        status: 'dispatched',
      });
    if (boundary.startsWith('delivery.'))
      seed('delivery_operations', {
        ...fenced,
        task_id: f.boundary.taskId,
        kind: 'github.merge',
        actor_role: 'workflow_orchestrator',
        request_digest: hash,
        request_json: '{}',
        status: 'prepared',
      });
    if (boundary.startsWith('repair.child'))
      seed('repair_child_intents', {
        ...fenced,
        sequence: 1,
        finding_digest: hash,
        chain_tip_task_id: f.boundary.taskId,
        request_json: '{}',
        status: 'prepared',
      });
    const input = {
      id: 'pending',
      ownerId: 'owner',
      workspaceId: f.contract.workspaceId,
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: f.boundary.runLeaseEpoch,
      taskLeaseEpoch: 1,
      nowMs: Date.now(),
      updatedAtMs: Date.now(),
      clock: Date.now,
      result: {},
      assertExternalState: () => {
        effects++;
      },
      initiate: async () => {
        effects++;
      },
    };
    let effects = 0;
    const operations: Record<string, () => unknown> = {
      'transition.commit': () =>
        f.store.commitTransition('pending', 'owner', f.boundary.runLeaseEpoch, {}),
      'scheduler.result': () => f.store.finishSchedulerExecution({ ...input, status: 'completed' }),
      'repair.accept': () => f.store.acceptRepairDispatch(input, workflowRepairMutationCapability),
      'delivery.commit': () =>
        f.store.commitDeliveryOperation(input, workflowDeliveryMutationCapability),
      'delivery.merge_observation': () =>
        f.store.verifyAndPersistMergeObservation(
          { ...input, observation: {}, observationDigest: hash },
          workflowDeliveryMutationCapability,
        ),
      'delivery.mutate': () =>
        f.store.guardGovernedMutation(input, workflowDeliveryMutationCapability),
      'repair.child_commit': () =>
        f.store.finalizeRepairChildIntent(
          { ...input, status: 'committed' },
          workflowEvaluationMutationCapability,
        ),
      'repair.child_effect': () =>
        f.store.assertRepairChildIntentFence(input, workflowEvaluationMutationCapability),
      'repair.child_dispatch': () =>
        f.store.dispatchRepairChildMutation(
          input,
          () => {
            effects++;
          },
          workflowEvaluationMutationCapability,
        ),
    };
    const tables = [
      'transitions',
      'scheduler_executions',
      'repair_dispatches',
      'delivery_operations',
      'repair_child_intents',
    ];
    const snapshot = () =>
      tables.map((table) => f.database.prepare(`SELECT * FROM ${table}`).all());
    const before = snapshot();
    await tamperDocument(f, fault);
    expect(operations[boundary]).toThrow('planning_documents_changed');
    expect(effects).toBe(0);
    expect(snapshot()).toEqual(before);
    expect(
      f.database.prepare("SELECT status FROM plan_approvals WHERE id='approval'").get(),
    ).toEqual({ status: 'invalidated' });
  },
);

it.each(['accepted', 'resume_pending'] as const)(
  'denies notification %s after document changes',
  async (to) => {
    const f = await setup();
    const hash = `sha256:${'a'.repeat(64)}`;
    const identity = {
      kind: 'notification.approval',
      workspaceId: f.contract.workspaceId,
      runId: 'run',
      taskId: f.boundary.taskId,
      phase: 'delivery',
      predecessor: 'delivery',
      resumeTarget: 'finalizing',
      contractVersion: 1,
      policyDigest: f.contract.policyDigest,
      materialDigest: deriveContractMaterialDigest(f.contract),
      headSha: f.contract.planningDocuments!.sourceRevision,
      actionScopeDigest: hash,
      recipientIdentity: 'owner',
      destinationDigest: hash,
      allowedResponseDigest: hash,
      expiresAtMs: Date.now() + 60000,
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: f.boundary.runLeaseEpoch,
      taskLeaseEpoch: 1,
      maxAttempts: 3,
    };
    const event = { ...identity, eventId: digestGovernedValue(identity) };
    f.database
      .prepare(
        'INSERT INTO approval_notifications (event_id,run_id,task_id,event_json,state,created_at_ms,updated_at_ms) VALUES(?,?,?,?,?,?,?)',
      )
      .run(event.eventId, 'run', f.boundary.taskId, JSON.stringify(event), 'delivered', 0, 0);
    const before = f.store.getApprovalNotification(event.eventId);
    await writeFile(join(f.sourceRoot, 'tests.md'), 'changed');
    expect(() =>
      f.store.casApprovalNotification(
        { eventId: event.eventId, from: 'delivered', to, nowMs: Date.now() },
        workflowGovernedPersistenceCapability,
      ),
    ).toThrow('planning_documents_changed');
    expect(f.store.getApprovalNotification(event.eventId)).toEqual(before);
  },
);
it('denies delegate result acceptance after document changes', async () => {
  const f = await setup();
  const hash = `sha256:${'a'.repeat(64)}`;
  const identity = {
    kind: 'workflow.delegate_callback',
    workspaceId: f.contract.workspaceId,
    parentRunId: 'run',
    parentTaskId: f.boundary.taskId,
    parentState: 'implementing',
    parentRunVersion: 0,
    delegationId: 'delegate',
    delegateAgentId: 'worker',
    delegateRole: 'implementation_worker',
    attemptNumber: 1,
    contractVersion: 1,
    policyDigest: f.contract.policyDigest,
    materialDigest: deriveContractMaterialDigest(f.contract),
    workspaceLeaseEpoch: 1,
    parentRunLeaseEpoch: f.boundary.runLeaseEpoch,
    taskLeaseEpoch: 1,
    headSha: f.contract.planningDocuments!.sourceRevision,
    inputProducerIdentity: 'coordinator',
    resultProducerIdentity: 'worker',
    inputArtifactDigest: hash,
    terminalStatus: 'complete',
    resultArtifactDigest: hash,
  };
  await writeFile(join(f.sourceRoot, 'spec.md'), 'changed');
  expect(() =>
    f.store.recordDelegateCallbackAndTransition(
      {
        callback: { ...identity, callbackId: digestGovernedValue(identity) },
        target: 'reviewing',
        ownerId: 'owner',
        nowMs: Date.now(),
      },
      workflowGovernedPersistenceCapability,
    ),
  ).toThrow('planning_documents_changed');
  expect(f.database.prepare('SELECT count(*) n FROM delegate_callbacks').get()).toEqual({ n: 0 });
});

it('cannot authorize partial object or receipt publication and retries publication idempotently', async () => {
  const f = await setup({ publish: false, approve: false });
  const file = f.contract.planningDocuments!.files[0]!;
  const hash = file.digest.slice(7);
  await rm(join(f.path, '..', 'artifacts', hash.slice(0, 2), hash));
  const publish = () =>
    f.store.recordPlanningDocumentPublication({ runId: 'run', sourceRoot: f.sourceRoot });
  const approve = () =>
    f.store.createPlanApproval({
      runId: 'run',
      approvalId: 'approval',
      approverId: 'fixture-owner',
      contract: f.contract,
      evidence: f.evidence,
    });
  expect(publish).toThrow('document_publication_verification_failed');
  expect(approve).toThrow('document_publication_missing');
  await f.artifactStore.put(await readFile(join(f.sourceRoot, file.path)));
  f.database.exec(
    "CREATE TRIGGER fail_receipt BEFORE INSERT ON planning_document_publications BEGIN SELECT RAISE(ABORT,'receipt_failed'); END",
  );
  expect(publish).toThrow('receipt_failed');
  expect(approve).toThrow('document_publication_missing');
  expect(f.database.prepare('SELECT count(*) n FROM plan_approvals').get()).toEqual({ n: 0 });
  f.database.exec('DROP TRIGGER fail_receipt');
  publish();
  const receipt = f.database.prepare('SELECT * FROM planning_document_publications').all();
  publish();
  expect(f.database.prepare('SELECT * FROM planning_document_publications').all()).toEqual(receipt);
  expect(f.database.prepare('SELECT count(*) n FROM plan_approvals').get()).toEqual({ n: 0 });
  approve();
  expect(f.store.verifyPlanningDocuments(f.boundary).approvalId).toBe('approval');
});
it.each(['spec.md', 'tests.md'])(
  'refuses owner approval if %s changes after publication and review',
  async (path) => {
    const f = await setup({ approve: false });
    await writeFile(join(f.sourceRoot, path), 'edit\n');
    expect(() =>
      f.store.createPlanApproval({
        runId: 'run',
        approvalId: 'approval',
        approverId: 'fixture-owner',
        contract: f.contract,
        evidence: f.evidence,
      }),
    ).toThrow('planning_documents_changed');
    expect(f.database.prepare('SELECT count(*) n FROM plan_approvals').get()).toEqual({ n: 0 });
  },
);

it('rejects incoming lineage whose worktree changed before the ledger exists', async () => {
  const f = await setup();
  const taskRoot = join(f.sourceRoot, '..', 'incoming');
  const ref = `refs/heads/task/${f.boundary.taskId}`;
  execFileSync('git', ['-C', f.sourceRoot, 'worktree', 'add', '-q', '-b', ref.slice(11), taskRoot]);
  await writeFile(join(taskRoot, 'tests.md'), 'changed incoming verification');
  const hash = `sha256:${'a'.repeat(64)}`;
  expect(() =>
    f.store.importWorkflowLineage(
      {
        ownerId: 'owner',
        operationId: 'incoming',
        nowMs: Date.now(),
        request: {
          kind: 'workflow.lineage_import',
          sourceRunId: 'historical',
          targetRunId: 'run',
          sourceTaskId: f.boundary.taskId,
          targetTaskId: f.boundary.taskId,
          sourceState: 'cancelled',
          targetState: 'approved',
          sourceFenced: true,
          sourcePreparedOperationCount: 0,
          ref,
          headSha: f.contract.planningDocuments!.sourceRevision,
          treeSha: 'b'.repeat(40),
          implementationArtifactDigest: hash,
          beadsSnapshotDigest: hash,
          contractDigest: hash,
          policyDigest: f.contract.policyDigest,
          materialDigest: deriveContractMaterialDigest(f.contract),
          workspaceLeaseEpoch: 1,
          runLeaseEpoch: f.boundary.runLeaseEpoch,
          taskLeaseEpoch: 1,
        },
      },
      workflowGovernedPersistenceCapability,
    ),
  ).toThrow('planning_documents_changed');
  expect(await readFile(join(f.sourceRoot, 'tests.md'), 'utf8')).toBe('test\n');
  expect(f.database.prepare('SELECT count(*) n FROM lineage_approved_heads').get()).toEqual({
    n: 0,
  });
  expect(f.store.getRun('run')?.state).toBe('planning');
});

it('does not allow approval creation to revive a run whose documents were invalidated', async () => {
  const f = await setup();
  await writeFile(join(f.sourceRoot, 'spec.md'), 'edit\n');
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('planning_documents_changed');
  await writeFile(join(f.sourceRoot, 'spec.md'), 'spec\n');
  expect(() =>
    f.store.createPlanApproval({
      runId: 'run',
      approvalId: 'replacement',
      approverId: 'fixture-owner',
      contract: f.contract,
      evidence: [],
    }),
  ).toThrow('document_new_contract_required');
});
it.runIf(process.env.WORKFLOW_DOCUMENT_DOCKER === '1').each(['spec.md', 'tests.md'])(
  'consumes the approved snapshot in a real read-only container then rejects changed %s after restart',
  async (changedPath) => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execute = promisify(execFile);
    const f = await setup();
    const task = f.contract.tasks[0]!;
    const packet = coordinator(f).createTaskPacket({
      runId: 'run',
      taskId: task.id,
      evidence: f.evidence,
    });
    const { prepareSpecialistWorkspace, buildDockerSpecialistLaunch } =
      await import('../src/specialistLauncher.js');
    const workspace = await prepareSpecialistWorkspace(f.sourceRoot, ['spec.md']);
    const privateRoot = join(workspace.root, '..');
    roots.push(privateRoot);
    const destination = join(privateRoot, 'approved-documents');
    const authFile = join(privateRoot, 'fixture-auth.json');
    const promptFile = join(privateRoot, 'fixture-prompt.json');
    await writeFile(authFile, '{}');
    await writeFile(promptFile, JSON.stringify(packet));
    f.store.stageApprovedDocuments({
      ...f.boundary,
      packet,
      sourceRoot: f.sourceRoot,
      destination,
    });
    const probe = `const fs=require('node:fs');const assert=require('node:assert/strict');
    assert.equal(fs.readFileSync('/run/approved-documents/documents/spec.md','utf8'),'spec\\n');
    const binding=JSON.parse(fs.readFileSync('/run/approved-documents/binding.json','utf8'));
    assert.equal(binding.approvalId,'approval');assert.equal(binding.runId,'run');
    assert.throws(()=>fs.writeFileSync('/run/approved-documents/documents/spec.md','changed'),e=>['EROFS','EACCES'].includes(e.code));
    assert.throws(()=>fs.writeFileSync('/run/approved-documents/new.md','changed'),e=>['EROFS','EACCES'].includes(e.code));
    console.log('approved snapshot readable; writes denied');`;
    const launch = await buildDockerSpecialistLaunch({
      workspaceRoot: workspace.root,
      codexHome: workspace.codexHome,
      authFile,
      promptFile,
      approvedDocumentsRoot: destination,
      egressNetwork: 'none',
      role: 'implementation_worker',
      runId: 'run',
      image: 'agent-platform-review:0.156.1-hardened',
      containerUser: `${process.getuid!()}:${process.getgid!()}`,
    });
    // Exercise production-generated mounts with a fixed offline consumer, without a model connection.
    const args = [...launch.args.slice(0, -3), 'node', '-e', probe];
    const result = await execute(launch.dockerBinary, args, { timeout: 60000, maxBuffer: 8192 });
    expect(result.stdout.trim()).toBe('approved snapshot readable; writes denied');
    const retained = await new JournaledArtifactRecorder(f.artifactStore, f.store).record(
      Buffer.from(result.stdout),
      {
        mediaType: 'text/plain',
        kind: 'test',
        producer: 'offline-consumer',
        producerRole: 'test_runner',
        workspaceId: f.contract.workspaceId,
        runId: 'run',
        taskId: task.id,
        contractVersion: 1,
        policyDigest: f.contract.policyDigest,
      },
    );
    expect(await f.artifactStore.get(retained.digest)).toEqual(Buffer.from(result.stdout));
    f.store.close();
    stores.splice(stores.indexOf(f.store), 1);
    const reopened = new WorkflowStore(f.path);
    stores.push(reopened);
    const resumed = coordinator(f, reopened).createTaskPacket({
      runId: 'run',
      taskId: task.id,
      evidence: f.evidence,
    });
    expect(resumed.documentBinding).toEqual(packet.documentBinding);
    await writeFile(join(f.sourceRoot, changedPath), 'edit\n');
    expect(() =>
      coordinator(f, reopened).createTaskPacket({
        runId: 'run',
        taskId: task.id,
        evidence: f.evidence,
      }),
    ).toThrow('planning_documents_changed');
    expect(
      f.database.prepare("SELECT count(*) n FROM plan_approvals WHERE status='active'").get(),
    ).toEqual({ n: 0 });
  },
  65000,
);
it('rechecks lease ownership at settlement and leaves a durable pending attempt after takeover', async () => {
  const f = await setup();
  f.database.exec(`CREATE TRIGGER replace_lease AFTER INSERT ON planning_document_attempts
    BEGIN UPDATE leases SET owner_id='replacement',epoch=epoch+1 WHERE resource_type='run' AND resource_id='run'; END`);
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('document_lease_stale');
  expect(
    f.database
      .prepare("SELECT count(*) n FROM planning_document_attempts WHERE status='pending'")
      .get(),
  ).toEqual({ n: 1 });
  f.database.exec('DROP TRIGGER replace_lease');
  const lease = f.database
    .prepare("SELECT epoch FROM leases WHERE resource_type='run' AND resource_id='run'")
    .get() as { epoch: number };
  expect(() =>
    f.store.verifyPlanningDocuments({
      ...f.boundary,
      ownerId: 'replacement',
      runLeaseEpoch: lease.epoch,
    }),
  ).toThrow('document_verification_unresolved');
});
it('reopens unchanged publication and approval without requiring another owner decision', async () => {
  const f = await setup();
  const first = f.store.verifyPlanningDocuments(f.boundary);
  f.store.close();
  stores.splice(stores.indexOf(f.store), 1);
  const reopened = new WorkflowStore(f.path);
  stores.push(reopened);
  expect(reopened.verifyPlanningDocuments({ ...f.boundary, boundary: 'test.restart' })).toEqual(
    first,
  );
  expect(f.database.prepare('SELECT count(*) n FROM plan_approvals').get()).toEqual({ n: 1 });
});
it('retains legacy contract readability while refusing new execution and approval', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'legacy-document-')));
  roots.push(root);
  const path = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(path);
  stores.push(store);
  const legacy = executionContractSchema.parse(
    JSON.parse(
      await readFile(
        new URL('./fixtures/documentBindingLegacyContract.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const id = store.createContract(legacy);
  store.createRun(id, 'planning', 'legacy');
  expect(store.getExecutionContract('legacy')).toEqual(legacy);
  expect(() =>
    store.verifyPlanningDocuments({ runId: 'legacy', ownerId: 'owner', boundary: 'test.resume' }),
  ).toThrow('document_manifest_required');
  expect(() =>
    store.createPlanApproval({
      runId: 'legacy',
      approvalId: 'never',
      approverId: 'owner',
      contract: legacy,
      evidence: [],
    }),
  ).toThrow('document_manifest_required');
});
it('keeps legacy cleanup available while a separately reviewed replacement gets fresh authority', async () => {
  const f = await setup();
  const legacy = structuredClone(f.contract);
  delete legacy.planningDocuments;
  legacy.featureId += '-historical';
  f.store.createRun(f.store.createContract(legacy), 'approved', 'historical');
  f.store.seedLineageApprovalForTest({
    runId: 'historical',
    materialDigest: deriveContractMaterialDigest(legacy),
    nowMs: 0,
  });
  const runEpoch = f.store.acquireLease('run', 'historical', 'owner', 60000).epoch;
  const workspaceEpoch = f.store.acquireLease(
    'workspace',
    legacy.workspaceId,
    'owner',
    60000,
  ).epoch;
  let cleanup = 0;
  const cancellation = WorkflowCancellationCoordinator.createForTest({
    store: f.store,
    contract: legacy,
    port: OfficialCancellationCleanupPort.createForTest({
      async stopOwnedWork() {
        cleanup++;
        return { stopped: true, incomplete: [] };
      },
      async cleanupPreparedEffects() {
        cleanup++;
        return { incomplete: [] };
      },
    }),
  });
  expect(() =>
    f.store.verifyPlanningDocuments({
      runId: 'historical',
      ownerId: 'owner',
      boundary: 'resume',
      runLeaseEpoch: runEpoch,
    }),
  ).toThrow('document_manifest_required');
  await expect(
    cancellation.cancel({
      id: 'legacy-cancel',
      runId: 'historical',
      requestedBy: 'fixture-owner',
      reason: 'replace historical unbound authority',
      stopDeadlineMs: Date.now() + 60000,
      retainedEvidence: [],
      ownerId: 'owner',
      workspaceLeaseEpoch: workspaceEpoch,
      runLeaseEpoch: runEpoch,
    }),
  ).resolves.toMatchObject({ status: 'cancelled' });
  expect(cleanup).toBe(2);
  expect(f.store.getExecutionContract('historical')).toEqual(legacy);
  // The replacement uses the independently recorded critic and owner evidence from setup;
  // no historical approval is copied or converted into a current approval.
  expect(f.store.verifyPlanningDocuments(f.boundary).approvalId).toBe('approval');
  expect(() =>
    f.store.verifyPlanningDocuments({ runId: 'historical', ownerId: 'owner', boundary: 'resume' }),
  ).toThrow('document_manifest_required');
});

it('invalidates sibling runs sharing a publication and requires a new immutable contract', async () => {
  const f = await setup();
  f.store.createRun(f.store.getRun('run')!.contractId, 'planning', 'sibling');
  f.store.seedLineageApprovalForTest({
    runId: 'sibling',
    materialDigest: deriveContractMaterialDigest(f.contract),
    nowMs: 0,
  });
  await writeFile(join(f.sourceRoot, 'spec.md'), 'edit\n');
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('planning_documents_changed');
  await writeFile(join(f.sourceRoot, 'spec.md'), 'spec\n');
  expect(() =>
    f.store.verifyPlanningDocuments({
      runId: 'sibling',
      ownerId: 'owner',
      boundary: 'test.sibling',
    }),
  ).toThrow('document_approval_required');
  expect(() =>
    f.store.createPlanApproval({
      runId: 'sibling',
      approvalId: 'new',
      approverId: 'fixture-owner',
      contract: f.contract,
      evidence: [],
    }),
  ).toThrow('document_new_contract_required');
});

it('rolls back a failed additive migration and reopens without rewriting historical records', () => {
  const database = new Database(':memory:');
  databases.push(database);
  database.exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at_ms INTEGER);
    CREATE TABLE contracts(id TEXT PRIMARY KEY, body_json TEXT);
    CREATE TABLE runs(id TEXT PRIMARY KEY,contract_id TEXT);
    INSERT INTO contracts VALUES('historical','{"unchanged":true}');
    CREATE TRIGGER fail_migration BEFORE INSERT ON schema_migrations WHEN NEW.version=17
    BEGIN SELECT RAISE(ABORT,'migration_failed'); END;`);
  expect(() => initializeDocumentApprovalSchema(database)).toThrow('migration_failed');
  expect(
    database.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'planning_document_%'").all(),
  ).toEqual([]);
  database.exec('DROP TRIGGER fail_migration');
  initializeDocumentApprovalSchema(database);
  initializeDocumentApprovalSchema(database);
  expect(database.prepare('SELECT * FROM contracts').all()).toEqual([
    { id: 'historical', body_json: '{"unchanged":true}' },
  ]);
  expect(
    database.prepare('SELECT count(*) n FROM schema_migrations WHERE version=17').get(),
  ).toEqual({ n: 1 });
});

it('quarantines sibling runs while an invalidation attempt is unresolved', async () => {
  const f = await setup();
  f.store.createRun(f.store.getRun('run')!.contractId, 'planning', 'sibling');
  f.store.seedLineageApprovalForTest({
    runId: 'sibling',
    materialDigest: deriveContractMaterialDigest(f.contract),
    nowMs: 0,
  });
  f.database.exec(
    "CREATE TRIGGER fail_invalidation BEFORE UPDATE ON plan_approvals BEGIN SELECT RAISE(ABORT,'injected'); END",
  );
  await writeFile(join(f.sourceRoot, 'spec.md'), 'edit\n');
  expect(() => f.store.verifyPlanningDocuments(f.boundary)).toThrow('injected');
  await writeFile(join(f.sourceRoot, 'spec.md'), 'spec\n');
  expect(() =>
    f.store.verifyPlanningDocuments({
      runId: 'sibling',
      ownerId: 'owner',
      boundary: 'test.sibling',
    }),
  ).toThrow('document_verification_unresolved');
});

it('upgrades a historical journal through WorkflowStore without rewriting contracts or approvals', async () => {
  const f = await setup();
  const legacy = structuredClone(f.contract);
  delete legacy.planningDocuments;
  legacy.featureId += '-old-schema';
  f.store.createRun(f.store.createContract(legacy), 'approved', 'old-run');
  f.store.seedLineageApprovalForTest({
    runId: 'old-run',
    materialDigest: deriveContractMaterialDigest(legacy),
    nowMs: 0,
  });
  const contracts = f.database.prepare('SELECT * FROM contracts').all();
  const approvals = f.database.prepare('SELECT * FROM plan_approvals').all();
  f.store.close();
  stores.splice(stores.indexOf(f.store), 1);
  f.database.exec(
    'DROP TABLE planning_document_attempts; DROP TABLE planning_document_publications; DELETE FROM schema_migrations WHERE version=17',
  );
  f.database.close();
  databases.splice(databases.indexOf(f.database), 1);
  const reopened = new WorkflowStore(f.path);
  stores.push(reopened);
  const observed = new Database(f.path);
  databases.push(observed);
  expect(observed.prepare('SELECT * FROM contracts').all()).toEqual(contracts);
  expect(observed.prepare('SELECT * FROM plan_approvals').all()).toEqual(approvals);
  expect(reopened.getExecutionContract('old-run')).toEqual(legacy);
  expect(() =>
    reopened.verifyPlanningDocuments({ runId: 'old-run', ownerId: 'owner', boundary: 'resume' }),
  ).toThrow('document_manifest_required');
  expect(
    observed.prepare('SELECT count(*) n FROM schema_migrations WHERE version=17').get(),
  ).toEqual({ n: 1 });
});
