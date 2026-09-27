import Database from 'better-sqlite3';
import { continuationFixture, terminalResult } from './continuationFixture.js';
import { executionContractSchema } from '../src/contracts.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { digestGovernedValue } from '../src/governedOperations.js';
import { ContinuationJournal } from '../src/continuationJournal.js';
import { phaseActionForCallback } from '../src/phaseJobs.js';
/** Disposable approved verification fixture, never a user task or live pilot. */
export async function developmentWorkflowFixture() {
  const f = await continuationFixture(Date.now(), 'implementation_worker', terminalResult, true);
  const db = new Database(f.database);
  const row = db.prepare('SELECT body_json FROM contracts').get() as { body_json: string };
  const contract = executionContractSchema.parse(JSON.parse(row.body_json));
  contract.authority.allowedActions.push('artifact.write', 'workspace.read', 'process.test');
  contract.tasks[0]!.allowedOperations.push('artifact.write', 'workspace.read', 'process.test');
  contract.tasks[0]!.phaseRoles = { task_verification: 'test_runner' };
  const materialDigest = deriveContractMaterialDigest(contract);
  db.prepare('UPDATE contracts SET body_json=?').run(JSON.stringify(contract));
  db.prepare('UPDATE plan_approvals SET material_digest=?').run(materialDigest);
  db.prepare("UPDATE runs SET state='implementing'").run();
  const { callbackId, approvalIntent, ...original } = f.callback;
  void callbackId;
  void approvalIntent;
  const identity = {
    ...original,
    materialDigest,
    parentState: 'implementing' as const,
    terminalStatus: 'continue' as const,
  };
  const callback = { ...identity, callbackId: digestGovernedValue(identity) };
  f.store.seedApprovedTaskHeadForTest({
    workspaceId: contract.workspaceId,
    runId: 'run',
    taskId: 'task',
    headSha: callback.headSha,
  });
  f.store.finishSchedulerExecution({
    id: 'child',
    status: 'completed',
    ownerId: 'owner',
    workspaceLeaseEpoch: 1,
    runLeaseEpoch: 1,
    taskLeaseEpoch: 1,
    result: terminalResult,
    callback,
  });
  const continuations = new ContinuationJournal(f.database);
  const parent = continuations.claim('fixture', 60000, Date.now())!;
  continuations.start(parent.id, parent.host_execution_id!, parent.lease_epoch, Date.now());
  continuations.consume(
    parent.id,
    parent.host_execution_id!,
    parent.lease_epoch,
    phaseActionForCallback(callback),
    Date.now(),
  );
  continuations.close();
  db.prepare('UPDATE leases SET expires_at_ms=0').run();
  db.close();
  f.store.close();
  return f;
}
