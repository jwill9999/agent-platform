# Task: Enforce durable aggregate active execution budget

**Beads issue:** `agent-platform-pilot-active-budget`  
**Spec file:** `docs/tasks/agent-platform-pilot-active-budget.md`  
**Parent epic:** `agent-platform-pilot-zero`

## Task requirements

Status: owner-authorized prerequisite repair; design draft, not implemented or verified.
On 8 October the owner authorized all issues preventing the single-task pilot, targeting 9 October.
Retain the proposed 60-minute aggregate active execution cap. Existing per-attempt deadlines and
scoped retry counters do not establish that cap. Pilot launch remains a separate exact approval.

B1: Bind immutable aggregate and attempt limits to reviewed execution material; material changes
invalidate existing approval. B2: Atomically reserve a durable bounded allowance before any specialist
or coordinator execution; all retries and concurrent phases share one run budget. B3: Enforce the
reserved deadline, refuse exhausted admission, survive restart/replay/fence changes and preserve
credential/container cleanup. B4: Return independently verified accounting and exhaustion evidence.

## Dependency order

No additional upstream blocking task is needed for design. This task blocks
`agent-platform-pilot-zero.17` and `agent-platform-pilot-zero.13`; the blocking edges exist in Beads.
The local application route task remains a separate prerequisite. Do not close on proposed accounting.

## Implementation plan

Produce a complete version 1 execution contract, document manifest and independent critique before
implementation. The owner has delegated routine repair choices. No persisted pilot approval or run
may be fabricated from that delegation.

Proposed conservative accounting: charge each execution's full reserved deadline allowance against
one durable run total before launch, including model/tool startup and bounded execution cleanup.
Parallel execution allowances add together. Retries receive new reservations; replay reuses its exact
reservation without replenishing it. Do not refund uncertain or crashed reservations. Idle waits have
no new execution reservation. A conservative charge can exhaust earlier than measured active time;
report reserved and measured values separately. This definition remains draft until source-backed
contract validation and independent critique confirm every dispatch/cleanup path is covered.

Inspect contracts, storage, phaseRuntime, standaloneCoordinators and interruption/continuation paths
in packages/workflow-control. Use exact paths in the final contract; do not widen command networking,
credential mounts or process authority. Preserve existing clients/contracts when no aggregate policy
is configured; require the aggregate policy for the final pilot admission. Bound schema validation,
policy identity and deadline calculations; detect invalid clocks and journal failure conservatively.

## Git workflow

Continue from pushed task/harness-readiness-reconciliation tip, chaining runtime repair task branches
under the repository workflow. Delivery target feature/harness-backlog-review; never main. No staging
promotion or live pilot is authorized by this task. Name final integration ownership in the contract.

## Tests and verification

B-T01: atomic concurrent reservation and sum/remaining-limit arithmetic; exhaustion denies admission.
B-T02: replay and restart retain charges; stale fences, changed limits and mismatched execution IDs
fail closed without replenishment. B-T03: each specialist and coordinator launch receives the capped
deadline; timeout cancels owned processes and revokes credentials, including uncertain cleanup.
B-T04: retries consume the same run total; idle waits do not renew budgets; clock rollback and unavailable
journal prevent unsafe admission. B-T05: deterministic offline governed orchestration demonstrates the
limits through real dispatch; no paid call or pilot launch. Preserve source/result provenance.

Require meaningful unit/integration tests, build/typecheck/lint, SonarQube or documented fallback,
independent review and hosted checks. Planned scenarios are not passed results.

## Definition of done and sign-off

Complete validated material and independent critique; implementation within owner-authorized scope;
all required accounting/dispatch/recovery tests pass; required quality gates pass; source is pushed
and integrated into the feature; full spec/results mirrored into Notion and read back; Beads state
and Dolt synchronized. Until then this task remains open and .17/.13 remain blocked.
