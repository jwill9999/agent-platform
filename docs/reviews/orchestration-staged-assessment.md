# Proposed staged orchestration assessment

Owner requested this assessment sequence on September 24, 2026. Tracking remains with
`agent-platform-pilot-zero`; findings belong in Beads and the
[field evaluation](orchestration-field-evaluation.md). This is an assessment protocol, not an
approved executable contract or authorization to activate a runtime, issue credentials or merge.

## Objective and sequence

Use remaining permission-baseline work to assess actual managed delivery, first for one bounded
task, then for two dependent tasks under one approved scope. Product-test success and orchestration
success are separate outcomes. A useful failed assessment must retain evidence rather than be
reported as a successful run after manual bridging.

| Stage               | What it establishes                                                    | Entry condition                                                                      |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Readiness           | The intended execution path exists and its prerequisites are available | Read-only investigation; no run launch                                               |
| Single task         | One complete managed task lifecycle                                    | Readiness passes and exact pilot material is reviewed and approved                   |
| Two dependent tasks | Automatic progression between tasks in one feature scope               | Single-task evidence passes, owner reviews it, and the two-task material is approved |

Do not begin the second live pilot just because code or unit tests pass. A successful first pilot is
necessary, and its evidence must be reviewed before expanding to the two-task assessment.

## Readiness and material to bind before either run

Select a small outstanding permission scenario from `agent-platform-harness-baseline-p2`, avoiding
coverage already completed in the direct-file repair. Candidate work is a representative direct
mutation journey that currently has dispatcher coverage but lacks independent UI-to-file evidence.
The exact tool/scenario and task identity are selected during readiness, not invented here.

For each pilot, freeze the actual Beads task IDs and dependencies, source/base revision and task
branch chain, allowed files/operations/roles, acceptance criteria, commands, runtime configuration,
model/spend limits, retries/deadlines, evidence destination and delivery boundary in the reviewed
execution material. Check the current repair integration status before choosing the baseline.
Review code changes to permission semantics separately; a testing pilot does not authorize them.

Confirm a supported creation/resume entrypoint, persisted approval, isolated launcher and model
access, secure result import, verification/review execution, acceptance and brokered task-state
updates, coordinator progression and observable blocker reporting. Check runtime health separately
from stored state. Distinguish absent relevant runs from an unavailable status service. Revalidate
historical pilot gaps against the current source/configuration; do not count them as newly reproduced.

If required capabilities are absent, record the exact failed prerequisite and stop before launch.
Raw database edits, direct worker launches, parent-authored changes or manual phase advancement are
not substitutes for a supported managed path. A separately authorized supervised repair may follow,
but cannot turn the blocked assessment into a managed pass.

Define completion explicitly: accepted task, durable evidence, committed/pushed output and required
delivery/closeout records. If integration is required, bind its authority upfront or report waiting
for owner approval; do not claim completion while a required gate remains outstanding. No staging
or production authority is supplied by this document.

## Assessment one: complete one task

Run one bounded permission-coverage task through the real orchestration system. It must perform the
work, return/import its actual changes, execute verification, obtain independent review, handle any
permitted bounded repair, and reach its defined acceptance/closeout state. A manually authored patch
followed only by orchestrated verification does not prove the complete task cycle.

### Gherkin assessment strategy

```gherkin
Feature: Complete a bounded testing task through managed orchestration
  Scenario: Approved task reaches its defined completion boundary
    Given one ready task is bound to reviewed and approved execution material
    And the real runtime passes its readiness checks
    When the supported entrypoint starts or resumes that task
    Then the managed worker returns execution-bound changes
    And verification and independent review evaluate the same candidate
    And acceptance and task-state updates are durably recorded
    And the required output and closeout evidence are available to the owner
    And no manual nudge or manual phase advancement was needed

  Scenario: A prerequisite or execution phase cannot complete
    Given the pilot encounters an unavailable prerequisite or unresolved phase failure
    When the runtime reports its outcome
    Then the owner can identify the blocked phase and reason
    And the task is not falsely accepted or silently completed manually
    And the evidence and any intervention are retained for review
```

Pass requires every scoped acceptance criterion, required gate and completion record, with no
unplanned human/parent bridging. Normal approval at the declared boundary is permitted and recorded;
unnecessary repeated approval within unchanged valid scope is a finding. A blocked or failed result
is useful assessment evidence but does not unlock the two-task pilot.

## Assessment two: automatically complete two dependent tasks

Choose two distinct, meaningful remaining coverage tasks, with the second explicitly blocked on
acceptance of the first. Bind both under one reviewed feature scope. They should share a real
artifact or accepted code baseline so that the second task demonstrably consumes the first task's
accepted result; two unrelated launches do not establish this handoff.

Each product test still uses fresh isolated data: the task dependency is on accepted source and
artifacts, not leftover files or execution order between individual Playwright tests.

### Gherkin assessment strategy

```gherkin
Feature: Advance automatically through two tasks in one approved scope
  Scenario: First task acceptance schedules the second
    Given two approved tasks have a recorded dependency
    And the second task is not ready before the first is accepted
    When orchestration completes and accepts the first task
    Then the brokered Beads transition records the first task's completion
    And the coordinator refreshes dependencies and starts the second automatically
    And the second task uses the first task's accepted source and relevant evidence
    And the second task completes verification, review and acceptance
    And feature completion is reported only after both tasks meet the defined boundary
    And no extra launch command, manual nudge or duplicate effect was required

  Scenario: First task remains unresolved
    Given the first task fails a required gate or remains blocked
    Then the dependent task does not start
    And bounded authorized recovery or explicit escalation is visible
    And a failed first task is not bypassed to produce apparent feature completion
```

Observe naturally occurring failures; deliberately injecting failures or restarts requires that
fault-injection scope in the approved pilot material. If the negative scenario is not exercised,
report it as not exercised rather than passed. Existing lower-level tests may supplement, but not
replace, evidence of real task-to-task progression.

## Evidence, boundaries and result recording

For each stage record source/configuration and contract bindings, run/task/phase identities,
expected and observed transitions, worker launch/settlement, imported commit, verification and review
results, authoritative task/dependency snapshots, acceptance receipts, and final delivery state.
Capture timestamps, attempts, model/cost information where available, notifications and every human
or parent intervention with its reason. Unavailable measurements remain unknown.

For the product permission journeys retain real UI interaction, persisted settings, approvals,
audits and independent disposable-file effects. Script only declared external product boundaries;
label provider/runner fixtures clearly. The orchestration worker, coordinator, import and acceptance
path must be real for an orchestration claim. No live paid calls are approved by this protocol.

Report each criterion as passed, failed, blocked or not exercised. Separate runtime/application
defects, orchestration defects, environment prerequisites and expected approval boundaries. Preserve
failure evidence and link any proposed repair through Beads; do not silently weaken criteria.

After assessment one, review results with the owner before assessment two. After assessment two,
review both task results and the intervening automatic transition before considering a larger
feature. Two tasks completed by separately prompting the primary agent are not a managed two-task
pass. Success here does not certify all interruption/recovery cases or close the wider pilot.

## Present state

Both assessments are documented but not executed. Next step: read-only readiness assessment and
selection of the exact first task, then preparation/review of runnable material if prerequisites
permit. No model-routing change, standing-permission expansion or automatic staging merge is implied.
