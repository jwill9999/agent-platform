# Development lifecycle implementation design

Proposed design for [DL-1–DL-6](development-lifecycle-addendum.md), owned by
`agent-platform-pilot-zero.17`. This supplements the authorized scope; implementation and runtime
qualification remain pending. It does not grant authority for a managed task run.

## Operator interface and readiness

Provide `workflow-control development-host <absolute-config.json>` as a foreground supervisor.
`development-status` reads its durable state without creating a database; `development-stop` requests
graceful shutdown of that exact service identity. Starting services does not launch a task. An optional
runtime configuration is accepted only through the existing approved-run interface and revalidation.
No arbitrary startup commands, inherited environment/configuration, MCP or Docker-host mounts enter
workers. The trusted operator retains Docker administration authority.

The strict operator config supplies a private state directory, immutable broker and worker image
digests, existing private account-file path, non-root container UID/GID, loopback control port and
model client version. Reject symlinks, public permissions, relative paths and unexpected fields.
Generate separate broker-server and host-adapter configs: the server reads container mount paths,
the host adapter reaches only the configured loopback control endpoint. The account stays read-only
in the gateway; the host owns a separate random private control key. Never copy host Codex settings.
Key/account bytes never enter the service fingerprint or evidence.

Readiness records separate Docker, images, topology, control authentication, broker generation,
credential conformance and provider discovery outcomes. Probe authenticated `/models` using a unique
short-lived lease; validate the response shape, then revoke and verify denial. No response body or token
is logged. This makes no paid generation request. A distinct bounded real generation remains part of
host qualification and uses existing owner-authorized model access. Discovery is not generation proof.

Broker control gets an authenticated health operation returning a strict protocol version, process
generation and readiness state. Verify the gateway listener is serving and the credential DB still
belongs to this process; no public unauthenticated health claim grants readiness. Probe interval is
2 seconds, timeout 3 seconds, one in flight. One failed check immediately invalidates readiness;
expected active-work detection is at most 5 seconds plus scheduler delay, measured in tests with a
1-second allowance. Provider discovery runs before admission and after service recovery, not every
heartbeat. Readiness must be fresh at every dispatch and generation-pinned; a healthy new generation
does not validate leases from its predecessor.

Use allowlisted codes: `docker_unavailable`, `image_unavailable`, `service_stopped`,
`service_identity_mismatch`, `topology_invalid`, `control_unavailable`, `control_auth_rejected`,
`broker_generation_changed`, `provider_unavailable`, `provider_auth_rejected`, `journal_unavailable`,
`cleanup_pending`, `cleanup_exhausted`, `ready`. Responses contain service ID, sequence, observation
time, stage, code and a fixed recovery instruction. Execution-related responses add run/task/execution
IDs and cleanup status. Never persist arbitrary exception text, request headers, URLs with secrets or
provider bodies. CLI exit codes: 0 for successful status/clean shutdown, 2 for invalid configuration,
3 for unavailable readiness and 4 for unresolved interruption/cleanup. Monitor events are JSONL plus
a concise operator message; status returns the same durable fields.

## Service ownership and partial provisioning

Use a separate private lifecycle SQLite database for service provisioning only. Workflow/phase state
stays authoritative in its existing journal. Record service UUID, canonical config fingerprint,
owner process identity, monotonic epoch, lease expiry, resource intent/result IDs, status and probe
observations. Take an immediate transaction before creating resources. Lease TTL is 15 seconds,
renew every 2 seconds. Loss of the lease/persistence pauses admission immediately. A replacement
checks recorded process identity and exact Docker resources before adoption; unknown identity blocks.
An alive previous owner is never displaced merely because a lease expired.

Create stable names derived from the service UUID and Docker ownership/config labels. Record each
intent before creation; read back image, labels, mounts, UID, privilege settings, port bindings and
network identities before confirming it. On an ambiguous create result, inspect the exact name;
never adopt a same-name resource with mismatching labels/config. Docker's unique name plus journal
ownership serializes creators. A stale owner cannot change service-level resources; verify ownership
immediately before each operation and re-observe outcomes. In-flight operations are reconciled by
identity after takeover; do not assume a timeout means nothing happened.

