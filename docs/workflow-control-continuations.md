# Durable workflow continuations

Specialist completion now records a continuation intent in the same SQLite transaction as the
scheduler result. A trusted caller can supply an exact callback through `launchTask.completionCallback`;
storage validates the scheduler identity, contract, material approval, evidence, fences, and parent
version before committing the callback, phase transition, and continuation together. Invalid callbacks
roll back the completion transaction. Callbacks arriving separately attach only before dispatch.

The result digest is calculated over the persisted result, not the callback envelope. The callback
must reference previously recorded, exact-head input/result evidence. The worker does not manufacture
evidence or authorize a callback from free-form specialist text.

## Runnable coordinator and watchdog

Build the package, then run `workflow-control coordinator /absolute/path/workflow.sqlite` as a
supervised service. Stop it with SIGTERM or SIGINT. Startup performs reconciliation; an in-process
completion signal triggers immediate reconciliation, and an independent timer covers missed signals,
separate scheduler processes, and coordinator restarts. No conversation turn is required.

The Docker image includes the workflow-control package. For a separately supervised worker, set
`WORKFLOW_DATABASE_HOST_DIRECTORY` to the directory containing the authorized `workflow.sqlite`,
then use `docker compose -f docker-compose.workflow-control.yml up -d --build`. The service uses
`restart: unless-stopped` and shares the existing journal. It must be given a writable directory
with permissions for the container user. Starting it is an operator deployment action; the tests
use temporary journals and do not start or change the user's active workflow runtime.

The watchdog checks completed scheduler rows missing an intent, overdue active specialists, pending
callbacks, and accepted or started continuations whose lease expired. It persists `attempts`,
`last_attempt_at_ms`, and `next_check_at_ms`. Missing callback grace periods do not spend host attempts.
An SQLite immediate transaction serializes claims, leases fence competing coordinators, and only one
continuation per parent run can hold a live lease. Busy hosts are retried at the persisted next check.
The absolute deadline revokes any outstanding lease and records a single blocker, even if another
worker is still observing the host. That worker must recheck its fence before dispatching.

| Setting                          | Default | Purpose                                           |
| -------------------------------- | ------- | ------------------------------------------------- |
| `WORKFLOW_WATCHDOG_POLL_MS`      | 1000    | Independent reconciliation interval               |
| `WORKFLOW_WATCHDOG_OVERDUE_MS`   | 30000   | Grace period for an eventual callback             |
| `WORKFLOW_WATCHDOG_MAX_ATTEMPTS` | 10      | Bound on host attempts                            |
| `WORKFLOW_WATCHDOG_DEADLINE_MS`  | 300000  | Maximum age before visible host failure           |
| `WORKFLOW_CONTINUATION_LEASE_MS` | 30000   | Fencing lease for a continuation attempt          |
| `WORKFLOW_HOST_TIMEOUT_MS`       | 5000    | Host call timeout; must be shorter than the lease |

`workflow-control status DATABASE RUN_ID` includes continuation status, failure reason, and durable
next action. Exhaustion records `blocked` with `host_resume_unavailable`. An overdue specialist
receives a visible blocker; the watchdog does not kill a process or revoke credentials outside the
existing scheduler recovery authority.

## Acceptance is not consumption

Each intent has one stable host execution identity and a monotonically increasing lease epoch.
Provider acceptance records only `accepted`. The actual parent process records `started`, including
its process ID. It then atomically inserts one durable next action and records `consumed`. The action
table has a unique job key. Duplicate callbacks, acknowledgement retries, and restarted supervisors
cannot insert a second action. A stale process cannot consume after a newer lease takes over.
A first validated callback may attach after dispatch acceptance or start while the job remains
unconsumed. Its execution identity stays unchanged, and subsequent callback substitution is rejected.

The legacy callback wake port remains compatible, but its acceptance receipt no longer marks the
callback woken. Only durable continuation consumption sets that flag. The old in-memory wake-count
test is not a release proof.

## Host boundary and current limitation

`AsyncParentExecutionHost` supplies asynchronous `observe` and `start` methods with abort signals.
The command adapter accepts an absolute `WORKFLOW_PARENT_HOST_BINARY`, with optional
`WORKFLOW_PARENT_HOST_ARGS` as a JSON string array. It invokes the binary with the operation and job
JSON and requires a strict observation response: `missing`, `busy`, `unavailable`, or a bound
`accepted`/`started`/`consumed` execution identity. Host implementations must observe actual execution,
start the bound parent idempotently, and use durable start and consumption acknowledgements. An
acknowledgement must never be inferred from successful message delivery.

The continuation lease protects intake and consumption only. Every phase executor must still
acquire and validate the existing workspace/run/task leases and route side effects through the
authorized brokers. It must not treat a continuation receipt as new Git, Beads, or notification
authority. The current role matrix tests the shared completion transport for each declared role;
the standalone runtime tests below separately exercise verification and review dispatch. Neither
suite proves a complete autonomous planning, implementation, and delivery workflow.

