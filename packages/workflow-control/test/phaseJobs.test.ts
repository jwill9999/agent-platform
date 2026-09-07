import { rm } from 'node:fs/promises';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { executionContractSchema } from '../src/contracts.js';
import { ContinuationJournal } from '../src/continuationJournal.js';
import { runParentContinuation } from '../src/continuationProcess.js';
import { digestGovernedValue, type DelegateCallback } from '../src/governedOperations.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import {
  PHASE_JOB_DISPATCH,
  PhaseJobJournal,
  phaseActionForCallback,
  type PhaseJob,
} from '../src/phaseJobs.js';
import { continuationFixture, terminalResult } from './continuationFixture.js';
import {
  OfficialCancellationCleanupPort,
  WorkflowCancellationCoordinator,
} from '../src/cancellation.js';
import { enqueueContinuation } from '../src/continuationJournal.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function fixture(
  parentState: DelegateCallback['parentState'] = 'implementing',
  terminalStatus: DelegateCallback['terminalStatus'] = 'continue',
) {
  const now = Date.now();
  const result =
    terminalStatus === 'repair' ? { ...terminalResult, status: 'needs_repair' } : terminalResult;
  const f = await continuationFixture(now, 'implementation_worker', result);
  const db = new Database(f.database);
  const row = db.prepare('SELECT body_json FROM contracts').get() as { body_json: string };
  const materialDigest = deriveContractMaterialDigest(
    executionContractSchema.parse(JSON.parse(row.body_json)),
  );
  db.prepare('UPDATE plan_approvals SET material_digest = ?').run(materialDigest);
  db.prepare('UPDATE runs SET state = ?').run(parentState);
  const { approvalIntent: _approval, callbackId: _callbackId, ...base } = f.callback;
  void _approval;
  void _callbackId;
  const identity = {
    ...base,
    parentState,
    terminalStatus,
    materialDigest,
    ...(terminalStatus === 'approval_required'
      ? { approvalIntent: f.callback.approvalIntent }
      : {}),
  };
  const callback: DelegateCallback = { ...identity, callbackId: digestGovernedValue(identity) };
  f.store.seedApprovedTaskHeadForTest({
    workspaceId: callback.workspaceId,
    runId: 'run',
    taskId: 'task',
    headSha: callback.headSha,
    nowMs: now,
  });
  f.store.finishSchedulerExecution({
    id: 'child',
    status: 'completed',
    ownerId: 'owner',
    workspaceLeaseEpoch: callback.workspaceLeaseEpoch,
    runLeaseEpoch: callback.parentRunLeaseEpoch,
    taskLeaseEpoch: callback.taskLeaseEpoch,
    result,
    callback,
    nowMs: now,
  });
  const continuations = new ContinuationJournal(f.database);
  const phases = new PhaseJobJournal(f.database);
  cleanups.push(async () => {
    phases.close();
    continuations.close();
    db.close();
    f.store.close();
    await rm(f.root, { recursive: true, force: true });
  });
  function consume() {
    const job = continuations.claim('host', 60_000, now)!;
    continuations.start(job.id, job.host_execution_id!, job.lease_epoch, now);
    continuations.consume(
      job.id,
      job.host_execution_id!,
      job.lease_epoch,
      phaseActionForCallback(callback),
      now,
    );
    return job;
  }
  return { ...f, db, phases, continuations, callback, now, consume };
}