Create one internal worker network and one outbound gateway network. Only the gateway joins both;
workers join only the internal network. Publish the control port solely on host loopback. Do not
publish gateway access externally or mount the Docker socket. Both broker listeners may bind the
container interface, but the separate control key never enters workers; validate the complete Docker
topology rather than interpreting a listen address as isolation. Reject unowned extra network members
or changed topology before readiness and on periodic checks.

The broker must handle listener errors explicitly: close whichever listener opened, terminate active
streams and exit unsuccessfully. No partial listener state is ready. Interrupted provisioning remains
recorded; reconcile only owned resources. Stop records a shutdown intent, stops admission, interrupts
attached work, attempts independent cleanup and preserves unresolved obligations. Remove only the
exact owned container/network IDs after settlement; never delete account files, broker SQLite state
or unrelated resources. A stopped service can be restarted by the same supported command.

## Durable execution interruption

Extend the phase journal with an execution-keyed interruption/cleanup table rather than changing the
phase status enum to a non-recoverable value. Store phase job, run/task/execution identity, original
failure code/time, observed broker generation, cancellation state, revocation state, settlement state,
last attempt/time, attempt count and reconciliation outcome. Schema upgrades are additive and
transactional. Existing jobs remain readable. An interruption without a valid execution association
fails closed rather than applying cleanup to another worker.

An atomic, phase-fenced operation inserts the immutable initiating failure and cleanup obligations
and records a workflow event. The job remains `started` while cleanup is pending, preventing dependent
claims and preserving recovery eligibility. No callback or completion is accepted once interruption
is recorded, including a worker-success race. Later cleanup errors append bounded codes without
replacing the original reason. Status and timeline expose the interruption immediately. A failed
initial write must stop admission and attempt best-effort containment; print `journal_unavailable`,
never claim a durable record that was not committed. Startup recovery independently inspects active
executions so an interruption lost to disk failure cannot imply completed work.

Cancellation, revocation and settlement have separate pending/confirmed/failed observations. Try
cancellation and generation-pinned revocation independently, even if one fails; then observe actual
worker absence and credential denial. Persist each result after observing it. Each external operation
has a 5-second deadline; one cleanup attempt has a bounded 15-second budget. Use three attempts with
2- and 4-second backoff, durably counting attempts before external operations. Exhaustion remains
visible, retains pending obligations and blocks dispatch. Recovery explicitly initiated by the operator
can start another bounded cleanup batch after readiness checks; never reset counters invisibly.

Cleanup is idempotent for a unique execution/container identity and its original credential generation.
Check phase ownership before each effect and each journal write. A stale in-flight cancellation or
revocation is safe only because it targets that permanently unique execution and cannot affect a later
attempt. Container identities and credential lease IDs must never be reused. Stale owners cannot
publish success, dispatch work, alter a replacement service or mark cleanup confirmed. If these
identity guarantees cannot be established, block and retain evidence rather than clean up speculatively.

Claim interruption cleanup independently of run state so cancelled/closed runs can have their workers
contained. This cleanup authority allows only cancel/revoke/observe and fenced cleanup-record updates;
it cannot advance a terminal run or create a new task attempt. Existing workspace/run/task lease
requirements for normal execution remain unchanged. Two recovery contenders serialize on the cleanup
record epoch. Final settlement marks the phase blocked only after all required cleanup is confirmed.

## Reconciliation and resumption

The authoritative broker generation already rotates on restart and invalidates old token admission;
retain that behavior. Reconcile original execution credentials through the durable generation-bound
broker protocol, not a newly issued token. Confirm process settlement through Docker inspection of the
recorded container ID and launcher settlement evidence. A successful stop request alone is insufficient.
Accepted upstream computation cannot be undone; report that limitation rather than claiming rollback.

Task effects use the existing approved result/artifact/import records where available. In this slice,
an interrupted worker result is not accepted or imported; preserve its private workspace/evidence for
inspection. Mark effects `none_verified`, `recorded_effects` or `uncertain` based on independent
inspection, never model narrative. The fixture marker test proves absence of replay, not a universal
reconciler for arbitrary tools. Unknown external effects remain uncertain and forbid automatic retry.
R2's governed importer is a separate prerequisite; this work must not pretend to implement it.

