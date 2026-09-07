import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContinuationJournal } from '../src/continuationJournal.js';
import { ContinuationWorker, type AsyncParentExecutionHost } from '../src/continuationWorker.js';
import {
  ContinuationNotificationDispatcher,
  JsonlContinuationNotificationSink,
  type ContinuationNotificationSink,
} from '../src/continuationNotifications.js';
import { continuationFixture } from './continuationFixture.js';

const roots: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('durable human visibility outbox', () => {
  it.each(['timeout', 'takeover'] as const)(
    'never sends from a late observation after %s or overwrites the successor receipt',
    async (boundary) => {
      const fixture = await continuationFixture(1000);
      roots.push(fixture.root);
      fixture.finish();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      let now = 1000;
      let release!: (value: null) => void;
      let staleSends = 0;
      const first = new ContinuationNotificationDispatcher(
        fixture.database,
        {
          channel: 'race',
          observe: () =>
            new Promise<null>((resolve) => {
              release = resolve;
            }),
          async send() {
            staleSends++;
            return 'stale';
          },
        },
        () => now,
        50,
        () => undefined,
      );
      const pending = first.flush();
      if (boundary === 'timeout') {
        await vi.advanceTimersByTimeAsync(50);
        await pending;
      }
      now = 1101;
      const sent: string[] = [];
      const successor = new ContinuationNotificationDispatcher(
        fixture.database,
        {
          channel: 'race',
          async observe() {
            return null;
          },
          async send(event) {
            sent.push(event.id);
            return `successor:${event.id}`;
          },
        },
        () => now,
        50,
      );
      await successor.flush();
      const db = new Database(fixture.database, { readonly: true });
      const receipts = db.prepare('SELECT * FROM continuation_event_deliveries').all();
      release(null);
      await pending;
      await Promise.resolve();
      expect(staleSends).toBe(0);
      expect(sent).toHaveLength(2);
      expect(new Set(sent).size).toBe(2);
      expect(db.prepare('SELECT * FROM continuation_event_deliveries').all()).toEqual(receipts);
      db.close();
      await first.stop();
      await successor.stop();
      fixture.store.close();
    },
  );
  it('records one handoff and one next action despite duplicate callbacks and acknowledgements', async () => {
    const fixture = await continuationFixture(1000);
    roots.push(fixture.root);
    fixture.finish();
    fixture.finish();
    const journal = new ContinuationJournal(fixture.database);
    const job = journal.claim('owner', 100, 1000)!;
    journal.accepted(job, 1000);
    journal.accepted(job, 1000);
    journal.start(job.id, job.host_execution_id!, job.lease_epoch, 1000);
    const action = { kind: 'approval_required', eventId: fixture.callback.approvalIntent.eventId };
    journal.consume(job.id, job.host_execution_id!, job.lease_epoch, action, 1000);
    journal.consume(job.id, job.host_execution_id!, job.lease_epoch, action, 1000);
    const events = journal.timeline('run');
    expect(events.map((event) => event.kind)).toEqual([
      'specialist_completed',
      'callback_committed',
      'continuation_accepted',
      'continuation_started',
      'next_action',
      'continuation_consumed',
      'approval_required',
    ]);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    journal.close();
    fixture.store.close();
  });

  it('reconciles a lost feed acknowledgement across restart without duplicate notification or workflow mutation', async () => {
    const fixture = await continuationFixture(1000);
    roots.push(fixture.root);
    fixture.finish();
    const feed = join(fixture.root, 'notifications.jsonl');
    const sink = new JsonlContinuationNotificationSink(feed);
    let loseResponse = true;
    const failures: unknown[] = [];
    const interrupted: ContinuationNotificationSink = {
      channel: sink.channel,
      observe: (event) => sink.observe(event),
      async send(event) {
        const receipt = await sink.send(event);
        if (loseResponse) {
          loseResponse = false;
          throw new Error('response lost after durable append');
        }
        return receipt;
      },
    };
    let now = 1000;
    const first = new ContinuationNotificationDispatcher(
      fixture.database,
      interrupted,
      () => now,
      50,
      (error) => failures.push(error),
    );
    await first.flush();
    await first.stop();
    expect(failures).toHaveLength(1);
    now = 1101;
    const resumed = new ContinuationNotificationDispatcher(fixture.database, sink, () => now, 50);
    await resumed.flush();
    await resumed.flush();
    const lines = (await readFile(feed, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { id: string });
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((line) => line.id)).size).toBe(2);
    const sql = new Database(fixture.database, { readonly: true });
    expect(
      sql
        .prepare(
          "SELECT count(*) AS count FROM continuation_event_deliveries WHERE status = 'delivered'",
        )
        .get(),
    ).toEqual({ count: 2 });
    sql.close();
    expect(fixture.store.getRun('run')).toMatchObject({ state: 'approval_waiting', version: 1 });
    const journal = new ContinuationJournal(fixture.database);
    expect(journal.get('specialist:child')?.status).toBe('pending');
    journal.close();
    await resumed.stop();
    fixture.store.close();
  });

  it('reports overdue at N despite a live lease, suppresses unchanged ticks, and escalates a parent that never resumes', async () => {
    const fixture = await continuationFixture(1000);
    roots.push(fixture.root);
    fixture.finish();
    const journal = new ContinuationJournal(fixture.database);
    let now = 1000;
    const host: AsyncParentExecutionHost = {
      async observe(job) {
        return { status: 'accepted', executionId: job.host_execution_id! };
      },
      async start() {
        throw new Error('never starts');
      },
    };
    const worker = new ContinuationWorker(
      journal,
      host,
      {
        pollIntervalMs: 10,
        overdueThresholdMs: 20,
        leaseTtlMs: 100,
        hostTimeoutMs: 50,
        maxAttempts: 2,
        deadlineMs: 1000,
      },
      () => now,
    );
    await worker.tick();
    now = 1020;
    await worker.tick();
    await worker.tick();
    expect(journal.timeline('run').filter((event) => event.kind === 'resume_overdue')).toHaveLength(
      1,
    );
    expect(journal.get('specialist:child')?.attempts).toBe(1);
    now = 1101;
    await worker.tick();
    now = 1202;
    await worker.tick();
    await worker.tick();
    const kinds = journal.timeline('run').map((event) => event.kind);
    expect(kinds.filter((kind) => kind === 'continuation_accepted')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'blocked')).toHaveLength(1);
    expect(kinds).not.toContain('watchdog_recovery');
    expect(kinds).not.toContain('continuation_started');
    journal.close();
    fixture.store.close();
  });

  it('reports watchdog recovery only after the recovered parent actually starts', async () => {
    const fixture = await continuationFixture(1000);
    roots.push(fixture.root);
    fixture.finish();
    const journal = new ContinuationJournal(fixture.database);
    const first = journal.claim('lost', 100, 1000)!;
    journal.accepted(first, 1000);
    const second = journal.claim('recovered', 100, 1101)!;
    expect(journal.timeline('run').some((event) => event.kind === 'watchdog_recovery')).toBe(false);
    expect(journal.start(second.id, second.host_execution_id!, second.lease_epoch, 1101)).toBe(
      true,
    );
    expect(journal.start(second.id, second.host_execution_id!, second.lease_epoch, 1101)).toBe(
      false,
    );
    expect(
      journal.timeline('run').filter((event) => event.kind === 'watchdog_recovery'),
    ).toHaveLength(1);
    journal.close();
    fixture.store.close();
  });
});