function completeNextSpecialist(f: Awaited<ReturnType<typeof fixture>>, job: PhaseJob) {
  const action = f.phases.action(job);
  const role = PHASE_JOB_DISPATCH[action.phase];
  const processIdentity = `specialist-process:${job.id}`;
  const result = { ...terminalResult, summary: `New ${role} result for ${job.id}` };
  const artifacts = f.store.seedDelegateCallbackAuthorizationForTest({
    workspaceId: action.workspaceId,
    runId: action.runId,
    taskId: action.taskId,
    delegationId: job.execution_id!,
    delegateAgentId: processIdentity,
    delegateRole: role,
    ownerId: 'owner',
    workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
    runLeaseEpoch: f.callback.parentRunLeaseEpoch,
    taskLeaseEpoch: f.callback.taskLeaseEpoch,
    materialDigest: action.materialDigest,
    headSha: action.headSha,
    inputProducerIdentity: 'orchestrator',
    input: { phaseJob: job.id, phase: action.phase },
    result,
    nowMs: f.now,
  });
  const { callbackId, ...previousIdentity } = f.callback;
  void callbackId;
  const identity = {
    ...previousIdentity,
    parentState: action.phase,
    parentRunVersion: action.runVersion,
    delegationId: job.execution_id!,
    delegateAgentId: processIdentity,
    delegateRole: role,
    resultProducerIdentity: processIdentity,
    ...artifacts,
    terminalStatus: 'continue' as const,
  };
  f.store.finishSchedulerExecution({
    id: job.execution_id!,
    status: 'completed',
    ownerId: 'owner',
    workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
    runLeaseEpoch: f.callback.parentRunLeaseEpoch,
    taskLeaseEpoch: f.callback.taskLeaseEpoch,
    result,
    callback: { ...identity, callbackId: digestGovernedValue(identity) },
    nowMs: f.now,
  });
  return { executionId: job.execution_id!, evidenceDigest: artifacts.resultArtifactDigest };
}

