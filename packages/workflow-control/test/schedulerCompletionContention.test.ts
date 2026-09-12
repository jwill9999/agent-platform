import { rm } from 'node:fs/promises';

import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';

import { continuationFixture, terminalResult } from './continuationFixture.js';

function sqliteCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? String(error.code) : undefined;
}

describe('scheduler completion writer reservation', () => {
  it('samples default time after obtaining the writer reservation and preserves explicit timestamps', async () => {
    const fixture = await continuationFixture(1000);
    const peer = new Database(fixture.database, { timeout: 0 });
    const execution = fixture.store.getSchedulerExecution('child')!;
    let peerFailure: string | undefined;
    const clock = vi
      .spyOn(Date, 'now')
      .mockReturnValue(122000)
      .mockImplementationOnce(() => {
        try {
          peer
            .prepare(
              'UPDATE schema_migrations SET applied_at_ms = applied_at_ms + 1 WHERE version = 1',
            )
            .run();
        } catch (error) {
          peerFailure = sqliteCode(error);
          if (peerFailure !== 'SQLITE_BUSY') throw error;
        }
        return 122000; // Leases valid at fixture time have now expired.
      });
    try {
      expect(() =>
        fixture.store.finishSchedulerExecution({
          id: execution.id,
          status: 'completed',
          ownerId: execution.ownerId,
          workspaceLeaseEpoch: execution.workspaceLeaseEpoch,
          runLeaseEpoch: execution.runLeaseEpoch,
          taskLeaseEpoch: execution.taskLeaseEpoch,
          result: terminalResult,
          callback: fixture.callback,
        }),
      ).toThrow('stale or expired workspace fencing token');
      expect(peerFailure).toBe('SQLITE_BUSY');
      expect(fixture.store.getSchedulerExecution('child')).toEqual(execution);
      // The fixture's explicit nowMs=1000 is still honored even while the default clock is later.
      expect(fixture.finish()).toMatchObject({ status: 'completed', result: terminalResult });
    } finally {
      clock.mockRestore();
      peer.close();
      fixture.store.close();
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('excludes a peer WAL commit after the first read and preserves exactly-once replay', async () => {
    const fixture = await continuationFixture(1000, 'plan_critic');
    const peer = new Database(fixture.database, { timeout: 0 });
    const readExecution = fixture.store.getSchedulerExecution.bind(fixture.store);
    let peerFailure: string | undefined;
    const firstRead = vi
      .spyOn(fixture.store, 'getSchedulerExecution')
      .mockImplementationOnce((id) => {
        const execution = readExecution(id); // Establish the actual SQLite read snapshot.
        try {
          // A real unrelated commit on another connection, with no timing or sleep dependency.
          peer
            .prepare(
              'UPDATE schema_migrations SET applied_at_ms = applied_at_ms + 1 WHERE version = 1',
            )
            .run();
        } catch (error) {
          peerFailure = sqliteCode(error);
          if (peerFailure !== 'SQLITE_BUSY') throw error;
        }
        return execution;
      });
    try {
      let completionFailure: unknown;
      try {
        fixture.finish();
      } catch (error) {
        completionFailure = error;
      }
      // On deferred BEGIN this records SQLITE_BUSY_SNAPSHOT, not only "database is locked".
      expect(sqliteCode(completionFailure)).toBeUndefined();
      expect(completionFailure).toBeUndefined();
      expect(peerFailure).toBe('SQLITE_BUSY');
      const completed = fixture.store.getSchedulerExecution('child');
      expect(completed).toMatchObject({ status: 'completed', result: terminalResult });
      const beforeReplay = {
        callbacks: peer.prepare('SELECT count(*) AS count FROM delegate_callbacks').get(),
        continuations: peer.prepare('SELECT count(*) AS count FROM continuation_jobs').get(),
        run: fixture.store.getRun('run'),
      };
      expect(beforeReplay.callbacks).toEqual({ count: 1 });
      expect(beforeReplay.continuations).toEqual({ count: 1 });
      expect(fixture.finish()).toEqual(completed);
      expect(peer.prepare('SELECT count(*) AS count FROM delegate_callbacks').get()).toEqual(
        beforeReplay.callbacks,
      );
      expect(peer.prepare('SELECT count(*) AS count FROM continuation_jobs').get()).toEqual(
        beforeReplay.continuations,
      );
      expect(fixture.store.getRun('run')).toEqual(beforeReplay.run);
      // The competing connection can write again once completion releases its reservation.
      expect(
        peer
          .prepare(
            'UPDATE schema_migrations SET applied_at_ms = applied_at_ms + 1 WHERE version = 1',
          )
          .run().changes,
      ).toBe(1);
    } finally {
      firstRead.mockRestore();
      peer.close();
      fixture.store.close();
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rolls back terminal state and continuation when callback validation fails', async () => {
    const fixture = await continuationFixture(1000);
    const observer = new Database(fixture.database);
    try {
      const before = fixture.store.getSchedulerExecution('child');
      const runBefore = fixture.store.getRun('run');
      expect(() =>
        fixture.finish(true, { ...terminalResult, summary: 'unbound replacement result' }),
      ).toThrow();
      expect(fixture.store.getSchedulerExecution('child')).toEqual(before);
      expect(fixture.store.getRun('run')).toEqual(runBefore);
      expect(observer.prepare('SELECT count(*) AS count FROM delegate_callbacks').get()).toEqual({
        count: 0,
      });
      expect(observer.prepare('SELECT count(*) AS count FROM continuation_jobs').get()).toEqual({
        count: 0,
      });
      expect(fixture.finish()).toMatchObject({ status: 'completed', result: terminalResult });
    } finally {
      observer.close();
      fixture.store.close();
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
