# Durable pilot execution budget repair

Status: owner-authorized supervised prerequisite repair; proposed executable material pending critique.
Owner authorization: 8 October, complete issues preventing the single-task pilot, target 9 October.
This delegation permits prerequisite implementation; it does not create a managed approval or launch.

## Identity and execution mode

Task: `agent-platform-pilot-active-budget`; parent: `agent-platform-pilot-zero`.
Canonical spec: [budget task](../../tasks/agent-platform-pilot-active-budget.md).
Repository: jwill9999/agent-platform. Worktree: harness-readiness/agent-platform in the Codex worktree
directory. Task branch: task/pilot-active-budget, created from pushed task/harness-readiness-reconciliation
at 5b796b741da862ff6546d205ff1097f9e2e68225. Integration: feature/harness-backlog-review.
The primary coordinator owns implementation, publication and final segment delivery. This is an
intermediate chained task; the subsequent local-test-route task owns the final cumulative segment PR.
Do not close this task until its declared integration gate is met. Keep PR283 as existing evidence;
do not treat its checks as validation of new runtime changes.

Supported canonical CLI discovery returned absent for this task, with no active matching run and an
expired workspace lease. Managed pilot configuration remains incomplete. Use the owner-authorized
direct supervised path to repair those prerequisites; do not start a duplicate run, manufacture
persisted approval or describe direct work as an autonomous orchestration result.

## Requirements and implementation

B1: Add optional contract executionLimits with aggregateActiveSeconds, attemptSeconds and
cleanupSeconds. Validate safe bounded positive integers, cleanup at least 15 seconds, and one attempt
plus cleanup within the aggregate. Keep legacy contracts unchanged when absent; final pilot material
must include 3600 aggregate seconds. Increasing or removing an existing limit is authority expansion.
All limit changes alter the contract material digest and invalidate old approval. Repair children
share their existing run total. A distinct run requires separate exact approved material.

B2: Use the workflow SQLite writer lock to reserve each full work-plus-cleanup allowance atomically,
before credential issue, container dispatch, coordinator process or recovery dispatch. Bind run,
execution/phase identity, role, immutable contract/policy, resource fences, reservation time and
absolute work/cleanup deadlines. Retain every charge, including crash-before-dispatch and failed
attempts; no refunds. Replay may observe the same exact reservation but never replenish or extend it.
Recovery that launches a new coordinator attempt must get a fresh bounded reservation; do not reuse
expired execution authority. Count parallel reservations cumulatively. Keep charged and measured
values distinct. Legacy no-limit runs retain their current behavior.

B3: Enforce deadlines at dispatch, credential/lease heartbeat, returned-result acceptance and every
coordinator mutation boundary. Use a separate short timer to cancel active work at its work deadline;
allow existing owned cleanup only until the allocated cleanup deadline. On unavailable journal,
rollback, deadline mismatch or uncertain cleanup, persist or report a durable blocked state and deny
new work. Restart cannot renew deadlines or charged allowances. Cleanup may still run after a budget
fence solely for containment; it cannot dispatch or advance the workflow. Physical process absence is
independently verified; an uncontrollable process is a blocker, not an asserted budget guarantee.

Central run work admission must respect durable budget blocked/exhausted state so continuation and
brokered transitions cannot progress after exhaustion. Recovery reconciles existing effects and
cleanup without new dispatch when fenced. Do not replace cancellation's existing journal.

Dispatch inventory: phaseRuntime new specialist and coordinator execution; coordinator restart
recovery; retained implementation/repair-planning completion; standaloneCoordinators transport and
integration checks; launcher credential/container admission and cleanup. Existing independently
bounded transport/process cleanup remains in force; no wider permissions or network changes.

## Document manifest and boundaries

Specification: docs/tasks/agent-platform-pilot-active-budget.md.
Design: this plan. Verification: [budget verification](../../testing/pilot-active-budget.md).
Executable contract: execution-contract.v1.json beside this plan; bind these committed documents
using publishPlanningDocumentObjects and validateDraftContract. Review/results:
docs/reviews/pilot-active-budget.md and its content-addressed evidence. Approval source is the owner's
recorded delegated prerequisite authorization; no persisted managed approval is invented.

Allowed source: contracts, lifecycle, runExecutionBudget, storage, phaseRuntime, phaseJobs,
standaloneCoordinators, coordinatorTransport, workCancellation and executionInterruptions within
packages/workflow-control/src, plus their named relevant tests. Allow only the declared planning,
specification, verification, review and session documents. No product/UI changes, dependency changes,
operator credentials/config changes, network widening, staging/main promotion or live pilot.

## Verification and escalation

Use Node 24, installed locked dependencies and disposable SQLite/process fixtures. No paid calls.
The connected application/Electron prerequisite remains owned by the local-test-route task and .17;
budget unit tests do not substitute for that journey. Run build/typecheck/lint, relevant tests,
package regression, formatting and SonarQube or documented Problems fallback. Record mocked
worker/provider boundaries and all skipped or unexecuted checks. Independent critique precedes code;
independent patch review follows. Two repair attempts per reproduced finding; stop unchanged retries.

On technical failure, preserve evidence, file/update Beads and continue a bounded source-backed fix
under the existing owner scope. Stop for authority/destination changes or an external requirement
the delegated scope cannot resolve. Publish full documents to branch-specific Notion mirrors, verify
readback, update session/Beads, sync Dolt, commit and push. Final pilot launch remains separately gated.
