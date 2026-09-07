import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';

import Database from 'better-sqlite3';
import { runAcceptsWork } from './workCancellation.js';

export type ContinuationEventKind =
  | 'specialist_completed'
  | 'callback_committed'
  | 'continuation_accepted'
  | 'continuation_started'
  | 'continuation_consumed'
  | 'next_action'
  | 'watchdog_recovery'
  | 'approval_required'
  | 'blocked'
  | 'resume_overdue'
  | 'phase_queued'
  | 'phase_started'
  | 'phase_recovery_required'
  | 'phase_completed'
  | 'phase_blocked';

export interface ContinuationEvent {
  id: string;
  runId: string;
  jobId: string;
  kind: ContinuationEventKind;
  generation: string;
  details: unknown;
  createdAtMs: number;
}

export function initializeContinuationOutbox(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS continuation_events (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES continuation_jobs(id),
    kind TEXT NOT NULL, generation TEXT NOT NULL, event_json TEXT NOT NULL, created_at_ms INTEGER NOT NULL,
    UNIQUE(run_id, job_id, kind, generation)
  );
  CREATE TABLE IF NOT EXISTS continuation_event_deliveries (
    event_id TEXT NOT NULL REFERENCES continuation_events(id), channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'delivered')),
    lease_owner TEXT, lease_epoch INTEGER NOT NULL DEFAULT 0, lease_until_ms INTEGER NOT NULL DEFAULT 0,
    receipt TEXT, delivered_at_ms INTEGER, last_error TEXT, PRIMARY KEY(event_id, channel)
  );
  INSERT OR IGNORE INTO schema_migrations (version, applied_at_ms) VALUES (14, unixepoch() * 1000);`);
}

/** Call inside the state-change transaction. Identity is stable across resend and restart. */
export function recordContinuationEvent(
  database: Database.Database,
  input: Omit<ContinuationEvent, 'id'>,
): void {
  const id = `sha256:${createHash('sha256')
    .update(JSON.stringify([input.runId, input.jobId, input.kind, input.generation]))
    .digest('hex')}`;
  const event = { id, ...input };
  database
    .prepare(
      `INSERT OR IGNORE INTO continuation_events
    (id, run_id, job_id, kind, generation, event_json, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.runId,
      input.jobId,
      input.kind,
      input.generation,
      JSON.stringify(event),
      input.createdAtMs,
    );
}

export interface ContinuationNotificationSink {
  readonly channel: string;
  observe(event: ContinuationEvent, signal: AbortSignal): Promise<string | null>;
  send(event: ContinuationEvent, signal: AbortSignal): Promise<string>;
}

/** Production local notification feed. A timeline/UI consumer deduplicates by event.id.
 * Observe-before-resend reconciles a flushed append whose acknowledgement was lost.
 */
export class JsonlContinuationNotificationSink implements ContinuationNotificationSink {
  readonly channel: string;
  constructor(readonly path: string) {
    this.channel = `jsonl:${path}`;
  }

  async observe(event: ContinuationEvent): Promise<string | null> {
    let content: string;
    try {
      content = readFileSync(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      const delivered = JSON.parse(line) as { id: string };
      if (delivered.id === event.id) return event.id;
    }
    return null;
  }

  async send(event: ContinuationEvent): Promise<string> {
    appendFileSync(this.path, `${JSON.stringify(event)}\n`, { mode: 0o600, flush: true });
    return event.id;
  }
}

interface DeliveryClaim {
  event: ContinuationEvent;
  epoch: number;
}

/** Independent outbox supervisor: a failed/stalled parent cannot suppress owner-visible events. */
export class ContinuationNotificationDispatcher {
  readonly #database: Database.Database;
  readonly #owner = randomUUID();
  #timer: ReturnType<typeof setInterval> | undefined;
  #active: Promise<void> | undefined;

  constructor(
    path: string,
    readonly sink: ContinuationNotificationSink,
    readonly clock: () => number = Date.now,
    readonly timeoutMs = 5000,
    readonly reportError: (error: unknown) => void = (error) => {
      process.stderr.write(`workflow notification delivery failed: ${String(error)}\n`);
    },
  ) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
      throw new Error('invalid notification timeout');
    this.#database = new Database(path);
    this.#database.pragma('busy_timeout = 5000');
  }

  timeline(runId?: string): ContinuationEvent[] {
    const rows = (
      runId === undefined
        ? this.#database
            .prepare('SELECT event_json FROM continuation_events ORDER BY created_at_ms, rowid')
            .all()
        : this.#database
            .prepare(
              'SELECT event_json FROM continuation_events WHERE run_id = ? ORDER BY created_at_ms, rowid',
            )
            .all(runId)
    ) as Array<{ event_json: string }>;
    return rows.map((row) => JSON.parse(row.event_json) as ContinuationEvent);
  }

