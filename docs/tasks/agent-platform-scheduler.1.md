# Task: Define scheduled job contracts, schema, and state machine

**Beads id:** `agent-platform-scheduler.1`  
**Parent epic:** `agent-platform-scheduler` - Scheduler and background work

## Summary

Create the durable foundation for scheduled/background work: shared contracts, SQLite schema/migration, repository APIs, and the allowed job/run state machine. This task does not execute jobs yet.

This task depends on the project/work context foundation in `agent-platform-active-project`. Scheduler tables should consume that project model rather than creating a second project abstraction.

## Requirements

- Add shared contracts for scheduled job definitions, run records, log records, creation/update bodies, and query filters.
- Include job ownership scope: `global`, `project`, `agent`, and `session`, with `scopeId` required for non-global scopes. `project` is the long-lived work context; the scheduled job itself is the editable automation definition.
- Add first-class DB association columns instead of hiding ownership in metadata JSON:
  - `scope` and canonical `scopeId`.
  - Nullable `projectId`, required when `scope = project`.
  - Nullable `ownerAgentId`, required when `scope = agent`.
  - Nullable `ownerSessionId`, required when `scope = session`.
  - Nullable `executionAgentId`, used for agent-turn execution and distinct from ownership.
  - Nullable `createdFromSessionId`, used for traceability when a job is created/refined from chat.
- Enforce association invariants in shared contracts and repository writes.
- Include optional execution `executionAgentId` and `createdFromSessionId` fields so jobs can be associated with a project/user context while still running as a specific agent.
- Include editable user-facing name, description, and instruction/payload fields so scheduled jobs can be reviewed and refined after creation.
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

## Dependencies

| Upstream task                   | Reason                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `agent-platform-active-project` | Defines `projects` and the canonical project/work context associations scheduler reuses. |

## Backwards Compatibility

- Scheduler tables and contract exports must be additive; this task must not alter existing chat, memory, model, agent, or working-memory behaviour.
- Existing sessions and agents must not require a project. Jobs can be `global`, `agent`, or `session` scoped with `projectId = null`.
- `project` scoped jobs must require the project foundation and should reject inconsistent rows where `scopeId !== projectId`.
- Clean installs should create the scheduler tables with no enabled jobs by default unless a later task deliberately seeds disabled maintenance jobs.
- Migrations must be safe on existing SQLite databases and covered by migration tests.
- Repository validation should reject inconsistent new scheduler rows without rewriting or invalidating existing non-scheduler records.

## Tests And Verification

- `pnpm --filter @agent-platform/contracts test`
- `pnpm --filter @agent-platform/db test -- test/scheduler*.test.ts`
- `pnpm --filter @agent-platform/contracts typecheck`
- `pnpm --filter @agent-platform/db typecheck`
- `pnpm --filter @agent-platform/contracts lint`
- `pnpm --filter @agent-platform/db lint`
- Migration test proving scheduler tables are added to an existing database without changing existing session, agent, memory, and working-memory reads.
- Repository tests for every ownership scope, including project-owned jobs, non-project jobs, and rejected inconsistent association combinations.
- State-machine tests for all allowed and denied transitions, including lease-ready fields that the later runner will consume.

## Definition Of Done

- Clean DB migrations create the scheduler tables.
- Jobs can be queried by scope and are ready for project-owned scheduling once active project binding exists.
- DB indexes support common association queries by `projectId`, `ownerAgentId`, `ownerSessionId`, `executionAgentId`, `status`, and next due time.
- Contracts and repositories support durable job/run/log records.
- Invalid state transitions are rejected and tested.
- Existing no-scheduler and no-project workflows are unaffected by the migration.
- No job execution happens yet.
