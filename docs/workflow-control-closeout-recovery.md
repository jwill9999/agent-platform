# Workflow closeout and recovery

Feature delivery enters `finalizing` only when the journal commits an exact GitHub merge
attestation. That commit atomically records `merge_verified`; callers cannot manufacture the
postcondition with a transition flag.

## Closeout sequence

`FeatureFinalizationCoordinator` holds current workspace, run, and closeout leases and performs the
following replay-safe sequence:

1. reconcile any prepared closeout transition;
2. build and persist one immutable, content-digested closeout intent from the passed feature
   evaluation at the exact merged head, including every evidence reference and every approved and
   committed repair child;
3. verify every recorded child is already closed in authoritative Beads state;
4. close only the feature epic through the exclusive journaled Beads port;
5. push and observe the Dolt remote as `synced`; and
6. atomically mark both the finalization record and workflow run `closed`.

Epic close and Dolt sync use stable transition identities. A restart after either external mutation
observes the result and commits the prepared journal entry without repeating the effect. `closed` is
derived from committed merge, epic-close, Dolt-sync, child-close, exact-head evaluation, and
final-report records; a caller boolean or caller-selected evidence cannot substitute for those
records. The closeout coordinator accepts only a sealed broker registered to its exact workflow
store; production broker clocks and fault injection cannot be caller-supplied.

## Recovery and waits

Entering `recovering` persists the interrupted state, exact recovery target, interrupted transition,
merge checkpoint, and evidence digests in the same transaction as transition preparation. Resume
loads that target from SQLite and rejects a caller-selected alternative. Once merge is verified,
recovery can target only `finalizing` (or escalate). Before the first closeout transition, the
committed exact GitHub merge operation is the authoritative predecessor for that recovery entry.

`PipelineWaitRecoveryDriver` enumerates due waits, acquires new fenced ownership per run/task,
replays the exact GitHub-check operation bound to each wait at its next poll attempt, applies a
bounded per-operation timeout, and aggregates per-row errors so one bad wait cannot suppress others.
Absolute expiry creates the existing idempotent terminal escalation. Committed repair children use
the same durable task authority as their delivery and evidence records.

## Cancellation

`WorkflowCancellationCoordinator` persists cancellation intent before cleanup and immediately moves
the run to `cancelling`, preventing new scheduling or delivery effects. Cleanup ports receive a stable
cancellation identity and must be idempotent. Successful cleanup reaches `cancelled`; incomplete
cleanup remains retryable until the absolute stop deadline and then reaches `escalated` exactly once.
Recorded evidence references must resolve to accepted, live secure evidence bound to the same run,
workspace, contract, and policy. Completion is refused while any durable owned work, prepared effect,
repair dispatch, or pipeline wait remains active, even if a cleanup adapter reports success.
Cleanup calls are bounded by the durable deadline. A restart driver enumerates every requested
cancellation, reacquires fenced ownership, and resumes cleanup from the persisted request.

## Verification

The integrated fixtures inject crashes after Beads/Dolt external effects, after report persistence,
and around cancellation. They reopen SQLite with fresh fencing epochs and assert identical terminal
state and no duplicated external mutations. Additional tests cover persisted recovery targets,
repair-child wait restart, merge-to-finalizing atomicity, final evidence traceability, and absolute
deadline escalation.