Restored health allows cleanup and fresh readiness assessment, not re-execution of the interrupted
action. A subsequent attempt needs the existing approved material, authorized retry allowance, fresh
execution identity and current fences. Keep the interrupted phase blocked where no supported safe
retry transition exists. The command must explain the next authorized step without inventing one.

## Transaction and interface refinements from independent critique

Interruption insertion and `WorkflowStore.finishSchedulerExecution` must serialize in the same
workflow SQLite database using immediate transactions. Inside the authoritative scheduler-result and
callback-commit transaction, reject successful completion for an interrupted execution before writing
its result or callback. Also recheck interruption at callback consumption and phase completion. If
successful terminal commitment wins the transaction race first, preserve that terminal outcome and
record any remaining service/credential cleanup separately; do not retroactively fabricate task
failure. Test each race boundary, not just the final phase-job write. Make the interruption-table
migration part of the shared workflow schema so the authoritative store cannot omit the guard.

Before dispatch, durably bind the private staging location and ownership to the execution. The launcher
must coordinate retention with interruption recording before deleting staging on failure or a late
authority rejection. Preserve only bounded source/evidence needed for reconciliation; authentication
and runtime credential files follow separate secure cleanup after confirmed containment. The record
must survive process restart and reject foreign paths, symlinks and ownership mismatch. Deletion of
retained evidence requires a recorded reconciliation/disposal decision. Tests must inspect retained
bytes after successful worker containment and restart; merely retaining a pathname is insufficient.

Propagate per-operation deadlines through broker HTTP, command execution and Docker calls. Terminate
timed-out child commands and abort HTTP requests; a `Promise.race` alone does not cancel an operation.
Allocate a durable cleanup-attempt sequence before effects; confirmations compare both owner epoch
and attempt sequence. A late response from an expired attempt cannot confirm a newer attempt, clear
exhaustion or publish completion. Observe uncertain Docker/credential outcomes before issuing another
effect, using unique execution identities to make any unavoidable in-flight effect safe. Retain pending
status where cancellation cannot be proved. Add delayed acknowledgements after timeout, takeover and
exhaustion to the tests. An attempt budget expiring never equates to successful cleanup.

Add a trusted-control `probe-issue` operation distinct from ordinary worker issuance. It creates a
fresh probe identity bound to the current generation, with a fixed maximum TTL of 30 seconds enforced
by the broker; clients cannot extend or renew it. Provider discovery has a 5-second timeout and always
attempts revocation. Persist its generation/lease identity and unresolved cleanup without token bytes.
Readiness is denied until revocation is confirmed, or expiry and broker denial are independently
observed. Test provider timeout plus revoke failure, eventual expiry, duplicate issuance and generation
change. The worker protocol and its ordinary TTL are unchanged.

`development-recover <absolute-config.json>` explicitly begins a new bounded cleanup batch. It never
requires full admission readiness: cancellation needs Docker and matching execution identity;
revocation needs the authenticated broker/control generation; settlement needs its respective
observation path. Attempt available obligations independently while admission remains blocked. Record
the operator recovery request and new batch identity; normal monitoring cannot silently reset budgets.

Persist a unique probe request ID and intended broker generation before `probe-issue`. Issuance binds
idempotently to that request ID and never extends its original expiry on retry. Authenticated
`probe-status` returns generation, lease identity, expiry and status without token bytes, including
an unambiguous never-issued result. On a lost response, recover through that ID before any replacement
probe; revoke-before-issue leaves a tombstone so delayed issuance cannot resurrect it. Changed service
generation fences old probes and requires observed denial before a fresh probe may establish readiness.

Run provider discovery and post-revocation denial checks in a uniquely named disposable probe container
on the same internal network as workers. Its pinned image and hardened mounts use the same network
boundary; the gateway port remains unpublished. Mount only the private, short-lived probe token file
read-only, never the account or control key. Record the container intent before creation and reconcile
it after timeouts/restart. Bound its HTTP call and process lifetime; remove its token file only after
confirmed container settlement. Provider bodies and token contents are excluded from output. This
explicitly avoids relying on host routing to Docker Desktop container-private addresses.
