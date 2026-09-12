# Respect the durable cancellation deadline after timer wake

Beads: `agent-platform-pilot-zero.5.3`

## Diagnosis and scope

PR260 verify job failed the hanging-cleanup test: cancellation returned requested with no recorded
timeouts instead of escalated. Timer completion is not proof the persisted wall-clock deadline has
been reached. Storage correctly refuses incomplete cancellation before that deadline. Reproduce
an early wake deterministically before changing the coordinator; do not weaken storage checks.

## Repair plan

Bound cleanup by its absolute durable deadline. After each timer wake, read the coordinator clock
again and re-arm only for the remaining interval if still early. Do not fabricate later timestamps,
escalate early, retry cleanup side effects or increase the declared deadline. Clear timer handles
when the operation finishes. Keep both hanging cleanup operations bounded by the same deadline.

## Verification and done

Use controlled timer progression and an independently controlled wall clock: first timer wakes
just before deadline, no terminal outcome yet; next wake at deadline yields escalated and both
timeout dispositions. Preserve immediate-success and recovery tests. Focused/full package,
independent review and hosted CI must pass. This is a narrow coordinator/test repair on PR260;
parent owns these files separately from the active settlement worker. No runtime DB mutation.

## Evidence

The early-wake regression failed before the production fix and all eight cancellation tests pass
afterward. Independent source review passed. Exact PR260-base verification under required Node24
passed 594 package tests with seven separately exercised Docker skips, plus typecheck/lint/format.
An initial new-worktree run selected unsupported Node25 and is not accepted as gate evidence.
