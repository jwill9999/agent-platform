import Database from 'better-sqlite3';
import { continuationFixture, terminalResult } from './continuationFixture.js';
import { executionContractSchema } from '../src/contracts.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { digestGovernedValue } from '../src/governedOperations.js';
import { ContinuationJournal } from '../src/continuationJournal.js';
import { phaseActionForCallback } from '../src/phaseJobs.js';
/** Disposable approved verification fixture, never a user task or live pilot. */
export async function developmentWorkflowFixture(
  implementation = false,
  review = false,
  coordinators = false,
  qualification: {
    noHostedChecks?: boolean;
    waitDeadlineSeconds?: number;
    repairPlanning?: boolean;
  } = {},
) {
  const f = await continuationFixture(
    Date.now(),
    implementation ? 'feature_planner' : 'implementation_worker',
    terminalResult,
    true,
  );
  const db = new Database(f.database);
  const row = db.prepare('SELECT body_json FROM contracts').get() as { body_json: string };
  const contract = executionContractSchema.parse(JSON.parse(row.body_json));
  contract.authority.allowedActions.push('artifact.write', 'workspace.read', 'process.test');
  contract.tasks[0]!.allowedOperations.push('artifact.write', 'workspace.read', 'process.test');
  if (implementation) {
    contract.tasks[0]!.assignedRole = 'implementation_worker';
    contract.authority.allowedActions.push('workspace.patch', 'git.commit');
    contract.tasks[0]!.allowedOperations.push('workspace.patch', 'git.commit');
  }
  contract.tasks[0]!.phaseRoles = {
    task_verification: 'test_runner',
    ...(review ? { task_review: 'code_reviewer' as const } : {}),
  };
  if (coordinators) {
    contract.retryPolicy.implementationAttempts = 3;
    contract.tasks[0]!.phaseRoles!.feature_evaluation = 'feature_evaluator';
    for (const operation of [
      'beads.mutate',
      'git.read',
      'git.push',
      'github.read',
      'github.deliver',
    ] as const) {
      contract.authority.allowedActions.push(operation);
      contract.tasks[0]!.allowedOperations.push(operation);
    }
    contract.authority.github.requiredChecks = qualification.noHostedChecks
      ? []
      : ['connected-check'];
    if (qualification.waitDeadlineSeconds)
      contract.retryPolicy.waitDeadlineSeconds = qualification.waitDeadlineSeconds;
    contract.qualityGates = ['connected-check'];
  }
  if (qualification.repairPlanning) {
    contract.tasks[0]!.phaseRoles!.repair_planning = 'feature_planner';
    contract.repairTaskPolicy = {
      idPattern: `${contract.featureId}.repair.<sequence>`,
      maxChildren: 2,
      allowedRoles: ['implementation_worker'],
      allowedPaths: contract.constraints.allowedPaths,
      authorityMayExpand: false,
    };
  }
  const materialDigest = deriveContractMaterialDigest(contract);
  db.prepare('UPDATE contracts SET body_json=?').run(JSON.stringify(contract));
  db.prepare('UPDATE plan_approvals SET material_digest=?').run(materialDigest);
  const parentState = implementation ? ('repair_planning' as const) : ('implementing' as const);
  db.prepare('UPDATE runs SET state=?').run(parentState);
  const original = { ...f.callback };
  Reflect.deleteProperty(original, 'callbackId');
  Reflect.deleteProperty(original, 'approvalIntent');
  const identity = {
    ...original,
    materialDigest,
    parentState,
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
