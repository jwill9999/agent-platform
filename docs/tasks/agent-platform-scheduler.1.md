# Task: Define scheduled job contracts, schema, and state machine

**Beads id:** `agent-platform-scheduler.1`  
**Parent epic:** `agent-platform-scheduler` - Scheduler and background work

## Summary

Create the durable foundation for scheduled/background work: shared contracts, SQLite schema/migration, repository APIs, and the allowed job/run state machine. This task does not execute jobs yet.

## Requirements

- Add shared contracts for scheduled job definitions, run records, log records, creation/update bodies, and query filters.
- Model one-off, delayed, and recurring jobs without binding to a specific scheduler library.
- Add SQLite migrations and Drizzle schema for job definitions, runs, and bounded run log rows.
- Add repository APIs for create/read/list/update state transitions and append/read logs.
- Enforce valid transitions such as queued -> running -> succeeded/failed/cancelled and paused -> queued.
- Include lease fields needed by the later runner, but do not implement the runner loop in this task.

## Implementation Plan

1. Add scheduler contracts in `packages/contracts`.
2. Add DB schema and migration in `packages/db`.
3. Implement repositories under `packages/db/src/repositories`.
4. Export the repository and contract surfaces.
5. Add unit tests for schema parsing, migrations, repository CRUD, and state-transition validation.
6. Update scheduler docs with the finalized state model if implementation changes the proposed model.

## Tests And Verification

- `pnpm --filter @agent-platform/contracts test`
- `pnpm --filter @agent-platform/db test -- test/scheduler*.test.ts`
- `pnpm --filter @agent-platform/contracts typecheck`
- `pnpm --filter @agent-platform/db typecheck`
- `pnpm --filter @agent-platform/contracts lint`
- `pnpm --filter @agent-platform/db lint`

## Definition Of Done

- Clean DB migrations create the scheduler tables.
- Contracts and repositories support durable job/run/log records.
- Invalid state transitions are rejected and tested.
- No job execution happens yet.
