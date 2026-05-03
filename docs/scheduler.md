# Scheduler

The scheduler provides durable local background work without external queues or OS cron. Jobs are stored in SQLite, claimed by the API process with short leases, and inspected through Settings > Scheduler or the `/v1/scheduler` API.

## Runtime

- The API starts the scheduler automatically unless `SCHEDULER_ENABLED=false`.
- `SCHEDULER_POLL_INTERVAL_MS` controls how often due jobs are claimed. The default is 30 seconds.
- `SCHEDULER_LEASE_MS` controls the base lease duration. The default is five minutes.
- Each run also honours the job `timeoutMs`; the effective lease is at least the timeout.

If the API process stops during a run, the next scheduler tick marks expired running attempts as failed and either schedules a retry or pauses the job after retry exhaustion.

## Jobs And Runs

A scheduled job is the editable definition: owner scope, target, instructions, schedule, retry policy, and timeout. A job run is one execution attempt with its own status, logs, terminal summary, and cancellation state.

Supported schedule types:

- `one_off`: runs once at `runAtMs`, then archives after success.
- `delayed`: runs once at `runAtMs`, usually created for delayed follow-up work.
- `recurring`: runs repeatedly when `intervalMs` is set. Cron expressions are reserved in the contract but not executed by the local runner yet.

Supported built-in targets:

- `scheduler.noop`: safe smoke-test target used by the UI.
- `memory.cleanup_expired.dry_run`: reports how many expired memories would be cleaned up without deleting records.

## Notifications

The runner emits structured notification events for:

- `scheduler.job_succeeded`
- `scheduler.job_failed`
- `scheduler.job_cancelled`
- `scheduler.job_retry_exhausted`

Notifications are persisted as run log entries prefixed with `Notification:`. The Settings Scheduler page shows them in the selected run logs, and `/v1/scheduler/runs/:runId/logs` returns the same bounded records for API consumers.

The current implementation keeps notification delivery local and inspectable. Email, Slack, push notifications, or webhooks should be added later through the scheduler notification hook rather than by bypassing run logs.

## Safety

Scheduler jobs do not bypass tool policy. Destructive maintenance remains confirm-first through its existing API path, and the built-in memory cleanup task is dry-run only. `agent_turn` scheduler targets are accepted by the contracts for future use, but the local runner currently fails them closed until they are explicitly wired through the normal agent execution and HITL policy path.

## Manual Verification

1. Rebuild and restart the stack with `make restart`.
2. Open `http://localhost:3001/settings/scheduler`.
3. Create a global one-off job using the built-in no-op target.
4. Click **Run now**.
5. Select the job, then select the latest run.
6. Confirm the run reaches `succeeded`.
7. Confirm the run logs include `Scheduled job run succeeded.` and `Notification: Scheduled job completed successfully.`
8. Create another job and use pause/resume to confirm the status badges and action buttons update.

For API-only verification, create a job with `POST /v1/scheduler`, request `POST /v1/scheduler/:id/run`, then inspect `/v1/scheduler/:id/runs` and `/v1/scheduler/runs/:runId/logs`.
