# Durable pilot budget repair — qualification

Status: implemented with local qualification; independent patch recheck approved.
Beads: `agent-platform-pilot-active-budget`; branch `task/pilot-active-budget`.
Owner authorized supervised prerequisite repairs on 8 October, targeting the 9 October pilot.
No managed run, persisted pilot approval, paid model call or pilot is claimed.

## Reviewed material

The [repair plan](../planning/pilot-active-budget/plan.md),
[canonical task](../tasks/agent-platform-pilot-active-budget.md) and
[verification plan](../testing/pilot-active-budget.md) are immutable planning snapshots at
`969072f4333d78e6474d9e789a1d35039c54349a`; their draft labels describe their publication time.
The [version 1 contract](../planning/pilot-active-budget/execution-contract.v1.json) was published
through supported document-object binding and passed production `validateDraftContract`.
[Bindings](evidence/pilot-active-budget/planning-validation.json) record exact source hashes.
Material digest: `sha256:de58ff4aed721750559885f2400c7dfec66c1e0e2828831fea7b36f89e2115cf`.

Distinct critic `/root/runner_plan_critic` reviewed supplied inert material without tool use.
This is the skill-required supervised evidence-only exception; inherited tools were not technically
disabled. It is not managed isolated-worker evidence. Planning round 1 required startup time charging,
cleanup propagation and precise same-run ownership. Revised material received approval with no
findings. [Plan review](evidence/pilot-active-budget/plan-review-r2.json) was subsequently machine
validated by the publisher. These review records do not represent a persisted execution or launch approval.

## Implementation

Optional contract limits bind aggregate, work and cleanup allocations into approval material.
Increasing or removing configured limits is rejected as authority expansion. The journal reserves
full work plus cleanup before effects under an immediate SQLite writer transaction. Each allocation
binds run, execution, role, policy and resource/phase fences. Startup consumes work time, replay
never extends deadlines, and failed/crashed reservations receive no refund. Concurrent attempts
share the charged run total. Same-run repairs/coordinators use that total; independently approved
runs are not combined. Legacy contracts retain existing behavior; final pilot material must bind
the 3,600-second ceiling explicitly.

Specialist and coordinator work uses the persisted absolute deadline, including admission,
heartbeat and result acceptance. Cleanup stages share a separate immutable deadline. Clock
regression, uncertain cleanup, policy substitution or exhaustion durably blocks new work. Trusted
emergency containment can continue beyond the allocation without advancing phases; this does
not guarantee physical termination of an uncontrollable process.

Post-implementation review found C01: a reused coordinator execution identity could make a
latest-reservation cleanup lookup extend old authority. The correction makes actual attempt
identity unique, forbids overlapping unsettled recovery for one phase identity, and uses an exact
execution lookup. A regression rejects early recovery, permits a distinct attempt after verified
settlement, retains the original deadline and rejects execution identity reuse. The [independent recheck](evidence/pilot-active-budget/code-review-r2.json)
approved the exact corrected artifact with no remaining actionable findings.

## Executed checks

[Qualification receipt](evidence/pilot-active-budget/qualification.json) binds the final reviewed
source patch and full log hash. Node 24.14.0; locked dependencies; no dependency changes.

- Workflow-control typecheck, ESLint with zero warnings and build passed. Full monorepo build passed.
- Final package regression: 63 files / 1,154 tests passed; 9 files / 77 platform-gated tests skipped.
  Duration 227.25 seconds, after C01. No source edits occurred during this run.
- Focused accounting/runtime/interruption checks passed 17 tests. Earlier pre-C01 full regression
  passed 1,153 tests; it does not replace the final snapshot.
- SonarQube and IDE Problems connectors were unavailable. Terminal typecheck/lint/test fallback
  passed; no claim of an IDE or Sonar analysis.

B-T01/B-T02 accounting exercises production SQLite, independent writer connections, replay, journal
reopen, immutable identity, invalid clock/policy and durable exhaustion. B-T03/B-T05 compose the
production phase supervisor with real child processes: startup exhaustion prevents container create,
work timeout interrupts and revokes, successful completion records settlement. Coordinator transport
tests enforce the remaining deadline and reject an already-expired call. Docker/provider/approval
responses are fixtures. B-T04 final allowance/exhaustion, concurrent writer and recovery identity
checks pass locally; real configured coordinator/repair/restart composition remains a readiness gate.

Initial push hooks failed first on missing built workspace dependencies, then four lease/timing
failures under higher package/test concurrency. The full build and controlled final regression passed.
A subsequent serial hook passed 1,153 tests but failed one coordinator fixture because Git
prepends Xcode git-core to hook PATH: the fixture discovered a symlink and executable pinning
correctly rejected it. The exact PATH reproduced that failure; the supported explicit
`WORKFLOW_GIT_BINARY=/usr/bin/git` made the same test pass. Push retry uses that canonical binary
and one Vitest worker, retaining every hook. The complete retry passed: all seven affected packages built, typechecked and passed tests,
including 1,154 workflow tests and 112 desktop tests; dependency cycles passed. Branch
`task/pilot-active-budget` was pushed at `8224d25`. No hook or protection was bypassed.

## Remaining gates

The restricted local application test route remains unresolved. Real Codex/container/Electron,
authenticated gateway, configured admission/scheduling/coordinator bindings and exact final pilot
review/owner launch approval are still required. Unit fixtures do not close .17/.13 or pilot readiness.
This intermediate chained task stays open until the final cumulative segment integrates into
`feature/harness-backlog-review` with exact-head hosted gates. PR283 remains the earlier readiness
segment; its passing checks do not validate this new runtime code. No staging/main promotion.
