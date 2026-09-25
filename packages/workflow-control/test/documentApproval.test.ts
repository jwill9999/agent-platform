import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { WorkflowStore } from '../src/storage.js';
import { ContentAddressedArtifactStore } from '../src/artifacts.js';
import { publishPlanningDocumentObjects } from '../src/planningDocuments.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { executionContractSchema } from '../src/contracts.js';
import { initializeDocumentApprovalSchema } from '../src/documentApproval.js';

const roots: string[] = [];
const stores: WorkflowStore[] = [];
const databases: Database.Database[] = [];
afterEach(async () => {
  for (const s of stores.splice(0)) s.close();
  for (const d of databases.splice(0)) d.close();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function setup() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'document-journal-')));
  roots.push(root);
  const sourceRoot = join(root, 'source');
  await mkdir(sourceRoot);
  await writeFile(join(sourceRoot, 'spec.md'), 'spec\n');
  await writeFile(join(sourceRoot, 'tests.md'), 'test\n');
  const input = JSON.parse(
    await readFile(
      new URL('./fixtures/documentBindingLegacyContract.json', import.meta.url),
      'utf8',
    ),
  );
  const taskId = input.tasks[0].id;
  const artifactStore = new ContentAddressedArtifactStore(join(root, 'artifacts'));
  input.planningDocuments = await publishPlanningDocumentObjects({
    sourceRoot,
    workspaceId: input.workspaceId,
    repository: input.authority.github.repository,
    sourceRevision: 'a'.repeat(40),
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
  return { store, database, sourceRoot, path, boundary, contract, artifactStore };
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
  reopened.recoverPlanningDocumentVerification(f.boundary);
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
it('stages exact approved bytes with packet identity and rejects substituted authority', async () => {
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
  f.store.stageApprovedDocuments({ ...f.boundary, packet, sourceRoot: f.sourceRoot, destination });
  expect(await readFile(join(destination, 'documents', 'spec.md'), 'utf8')).toBe('spec\n');
  await writeFile(join(f.sourceRoot, 'spec.md'), 'edit\n');
  expect(await readFile(join(destination, 'documents', 'spec.md'), 'utf8')).toBe('spec\n');
  expect(() =>
    f.store.stageApprovedDocuments({
      ...f.boundary,
      packet,
      sourceRoot: f.sourceRoot,
      destination: join(f.path, '..', 'next'),
    }),
  ).toThrow('planning_documents_changed');
});
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
  ).toThrow('document_snapshot_binding_rejected');
  expect(() => f.store.stageApprovedDocuments({ ...input, taskId: 'unknown' })).toThrow(
    'document_task_unknown',
  );
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
it.runIf(process.env.WORKFLOW_DOCUMENT_DOCKER === '1')(
  'consumes the approved snapshot in a real read-only container',
  async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execute = promisify(execFile);
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
