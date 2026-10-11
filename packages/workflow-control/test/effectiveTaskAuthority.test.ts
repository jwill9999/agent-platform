import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { resolveEffectiveTask } from '../src/effectiveTaskAuthority.js';
import { WorkflowStore } from '../src/storage.js';
import { developmentWorkflowFixture } from './developmentWorkflowFixture.js';
import { rm } from 'node:fs/promises';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const f = await developmentWorkflowFixture(true, true, true);
  roots.push(f.root);
  const store = new WorkflowStore(f.database);
  const contract = store.getExecutionContract('run');
  store.close();
  contract.repairTaskPolicy = {
    ...contract.repairTaskPolicy,
    maxChildren: 2,
    idPattern: 'continuation.repair.<sequence>',
    allowedRoles: ['implementation_worker'],
    allowedPaths: contract.constraints.allowedPaths,
  };
  contract.tasks[0]!.phaseRoles!.repair_planning = 'feature_planner';
  const db = new Database(':memory:');
  db.exec(
    'CREATE TABLE repair_child_intents(id TEXT,run_id TEXT,status TEXT,request_json TEXT,chain_tip_task_id TEXT)',
  );
  const child = {
    id: 'continuation.repair.1',
    runId: 'run',
    workspaceId: contract.workspaceId,
    contractVersion: 1,
    policyDigest: contract.policyDigest,
    sequence: 1,
    chainTipTaskId: 'task',
    dependsOn: 'task',
    branchParent: 'task/task',
    assignedRole: 'implementation_worker',
    allowedPaths: contract.tasks[0]!.allowedPaths,
    allowedOperations: contract.tasks[0]!.allowedOperations,
    authorityExpanded: false,
  };
  const put = (value: typeof child, status = 'committed') =>
    db
      .prepare('INSERT INTO repair_child_intents VALUES(?,?,?,?,?)')
      .run(value.id, 'run', status, JSON.stringify(value), value.chainTipTaskId);
  return { db, contract, child, put };
}
it('inherits approved phase roles only from a committed bounded child', async () => {
  const f = await fixture();
  try {
    expect(resolveEffectiveTask(f.db, f.contract, 'run', f.child.id)).toBeUndefined();
    f.put(f.child, 'prepared');
    expect(resolveEffectiveTask(f.db, f.contract, 'run', f.child.id)).toBeUndefined();
    f.db.prepare("UPDATE repair_child_intents SET status='committed'").run();
    expect(resolveEffectiveTask(f.db, f.contract, 'run', f.child.id)).toMatchObject({
      ancestorTaskId: 'task',
      task: { id: f.child.id, phaseRoles: { repair_planning: 'feature_planner' } },
    });
  } finally {
    f.db.close();
  }
});
it.each([
  'runId',
  'policyDigest',
  'workspaceId',
  'branchParent',
  'sequence',
  'allowedPaths',
  'allowedOperations',
  'assignedRole',
])('rejects child authority expansion or substitution: %s', async (field) => {
  const f = await fixture();
  try {
    const values: Record<string, unknown> = {
      runId: 'other',
      policyDigest: 'other',
      workspaceId: 'other',
      branchParent: 'main',
      sequence: 3,
      allowedPaths: ['outside'],
      allowedOperations: ['process.launch'],
      assignedRole: 'workflow_orchestrator',
    };
    f.put({ ...f.child, [field]: values[field] } as typeof f.child);
    expect(() => resolveEffectiveTask(f.db, f.contract, 'run', f.child.id)).toThrow();
  } finally {
    f.db.close();
  }
});

it('resolves the second linear repair child without widening its phase roles', async () => {
  const f = await fixture();
  try {
    f.put(f.child);
    const second = {
      ...f.child,
      id: 'continuation.repair.2',
      sequence: 2,
      chainTipTaskId: f.child.id,
      dependsOn: f.child.id,
      branchParent: `task/${f.child.id}`,
    };
    f.put(second);
    expect(resolveEffectiveTask(f.db, f.contract, 'run', second.id)).toMatchObject({
      ancestorTaskId: 'task',
      task: { id: second.id, dependsOn: [f.child.id], phaseRoles: f.contract.tasks[0]!.phaseRoles },
    });
  } finally {
    f.db.close();
  }
});
it('rejects a skipped predecessor even when it is another approved task', async () => {
  const f = await fixture();
  try {
    const second = { ...f.child, id: 'continuation.repair.2', sequence: 2 };
    f.put(second);
    expect(() => resolveEffectiveTask(f.db, f.contract, 'run', second.id)).toThrow(
      'immutable binding',
    );
  } finally {
    f.db.close();
  }
});
it('does not resolve a child whose predecessor is uncommitted', async () => {
  const f = await fixture();
  try {
    f.put(f.child, 'prepared');
    const second = {
      ...f.child,
      id: 'continuation.repair.2',
      sequence: 2,
      chainTipTaskId: f.child.id,
      dependsOn: f.child.id,
      branchParent: `task/${f.child.id}`,
    };
    f.put(second);
    expect(() => resolveEffectiveTask(f.db, f.contract, 'run', second.id)).toThrow(
      'approved ancestor',
    );
  } finally {
    f.db.close();
  }
});
