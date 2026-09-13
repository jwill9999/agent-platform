# Durable active specialist settlement

Beads: `agent-platform-pilot-zero.7`

## Requirement and scope

The active launcher currently swallows removal failures and forgets failed launch settlements.
`waitForSettlement` can then report true while container state is uncertain. Correct this actual
runtime boundary before attaching output candidates or enabling implementation. This slice does
not import files, emit new phase receipts, enable implementing, or provision model credentials.

## Implementation design

Preserve `docker:workflow-specialist-<reservation.id>` and the existing reservation deadline;
do not substitute the preapproval lifecycle's random identity or 120-second ceiling. Persist a
small execution-bound lifecycle record before create through the existing trusted storage boundary:
not-dispatched, create-pending, acknowledged exact ID, and removal-confirmed. Bind immutable name,
execution ownership label and acknowledged ID; reject substitution and invalid/replayed transitions.
Only trusted launcher composition may write it, not model-produced callbacks or arbitrary JSON.
Tie writes to the scheduler execution and existing authority/fencing conventions. Use temporary
databases in tests; never migrate the active canonical journal as part of development.

Require one valid 64-hex create acknowledgement. Start only that ID, under cancellation locking,
after checking deadline/cancellation. Inspect ID/name/label and exit state; remove only verified owned
containers and confirm exact absence. A failed/lost create acknowledgement remains ambiguous even
if a lookup presently shows absence: a delayed create may still arrive. Preserve private staging
and report an actionable recovery state without exposing an importable workspace on uncertainty.

Always attempt generation-pinned credential revocation independently of cleanup. Settled success
requires both confirmed container removal and confirmed revocation. Return no successful retained
workspace before these conditions. Preserve an unconfirmed outcome after rejection, so in-process
waiters cannot infer settlement from a missing promise. Restart recovery consults durable state;
missing/legacy or create-pending evidence fails closed, not silent success from name absence.
Only acknowledged owned-container absence/removal may become confirmed. Never re-dispatch a create
just because its acknowledgement was lost, and never delete unrelated containers or caller edits.

Enforce this at scheduler terminalization as well as launcher return: completed, failed, cancelled
or escalated paths must not release capacity until durable settlement and credential revocation are
confirmed. A durable never-dispatched record plus revoked credentials may settle without a container
acknowledgement. Missing/legacy lifecycle state is unknown, not equivalent to never-dispatched.
Preserve replay of already-terminal records; do not retroactively invent historical lifecycle proof.

Recovery may promote create-pending to an acknowledged ID only after independently observing the
exact persisted name and ownership label on a valid container ID. The create operation is never
redispatched, so this positive observation reconciles its lost acknowledgement. Absence cannot do
so. Recovery adopts/revalidates current leases before authoritative lifecycle writes; expired or
superseded owners cannot record settlement. If external cleanup succeeded but its journal write was
rejected, the current owner must reconcile through fresh observations. Separate best-effort security
cleanup from authoritative state changes and never stop a foreign/substituted container.

## Dependencies and delivery

Chained task branch after .6. Parent owns task records, spec and publication. Worker owns active
launcher/storage integration and focused tests; independent reviewer challenges production path and
fault evidence. Reuse lifecycle validation patterns but do not weaken existing role, lease, credential
or callback guards. New internal persistence grants no additional contract operations. If stronger
external recovery authority is genuinely required, report it rather than fabricating evidence.

## Verification and definition of done

Cover successful create/start/remove/revoke, malformed/extra/lost create acknowledgement, late create,
foreign ID/name/label, removal/inspection failure, wrong-ID absence, cancellation at every boundary,
revocation failures and deadlines exceeding 120 seconds. Verify staging retained on uncertainty and
waitForSettlement stays false across failed launches and reconstructed launcher instances. Legacy
unknown state must visibly fail closed. Test immutable transitions and stale/fenced execution writes.
Exercise the storage terminalization gate and existing failure/cancellation/restart callers, including
the never-dispatched case, so none can release capacity through an alternative route.
Inject lease expiry/takeover during inspect/remove/revoke and lost journal acknowledgement after
cleanup; prove a current owner can reconcile positive evidence without stale-owner writes or re-create.
Update existing fixture transports to realistic IDs and structured owned observations; preserve their
purpose. Run real offline Docker probes where applicable, full package, static checks, independent
review and hosted gates before closeout. No live model or autonomous completion claim is permitted.

## Verification record

Independent source review passed, including transaction-time deadline checks and exact container
identity matching. Real Docker 29.5.3 probes initially failed because generic inspect uses a lowercase
missing-object diagnostic. The bounded fix accepts only the exact diagnostic with exit code 1 and
the expected identity; regression cases reject different identities, exit codes and extra output.
Thirty focused tests and both real offline success/cancellation probes passed after the fix.
The earlier full package run passed 679 tests; final reconciled-branch and hosted checks remain
required. Sonar snippet initialization was unavailable; build, typecheck, touched lint and formatting
passed as the local fallback. This evidence does not establish live model or autonomous operation.

## Following integration

After settlement is proven, bind a pre-launch .6 baseline to actual source and expose an opaque
settled-output handle. Then freeze bytes, journal import, commit through existing Git broker, and
add an implementation-specific H0-to-H1 receipt. Current callbacks require same-head input/result;
never relabel starting evidence to the new commit. Those are separate recorded integration steps.
