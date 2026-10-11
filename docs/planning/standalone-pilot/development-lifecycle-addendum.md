# Development startup and recovery qualification

Status: owner authorized this bounded work on 27 September 2026; the design received four isolated
planning reviews and implementation is in progress. This is not a persisted managed-run approval or pilot launch.

Owner: `agent-platform-pilot-zero.17`, R4 host qualification. Reuse that task and its dependency on
the pilot plan; do not create a duplicate programme. Source baseline is PR275 head
`506f3f69c9377585bb4fb547fbfe8c5efc5b81db`, integrated by PR275 merge
`b53fdbb9cd3f184fc430d244df94c20dce48e7ff` (verified 27 September). Worktree:
`/Users/letuscode/projects/agent-platform-workflow-evaluation`; branch `task/development-lifecycle-plan`, chained from `task/standalone-pilot-plan`;
integration destination `feature/harness-backlog-review`. The follow-up branch has incorporated that integration baseline. The coordinator publishes this material using the documentation guide.

## Requirements

- DL-1: one supported development entry point starts or adopts only its own explicitly configured
  services and checks Docker, pinned images, private worker/gateway topology, broker control,
  credential issue/revoke and model gateway connectivity before admitting work. Docker Desktop alone
  is not readiness. Existing unrelated services must remain untouched. Repeated and concurrent startup
  must not create competing owners. Configuration and identity mismatch block adoption.
- DL-2: readiness returns a structured status and readable reason with a recovery action. Distinguish
  stopped service, unreachable control, invalid credentials, wrong topology, missing image and provider
  connectivity failure. A TCP connection or unauthenticated response does not prove account access.
  Secrets must not appear in diagnostics. Model probes must be bounded and their cost disclosed.
- DL-3: monitor the broker during work with bounded checks and record interruption durably before
  attempting remote cancellation or revocation. Include task/run/execution identity, broker generation,
  reason, observation time and cleanup-pending state. Failure to persist blocks further dispatch.
  Broker failure must remain visible even when revocation cannot be confirmed.
- DL-4: recovery reconciles stopped workers, credential state, service generation and recorded task
  effects before allowing further dispatch. Retry cleanup idempotently with bounded attempts. Never
  replay an uncertain action, reuse invalid credentials, manufacture completion or restart a blocked
  phase merely because broker health returns. Use existing authorization/fencing rules for new attempts.
- DL-5: interruption state survives coordinator/service restart. Partial startup and shutdown preserve
  enough identity to reconcile owned resources safely. Do not broadly prune Docker resources, remove
  durable broker state, or overwrite the user's account/configuration. Concurrent recovery must be fenced.
- DL-6: qualify the connected lifecycle from stopped owned services through readiness, active-work
  broker failure, durable visible interruption, pending cleanup and reconciled recovery. Assert backend
  state and side effects independently of console messages. Retain positive and negative evidence.

## Implementation boundary

The [implementation design](development-lifecycle-design.md) specifies command behavior, deadlines,
service ownership, interruption persistence, cleanup fencing and recovery semantics. Review it together
with this scope and the verification plan; none is a substitute for the other.

Prefer existing broker, phase journal, runtime and Docker launcher interfaces. Allowed code areas:
`packages/workflow-control/src/`, corresponding `test/`, credential-runtime packaging and package
scripts; linked task, planning, testing, review and session documentation. Changes must preserve the
qualified role restrictions, source mounts, generated client configuration and denial of inherited MCP.
No new provider, remote transport, role authority, UI feature, selective MCP access, staging promotion
or live pilot is included. R1-R3 remain separately open and cannot be declared complete by this slice.

The initial source assessment found that `StandalonePhaseRuntime.#failExecution` cancels and revokes
before calling `PhaseJobJournal.block`. An unavailable broker can therefore interrupt that path before
the blocked state is recorded. Repair must retain recovery eligibility while publishing interruption;
simply changing the job to blocked would lose the existing started-job recovery claim. Design a durable
cleanup record/state transition and its ownership checks before changing this ordering.

Use supervised prerequisite development because managed execution is being qualified. Read-only
inspection of the canonical journal found four cancelled runs and zero live leases on 27 September;
this does not assert absence of arbitrary in-memory grants. Independent critique must use the isolated
reviewer route. Static planning, component tests and supervised service tests are distinct from an
autonomous task run. Preserve owner authorization; ask only about unresolved changes to behavior,
scope or authority. No merge authorization is inferred from runtime implementation authorization.

## Handoff and completion

The proposed command is a foreground development supervisor, not an operating-system login service.
It starts the configured broker and reports readiness while it stays running. Starting services does
not create a workflow or authorize tasks. An optional explicitly supplied approved runtime configuration
may construct the phase runtime for cleanup before readiness; task dispatch remains blocked until readiness; otherwise the command provides services/status.
Do not auto-discover an arbitrary task or connect to the user's other MCP services.

Provider readiness should use the existing allowed authenticated model-discovery route, with a
short-lived probe lease revoked afterward. This avoids a paid generation merely to check readiness.
Discovery success proves that request's connectivity/authentication, not future model generation.
Failure or uncertain probe cleanup prevents ready status. Require a separate real generation check
for final host qualification where the existing component evidence does not cover the deployed image.

The runtime interruption design should retain a started job's recovery eligibility and fencing while
recording the interruption reason and pending cleanup in the journal before remote operations. A late
successful worker result cannot overwrite that interruption. Only confirmed worker settlement and
generation-bound revocation allow final blocked settlement; future work requires the existing
authorized-attempt path. Status/timeline must expose the interruption and pending cleanup immediately.
Cancellation and revocation are independent obligations: failure in one must not suppress trying the
other. Recovery must also consider interrupted work after run cancellation, without authorizing more
task execution. Restarting services is not permission to replay that work.

The linked [verification plan](../../testing/development-lifecycle.md) defines required scenarios.
Before implementation, finish source-level design, validate affected contracts and obtain independent
critique of the complete material. Retain findings, dispositions and exact reviewed source/material
digests in `docs/reviews/development-lifecycle-qualification.md`. That report must distinguish planned,
passed, failed, skipped and blocked checks. Current review findings and provisional test evidence are recorded in that report; final qualification is pending.

Completion requires the connected lifecycle tests, affected regression/role tests, typecheck, lint,
build, Sonar/Problems gate, independent implementation review, pushed changes and Beads read-back/sync.
The complete `.17` task remains open until its other requirements are qualified. Failed or unexecuted
required tests block this component's sign-off; passing broker tests alone cannot replace them.
