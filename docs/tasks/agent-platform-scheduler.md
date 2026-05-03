# Epic: Scheduler and background work

**Beads id:** `agent-platform-scheduler`  
**Planning source:** [Harness Gap Analysis](../planning/harness-gap-analysis-2026-04-29.md)

## Objective

Add durable scheduled tasks and background process tracking so agents can run recurring automation, long-running coding checks, and delayed follow-up work outside a single active chat request.

This epic is the platform foundation for later automation such as nightly memory/self-learning review, runtime configuration backups, expired memory cleanup, delayed follow-ups, and long-running quality gates. The first implementation should be single-node and Docker-local; it must not introduce external queues or OS-level cron.

## Capability Map

```json
{
  "jobs": ["one_off", "recurring", "manual_run", "retry"],
  "runtime": ["queued", "running", "succeeded", "failed", "paused", "cancelled"],
  "controls": ["create", "pause", "resume", "cancel", "inspect_logs"],
  "safety": ["owner_scope", "tool_policy", "HITL_for_high_risk", "audit_log"]
}
```

## Scope

- Durable job definitions and run history in SQLite.
- Scoped ownership for jobs: `global`, `project`, `agent`, and `session`, with project scope intended as the normal user-created job scope once active project binding is available.
- One-off, delayed, and recurring schedules.
- A single API-owned scheduler loop with leasing so duplicate API processes do not double-run the same job.
- Bounded run output/log capture and inspectable run status.
- Retry, timeout, cancellation, pause/resume, and manual-run controls.
- API and Settings UI surfaces for managing jobs and viewing runs.
- Safety policy integration for agent/tool execution, including HITL for high-risk work.
- Notification hooks for completion/failure events, starting with in-app/audit surfaces.

## Non-Goals

- Distributed queue infrastructure such as Redis, Postgres advisory locks, or cloud task queues.
- User-auth or multi-tenant ownership beyond the current single-user/scoped-data model.
- Silent autonomous code/policy/prompt changes from scheduled jobs.
- Full email/Slack/push notification delivery. This epic should create the hook/event shape and at most local/in-app notification behavior.

## Terminology

- **Project:** a durable user work context, usually tied to a workspace/repository/application, its scoped memories, configuration, files, and future project-specific MCP/model defaults.
- **Scheduled job:** an editable automation definition. Users can refine its name, description, instructions, schedule, target, scope, retry policy, and enabled/paused state.
- **Job run:** one execution attempt of a scheduled job, with its own status, logs, result summary, retry attempt, and cancellation state.
- **Beads task:** a development-tracking issue in this repository. It is not the same thing as a user-created scheduled job.

The runtime data model should use `project` for the long-lived association and `scheduled job` for the automation itself. UI copy can say "scheduled task" if that reads better to users, but contracts and tables should avoid overloading "task" as the ownership scope.

## Proposed Task Chain

| Task                         | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `agent-platform-scheduler.1` | Define scheduled job contracts, schema, and state machine   |
| `agent-platform-scheduler.2` | Implement job runner, queue, retry, and cancellation basics |
| `agent-platform-scheduler.3` | Add background process tracking and log capture             |
| `agent-platform-scheduler.4` | Add UI/API controls for schedule and background work        |
| `agent-platform-scheduler.5` | Add notification hooks and end-to-end tests                 |

## Child Task Boundaries

1. `agent-platform-scheduler.1` defines the scheduler data model, contracts, migrations, and state machine only, using the project/work context model from `agent-platform-active-project`.
2. `agent-platform-scheduler.2` implements a minimal runner/dispatcher that can execute persisted jobs safely.
3. `agent-platform-scheduler.3` adds durable background run output and bounded log/event capture.
4. `agent-platform-scheduler.4` exposes management API/UI controls.
5. `agent-platform-scheduler.5` completes observability/notification hooks, E2E coverage, docs, and epic polish.

## Architecture

