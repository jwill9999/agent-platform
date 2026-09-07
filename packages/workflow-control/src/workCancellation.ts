import type Database from 'better-sqlite3';

/** The run row is the common serialization boundary for every asynchronous work queue. */
export function runAcceptsWork(database: Database.Database, runId: string): boolean {
  const run = database.prepare('SELECT state FROM runs WHERE id = ?').get(runId) as
    | { state: string }
    | undefined;
  return (
    run !== undefined &&
    !['cancelling', 'cancelled', 'closed'].includes(run.state) &&
    database.prepare('SELECT 1 FROM workflow_cancellations WHERE run_id = ?').get(runId) ===
      undefined
  );
}

/** Called inside cancellation's final transaction. Never claims that started execution stopped. */
export function fenceRunWork(database: Database.Database, runId: string, nowMs: number): string[] {
  const incomplete: string[] = [];
  const fenced = Object.fromEntries(
    [
      [
        'continuations',
        "SELECT count(*) n FROM continuation_jobs WHERE run_id=? AND status NOT IN ('consumed','blocked')",
      ],
      [
        'phases',
        "SELECT count(*) n FROM phase_jobs WHERE run_id=? AND status IN ('pending','claimed')",
      ],
      [
        'approvalWaits',
        "SELECT count(*) n FROM approval_wait_contexts WHERE run_id=? AND status='waiting'",
      ],
      [
        'approvalNotifications',
        "SELECT count(*) n FROM approval_notifications WHERE run_id=? AND state!='resumed'",
      ],
    ].map(([label, sql]) => [label, (database.prepare(sql!).get(runId) as { n: number }).n]),
  );
  if (
    database.prepare("SELECT 1 FROM phase_jobs WHERE run_id = ? AND status = 'started'").get(runId)
  )
    incomplete.push('started-phase-jobs');
  if (
    database
      .prepare(
        `SELECT 1 FROM continuation_event_deliveries d JOIN continuation_events e
    ON e.id = d.event_id WHERE e.run_id = ? AND d.status = 'pending' AND d.lease_owner IS NOT NULL`,
      )
      .get(runId)
  )
    incomplete.push('inflight-continuation-notifications');
  if (
    database
      .prepare(
        `SELECT 1 FROM approval_notifications WHERE run_id = ?
    AND state IN ('delivery_pending', 'resume_pending')`,
      )
      .get(runId)
  )
    incomplete.push('inflight-approval-notifications');
  database
    .prepare(
      `UPDATE continuation_jobs SET status = 'blocked', failure_code = 'run_cancelled',
    lease_epoch = lease_epoch + 1, lease_owner = NULL, lease_until_ms = 0
    WHERE run_id = ? AND status NOT IN ('consumed', 'blocked')`,
    )
    .run(runId);
  database
    .prepare(
      `UPDATE phase_jobs SET status = 'blocked', failure_code = 'run_cancelled',
    lease_epoch = lease_epoch + 1, lease_owner = NULL, lease_until_ms = 0
    WHERE run_id = ? AND status IN ('pending', 'claimed')`,
    )
    .run(runId);
  // Approval contexts/outbox history remain truthful; the run fence prevents all further dispatch.
  database
    .prepare(
      `INSERT INTO cancellation_work_fences(run_id, fenced_at_ms, details_json)
    VALUES (?, ?, ?) ON CONFLICT(run_id) DO UPDATE SET fenced_at_ms=excluded.fenced_at_ms,
    details_json=excluded.details_json`,
    )
    .run(runId, nowMs, JSON.stringify({ incomplete, fenced, fence: 'run_cancellation' }));
  return incomplete;
}