describe('standalone durable phase jobs', () => {
  it.each([
    ['implementing', 'continue', 'task_verification', 'test_runner'],
    ['implementing', 'repair', 'task_verification', 'test_runner'],
    ['task_verification', 'continue', 'task_review', 'code_reviewer'],
    ['task_verification', 'repair', 'repair', 'repair_coordinator'],
    ['task_review', 'continue', 'task_accepted', 'task_acceptance_coordinator'],
    ['task_review', 'repair', 'repair', 'repair_coordinator'],
    ['feature_evaluation', 'repair', 'repair_planning', 'feature_planner'],
    ['repair_planning', 'continue', 'implementing', 'implementation_worker'],
    ['pipeline', 'continue', 'delivery', 'delivery_coordinator'],
    ['delivery', 'continue', 'finalizing', 'finalization_coordinator'],
    ['finalizing', 'complete', 'finalizing', 'finalization_coordinator'],
  ] as const)(
    'maps %s/%s to %s without inventing a transition',
    async (parent, result, phase, dispatch) => {
      const f = await fixture(parent, result);
      f.consume();
      const [job] = f.phases.list();
      const action = f.phases.action(job!);
      expect(action.phase).toBe(phase);
      expect(PHASE_JOB_DISPATCH[action.phase]).toBe(dispatch);
      expect(f.store.getRun('run')).toMatchObject({ state: phase, version: 1 });
      expect(
        f.continuations.timeline('run').filter((event) => event.kind === 'phase_queued'),
      ).toHaveLength(1);
      expect(f.continuations.timeline('run').some((event) => event.kind === 'phase_started')).toBe(
        false,
      );
    },
  );

  it('atomically consumes a callback into exactly one job across duplicate consumption and restart', async () => {
    const f = await fixture();
    const parent = f.consume();
    const restarted = new ContinuationJournal(f.database);
    try {
      restarted.consume(
        parent.id,
        parent.host_execution_id!,
        parent.lease_epoch,
        phaseActionForCallback(f.callback),
        f.now + 1,
      );
      expect(f.phases.list()).toHaveLength(1);
      expect(f.db.prepare('SELECT wake_status FROM delegate_callbacks').get()).toEqual({
        wake_status: 'woken',
      });
      expect(f.db.prepare('SELECT count(*) AS count FROM continuation_actions').get()).toEqual({
        count: 1,
      });
    } finally {
      restarted.close();
    }
  });

  it.each([
    ['run', 'UPDATE runs SET version = version + 1'],
    [
      'head',
      "UPDATE delivery_approved_heads SET current_sha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'",
    ],
    ['approval', "UPDATE plan_approvals SET status = 'invalidated'"],
    [
      'material',
      `UPDATE contracts SET body_json = json_set(body_json, '$.objective', 'changed contract')`,
    ],
    [
      'policy',
      `UPDATE contracts SET body_json = json_set(body_json, '$.policyDigest', 'sha256:${'b'.repeat(64)}')`,
    ],
  ])('rejects stale %s at enqueue and leaves no partial action', async (_name, sql) => {
    const f = await fixture();
    f.db.prepare(sql).run();
    expect(() => f.consume()).toThrow(/stale|approval/);
    expect(f.phases.list()).toEqual([]);
    expect(f.continuations.action('specialist:child')).toBeUndefined();
    expect(f.continuations.get('specialist:child')?.status).toBe('started');
  });

  it('rejects substituted callback identity and phase', async () => {
    const f = await fixture();
    const parent = f.continuations.claim('host', 60_000, f.now)!;
    f.continuations.start(parent.id, parent.host_execution_id!, parent.lease_epoch, f.now);
    const action = phaseActionForCallback(f.callback);
    for (const replacement of [
      { callbackId: `sha256:${'b'.repeat(64)}` },
      { phase: 'task_review' },
    ]) {
      expect(() =>
        f.continuations.consume(
          parent.id,
          parent.host_execution_id!,
          parent.lease_epoch,
          { ...action, ...replacement },
          f.now,
        ),
      ).toThrow(/binding/);
    }
    expect(f.phases.list()).toEqual([]);
  });

  it('allows only one claimer and fences stale workers after a pre-start crash', async () => {
    const f = await fixture();
    f.consume();
    const other = new PhaseJobJournal(f.database);
    try {
      const first = f.phases.claim('one', 100, f.now)!;
      expect(other.claim('two', 100, f.now)).toBeUndefined();
      const second = other.claim('two', 100, f.now + 101)!;
      expect(second.lease_epoch).toBe(first.lease_epoch + 1);
      expect(() => f.phases.start(first, f.now + 102)).toThrow(/fence/);
      expect(() => f.phases.renew(first, 100, f.now + 102)).toThrow(/fence/);
      expect(other.start(second, f.now + 102).status).toBe('started');
    } finally {
      other.close();
    }
  });

  it('revalidates authority at claim and start with a visible blocker for stale queued work', async () => {
    const f = await fixture();
    f.consume();
    f.db.prepare('UPDATE runs SET version = 2').run();
    expect(f.phases.claim('one', 100, f.now)).toBeUndefined();
    expect(f.phases.list()[0]).toMatchObject({ status: 'blocked' });
    expect(f.continuations.timeline('run').some((event) => event.kind === 'phase_blocked')).toBe(
      true,
    );
  });

  it('rejects a head change between claim and start without a false phase-start event', async () => {
    const f = await fixture();
    f.consume();
    const claimed = f.phases.claim('one', 100, f.now)!;
    f.db.prepare('UPDATE delivery_approved_heads SET current_sha = ?').run('b'.repeat(40));
    expect(() => f.phases.start(claimed, f.now)).toThrow(/head/);
    expect(f.phases.get(claimed.id)?.status).toBe('claimed');
    expect(f.continuations.timeline('run').some((event) => event.kind === 'phase_started')).toBe(
      false,
    );
  });

  it('does not infer a head ledger or active callback authority when either is absent', async () => {
    const noHead = await fixture();
    noHead.db.prepare('DELETE FROM delivery_approved_heads').run();
    expect(() => noHead.consume()).toThrow(/head/);
    expect(noHead.phases.list()).toEqual([]);
    const noAuthority = await fixture();
    const row = noAuthority.db.prepare('SELECT body_json FROM contracts').get() as {
      body_json: string;
    };
    const contract = executionContractSchema.parse(JSON.parse(row.body_json));
    contract.authority.allowedActions = [];
    noAuthority.db.prepare('UPDATE contracts SET body_json = ?').run(JSON.stringify(contract));
    expect(() => noAuthority.consume()).toThrow(/material|authority/);
    expect(noAuthority.phases.list()).toEqual([]);
  });

  it('keeps started work beyond five seconds and requires recovery instead of duplicate launch', async () => {
    const f = await fixture();
    f.consume();
    const claimed = f.phases.claim('one', 20_000, f.now)!;
    const started = f.phases.start(claimed, f.now);
    f.phases.renew(started, 20_000, f.now + 10_000);
    const restarted = new PhaseJobJournal(f.database);
    try {
      expect(restarted.claim('two', 1000, f.now + 30_001)).toBeUndefined();
      const recovered = restarted.claimRecovery('two', 1000, f.now + 30_001)!;
      expect(recovered.execution_id).toBe(started.execution_id);
      expect(() => restarted.start(recovered, f.now + 30_002)).toThrow(/not claimed/);
      expect(() => f.phases.block(started, 'old worker', f.now + 30_002)).toThrow(/fence/);
      restarted.block(recovered, 'specialist settlement requires coordinator', f.now + 30_002);
      expect(f.phases.list()[0]?.status).toBe('blocked');
      expect(
        f.continuations.timeline('run').filter((event) => event.kind === 'phase_started'),
      ).toHaveLength(1);
    } finally {
      restarted.close();
    }
  });

  it('requires execution-bound durable completion and fences late completion', async () => {
    const f = await fixture();
    f.consume();
    const claimed = f.phases.claim('one', 100, f.now)!;
    const started = f.phases.start(claimed, f.now);
    const missingReceipt = {
      executionId: started.execution_id!,
      evidenceDigest: f.callback.resultArtifactDigest,
    };
    expect(() => f.phases.complete(started, missingReceipt, f.now)).toThrow(/committed execution/);
    const receipt = completeNextSpecialist(f, started);
    expect(receipt.evidenceDigest).not.toBe(f.callback.resultArtifactDigest);
    expect(f.store.getRun('run')?.state).toBe('task_review');
    expect(() => f.phases.complete(started, receipt, f.now + 101)).toThrow(/fence/);
    const recovered = f.phases.claimRecovery('two', 100, f.now + 101)!;
    f.phases.complete(recovered, receipt, f.now + 102);
    f.phases.complete(recovered, receipt, f.now + 103);
    expect(f.phases.list()[0]?.status).toBe('completed');
    expect(
      f.continuations.timeline('run').filter((event) => event.kind === 'phase_completed'),
    ).toHaveLength(1);
    expect(f.store.getRun('run')?.state).toBe('task_review');
  });

  it.each([
    ['head_sha', 'b'.repeat(40)],
    ['producer', 'previous-implementation-process'],
    ['producer_role', 'implementation_worker'],
  ])(
    'rejects result evidence with substituted %s without completing',
    async (field, replacement) => {
      const f = await fixture();
      f.consume();
      const started = f.phases.start(f.phases.claim('one', 100, f.now)!, f.now);
      const receipt = completeNextSpecialist(f, started);
      f.db
        .prepare(`UPDATE secure_evidence SET ${field} = ? WHERE digest = ?`)
        .run(replacement, receipt.evidenceDigest);
      expect(() => f.phases.complete(started, receipt, f.now)).toThrow(/durable evidence/);
      expect(f.phases.get(started.id)).toMatchObject({ status: 'started', result_json: null });
      expect(
        f.continuations.timeline('run').filter((event) => event.kind === 'phase_completed'),
      ).toEqual([]);
    },
  );

  it('rejects a previous implementation result even when it has valid generic evidence scope', async () => {
    const f = await fixture();
    f.consume();
    const started = f.phases.start(f.phases.claim('one', 100, f.now)!, f.now);
    completeNextSpecialist(f, started);
    f.db
      .prepare(
        "UPDATE scheduler_executions SET result_json = (SELECT result_json FROM scheduler_executions WHERE id = 'child') WHERE id = ?",
      )
      .run(started.execution_id!);
    expect(() =>
      f.phases.complete(
        started,
        { executionId: started.execution_id!, evidenceDigest: f.callback.resultArtifactDigest },
        f.now,
      ),
    ).toThrow(/callback binding/);
    expect(f.phases.get(started.id)).toMatchObject({ status: 'started', result_json: null });
  });

  it('does not invent coordinator completion authority from a generic transition receipt', async () => {
    const f = await fixture('task_review');
    f.consume();
    const started = f.phases.start(f.phases.claim('one', 100, f.now)!, f.now);
    expect(() =>
      f.phases.complete(
        started,
        { executionId: started.execution_id!, evidenceDigest: f.callback.resultArtifactDigest },
        f.now,
      ),
    ).toThrow(/coordinator completion authority unavailable/);
    expect(f.phases.get(started.id)).toMatchObject({ status: 'started', result_json: null });
  });

  it('production continuation queues runnable work and reports missing authority visibly', async () => {
    const f = await fixture();
    const parent = f.continuations.claim('host', 60_000, f.now)!;
    runParentContinuation([
      f.database,
      parent.id,
      parent.host_execution_id!,
      String(parent.lease_epoch),
    ]);
    expect(f.continuations.action(parent.id)?.kind).toBe('execute_phase');
    expect(f.phases.list()).toHaveLength(1);
    const stale = await fixture();
    stale.db.prepare("UPDATE plan_approvals SET status = 'invalidated'").run();
    const staleParent = stale.continuations.claim('host', 60_000, stale.now)!;
    runParentContinuation([
      stale.database,
      staleParent.id,
      staleParent.host_execution_id!,
      String(staleParent.lease_epoch),
    ]);
    expect(stale.continuations.action(staleParent.id)).toMatchObject({
      kind: 'blocked',
      reason: expect.stringContaining('phase_authority_unavailable'),
    });
    expect(stale.phases.list()).toEqual([]);
  });

  it('preserves approval and blocked outcomes without enqueueing specialist work', async () => {
    for (const status of ['approval_required', 'blocked'] as const) {
      const f = await fixture('task_review', status);
      const parent = f.continuations.claim('host', 60_000, f.now)!;
      runParentContinuation([
        f.database,
        parent.id,
        parent.host_execution_id!,
        String(parent.lease_epoch),
      ]);
      expect(f.continuations.action(parent.id)?.kind).toBe(status);
      expect(f.phases.list()).toEqual([]);
    }
  });
});

