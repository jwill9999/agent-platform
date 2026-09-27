import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  initializeInterruptionSchema,
  InterruptionCleanupJournal,
  assertExecutionNotInterrupted,
} from '../src/executionInterruptions.js';

const databases: Database.Database[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
function fixture() {
  const db = new Database(':memory:');
  databases.push(db);
  initializeInterruptionSchema(db);
  db.prepare(
    `INSERT INTO execution_interruptions
    (execution_id,job_id,run_id,reason,observed_at_ms,owner,epoch,lease_until_ms)
    VALUES ('execution','job','run','broker_unavailable',0,'original',1,0)`,
  ).run();
  return { db, journal: new InterruptionCleanupJournal(db) };
}

describe('durable interruption cleanup authority', () => {
  it('prevents success while cleanup remains unresolved', () => {
    const { db, journal } = fixture();
    expect(() => assertExecutionNotInterrupted(db, 'execution')).toThrow('execution_interrupted');
    const row = journal.begin(journal.claim('run', 'one', 1)!, 1);
    journal.confirm(row, 'cancel', 2);
    const pending = journal.finishAttempt(row, 3);
    expect(pending).toMatchObject({
      state: 'pending',
      cancel: 1,
      revoke: 0,
      settle: 0,
      attempt: 1,
    });
    expect(journal.claim('run', 'two', 2002)).toBeUndefined();
    expect(journal.claim('run', 'two', 2003)).toBeDefined();
  });

  it('rejects late acknowledgements and stale recovery owners', () => {
    const { journal } = fixture();
    const first = journal.begin(journal.claim('run', 'one', 1)!, 1);
    expect(() => journal.confirm(first, 'revoke', 15001)).toThrow('cleanup_attempt_expired');
    const replacement = journal.claim('run', 'two', 30001)!;
    expect(() => journal.confirm(first, 'cancel', 30002)).toThrow('cleanup_fence_rejected');
    const second = journal.begin(replacement, 30002);
    journal.confirm(second, 'cancel', 30003);
    journal.confirm(second, 'revoke', 30003);
    journal.confirm(second, 'settle', 30003);
    expect(journal.finishAttempt(second, 30004).state).toBe('settled');
    expect(journal.claim('run', 'three', 90000)).toBeUndefined();
  });

  it('exhausts a durable retry budget instead of silently resetting it', () => {
    const { journal } = fixture();
    let now = 1;
    for (let i = 0; i < 3; i++) {
      const attempt = journal.begin(journal.claim('run', 'owner', now)!, now);
      const result = journal.finishAttempt(attempt, now + 1);
      expect(result.state).toBe(i === 2 ? 'exhausted' : 'pending');
      now = result.next_attempt_ms;
    }
    expect(journal.claim('run', 'owner', 100000)).toBeUndefined();
    expect(journal.list('run')[0]!.attempt).toBe(3);
  });
});

it('exhausts a third attempt lost to a coordinator crash and requires explicit recovery', () => {
  const { journal } = fixture();
  for (const now of [1, 30001, 60001]) journal.begin(journal.claim('run', 'owner', now)!, now);
  expect(journal.claim('run', 'replacement', 90001)).toBeUndefined();
  expect(journal.list('run')[0]).toMatchObject({ state: 'exhausted', attempt: 3 });
  expect(journal.requestRecovery('run')).toBe(1);
  const row = journal.begin(journal.claim('run', 'replacement', 90002)!, 90002);
  expect(row).toMatchObject({ batch: 2, attempt: 1, state: 'pending' });
});