  start(pollMs: number): void {
    if (!Number.isSafeInteger(pollMs) || pollMs <= 0)
      throw new Error('invalid notification poll interval');
    if (this.#timer !== undefined) return;
    this.#timer = setInterval(() => {
      void this.flush();
    }, pollMs);
    void this.flush();
  }

  async stop(): Promise<void> {
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    await this.#active;
    this.#database.close();
  }

  flush(): Promise<void> {
    if (this.#active !== undefined) return this.#active;
    this.#active = this.#flush()
      .catch(this.reportError)
      .finally(() => {
        this.#active = undefined;
      });
    return this.#active;
  }

  #claim(): DeliveryClaim | undefined {
    return this.#database
      .transaction(() => {
        const row = this.#database
          .prepare(
            `SELECT e.id, e.event_json FROM continuation_events e
        LEFT JOIN continuation_event_deliveries d ON d.event_id = e.id AND d.channel = ?
        WHERE (d.event_id IS NULL OR (d.status = 'pending' AND d.lease_until_ms <= ?))
        AND EXISTS (SELECT 1 FROM runs r WHERE r.id = e.run_id AND
          ((r.state NOT IN ('cancelling', 'cancelled', 'closed') AND
            NOT EXISTS (SELECT 1 FROM workflow_cancellations c WHERE c.run_id = r.id)) OR
           (d.status = 'pending' AND d.lease_owner IS NOT NULL AND
            EXISTS (SELECT 1 FROM workflow_cancellations c WHERE c.run_id = r.id))))
        ORDER BY e.created_at_ms, e.rowid LIMIT 1`,
          )
          .get(this.sink.channel, this.clock()) as { id: string; event_json: string } | undefined;
        if (row === undefined) return undefined;
        this.#database
          .prepare(
            `INSERT INTO continuation_event_deliveries
        (event_id, channel, lease_owner, lease_epoch, lease_until_ms) VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(event_id, channel) DO UPDATE SET lease_owner = excluded.lease_owner,
        lease_epoch = lease_epoch + 1, lease_until_ms = excluded.lease_until_ms`,
          )
          .run(row.id, this.sink.channel, this.#owner, this.clock() + this.timeoutMs * 2);
        const claim = this.#database
          .prepare(
            'SELECT lease_epoch FROM continuation_event_deliveries WHERE event_id = ? AND channel = ?',
          )
          .get(row.id, this.sink.channel) as { lease_epoch: number };
        return { event: JSON.parse(row.event_json) as ContinuationEvent, epoch: claim.lease_epoch };
      })
      .immediate();
  }

  async #flush(): Promise<void> {
    for (let count = 0; count < 100; count += 1) {
      const claim = this.#claim();
      if (claim === undefined) return;
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const deliver = async () => {
          const observed = await this.sink.observe(claim.event, controller.signal);
          controller.signal.throwIfAborted();
          if (observed !== null) return observed;
          const dispatch = this.#database
            .transaction(() => {
              controller.signal.throwIfAborted();
              if (
                !this.#database
                  .prepare(
                    `SELECT 1 FROM continuation_event_deliveries
                  WHERE event_id = ? AND channel = ? AND status = 'pending'
                  AND lease_owner = ? AND lease_epoch = ? AND lease_until_ms > ?`,
                  )
                  .get(claim.event.id, this.sink.channel, this.#owner, claim.epoch, this.clock())
              )
                throw new Error('notification claim is stale');
              if (!runAcceptsWork(this.#database, claim.event.runId)) {
                this.#database
                  .prepare(
                    `UPDATE continuation_event_deliveries SET lease_owner = NULL,
              lease_until_ms = 0, lease_epoch = lease_epoch + 1, last_error = 'run_cancelled'
              WHERE event_id = ? AND channel = ? AND lease_owner = ? AND lease_epoch = ?`,
                  )
                  .run(claim.event.id, this.sink.channel, this.#owner, claim.epoch);
                return undefined;
              }
              // Initiate under the writer lock; never hold a SQLite transaction across await.
              return { pending: this.sink.send(claim.event, controller.signal) };
            })
            .immediate();
          if (dispatch === undefined) throw new Error('notification run is cancelled');
          return dispatch.pending;
        };
        const receipt = await Promise.race([
          deliver(),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(new Error('notification sink timed out'));
            }, this.timeoutMs);
          }),
        ]);
        if (!receipt) throw new Error('notification sink returned no receipt');
        this.#database
          .prepare(
            `UPDATE continuation_event_deliveries SET status = 'delivered',
            receipt = ?, delivered_at_ms = ?, last_error = NULL WHERE event_id = ? AND channel = ? AND lease_owner = ?
          AND lease_epoch = ? AND lease_until_ms > ?`,
          )
          .run(
            receipt,
            this.clock(),
            claim.event.id,
            this.sink.channel,
            this.#owner,
            claim.epoch,
            this.clock(),
          );
      } catch (error) {
        this.#database
          .prepare(
            `UPDATE continuation_event_deliveries SET last_error = ?
          WHERE event_id = ? AND channel = ? AND lease_owner = ? AND lease_epoch = ?`,
          )
          .run(
            error instanceof Error ? error.message : String(error),
            claim.event.id,
            this.sink.channel,
            this.#owner,
            claim.epoch,
          );
        throw error;
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
    }
  }
}
