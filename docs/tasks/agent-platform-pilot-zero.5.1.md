# Preserve specialist completion under SQLite writer contention

Beads: `agent-platform-pilot-zero.5.1`  
Parent: `agent-platform-pilot-zero.5`

## Requirements and reproduction

The normal pre-push gate failed the real two-coordinator continuation test at
`WorkflowStore.finishSchedulerExecution`'s scheduler UPDATE after reading the execution and leases.
The production transaction is deferred; an intervening WAL writer can prevent its read snapshot
from being promoted to a writer. Busy timeout alone cannot repair a stale snapshot.

## Implementation plan

First reproduce deterministically with two connections to a temporary fixture database: after the
completion transaction's first read, attempt an unrelated peer WAL commit. Then acquire the write
reservation before completion reads using the existing database driver's immediate transaction
mode. Do not retry partially completed actions, weaken fences, bypass the hook or modify live state.
Keep all terminal result, callback and continuation writes in the existing atomic transaction.
Sample the default wall clock only after acquiring the writer reservation, so waiting for it cannot
make lease/deadline checks use stale time. Preserve explicit timestamp inputs used by deterministic
callers and add a regression for the default-clock boundary.

## Dependency and scope

Gate-repair subtask of .5 on its existing task branch. Touch only the completion transaction and
focused temporary-database regression tests. No broad conversion of all storage transactions.
Parent .5 cannot close while this gate repair remains unverified.

## Tests and definition of done

Record the pre-fix SQLite error code, not just its message. After the fix, a peer cannot commit
between completion's read and write, completion succeeds, and replay creates no duplicate callback
or continuation. Run the real continuation-process suite repeatedly, full package tests, build,
typecheck, lint, formatting and independent review. Publish through the parent's normal gate/PR.
This verifies one completion boundary, not all SQLite transactions or end-to-end model execution.

## Sign-off

Owner-directed iterative repair. Independent Astra source review and red/green regression evidence
required; no managed-run approval or runtime conformance is implied.

## Review and reproduction evidence

The pre-fix two-connection regression failed with `SQLITE_BUSY_SNAPSHOT`; this identifies the
deterministic reproduction, not the original hook failure's unreported SQLite code. The corrected
transaction excludes that peer commit, preserves one callback/continuation on replay, and rolls
back all terminal effects when callback validation fails. The critic identified stale default time
across writer-lock acquisition; moving the clock read inside the reservation corrected that finding.
Three focused tests and 74 relevant tests pass; independent source review has no remaining findings.
The final full package run passes 585 tests with seven separately exercised opt-in Docker skips.
Build, typecheck, lint, formatting and diff checks pass. Hosted delivery is still required before
closeout.
