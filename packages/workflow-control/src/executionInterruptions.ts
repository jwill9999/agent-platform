import type Database from 'better-sqlite3';

export const cleanupOperations = ['cancel', 'revoke', 'settle'] as const;
export type CleanupOperation = (typeof cleanupOperations)[number];
export interface ExecutionInterruption {
  execution_id: string;
  job_id: string;
  run_id: string;
  reason: string;
  observed_at_ms: number;
  broker_generation: string | null;
  owner: string;
  epoch: number;
  lease_until_ms: number;
  batch: number;
  attempt: number;
  attempt_deadline_ms: number;
  next_attempt_ms: number;
  state: 'pending' | 'exhausted' | 'settled';
  cancel: number;
  revoke: number;
  settle: number;
  effects: 'uncertain' | 'none_verified' | 'recorded_effects';
}

/** Shared workflow schema: interruption and terminal commitment use the same SQLite writer lock. */
export function initializeInterruptionSchema(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS scheduler_staging (execution_id TEXT PRIMARY KEY, root TEXT NOT NULL UNIQUE, created_at_ms INTEGER NOT NULL, device TEXT, inode TEXT, uid INTEGER);
  CREATE TABLE IF NOT EXISTS execution_interruptions (
    execution_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, run_id TEXT NOT NULL,
    reason TEXT NOT NULL, observed_at_ms INTEGER NOT NULL, broker_generation TEXT,
    owner TEXT NOT NULL, epoch INTEGER NOT NULL, lease_until_ms INTEGER NOT NULL,
    batch INTEGER NOT NULL DEFAULT 1, attempt INTEGER NOT NULL DEFAULT 0,
    attempt_deadline_ms INTEGER NOT NULL DEFAULT 0, next_attempt_ms INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','exhausted','settled')),
    cancel INTEGER NOT NULL DEFAULT 0, revoke INTEGER NOT NULL DEFAULT 0,
    settle INTEGER NOT NULL DEFAULT 0
  );`);
  const interruptionFields = db
    .prepare('PRAGMA table_info(execution_interruptions)')
    .all() as Array<{ name: string }>;
  if (!interruptionFields.some((field) => field.name === 'effects'))
    db.exec(
      "ALTER TABLE execution_interruptions ADD COLUMN effects TEXT NOT NULL DEFAULT 'uncertain'",
    );
  const fields = new Set(
    (db.prepare('PRAGMA table_info(scheduler_staging)').all() as Array<{ name: string }>).map(
      (row) => row.name,
    ),
  );
  for (const [name, type] of [
    ['device', 'TEXT'],
    ['inode', 'TEXT'],
    ['uid', 'INTEGER'],
  ])
    if (!fields.has(name!)) db.exec(`ALTER TABLE scheduler_staging ADD COLUMN ${name} ${type}`);
}

export function getInterruption(
  db: Database.Database,
  id: string,
): ExecutionInterruption | undefined {
  return db.prepare('SELECT * FROM execution_interruptions WHERE execution_id=?').get(id) as
    | ExecutionInterruption
    | undefined;
}

export function assertExecutionNotInterrupted(db: Database.Database, id: string): void {
  if (getInterruption(db, id)) throw new Error('execution_interrupted');
}

/** All effect acknowledgements bind owner, epoch, batch AND attempt, including after timeouts. */
export class InterruptionCleanupJournal {
  constructor(private readonly db: Database.Database) {}

  list(runId: string): ExecutionInterruption[] {
    return this.db
      .prepare(
        'SELECT * FROM execution_interruptions WHERE run_id=? ORDER BY observed_at_ms, execution_id',
      )
      .all(runId) as ExecutionInterruption[];
  }

  requestRecovery(runId: string): number {
    return this.db
      .prepare(
        `UPDATE execution_interruptions SET state='pending',batch=batch+1,
      attempt=0,attempt_deadline_ms=0,next_attempt_ms=0,lease_until_ms=0,epoch=epoch+1
      WHERE run_id=? AND state='exhausted'`,
      )
      .run(runId).changes;
  }

  claim(
    runId: string,
    owner: string,
    now: number,
    ttl = 30_000,
    executionId?: string,
  ): ExecutionInterruption | undefined {
    if (!owner || !Number.isSafeInteger(ttl) || ttl < 15_000)
      throw new Error('invalid_cleanup_lease');
    return this.db
      .transaction(() => {
        // A crash can consume the final attempt before finishAttempt commits.
        // Expired owners must not leave that record permanently pending.
        this.db
          .prepare(
            `UPDATE execution_interruptions SET state='exhausted',lease_until_ms=0
          WHERE run_id=? AND state='pending' AND attempt>=3 AND lease_until_ms<=?
          AND attempt_deadline_ms<=?`,
          )
          .run(runId, now, now);
        const row = this.db
          .prepare(
            `SELECT * FROM execution_interruptions
        WHERE run_id=? AND state='pending' AND lease_until_ms<=? AND next_attempt_ms<=?
        AND (? IS NULL OR execution_id=?)
        ORDER BY observed_at_ms,execution_id LIMIT 1`,
          )
          .get(runId, now, now, executionId ?? null, executionId ?? null) as
          | ExecutionInterruption
          | undefined;
        if (!row) return undefined;
        this.db
          .prepare(
            `UPDATE execution_interruptions SET owner=?,epoch=epoch+1,lease_until_ms=?
        WHERE execution_id=?`,
          )
          .run(owner, now + ttl, row.execution_id);
        return getInterruption(this.db, row.execution_id);
      })
      .immediate();
  }

  begin(row: ExecutionInterruption, now: number): ExecutionInterruption {
    return this.db
      .transaction(() => {
        this.assertOwner(row, now);
        const current = getInterruption(this.db, row.execution_id)!;
        if (
          current.attempt >= 3 ||
          current.next_attempt_ms > now ||
          current.attempt_deadline_ms > now
        )
          throw new Error('cleanup_attempt_unavailable');
        this.db
          .prepare(
            `UPDATE execution_interruptions SET attempt=attempt+1,attempt_deadline_ms=?
        WHERE execution_id=?`,
          )
          .run(now + 15_000, row.execution_id);
        return getInterruption(this.db, row.execution_id)!;
      })
      .immediate();
  }

  assertOwner(row: ExecutionInterruption, now: number): void {
    const current = getInterruption(this.db, row.execution_id);
    if (
      current?.owner !== row.owner ||
      current.epoch !== row.epoch ||
      current.batch !== row.batch ||
      current.lease_until_ms <= now ||
      current.state !== 'pending'
    )
      throw new Error('cleanup_fence_rejected');
  }

  confirm(row: ExecutionInterruption, operation: CleanupOperation, now: number): void {
    if (!cleanupOperations.includes(operation)) throw new Error('invalid_cleanup_operation');
    this.db
      .transaction(() => {
        this.assertOwner(row, now);
        const current = getInterruption(this.db, row.execution_id)!;
        if (current.attempt !== row.attempt || current.attempt_deadline_ms <= now)
          throw new Error('cleanup_attempt_expired');
        this.db
          .prepare(`UPDATE execution_interruptions SET ${operation}=1 WHERE execution_id=?`)
          .run(row.execution_id);
      })
      .immediate();
  }

  finishAttempt(row: ExecutionInterruption, now: number): ExecutionInterruption {
    return this.db
      .transaction(() => {
        this.assertOwner(row, now);
        const current = getInterruption(this.db, row.execution_id)!;
        if (current.attempt !== row.attempt) throw new Error('cleanup_attempt_expired');
        const settled = current.cancel === 1 && current.revoke === 1 && current.settle === 1;
        let state: ExecutionInterruption['state'] = 'pending';
        if (settled) state = 'settled';
        else if (current.attempt >= 3) state = 'exhausted';
        this.db
          .prepare(
            `UPDATE execution_interruptions SET state=?,attempt_deadline_ms=0,
        next_attempt_ms=?,lease_until_ms=0 WHERE execution_id=?`,
          )
          .run(state, now + (current.attempt === 1 ? 2000 : 4000), row.execution_id);
        return getInterruption(this.db, row.execution_id)!;
      })
      .immediate();
  }
}

export async function withinCleanupDeadline<T>(
  operation: Promise<T>,
  deadlineMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('cleanup_operation_timed_out')),
          Math.max(0, deadlineMs - Date.now()),
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
