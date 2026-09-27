import { rm } from 'node:fs/promises';
import { afterEach, expect, it } from 'vitest';
import {
  assertRepairPlanningResult,
  buildRepairChildRequest,
  type RepairPlanningContext,
} from '../src/repairPlanning.js';
import { WorkflowStore } from '../src/storage.js';
import { developmentWorkflowFixture } from './developmentWorkflowFixture.js';
import type { AgentResult } from '../src/contracts.js';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const evidence = {
  digest: `sha256:${'a'.repeat(64)}`,
  mediaType: 'application/json',
  sizeBytes: 100,
  kind: 'evaluation' as const,
};
const context: RepairPlanningContext = {
  evaluationId: `sha256:${'b'.repeat(64)}`,
  headSha: 'c'.repeat(40),
  summary: 'Criterion failed',
  failedCriteria: [{ criterion: 'durable', summary: 'Missing result', evidence: [evidence] }],
};
const terminal: AgentResult = {
  status: 'passed',
  summary: 'Proposed bounded repair',
  changedFiles: [],
  acceptanceCriteria: { passed: [], failed: [] },
  evidence: [],
  findings: [
    {
      id: 'finding',
      severity: 'high',
      summary: 'Fix missing result',
      acceptanceCriterion: 'durable',
      evidence: [evidence],
      repairHypothesis: 'Persist the result before acknowledgement',
    },
  ],
  remainingRisks: [],
  recommendedTransition: 'continue',
};
it('accepts a bounded plan without claiming that feature criteria passed', () => {
  expect(assertRepairPlanningResult(terminal, context)).toEqual(terminal);
});
it.each([
  { ...terminal, acceptanceCriteria: { passed: ['durable'], failed: [] } },
  { ...terminal, changedFiles: ['source.ts'] },
  { ...terminal, findings: [] },
  { ...terminal, findings: [{ ...terminal.findings[0]!, acceptanceCriterion: 'other' }] },
  { ...terminal, findings: [{ ...terminal.findings[0]!, repairHypothesis: '' }] },
  {
    ...terminal,
    findings: [
      { ...terminal.findings[0]!, evidence: [{ ...evidence, digest: `sha256:${'d'.repeat(64)}` }] },
    ],
  },
  { ...terminal, status: 'needs_repair' },
  { ...terminal, recommendedTransition: 'integrate' },
])('rejects malformed or misleading repair proposal %#', (value) => {
  expect(() => assertRepairPlanningResult(value, context)).toThrow();
});
it('derives child identity and permission intersection from approved material', async () => {
  const f = await developmentWorkflowFixture(true, true, true, { repairPlanning: true });
  roots.push(f.root);
  const store = new WorkflowStore(f.database);
  try {
    const contract = store.getExecutionContract('run');
    const parent = contract.tasks[0]!;
    contract.repairTaskPolicy.allowedPaths = ['packages/workflow-control'];
    const request = buildRepairChildRequest({
      contract,
      parent,
      runId: 'run',
      sequence: 1,
      context,
      terminal,
      remainingRetryBudget: {
        implementationAttempts: 2,
        findingAttempts: 1,
        infrastructureAttempts: 1,
        waitDeadlineSeconds: 60,
      },
    });
    expect(request).toMatchObject({
      id: `${contract.featureId}.repair.1`,
      dependsOn: parent.id,
      branchParent: `task/${parent.id}`,
      branchParentSha: context.headSha,
      authorityExpanded: false,
      assignedRole: 'implementation_worker',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: parent.allowedOperations,
    });
    const unauthorized = {
      ...parent,
      allowedOperations: parent.allowedOperations.filter((op) => op !== 'beads.mutate'),
    };
    expect(() =>
      buildRepairChildRequest({
        contract,
        parent: unauthorized,
        runId: 'run',
        sequence: 1,
        context,
        terminal,
        remainingRetryBudget: request.remainingRetryBudget,
      }),
    ).toThrow('handoff authority');
  } finally {
    store.close();
  }
});

it('binds the child handoff to the retained result and preserves the parent callback', async () => {
  const { default: Database } = await import('better-sqlite3');
  const {
    initializeRepairPlanning,
    prepareRepairPlanningHandoff,
    activateRepairPlanningHandoff,
    repairChildForCallback,
  } = await import('../src/repairPlanningJournal.js');
  const { digestGovernedValue } = await import('../src/governedOperations.js');
  const f = await developmentWorkflowFixture(true, true, true, { repairPlanning: true });
  roots.push(f.root);
  const store = new WorkflowStore(f.database);
  const db = new Database(':memory:');
  db.exec(
    'CREATE TABLE scheduler_executions(id TEXT PRIMARY KEY,packet_json TEXT);CREATE TABLE repair_child_intents(id TEXT,status TEXT,request_json TEXT)',
  );
  initializeRepairPlanning(db);
  try {
    const contract = store.getExecutionContract('run');
    const request = buildRepairChildRequest({
      contract,
      parent: contract.tasks[0]!,
      runId: 'run',
      sequence: 1,
      context,
      terminal,
      remainingRetryBudget: {
        implementationAttempts: 2,
        findingAttempts: 0,
        infrastructureAttempts: 1,
        waitDeadlineSeconds: 60,
      },
    });
    const executionId = 'planner-execution';
    db.prepare('INSERT INTO scheduler_executions VALUES(?,?)').run(executionId, '{}');
    const resultDigest = digestGovernedValue({
      executionDigest: digestGovernedValue(executionId),
      terminal,
    });
    prepareRepairPlanningHandoff(db, { executionId, request, terminal, resultDigest });
    expect(() => activateRepairPlanningHandoff(db, executionId)).toThrow('not committed');
    db.prepare('INSERT INTO repair_child_intents VALUES(?,?,?)').run(
      request.id,
      'committed',
      JSON.stringify(request),
    );
    const callback = {
      ...f.callback,
      delegationId: executionId,
      parentState: 'repair_planning' as const,
      delegateRole: 'feature_planner' as const,
      terminalStatus: 'continue' as const,
      resultArtifactDigest: resultDigest,
      workspaceId: request.workspaceId,
      parentRunId: request.runId,
      parentTaskId: request.chainTipTaskId,
      headSha: request.branchParentSha,
      policyDigest: request.policyDigest,
      contractVersion: request.contractVersion,
    };
    expect(() => repairChildForCallback(db, callback)).toThrow('activated');
    activateRepairPlanningHandoff(db, executionId);
    expect(repairChildForCallback(db, callback)).toBe(request.id);
    expect(callback.parentTaskId).toBe('task');
    for (const changed of [
      { parentTaskId: request.id },
      { resultArtifactDigest: context.evaluationId },
      { headSha: 'e'.repeat(40) },
      { parentRunId: 'other' },
      { delegateRole: 'implementation_worker' as const },
    ])
      expect(() => repairChildForCallback(db, { ...callback, ...changed })).toThrow();
    expect(() =>
      prepareRepairPlanningHandoff(db, {
        executionId,
        request: { ...request, branchParentSha: 'e'.repeat(40) },
        terminal,
        resultDigest,
      }),
    ).toThrow('immutable');
  } finally {
    db.close();
    store.close();
  }
});