The built-in local adapter launches a real parent continuation child. It validates the structured
specialist terminal result and consumes into an already-authorized approval intent, a visible blocker,
or an `execute_phase` action. Missing callback authority yields
`specialist_callback_authority_unavailable`; unparseable terminal output yields
`invalid_specialist_terminal_result`. A non-approval callback with current contract, material approval,
parent version, and approved-head bindings atomically queues one durable phase job with consumption.
Missing or stale phase authority produces a `phase_authority_unavailable` blocker. The built-in adapter
does not resume a desktop conversation or execute the queued specialist.

`PhaseJobJournal` provides fenced claims, renewable leases, and a stable downstream execution ID.
These leases are independent of the five-second host acknowledgement timeout. Expired claims that
never started may be reclaimed; started work requires `claimRecovery` and explicit observation or
settlement of its existing execution. Recovery never automatically launches a second specialist.
The dispatch mapping identifies the intended specialist role or coordinator; it grants no new role,
operation, credential, or resource-lease authority. The standalone runtime below composes the existing
isolated launcher for verification and review. Other phases still require their authorized executors
or coordinators. A queued intent alone does not prove that the next phase ran.

Specialist completion requires a matching completed scheduler execution with revoked credentials and
its committed result callback. Result evidence must match the execution's process identity, dispatch
role, callback result head, digest, and contract/run/task scope. Read-only specialist results must
remain on the dispatched head. Completion records bookkeeping only; the validated callback controls
the normative workflow transition. Coordinator completion currently fails with
`phase coordinator completion authority unavailable`: generic transition records do not establish a
uniform execution producer or result head. A typed coordinator receipt adapter is required before
those jobs can claim completion.

## Standalone verification and review runtime

After building, `workflow-control phase-runtime DATABASE CONFIG.json` starts the concrete
`StandalonePhaseRuntime`. Run it alongside the continuation coordinator, which consumes terminal
callbacks into subsequent phase jobs. The phase runtime is scoped to one approved run. It acquires
workspace, run, and task leases, renews them with its phase lease throughout execution, and uses a
deterministic UUID execution identity accepted by the credential broker and Docker launcher.
Its production factory instantiates `RevocableSpecialistCredentialBroker`,
`DockerIsolatedSpecialistLauncher`, and `SecureEvidenceVault`; test executor injection is rejected
outside the test runtime.

The JSON configuration requires `runId`, absolute `sourceRoot`, absolute `credentialBrokerBinary`,
an immutable `image` reference ending in `@sha256:` and 64 hexadecimal characters, a dedicated
`egressNetwork`, and a non-root numeric `containerUser` in `uid:gid` form. Optional `leaseTtlMs`
defaults to 30000 and `pollIntervalMs` to 1000. The execution deadline comes from the approved
contract's `retryPolicy.waitDeadlineSeconds`. Production uses `/usr/local/bin/docker` and
`/usr/bin/git`. The image and network must already exist; the factory neither pulls nor deploys them.
The source checkout must have the exact approved HEAD and no changes or untracked files beneath the
task's allowed paths. Those conditions are checked before launch and after the specialist exits.

Verification and review require explicit task contract material:

```json
"phaseRoles": {
  "task_verification": "test_runner",
  "task_review": "code_reviewer"
}
```

Absent phase roles confer no authority. Adding them changes the material digest and is rejected by
the automatic no-authority-expansion revision guard; it requires a newly approved contract. The
existing task operations must permit `artifact.write` for trusted result collection and
`workspace.read`; verification also needs `process.test`. Specialist packet operations are narrowed
to the intersection of task permissions and the existing role policy. Reviewers receive no write
capability. The orchestrator authenticates result ingestion, and the vault derives the recorded
producer and role from the settled scheduler execution. Exact approved task paths and journal IDs
are exempt from the entropy heuristic only; direct secret detection and redaction still apply.

The persisted scheduler input, secure input evidence, and actual specialist prompt use the same strict
input envelope. It contains the task packet, execution digest, approved head, owner digest, originating
callback, run version, and phase/workspace/run/task lease generations. A repeated verification after
repair or owner replacement therefore records distinct immutable input evidence without rebinding
the earlier evidence's head or producer. The launcher verifies the envelope's execution and role
bindings before issuing credentials. The vault permits the already-verified exact head through its
entropy heuristic while preserving direct secret scanning.

The runtime ingests the actual structured terminal answer with a trusted execution digest, records
its evidence, and commits the validated callback before completing the phase job. A `passed` status
alone never proves acceptance: every approved criterion must pass, no unapproved criterion may be
substituted, and failed criteria or unresolved findings route to repair. Unresolved risks, blocked
status, escalation intent, or changes from a read-only specialist route to escalation. Verification
must recommend `continue`; review must recommend `integrate`, matching the existing final task
acceptance semantics. Contradictory status or transition intent cannot enter task acceptance. Restart
recovery first observes the durable scheduler; completed work reconciles from its existing evidence,
while interrupted work is stopped, inspected, credential-revoked, and settled before it is visibly
blocked for a new authorized attempt. It is never automatically relaunched under the same identity.