describe('cancellation queue fencing', () => {
  it('keeps phase launch fenced after an incomplete cancellation deadline while allowing observation recovery', async () => {
    const f = await fixture();
    f.consume();
    const job = f.phases.start(f.phases.claim('phase-owner', 1000, f.now)!, f.now);
    let now = f.now;
    const coordinator = WorkflowCancellationCoordinator.createForTest({
      store: f.store,
      contract: f.store.getExecutionContract('run'),
      clock: () => now,
      port: OfficialCancellationCleanupPort.createForTest({
        async stopOwnedWork() {
          return { stopped: false, incomplete: ['owned-work'] };
        },
        async cleanupPreparedEffects() {
          return { incomplete: [] };
        },
      }),
    });
    const fence = {
      ownerId: 'owner',
      workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
      runLeaseEpoch: f.callback.parentRunLeaseEpoch,
    };
    expect(
      (
        await coordinator.cancel({
          id: 'cancel',
          runId: 'run',
          requestedBy: 'owner',
          reason: 'planned_authority_handoff',
          stopDeadlineMs: now + 2000,
          retainedEvidence: [],
          ...fence,
        })
      ).status,
    ).toBe('requested');
    now += 2001;
    expect((await coordinator.resume({ runId: 'run', ...fence })).status).toBe('escalated');
    expect(f.store.getRun('run')?.state).toBe('escalated');
    const recovery = f.phases.claimRecovery('observer', 1000, now)!;
    expect(recovery.id).toBe(job.id);
    f.phases.block(recovery, 'observed_stopped', now);
    // Exercise stale pending and claimed work independently of cancellation's eager cleanup.
    f.db.prepare("UPDATE phase_jobs SET status='pending',lease_until_ms=0").run();
    expect(f.phases.claim('late', 1000, now)).toBeUndefined();
    expect(f.phases.get(job.id)?.failure_code).toBe('phase run is cancelled');
    f.db.prepare("UPDATE phase_jobs SET status='claimed',lease_until_ms=?").run(now + 1000);
    expect(() => f.phases.start(f.phases.get(job.id)!, now)).toThrow('phase run is cancelled');
  });
  it.each(['pending', 'claimed'] as const)(
    'atomically fences %s phase work and rejects cancellation-time enqueues/claims',
    async (status) => {
      const f = await fixture();
      f.consume();
      if (status === 'claimed') f.phases.claim('phase-owner', 1000, f.now);
      let cleanupObserved = false;
      const coordinator = WorkflowCancellationCoordinator.createForTest({
        store: f.store,
        contract: f.store.getExecutionContract('run'),
        clock: () => f.now,
        port: OfficialCancellationCleanupPort.createForTest({
          async stopOwnedWork() {
            cleanupObserved = true;
            expect(f.continuations.claim('late', 1000, f.now)).toBeUndefined();
            expect(f.phases.claim('late', 1000, f.now)).toBeUndefined();
            enqueueContinuation(f.db, 'child', 'run', f.now);
            return { stopped: true, incomplete: [] };
          },
          async cleanupPreparedEffects() {
            return { incomplete: [] };
          },
        }),
      });
      const result = await coordinator.cancel({
        id: 'cancel',
        runId: 'run',
        requestedBy: 'owner',
        reason: 'planned_authority_handoff',
        stopDeadlineMs: f.now + 1000,
        retainedEvidence: [],
        ownerId: 'owner',
        workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
        runLeaseEpoch: f.callback.parentRunLeaseEpoch,
      });
      expect(cleanupObserved).toBe(true);
      expect(result.status).toBe('cancelled');
      expect(f.phases.list()[0]?.status).toBe('blocked');
      expect(f.continuations.claim('late', 1000, f.now + 2000)).toBeUndefined();
      expect(f.phases.claimRecovery('late', 1000, f.now + 2000)).toBeUndefined();
      f.continuations.reconcileMissingIntents(f.now + 2000);
      expect(f.continuations.list()).toHaveLength(1);
      expect(f.db.prepare('SELECT run_id FROM cancellation_work_fences').get()).toEqual({
        run_id: 'run',
      });
    },
  );
  it('does not declare started phase execution stopped from a cleanup boolean alone', async () => {
    const f = await fixture();
    f.consume();
    const job = f.phases.start(f.phases.claim('phase-owner', 1000, f.now)!, f.now);
    const coordinator = WorkflowCancellationCoordinator.createForTest({
      store: f.store,
      contract: f.store.getExecutionContract('run'),
      clock: () => f.now,
      port: OfficialCancellationCleanupPort.createForTest({
        async stopOwnedWork() {
          return { stopped: true, incomplete: [] };
        },
        async cleanupPreparedEffects() {
          return { incomplete: [] };
        },
      }),
    });
    const request = {
      id: 'cancel',
      runId: 'run',
      requestedBy: 'owner',
      reason: 'planned_authority_handoff',
      stopDeadlineMs: f.now + 2000,
      retainedEvidence: [],
      ownerId: 'owner',
      workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
      runLeaseEpoch: f.callback.parentRunLeaseEpoch,
    };
    expect((await coordinator.cancel(request)).status).toBe('requested');
    expect(f.store.getRun('run')?.state).toBe('cancelling');
    // Actual cleanup can settle the execution under its fence; no relaunch is implied.
    f.phases.block(job, 'observed_stopped', f.now);
    expect(
      (
        await coordinator.resume({
          runId: 'run',
          ownerId: 'owner',
          workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
          runLeaseEpoch: f.callback.parentRunLeaseEpoch,
        })
      ).status,
    ).toBe('cancelled');
    expect(f.phases.claimRecovery('other', 1000, f.now + 3000)).toBeUndefined();
  });
});