```mermaid
stateDiagram-v2
    [*] --> Queued
    Queued --> Running
    Running --> Succeeded
    Running --> Failed
    Running --> Cancelled
    Failed --> Queued: retry policy
    Queued --> Paused
    Paused --> Queued: resume
```

```mermaid
flowchart LR
    UI["Settings UI"] --> API["Scheduler API"]
    Agent["Agent tool/API request"] --> API
    API --> DB[("SQLite scheduled_jobs / scheduled_job_runs")]
    Loop["API scheduler loop"] --> DB
    Loop --> Runner["Job runner"]
    Runner --> Harness["Agent/session runtime or built-in task"]
    Runner --> Logs["bounded run logs/events"]
    Logs --> DB
    Runner --> Notify["notification/audit hooks"]
```

## Data Model Direction

- `scheduled_jobs`: job definition, schedule type, cron/interval/run-at expression, target kind, target payload JSON, status, retry policy, timeout, created/updated timestamps.
- Job ownership fields should be first-class columns, not only metadata JSON:
  - `scope`: `global`, `project`, `agent`, or `session`.
  - `scopeId`: the canonical scoped owner id; omitted only for `global`.
  - `projectId`: nullable project/work-context association. Required when `scope = project`; references `projects.id`.
  - `ownerAgentId`: nullable agent ownership association. Required when `scope = agent`; references `agents.id` where possible.
  - `ownerSessionId`: nullable session ownership association. Required when `scope = session`; references `sessions.id` where possible.
  - `executionAgentId`: nullable agent used to execute agent-turn jobs. This is separate from ownership because a project-owned job may still run as a specific agent.
  - `createdFromSessionId`: nullable trace link to the session that created/refined the job.
  - Editable user-facing `name`, `description`, and `instructions` fields so scheduled jobs can be refined after creation.
- `scheduled_job_runs`: immutable-ish run attempts with status, lease metadata, started/completed timestamps, result summary, error code/message, retry attempt, and cancellation request state.
- `scheduled_job_run_logs`: bounded append-only output/events for a run, with truncation controls.

The schema should stay SQLite/Postgres-compatible and use JSON columns only for target payloads, retry policy, and compact metadata.

Association invariants should be enforced in shared contracts and repository writes:

- `global`: no `scopeId`, no required project/agent/session owner.
- `project`: `scopeId = projectId`, and `projectId` is required.
- `agent`: `scopeId = ownerAgentId`, and `ownerAgentId` is required.
- `session`: `scopeId = ownerSessionId`, and `ownerSessionId` is required.
- `executionAgentId` is optional and describes who runs the work, not who owns it.

## Compatibility And Rollout

- Scheduler schema changes must be additive. Existing agents, sessions, memories, and working-memory records must continue to load when no project exists.
- Project-owned scheduled jobs require the project/work context foundation from `agent-platform-active-project`; the scheduler must reference `projects.id` rather than defining a parallel project identifier.
- Non-project jobs remain supported: global jobs can have no owner id, agent jobs can be owned by an agent, and session jobs can be owned by a session.
- A user should not be forced to configure scheduler jobs during initial app setup. Clean installs and migrated installs should both start with no scheduled jobs unless seed data intentionally adds disabled maintenance examples.
- The implementation should keep feature rollout staged: contracts/schema first, runner second, logs third, UI fourth, notifications/E2E last.

## Safety Model

- Jobs start paused or enabled explicitly depending on creation path; destructive defaults should be conservative.
- High-risk tool work must still route through existing policy/HITL behavior.
- A scheduled job should execute as a normal agent turn or a named built-in maintenance task, with trace/audit records linking the job id and run id.
- Cancellation must be best-effort and leave an inspectable terminal state.

## Definition Of Done

- Jobs have durable state and audit trails.
- User can pause, resume, cancel, and inspect work.
- High-risk scheduled actions remain policy/HITL controlled.
- Background process logs are captured and bounded.
- Tests cover retries, cancellation, failures, and persistence.
- Parent and child Beads issues are closed only after docs, tests, and manual UI verification are complete.
