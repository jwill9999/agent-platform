# Workflow-control persistence and recovery

Workflow control stores repository-development orchestration state outside Git. The canonical
workspace path is SHA-256 hashed and mapped to:

```text
${CODEX_HOME}/workflow-control/<workspace-hash>/
  workflow.sqlite
  artifacts/<digest-prefix>/<sha256>
```

The SQLite database runs with foreign keys and WAL enabled. Schema migration `1` creates immutable
execution contracts plus runs, fenced leases, transitions, attempts, waits, findings, external-effect
intents, and evidence metadata. Reopening the store applies migrations idempotently.
Schema migration `2` adds persisted critic reviews/findings, focused human-decision payloads, finding
dispositions, and evidence-backed human approvals.

## Mutation protocol

Every external mutation uses a journaled transition:

1. Validate the immutable contract version and policy digest.
2. Validate the run state/version and current fenced lease.
3. Persist a prepared transition and external-effect intent, then advance the run CAS version.
4. Observe the external provider. Apply the mutation only when the provider remains unchanged.
5. Observe again and commit the transition only when the expected state is visible.

The idempotency key uniquely identifies the complete operation. Reusing a key with different run,
operation, or run version is rejected. A run may have only one prepared transition.

The official Beads MCP and Dolt adapter is represented by `JournaledBeadsDoltBroker`; active runs do
not expose a second write path. Beads remains authoritative for issue lifecycle. A closed Beads task
without matching acceptance evidence blocks dependants, while an unmatched close transition is
escalated for review.

## Restart reconciliation

A recovering owner first acquires a lease with a strictly newer fencing epoch and adopts the prepared
transition. Recovery revalidates the current contract and policy before any external access. It then:

- commits when the expected external state is already visible;
- repeats the idempotent mutation when the provider is unchanged;
- escalates contradictory state or changed authorization;
- leaves ambiguous results uncommitted so a later observation can decide safely.

Tests inject faults before and after prepare, external mutation, local commit, artifact storage, and
evidence recording. Replays prove that external effects and evidence are not duplicated.

## Interfaces

`workflow-control migrate <database-path>` initializes or upgrades the database. `workflow-control
status <database-path> <run-id>` is read-only. The stdio MCP server requires `WORKFLOW_CONTROL_DB`
and exposes only `workflow_status` and `workflow_resume_preview`; mutation authority remains inside
the broker library.