Supported execution currently covers `task_verification` to `task_review` and `task_review` to
`task_accepted`, with normative repair and escalation outcomes. Initial scheduling remains the
existing `WorkflowOrchestrator.launchTask` path. The standalone runtime blocks `implementing` with
`phase_artifact_import_unavailable`: importing isolated implementation changes is not implemented.
Coordinator phases, final task acceptance/closure, delivery, approval-notification transport,
and external credential-service implementation remain separate prerequisites. The runtime creates
no credential service and performs no deployment.

`workflow-control standalone-conformance DATABASE CONFIG.json` uses the same production factory and
executes one already-authorized runnable phase. It succeeds only after real isolated execution,
validated evidence, callback commit, and phase completion. It fails explicitly for missing config,
credential broker, immutable image, Docker image/network availability, or absence of a completed
phase. This command operates on the supplied run; use a separately approved conformance run.
It proves the standalone execution boundary, not feature delivery or desktop conversation resumption.
`host-conformance` remains the distinct optional desktop boundary and still fails without a supported
desktop adapter. Fixture-backed runtime tests never count as actual Codex conformance.

## Release gates

### Mandatory early-rollout visibility

Every meaningful change appends a transactional `continuation_events` outbox entry:
`specialist_completed`, `callback_committed`, `continuation_accepted`, `continuation_started`,
`continuation_consumed`, `next_action`, `watchdog_recovery`, `approval_required`, and `blocked`.
Phase-job intake and execution bookkeeping add `phase_queued`, `phase_started`,
`phase_recovery_required`, `phase_completed`, and `phase_blocked`. Queueing does not emit a started
or completed event, and a completion rejected by its evidence checks emits no completion event.
The watchdog also emits `resume_overdue` once at the configured N threshold, even while a parent
holds a live continuation lease. The identity is derived from run, job, event kind, and generation.
Unchanged polls do not create events. A recovery event requires an actual parent start; acceptance
or a retry alone cannot claim recovery.

`workflow-control timeline DATABASE RUN_ID` displays events and per-channel delivery receipts,
including pending delivery errors. A separate notification dispatcher runs beside the coordinator
and publishes the default durable local JSON-lines feed at `DATABASE.notifications.jsonl`. It keeps
reporting completion, overdue status, and blockers even when the parent process never resumes.
`WORKFLOW_NOTIFICATION_POLL_MS` controls delivery checks (default 1000), and
`WORKFLOW_NOTIFICATION_FEED_PATH` can select another local feed path. Delivery uses fenced claims,
durable receipts, and observe-before-resend after response loss. Receipt status never defines
workflow success or callback consumption.

This is the minimal production visibility surface: the journal, CLI timeline, and generic feed.
An in-app timeline/chat adapter can consume that feed and deduplicate by event ID. It should show
actual handoffs, recovered stalls, approvals, and blockers, without heartbeat spam. Native Codex
chat delivery is not implemented or claimed. Optional owner-authorized email, Slack, or iMessage
adapters should deliver only approval-needed and terminal stall/blocker events with the same IDs.
No out-of-band integration is enabled by this repair.

### Commands

- `pnpm --filter @agent-platform/workflow-control test:progression` builds and tests deterministic
  watchdog races and production coordinator processes. Real specialist children produce results;
  real parent children record distinct process identities, start, and consume exactly once without
  a user message. Every declared specialist role is exercised. A real host subprocess that accepts
  without starting is bounded by the watchdog and fails visibly.
- `pnpm --filter @agent-platform/workflow-control test:host-conformance` is mandatory for autonomous
  desktop progression only. It currently exits nonzero with `host_resume_unavailable`; it is never skipped.
- `pnpm --filter @agent-platform/workflow-control test:standalone-runtime` builds and exercises the
  durable phase journal and concrete runtime with temporary fixture credentials and real Node child
  transport. No live Docker/Codex execution is claimed by that test.
- `pnpm --filter @agent-platform/workflow-control test:standalone-conformance DATABASE CONFIG.json`
  performs the explicit standalone execution check described above; missing configuration fails.
- `pnpm --filter @agent-platform/workflow-control gate:autonomous-progression` runs both gates and
  therefore currently fails. A passing process test proves durable scheduling and visible outcomes,
  not autonomous Codex desktop resumption. Supply and independently verify a real desktop host adapter
  before replacing the explicit unsupported conformance gate.

The process tests would fail against the previous implementation: it lacks the runnable coordinator,
atomic completion intent, parent process identity, consumed acknowledgement, and unique next action.
