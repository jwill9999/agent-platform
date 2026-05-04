# Task: Implement job runner, queue, retry, and cancellation basics

**Beads id:** `agent-platform-scheduler.2`
**Parent epic:** `agent-platform-scheduler` - Scheduler and background work

## Summary

Implement the first single-node scheduler loop that claims due jobs, creates run attempts, executes supported targets, applies retry policy, and supports pause/resume/cancel semantics.

## Requirements

- Add an API-owned scheduler service that starts and stops with the API lifecycle.
- Poll durable jobs for due work and claim runs with a lease so duplicate workers do not run the same attempt.
- Support one-off/delayed jobs and the minimum recurring schedule representation from `.1`.
- Execute a conservative first target set: built-in maintenance task and/or normal agent turn using existing runtime policy boundaries.
- Persist run status, attempts, next-run scheduling, timeout, retry, and cancellation state.
- Cancellation must be best-effort and must never leave a run permanently `running` without lease/timeout recovery.

## Implementation Plan

1. Add scheduler service lifecycle wiring in the API bootstrap.
2. Implement due-job polling and lease acquisition using repository APIs.
3. Implement target dispatch with a narrow supported target interface.
4. Add timeout and cancellation handling.
5. Apply retry/backoff policy and next-run calculation.
6. Add focused tests using fake timers or injectable clocks.

## Tests And Verification

- Unit tests for due selection, leases, retry, timeout, and cancellation.
- Integration tests proving the API scheduler service can run a due job and persist terminal state.
- `pnpm --filter @agent-platform/api test`
- `pnpm --filter @agent-platform/db test`
- Relevant typecheck/lint commands for touched packages.

## Definition Of Done

- Due jobs run without a live chat request.
- Failed jobs retry according to policy and eventually reach terminal state.
- Paused/cancelled jobs do not execute.
- The runner is deterministic in tests and bounded in production.
