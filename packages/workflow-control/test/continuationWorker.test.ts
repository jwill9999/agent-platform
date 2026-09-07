import { rm } from 'node:fs/promises';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { ContinuationJournal } from '../src/continuationJournal.js';
import { ContinuationWorker, type AsyncParentExecutionHost } from '../src/continuationWorker.js';
import { createWorkflowStoreDelegateCallbackStore } from '../src/governedPersistence.js';
import { continuationFixture, terminalResult } from './continuationFixture.js';
import { specialistTerminalResult } from '../src/specialistTerminalResult.js';
import { digestGovernedValue } from '../src/governedOperations.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const options = {
  pollIntervalMs: 10,
  overdueThresholdMs: 20,
  leaseTtlMs: 100,
  hostTimeoutMs: 50,
  maxAttempts: 2,
  deadlineMs: 1000,
};

async function setup() {
  const fixture = await continuationFixture(1000);
  roots.push(fixture.root);
  const journal = new ContinuationJournal(fixture.database);
  return { ...fixture, journal };
}

describe('durable continuation watchdog', () => {
  it.each(['observe', 'start'] as const)(
    'does not report a blocker when the parent consumes before an unavailable %s response',
    async (boundary) => {
      const { finish, journal, store, database, callback } = await setup();
      finish();
      const parent = new ContinuationJournal(database);
      const action = { kind: 'approval_required', eventId: callback.approvalIntent.eventId };
      const consume: AsyncParentExecutionHost['observe'] = async (job) => {
        expect(parent.start(job.id, job.host_execution_id!, job.lease_epoch, 1000)).toBe(true);
        parent.consume(job.id, job.host_execution_id!, job.lease_epoch, action, 1000);
        return { status: 'unavailable' };
      };
      const host: AsyncParentExecutionHost = {
        observe: boundary === 'observe' ? consume : async () => ({ status: 'missing' }),
        start: consume,
      };
      const errors: unknown[] = [];
      const worker = new ContinuationWorker(
        journal,
        host,
        options,
        () => 1000,
        (error) => errors.push(error),
      );
      await worker.tick();
      await worker.tick();
      expect(errors).toEqual([]);
      expect(journal.get('specialist:child')).toMatchObject({
        status: 'consumed',
        failure_code: null,
      });
      expect(journal.action('specialist:child')).toEqual(action);
      const timeline = journal.timeline('run');
      expect(timeline.filter((event) => event.kind === 'next_action')).toHaveLength(1);
      expect(timeline.filter((event) => event.kind === 'continuation_consumed')).toHaveLength(1);
      expect(
        timeline
          .filter((event) => ['approval_required', 'blocked'].includes(event.kind))
          .map((event) => event.kind),
      ).toEqual(['approval_required']);
      parent.close();
      journal.close();
      store.close();
    },
  );

  it('lets a second worker expire the first observation lease without duplicate blockers or a stale start', async () => {
    const { finish, journal, store, database } = await setup();
    finish();
    const other = new ContinuationJournal(database);
    let now = 1000;
    let observed!: () => void;
    let finishObservation!: () => void;
    const observing = new Promise<void>((resolve) => {
      observed = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      finishObservation = resolve;
    });
    let starts = 0;
    const errors: unknown[] = [];
    const host: AsyncParentExecutionHost = {
      async observe() {
        observed();
        await barrier;
        return { status: 'missing' };
      },
      async start(job) {
        starts += 1;
        return { status: 'accepted', executionId: job.host_execution_id! };
      },
    };
    const worker = new ContinuationWorker(
      journal,
      host,
      { ...options, deadlineMs: 50 },
      () => now,
      (error) => errors.push(error),
    );
    const pending = worker.tick();
    await observing;
    now = 1050;
    await new ContinuationWorker(other, host, { ...options, deadlineMs: 50 }, () => now).tick();
    finishObservation();
    await pending;
    expect(starts).toBe(0);
    expect(errors).toHaveLength(1);
    expect(journal.timeline('run').filter((event) => event.kind === 'blocked')).toHaveLength(1);
    other.close();
    journal.close();
    store.close();
  });
  it('expires an accepted outstanding lease at the absolute deadline and fences both workers', async () => {
    const { finish, journal, store, database } = await setup();
    finish();
    const other = new ContinuationJournal(database);
    const claimed = journal.claim('first', 1000, 1000)!;
    journal.accepted(claimed, 1000);
    journal.reconcileDeadlines(1050, 50);
    other.reconcileDeadlines(1050, 50);
    expect(other.get(claimed.id)).toMatchObject({
      status: 'blocked',
      lease_until_ms: 0,
      lease_epoch: claimed.lease_epoch + 1,
    });
    expect(other.timeline('run').filter((event) => event.kind === 'blocked')).toHaveLength(1);
    expect(journal.start(claimed.id, claimed.host_execution_id!, claimed.lease_epoch, 1050)).toBe(
      false,
    );
    expect(() => journal.accepted(claimed, 1050)).toThrow('fence');
    other.close();
    journal.close();
    store.close();
  });

  it('accepts an eventual immutable callback after watchdog acceptance and consumes the next action once', async () => {
    const { finish, journal, store, callback } = await setup();
    finish(false);
    let now = 1021;
    const host: AsyncParentExecutionHost = {
      async observe() {
        return { status: 'missing' };
      },
      async start(job) {
        return { status: 'accepted', executionId: job.host_execution_id! };
      },
    };
    await new ContinuationWorker(journal, host, options, () => now).tick();
    const accepted = journal.get('specialist:child')!;
    expect(accepted.status).toBe('accepted');
    finish(true);
    expect(journal.get(accepted.id)?.host_execution_id).toBe(accepted.host_execution_id);
    const callbacks = createWorkflowStoreDelegateCallbackStore({
      store,
      ownerId: 'owner',
      clock: () => now,
    });
    const substitutionIdentity = { ...callback, callbackId: undefined };
    const substitutedIntent = {
      ...substitutionIdentity,
      approvalIntent: { ...callback.approvalIntent, eventId: `sha256:${'f'.repeat(64)}` },
    };
    const substituted = {
      ...substitutedIntent,
      callbackId: digestGovernedValue(substitutedIntent),
    };
    expect(() =>
      callbacks.recordAndTransition({
        callback: substituted,
        target: 'approval_waiting',
        expectedParentVersion: 0,
      }),
    ).toThrow();
    expect(JSON.parse(journal.get(accepted.id)!.callback_json!)).toEqual(callback);
    now += 1;
    expect(journal.start(accepted.id, accepted.host_execution_id!, accepted.lease_epoch, now)).toBe(
      true,
    );
    const action = { kind: 'approval_required', eventId: callback.approvalIntent.eventId };
    journal.consume(accepted.id, accepted.host_execution_id!, accepted.lease_epoch, action, now);
    finish(true);
    journal.consume(accepted.id, accepted.host_execution_id!, accepted.lease_epoch, action, now);
    expect(store.getRun('run')).toMatchObject({ state: 'approval_waiting', version: 1 });
    expect(journal.timeline('run').filter((event) => event.kind === 'next_action')).toHaveLength(1);
    journal.close();
    store.close();
  });
  it('requires an actual structured terminal message, not tool output or arbitrary JSON events', () => {
    const item = { type: 'agent_message', text: JSON.stringify(terminalResult) };
    expect(specialistTerminalResult({ events: [{ type: 'item.completed', item }] })).toEqual(
      terminalResult,
    );
    expect(specialistTerminalResult({ events: [{ type: 'item.started', item }] })).toBeUndefined();
    expect(
      specialistTerminalResult({
        events: [{ type: 'item.completed', item: { ...item, type: 'tool_result' } }],
      }),
    ).toBeUndefined();
  });

  it.each([{ arbitrary: 'text' }, { ...terminalResult, status: 'blocked' }])(
    'rolls back callback progression for invalid or contradictory terminal output',
    async (result) => {
      const fixture = await continuationFixture(1000, 'code_reviewer', result);
      roots.push(fixture.root);
      expect(() => fixture.finish()).toThrow(/validated terminal result/);
      expect(fixture.store.getRun('run')).toMatchObject({ state: 'task_review', version: 0 });
      expect(fixture.store.getSchedulerExecution('child')?.status).toBe('active');
      const journal = new ContinuationJournal(fixture.database);
      expect(journal.list()).toHaveLength(0);
      journal.close();
      fixture.store.close();
    },
  );
  it('immediately handles the completion signal without waiting for the watchdog interval', async () => {
    const { finish, journal, store } = await setup();
    let called!: () => void;
    const started = new Promise<void>((resolve) => {
      called = resolve;
    });
    const host: AsyncParentExecutionHost = {
      async observe() {
        return { status: 'missing' };
      },
      async start(job) {
        called();
        return { status: 'accepted', executionId: job.host_execution_id! };
      },
    };
    const worker = new ContinuationWorker(
      journal,
      host,
      { ...options, pollIntervalMs: 60_000 },
      () => 1000,
    );
    await worker.start();
    finish();
    await started;
    await worker.stop();
    journal.close();
    store.close();
  });

  it('attaches a callback when completion is retried after the result transaction survived a restart', async () => {
    const { finish, journal, store } = await setup();
    finish(false);
    expect(journal.get('specialist:child')?.callback_json).toBeNull();
    finish(true);
    expect(journal.get('specialist:child')?.callback_json).not.toBeNull();
    expect(store.getRun('run')).toMatchObject({ state: 'approval_waiting', version: 1 });
    journal.close();
    store.close();
  });
  it('ignores running specialists until overdue, then exposes recovery work without a callback', async () => {
    const { journal, store } = await setup();
    journal.reconcileMissingIntents(1000);
    expect(journal.list()).toHaveLength(0);
    journal.reconcileMissingIntents(11_001);
    expect(journal.list()).toHaveLength(1);
    expect(journal.specialistResult('child').status).toBe('active');
    journal.close();
    store.close();
  });
  it('keeps acceptance pending, retries after restart, and visibly blocks exhausted delivery', async () => {
    const { finish, journal, store, database } = await setup();
    finish();
    let now = 1000;
    const host: AsyncParentExecutionHost = {
      async observe(job) {
        return { status: 'accepted', executionId: job.host_execution_id! };
      },
      async start() {
        throw new Error('acceptance is not a start');
      },
    };
    await new ContinuationWorker(journal, host, options, () => now).tick();
    const first = journal.get('specialist:child')!;
    expect(first).toMatchObject({
      status: 'accepted',
      attempts: 1,
      started_at_ms: null,
      consumed_at_ms: null,
    });
    journal.close();
    const restarted = new ContinuationJournal(database);
    now = 1101;
    await new ContinuationWorker(restarted, host, options, () => now).tick();
    expect(restarted.get(first.id)).toMatchObject({
      status: 'accepted',
      attempts: 2,
      host_execution_id: first.host_execution_id,
    });
    now = 1202;
    await new ContinuationWorker(restarted, host, options, () => now).tick();
    expect(restarted.get(first.id)).toMatchObject({
      status: 'blocked',
      failure_code: 'host_resume_unavailable',
    });
    expect(restarted.action(first.id)).toBeUndefined();
    restarted.close();
    store.close();
  });

  it('recovers a missed completion intent, defers missing callback, then consumes eventual callback once', async () => {
    const { finish, journal, store, database, callback } = await setup();
    finish(false);
    const db = new Database(database);
    db.prepare('DELETE FROM continuation_events').run();
    db.prepare('DELETE FROM continuation_jobs').run(); // Simulate the pre-fix completion gap.
    db.close();
    let now = 1000;
    const host: AsyncParentExecutionHost = {
      async observe() {
        return { status: 'missing' };
      },
      async start(job) {
        expect(journal.start(job.id, job.host_execution_id!, job.lease_epoch, now)).toBe(true);
        journal.consume(
          job.id,
          job.host_execution_id!,
          job.lease_epoch,
          { kind: 'approval_required', eventId: callback.approvalIntent.eventId },
          now,
        );
        return { status: 'consumed', executionId: job.host_execution_id! };
      },
    };
    const worker = new ContinuationWorker(journal, host, options, () => now);
    await worker.tick();
    expect(journal.get('specialist:child')).toMatchObject({
      status: 'pending',
      attempts: 0,
      next_check_at_ms: 1010,
    });
    const callbacks = createWorkflowStoreDelegateCallbackStore({
      store,
      ownerId: 'owner',
      clock: () => now,
    });
    callbacks.recordAndTransition({
      callback,
      target: 'approval_waiting',
      expectedParentVersion: 0,
    });
    now = 1011;
    await worker.tick();
    expect(journal.get('specialist:child')?.status).toBe('consumed');
    expect(
      callbacks.recordAndTransition({
        callback,
        target: 'approval_waiting',
        expectedParentVersion: 0,
      }).disposition,
    ).toBe('duplicate');
    await worker.tick();
    expect(store.getRun('run')).toMatchObject({ state: 'approval_waiting', version: 1 });
    journal.close();
    store.close();
  });

  it('fences duplicate supervisors, recovers a crashed started parent, and rejects stale consumption', async () => {
    const { finish, journal, store, database } = await setup();
    finish();
    const other = new ContinuationJournal(database);
    const first = journal.claim('one', 100, 1000)!;
    expect(other.claim('two', 100, 1000)).toBeUndefined();
    expect(journal.start(first.id, first.host_execution_id!, first.lease_epoch, 1000)).toBe(true);
    const recovered = other.claim('two', 100, 1101)!;
    expect(() =>
      journal.consume(
        first.id,
        first.host_execution_id!,
        first.lease_epoch,
        { kind: 'blocked', reason: 'stale' },
        1101,
      ),
    ).toThrow('fence');
    expect(
      other.start(recovered.id, recovered.host_execution_id!, recovered.lease_epoch, 1101),
    ).toBe(true);
    const action = { kind: 'blocked', reason: 'host_resume_unavailable' };
    other.consume(recovered.id, recovered.host_execution_id!, recovered.lease_epoch, action, 1101);
    other.consume(recovered.id, recovered.host_execution_id!, recovered.lease_epoch, action, 1102);
    expect(other.action(first.id)).toEqual(action);
    other.close();
    journal.close();
    store.close();
  });

  it('persists busy-parent retry time and rejects an unproved consumption claim', async () => {
    const { finish, journal, store } = await setup();
    finish();
    let now = 1000;
    const errors: unknown[] = [];
    const host: AsyncParentExecutionHost = {
      async observe(job) {
        return now === 1000
          ? { status: 'busy' }
          : { status: 'consumed', executionId: job.host_execution_id! };
      },
      async start() {
        throw new Error('busy parent cannot be started');
      },
    };
    const worker = new ContinuationWorker(
      journal,
      host,
      options,
      () => now,
      (error) => errors.push(error),
    );
    await worker.tick();
    expect(journal.get('specialist:child')).toMatchObject({
      next_check_at_ms: 1010,
      last_attempt_at_ms: 1000,
      attempts: 1,
    });
    now = 1011;
    await worker.tick();
    expect(errors).toHaveLength(1);
    expect(journal.get('specialist:child')?.consumed_at_ms).toBeNull();
    journal.close();
    store.close();
  });
});
