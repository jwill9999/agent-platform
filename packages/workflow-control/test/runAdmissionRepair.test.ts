import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import { documentFixture } from './documentFixture.js';
import { WorkflowStore, workflowEvaluationMutationCapability } from '../src/storage.js';
import { executionContractSchema } from '../src/contracts.js';
import { readFile } from 'node:fs/promises';

const roots: string[] = [];
const execute = promisify(execFile);
afterEach(async () => {
  await Promise.all(roots.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'r1-repair-'));
  roots.push(root);
  const contract = executionContractSchema.parse(
    JSON.parse(
      await readFile(
        new URL(
          '../../../docs/planning/standalone-pilot/execution-contract.v1.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
  delete contract.planningDocuments;
  contract.repairTaskPolicy.maxChildren = 1;
  const publish = await documentFixture(contract, root);
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  store.createRun(store.createContract(contract), 'repair_planning', 'parent');
  publish(store, 'parent', true);
  const ownerId = 'owner';
  const taskId = contract.tasks[0]!.id;
  const workspaceLeaseEpoch = store.acquireLease(
    'workspace',
    contract.workspaceId,
    ownerId,
    100000,
    1000,
  ).epoch;
  const runLeaseEpoch = store.acquireLease('run', 'parent', ownerId, 100000, 1000).epoch;
  const taskLeaseEpoch = store.acquireLease('task', taskId, ownerId, 100000, 1000).epoch;
  const findingId = 'finding';
  const id = 'child';
  const remainingRetryBudget = store.remainingRepairBudgetForChild(
    {
      runId: 'parent',
      featureId: contract.featureId,
      childId: id,
      findingId,
      policy: contract.retryPolicy,
    },
    workflowEvaluationMutationCapability,
  );
  const input = {
    id,
    workspaceId: contract.workspaceId,
    runId: 'parent',
    sequence: 1,
    findingDigest: `sha256:${'d'.repeat(64)}`,
    chainTipTaskId: taskId,
    ownerId,
    workspaceLeaseEpoch,
    runLeaseEpoch,
    taskLeaseEpoch,
    createdAtMs: 1000,
    request: {
      id,
      featureId: contract.featureId,
      finding: { id: findingId },
      remainingRetryBudget,
    },
  };
  const other = structuredClone(contract);
  delete other.planningDocuments;
  other.featureId = 'other';
  other.tasks = [{ ...other.tasks[0]!, id }];
  const otherId = store.createContract(other);
  return { root, store, database, input, otherId };
}
it.each(['repair-first', 'run-first'])('rejects competing owner: %s', async (order) => {
  const f = await setup();
  try {
    if (order === 'repair-first') {
      f.store.prepareRepairChildIntent(f.input, workflowEvaluationMutationCapability);
      expect(() => f.store.createRun(f.otherId, 'approved', 'other')).toThrow(
        'run_admission_conflict',
      );
    } else {
      f.store.createRun(f.otherId, 'approved', 'other');
      expect(() =>
        f.store.prepareRepairChildIntent(f.input, workflowEvaluationMutationCapability),
      ).toThrow('run_admission_conflict');
      expect(f.store.getRepairChildIntent('child')).toBeUndefined();
    }
  } finally {
    f.store.close();
  }
});
it('serializes process-level repair reservation versus run admission after both observe absence', async () => {
  const f = await setup();
  f.store.close();
  const module = new URL('../dist/storage.js', import.meta.url).href;
  const discovery = new URL('../dist/runDiscovery.js', import.meta.url).href;
  const script = `import { WorkflowStore, workflowEvaluationMutationCapability } from ${JSON.stringify(module)};
    import { queryRunInventory } from ${JSON.stringify(discovery)};
    import Database from 'better-sqlite3';
    import { writeFileSync, existsSync } from 'node:fs';
    const [database, root, kind, raw, contract] = process.argv.slice(1); const input = JSON.parse(raw);
    const s = new WorkflowStore(database); const db = new Database(database, { readonly: true });
    if(queryRunInventory(db, {workspaceId:input.workspaceId,taskId:'child'}).status!=='absent')throw new Error('not empty'); db.close();
    writeFileSync(root+'/'+kind+'.ready','ready'); const deadline=Date.now()+10000;
    while(!existsSync(root+'/release')){if(Date.now()>deadline)throw new Error('barrier timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}
    try { if(kind==='repair') s.prepareRepairChildIntent(input,workflowEvaluationMutationCapability);else s.createRun(contract,'approved','other');console.log('admitted'); }
    catch(e){console.log(e.message);}finally{s.close();}`;
  const pending = ['repair', 'run'].map((kind) =>
    execute(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        script,
        f.database,
        f.root,
        kind,
        JSON.stringify(f.input),
        f.otherId,
      ],
      { cwd: new URL('..', import.meta.url) },
    ),
  );
  const deadline = Date.now() + 10000;
  while (
    !(await readdir(f.root)).includes('repair.ready') ||
    !(await readdir(f.root)).includes('run.ready')
  ) {
    if (Date.now() > deadline) throw new Error('barrier timeout');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await writeFile(join(f.root, 'release'), 'go');
  const results = (await Promise.all(pending)).map((r) => r.stdout.trim()).sort();
  expect(results).toEqual(['admitted', 'run_admission_conflict']);
}, 15000);

it.each(['cancel', 'workspace', 'run', 'task'])(
  'rechecks %s after a competing process changes authority before transaction acquisition',
  async (kind) => {
    const f = await setup();
    const original = f.input.request;
    const script = `import Database from 'better-sqlite3';
    const db = new Database(process.argv[1]);
    if(process.argv[2] === 'cancel') db.prepare("UPDATE runs SET state='cancelled' WHERE id='parent'").run();
    else db.prepare("UPDATE leases SET owner_id='replacement', epoch=epoch+1 WHERE resource_type=?").run(process.argv[2]);
    db.close();`;
    Object.defineProperty(f.input.request, 'toJSON', {
      value() {
        execFileSync(process.execPath, ['--input-type=module', '-e', script, f.database, kind], {
          cwd: new URL('..', import.meta.url),
        });
        return { ...original };
      },
    });
    try {
      expect(() =>
        f.store.prepareRepairChildIntent(f.input, workflowEvaluationMutationCapability),
      ).toThrow();
      expect(f.store.getRepairChildIntent('child')).toBeUndefined();
    } finally {
      f.store.close();
    }
  },
);
