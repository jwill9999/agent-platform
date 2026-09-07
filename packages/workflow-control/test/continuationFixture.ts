import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { WorkflowStore } from '../src/storage.js';
import { digestGovernedValue } from '../src/governedOperations.js';
import type { ExecutionContract, WorkflowRole } from '../src/contracts.js';

export const terminalResult = {
  status: 'passed',
  summary: 'specialist child completed',
  changedFiles: [],
  acceptanceCriteria: { passed: ['durable'], failed: [] },
  evidence: [],
  findings: [],
  remainingRisks: [],
  recommendedTransition: 'continue',
};

export async function continuationFixture(
  nowMs = Date.now(),
  role: WorkflowRole = 'code_reviewer',
  resultInput: unknown = terminalResult,
) {
  const root = await mkdtemp(join(tmpdir(), 'continuation-'));
  const database = join(root, 'workflow.sqlite');
  const store = new WorkflowStore(database);
  const digest = `sha256:${'a'.repeat(64)}`;
  const contract: ExecutionContract = {
    featureId: 'continuation',
    contractVersion: 1,
    policyDigest: digest,
    workspaceId: digest,
    objective: 'durable progression',
    requirements: [],
    nonGoals: [],
    acceptanceCriteria: ['durable'],
    constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
    authority: {
      deliveryTarget: 'feature/test',
      allowedActions: ['workflow.delegate_callback'],
      github: {
        repository: 'owner/repo',
        base: 'feature/test',
        mergeMethod: 'squash',
        requiredChecks: [],
      },
    },
    tasks: [
      {
        id: 'task',
        dependsOn: [],
        risk: 'standard',
        assignedRole: role,
        branchParent: 'feature/test',
        allowedPaths: ['packages/workflow-control'],
        allowedOperations: ['workflow.delegate_callback'],
      },
    ],
    qualityGates: [],
    retryPolicy: {
      implementationAttempts: 1,
      findingAttempts: 1,
      infrastructureAttempts: 1,
      waitDeadlineSeconds: 60,
    },
    repairTaskPolicy: {
      idPattern: 'task.fix.<sequence>',
      maxChildren: 0,
      allowedRoles: ['implementation_worker'],
      allowedPaths: ['packages/workflow-control'],
      authorityMayExpand: false,
    },
    escalationPolicy: [],
  };
  const contractId = store.createContract(contract, nowMs);
  store.createRunForTest(contractId, 'task_review', 'run');
  const workspaceLeaseEpoch = store.acquireLease(
    'workspace',
    digest,
    'owner',
    120_000,
    nowMs,
  ).epoch;
  const runLeaseEpoch = store.acquireLease('run', 'run', 'owner', 120_000, nowMs).epoch;
  const taskLeaseEpoch = store.acquireLease('task', 'task', 'owner', 120_000, nowMs).epoch;
  const artifacts = store.seedDelegateCallbackAuthorizationForTest({
    workspaceId: digest,
    runId: 'run',
    taskId: 'task',
    delegationId: 'child',
    delegateAgentId: 'child-process',
    delegateRole: role,
    ownerId: 'owner',
    workspaceLeaseEpoch,
    runLeaseEpoch,
    taskLeaseEpoch,
    materialDigest: digest,
    headSha: 'a'.repeat(40),
    inputProducerIdentity: 'orchestrator',
    input: { task: 'fixture' },
    result: resultInput,
    nowMs,
  });
  // Fixture only: the terminal production write is exercised after a real child exits in E2E.
  const db = new Database(database);
  db.prepare(
    "UPDATE scheduler_executions SET status = 'active', result_json = NULL WHERE id = 'child'",
  ).run();
  db.close();
  const identity = {
    kind: 'workflow.delegate_callback' as const,
    workspaceId: digest,
    parentRunId: 'run',
    parentTaskId: 'task',
    parentState: 'task_review' as const,
    parentRunVersion: 0,
    delegationId: 'child',
    delegateAgentId: 'child-process',
    delegateRole: role,
    attemptNumber: 1,
    contractVersion: 1 as const,
    policyDigest: digest,
    materialDigest: digest,
    workspaceLeaseEpoch,
    parentRunLeaseEpoch: runLeaseEpoch,
    taskLeaseEpoch,
    headSha: 'a'.repeat(40),
    inputProducerIdentity: 'orchestrator',
    resultProducerIdentity: 'child-process',
    inputArtifactDigest: artifacts.inputArtifactDigest,
    terminalStatus: 'approval_required' as const,
    resultArtifactDigest: artifacts.resultArtifactDigest,
    approvalIntent: {
      eventId: digest,
      phase: 'task_review',
      resumeTarget: 'task_accepted' as const,
      recipientIdentity: 'owner',
      deadlineMs: nowMs + 120_000,
    },
  };
  const callback = { ...identity, callbackId: digestGovernedValue(identity) };
  const finish = (withCallback = true, result: unknown = resultInput) =>
    store.finishSchedulerExecution({
      id: 'child',
      status: 'completed',
      ownerId: 'owner',
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      result,
      nowMs,
      ...(withCallback ? { callback } : {}),
    });
  return { root, database, store, callback, finish };
}
