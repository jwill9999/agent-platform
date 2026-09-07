# Workflow-control orchestrator

The repository-local workflow-control orchestrator reads task state through the workspace-pinned
official Beads adapter and schedules only issues that are open with every blocking dependency closed.
A task packet is bound to the stored
execution contract, run, role, paths, operations, acceptance criteria, retry policy, and recorded
evidence before an isolated specialist can launch.

## Fencing and concurrency

Launching work requires a run in `scheduling` plus live workspace and run leases. The orchestrator
acquires a task lease and persists the specialist execution before recording attempt 1 or journaling
the authoritative Beads claim together with the normative `scheduling` to `implementing` transition.
Only then can it invoke the concrete Docker-isolated launcher. SQLite transactionally
enforces the pilot limits across orchestrator instances and restarts:

- at most four specialist processes in total per workspace;
- at most one mutating specialist; and
- no launch for a task that is not ready in an internally refreshed authoritative Beads snapshot.

Completion, cancellation, and escalation read the clock again and require the same workspace, run,
and task fencing epochs. The launcher is raced against its absolute deadline. Every container has a
stable, persisted name. A timeout stops that identity and journals `implementing` to `recovering` to
`escalated`; incomplete cleanup remains explicit evidence rather than being treated as success.

Each scheduler intent also persists a deterministic, execution-bound credential lease before the
credential broker is called. The broker protocol must issue idempotently for the requested lease ID,
retain an irrevocable revocation tombstone for that ID, and report `revoked` only after the credential
cannot be used again. Issuance and revocation states are journaled. No scheduler execution can become
terminal until revocation is confirmed. A delayed or lost issue response triggers a compensating
revoke, and successful worker output is released only after revocation. Before every launch, the
broker must atomically run its `revoke-wins-v1` self-test and return generation-bound evidence that
the delayed issue lost and broker-owned probe credentials have a cleanup TTL of at most 30 seconds;
a broker without that protocol cannot launch a specialist. The attested broker generation is bound
into the scheduler journal and must match every issue, revoke, and status response. Credential-state
updates use compare-and-swap transitions so a stale issuer cannot overwrite revocation. Executions
migrated from the earlier
shared-credential design remain
`legacy_quarantined` and cannot finish automatically; an operator must rotate the unknown shared
credential before a separately authorized recovery can be added.

After a service restart, the new owner first acquires the workspace lease. It then reconciles active
executions only after expired run and task leases can be reacquired with newer epochs. The recovery
owner stops the persisted container identity and confirms credential revocation before bounded Beads
reconciliation, journaling `implementing` to `recovering` to `escalated`, and completing the execution
exactly once with a lost-process or elapsed-deadline reason. Recovery failures are isolated per
execution so later active executions still receive cleanup attempts.
Live executions owned by an unfenced process are left untouched.

## Acceptance and Beads closure

Task acceptance requires the run to be in `task_accepted`, live workspace/run/task fencing tokens,
the head observed directly from Git, every contract-required command executed by the trusted local
gate, complete acceptance-criterion coverage, no remaining findings or risks, and evidence recorded
for that run, task, contract, policy, and observed head.
The gate requires a clean index and worktree before and after checks, resolves the task's symbolic
branch parent once to an immutable base SHA, derives changed paths from that base, and records both
base and head SHAs in content-addressed check evidence.
The next state is derived from the authoritative Beads snapshot: intermediate tasks return the run to
`scheduling`; the last outstanding task advances it to `integration`.

The orchestrator accepts only a `JournaledBeadsTaskCloser`. That closer derives the trusted
`workflow_orchestrator` role and submits a fenced `task_accepted` transition through the exclusive
`JournaledBeadsDoltBroker`. The official adapter fixes operation postconditions rather than trusting
caller input:

- `beads.task_claim` requires `open` to become `in_progress`;
- `beads.task_close` requires `in_progress` to become `closed`; and
- `beads.dolt_push` requires `pending` to become `synced`.

Durable transition preparation derives the canonical idempotency key, compares the complete immutable
request on replay, and validates the normative state machine before recording an external effect.
Commit and recovery recheck workspace, run, and task leases. A recovered prepared transition
must replace its interrupted fencing context before it can observe, replay, or commit an external
mutation.

Beads remains lifecycle-authoritative. Dependents are selected only from a refreshed Beads snapshot
after the journaled close reports the upstream issue as closed.
