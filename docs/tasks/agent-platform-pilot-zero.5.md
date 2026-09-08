# Bounded specialist container lifecycle

Beads: `agent-platform-pilot-zero.5`  
Parent: `agent-platform-pilot-zero`

## Requirements

Provide a production Docker lifecycle primitive for a future preapproval critic runner. Separate
container creation from execution, pin the acknowledged container ID, bound subprocess time and
output, and observe removal before returning successful execution. A killed Docker client is not
proof of container termination. Never start after uncertain creation. Report cleanup uncertainty
explicitly, including the generated recovery name, without accepting model evidence.

No credentials, model image or restricted egress network are provisioned by this task. The primitive
does not confer isolation, review approval, network policy or workflow mutation authority.

## Implementation plan

Add a narrow lifecycle module using a fixed production subprocess implementation and empty child
environment. Generate a unique owned container name. Convert a generated launch into create then
start/attach operations; reject conflicting lifecycle options. On acknowledged creation, operate
on the validated container ID. Bound creation, execution and cleanup independently. Always attempt
cleanup after execution failure, cancellation or output overflow. Verify daemon exit status and
container absence; distinguish command failure from confirmed container exit and removal.

An ambiguous create may be processed late by the daemon. Never start it, attempt bounded removal
by the generated name and return cleanup-unconfirmed even if an immediate lookup reports absence.
Do not remove caller-owned source/auth paths. Return ownership information for recovery. The caller
must retain private material while cleanup is unconfirmed. No test-injected executor is exported as
a production verified transport.

## Dependency order and delivery

Depends on closed `agent-platform-pilot-zero.4`. Start this segment on
`task/pilot-zero-container-lifecycle` from updated `feature/pilot-zero-assessment` (PR259).
Delivery is a segment-tip PR to that feature branch; no staging/main merge is authorized here.
Beads closure requires independent review, pushed changes, hosted gates and segment integration.

## Tests and definition of done

Deterministic subprocess faults cover create rejection/ambiguity, invalid IDs, start failure,
nonzero exit, output overflow, cancellation, timeout, failed removal and failed absence observation.
Confirm no start follows uncertain create and no uncertain cleanup becomes success. Test the
production executor with real network-disabled containers for successful output and forced timeout,
then independently inspect container absence. Preserve existing launch restrictions and tests.
Run package build, unit tests, typecheck, lint, formatting, Sonar or documented fallback, Docker
integration and hosted checks. UI is unchanged; existing browser/desktop CI remains required.

## Sign-off and limits

Owner-directed iterative supervised bootstrap repair. Distinct Astra review is required; it is not
a formal execution-contract approval or proof of live isolated Codex execution. Persistent recovery
after host death and real model provisioning remain separately recorded integration gaps.

## Verification record

The initial source review found two probe gaps: uncertain cleanup lacked a finally fallback, and
interruption did not prove the container was running. Both were corrected with exact generated
identity/ownership observations, bounded fallback cleanup and a 45-second outer test budget covering
all operation/teardown bounds. Production time limits were not increased to hide failures.
The 44 deterministic tests and three corrected real Docker probes pass; build/typecheck/lint and
formatting pass. The initial full package run passed 582 tests with seven opt-in skips. The four
earlier Docker isolation probes and three new lifecycle probes are exercised separately.
Local Sonar initialization failed; terminal fallback is recorded and hosted Sonar remains required.
No live model execution or persistent host-crash reconciliation is claimed.
