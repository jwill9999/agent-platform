import { rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { continuationFixture } from './continuationFixture.js';
import { BootstrapJournal } from '../src/bootstrapJournal.js';
import { createObservedBootstrapCleanupPort } from '../src/bootstrap.js';
import { WorkflowCancellationCoordinator } from '../src/cancellation.js';
import {
  ContinuationNotificationDispatcher,
  JsonlContinuationNotificationSink,
} from '../src/continuationNotifications.js';
import { ContinuationJournal, enqueueContinuation } from '../src/continuationJournal.js';
import { runAcceptsWork } from '../src/workCancellation.js';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
describe('cancellation owns asynchronous outbox fencing', () => {
  it.each([false, true])(
    'observes a lost notification acknowledgement without new sends after cancellation (deadline=%s)',
    async (deadline) => {
      const f = await continuationFixture(1000);
      roots.push(f.root);
      f.finish();
      const journal = new BootstrapJournal(f.database);
      let now = 1000;
      const feed = join(f.root, 'feed.jsonl');
      const sink = new JsonlContinuationNotificationSink(feed);
      let sends = 0;
      const first = new ContinuationNotificationDispatcher(
        f.database,
        {
          channel: sink.channel,
          observe: (event) => sink.observe(event),
          async send(event) {
            sends++;
            await sink.send(event);
            throw Error('response lost');
          },
        },
        () => now,
        50,
        () => undefined,
      );
      await first.flush();
      await first.stop();
      const cancel = WorkflowCancellationCoordinator.createForTest({
        store: f.store,
        contract: f.store.getExecutionContract('run'),
        clock: () => now,
        port: createObservedBootstrapCleanupPort(journal),
      });
      const fence = {
        ownerId: 'owner',
        workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
        runLeaseEpoch: f.callback.parentRunLeaseEpoch,
      };
      expect(
        (
          await cancel.cancel({
            id: 'cancel',
            runId: 'run',
            requestedBy: 'owner',
            reason: 'planned_authority_handoff',
            stopDeadlineMs: 2000,
            retainedEvidence: [],
            ...fence,
          })
        ).status,
      ).toBe('requested');
      now = deadline ? 2001 : 1101;
      if (deadline) {
        expect((await cancel.resume({ runId: 'run', ...fence })).status).toBe('escalated');
        expect(f.store.getRun('run')?.state).toBe('escalated');
      }
      const recovery = new ContinuationNotificationDispatcher(f.database, sink, () => now, 50);
      await recovery.flush();
      await recovery.stop();
      expect((await cancel.resume({ runId: 'run', ...fence })).status).toBe(
        deadline ? 'escalated' : 'cancelled',
      );
      expect(sends).toBe(1);
      expect((await readFile(feed, 'utf8')).trim().split('\n')).toHaveLength(1);
      const queue = new ContinuationJournal(f.database);
      expect(queue.claim('late', 1000, 3000)).toBeUndefined();
      queue.close();
      journal.close();
      f.store.close();
    },
  );
  it('cancellation wins an observe-before-send race and fences waiting approval contexts', async () => {
    const f = await continuationFixture(1000);
    roots.push(f.root);
    f.finish();
    const journal = new BootstrapJournal(f.database);
    let release: (value: null) => void = () => undefined;
    let entered: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let sends = 0;
    const notifications = new ContinuationNotificationDispatcher(
      f.database,
      {
        channel: 'race',
        observe: () => {
          entered();
          return new Promise<null>((resolve) => {
            release = resolve;
          });
        },
        async send() {
          sends++;
          return 'must not send';
        },
      },
      () => 1000,
      5000,
      () => undefined,
    );
    const pending = notifications.flush();
    await ready;
    const cancel = WorkflowCancellationCoordinator.createForTest({
      store: f.store,
      contract: f.store.getExecutionContract('run'),
      clock: () => 1000,
      port: createObservedBootstrapCleanupPort(journal),
    });
    const fence = {
      ownerId: 'owner',
      workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
      runLeaseEpoch: f.callback.parentRunLeaseEpoch,
    };
    expect(
      (
        await cancel.cancel({
          id: 'cancel',
          runId: 'run',
          requestedBy: 'owner',
          reason: 'planned_authority_handoff',
          stopDeadlineMs: 2000,
          retainedEvidence: [],
          ...fence,
        })
      ).status,
    ).toBe('requested');
    release(null);
    await pending;
    await notifications.stop();
    expect((await cancel.resume({ runId: 'run', ...fence })).status).toBe('cancelled');
    expect(sends).toBe(0);
    const raw = new Database(f.database);
    expect(raw.prepare('SELECT run_id FROM cancellation_work_fences').get()).toEqual({
      run_id: 'run',
    });
    expect(raw.prepare('SELECT status FROM approval_wait_contexts').get()).toEqual({
      status: 'waiting',
    });
    raw.close();
    journal.close();
    f.store.close();
  });
  it('refuses a pending approval transport rather than inventing cancellation acknowledgement', async () => {
    const f = await continuationFixture(1000);
    roots.push(f.root);
    f.finish();
    const raw = new Database(f.database);
    raw
      .prepare(
        "INSERT INTO approval_notifications(event_id,run_id,task_id,event_json,state,created_at_ms,updated_at_ms) VALUES('pending','run','task','{}','delivery_pending',1000,1000)",
      )
      .run();
    const journal = new BootstrapJournal(f.database);
    let now = 1000;
    const cancel = WorkflowCancellationCoordinator.createForTest({
      store: f.store,
      contract: f.store.getExecutionContract('run'),
      clock: () => now,
      port: createObservedBootstrapCleanupPort(journal),
    });
    expect(
      (
        await cancel.cancel({
          id: 'cancel',
          runId: 'run',
          requestedBy: 'owner',
          reason: 'planned_authority_handoff',
          stopDeadlineMs: 2000,
          retainedEvidence: [],
          ownerId: 'owner',
          workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
          runLeaseEpoch: f.callback.parentRunLeaseEpoch,
        })
      ).status,
    ).toBe('requested');
    expect(f.store.getRun('run')?.state).toBe('cancelling');
    now = 2001;
    expect(
      (
        await cancel.resume({
          runId: 'run',
          ownerId: 'owner',
          workspaceLeaseEpoch: f.callback.workspaceLeaseEpoch,
          runLeaseEpoch: f.callback.parentRunLeaseEpoch,
        })
      ).status,
    ).toBe('escalated');
    expect(f.store.getRun('run')?.state).toBe('escalated');
    expect(runAcceptsWork(raw, 'run')).toBe(false);
    // A queue row left behind by interrupted cleanup cannot become dispatchable again.
    raw.prepare("UPDATE continuation_jobs SET status='pending', lease_until_ms=0").run();
    const queue = new ContinuationJournal(f.database);
    expect(queue.claim('late', 1000, now)).toBeUndefined();
    expect(queue.start('specialist:child', 'stale', 1, now)).toBe(false);
    enqueueContinuation(raw, 'missing', 'run', now);
    expect(queue.get('specialist:missing')).toBeUndefined();
    const execution = f.store.getSchedulerExecution('child')!;
    expect(() =>
      f.store.createSchedulerExecution({ ...execution, id: 'late', nowMs: now, deadlineMs: 3000 }),
    ).toThrow('scheduler run is cancelled');
    let sends = 0;
    const dispatcher = new ContinuationNotificationDispatcher(
      f.database,
      {
        channel: 'cancelled',
        async observe() {
          return null;
        },
        async send() {
          sends++;
          return 'unexpected';
        },
      },
      () => now,
    );
    await dispatcher.flush();
    await dispatcher.stop();
    expect(sends).toBe(0);
    raw.prepare('DELETE FROM continuation_events').run();
    raw.prepare('DELETE FROM continuation_jobs').run();
    queue.reconcileMissingIntents(now);
    expect(queue.list()).toHaveLength(0);
    queue.close();
    const reopened = new ContinuationJournal(f.database);
    expect(reopened.list()).toHaveLength(0);
    reopened.close();
    raw.close();
    journal.close();
    f.store.close();
  });
});
