# Correlation and safe event contract — bounded diagnostics MVP

**Beads issue:** `agent-platform-harness-v1`

**Parent:** `agent-platform-llm-observability-export`

**Status:** implementation authorized and in progress; P1 option A accepted.

## Current authorization and scope

The owner accepted P1 option A and authorized implementation on 11 October. Checkout-free artifact
variants of T10/T12 are transferred to `agent-platform-electron-release.diagnostics-export` under
release work; connected standalone-Electron/browser export and the final support exercise remain
mandatory here. The V1-only historical review-gate edge is removed; the broader gate stays open.
V1 is in progress on `task/diagnostic-event-foundation` from planning tip `ebf3c279`, with segment PR
target `feature/agent-observability`. Earlier planning-only/strict-artifact/default-B paragraphs below
are retained decision history and superseded by this authorization. Runtime work follows R1–R7,
the tests below with that explicit artifact transfer, and ordinary independent review/CI gates.

## Current task requirements

Implement R1–R7 in the [11 October feature contract](../planning/agent-observability-mvp.md):
unique request/operation/attempt observations; safe focused backend logging; durable local SQLite
history behind one adapter; configurable seven-day retention and bounded failure behavior;
readable and structured reports; one packaged-app/browser export action; unchanged execution
permissions and recovery. All technical bounds and privacy rules in that contract are normative.
The earlier 1–2 day envelope estimate is replaced by 4–6 focused engineering days for this larger
but bounded support workflow. Implementation and local verification are recorded in the
[results](../reviews/agent-observability-mvp-results.md); current-head hosted qualification and
authorized feature delivery remain separate completion gates.

## Dependency order

The owner-authorized V1 edge to `agent-platform-harness-review-gate` has been removed in Beads.
The broader gate remains open for its other work; it does not block this implementation. The
release export child depends on V1, not the reverse. This MVP does not require a prototype
broker/contract, paused pilot, SDK modernization or dashboard.
Existing downstream V2/V3/V4/R1/R4/K1 and local visibility/reliability records are retained. V1
completion does not close them or waive their own acceptance requirements. Beads is authoritative.

## Implementation plan and branch mapping

Source: staging `7814b59845b52ad5f850bfc99b7baee0e6742a25`, separate clean owned worktree.
Planning: `feature/agent-observability` → `task/observability-mvp-plan` (intermediate).
The authorized `task/diagnostic-event-foundation` from the pushed planning tip is the
single implementation segment tip, carrying this plan into a PR to `feature/agent-observability`.
Staging is the eventual protected destination when authorized; never main. Implementation uses `task/diagnostic-event-foundation` from planning tip `ebf3c279`. Preserve all paused refs and dirty/unrelated checkouts.

Milestones within this one task: identity/projection; adapter/lifecycle; report/CLI/export;
connected verification and independent source review. The implementer owns final integrated
T12 acceptance as well as individual tests; do not defer it to the broader V5 task.
The two-day checkpoint and bounded retry/escalation rules are in the feature contract.

## Tests and definition of done

The [verification plan](../testing/agent-observability-mvp.md) maps every requirement to T01–T12,
source files, real backend/file assertions, environments, limits and evidence. All are required
before implementation completion. Model-provider doubles are disclosed; no paid live call required.
For planning completion, validate these documents and obtain independent critique; do not claim
application tests have passed. [Planning review](../reviews/agent-observability-mvp-plan-review.md)
records findings and their dispositions.

V1 closes only after R1–R7 and T01–T12 pass on the accepted source, dependencies are reconciled,
independent implementation review has no actionable findings, affected quality gates and detailed
Sonar/Problems findings clear, and the segment-tip PR has merged into its feature under actual
owner authority. Record exact tested/merged revisions, safe artifacts and full documentation
mirrors/readbacks. Then close/read back Beads and verify Dolt push. Parent closure requires its
remaining broader scope; feature-to-staging delivery is separately gated. V1 remains in progress until those delivery conditions hold. The owner has approved the completed
plan and implementation; the V1-only historical review-gate edge has been removed.

## Recorded feasibility decision before allocation — superseded by accepted P1 option A

The completion audit found no checkout-free desktop app artifact or app packaging command.
Existing Electron VM tests use the development Node and source checkout. Strict T10/T12 therefore
remain required but blocked on release-owned artifact provision. [Decision P1](../planning/agent-observability-mvp.md#completion-audit--packaged-artifact-decision-p1)
presents the bounded alternative: deliver connected standalone export in V1 and explicitly transfer
checkout-free artifact acceptance to release work, only if the owner agrees at final plan review.
Do not silently weaken acceptance, expand V1 into packaging, or claim implementation readiness.
At that earlier planning checkpoint, no dependency edge or release task had been activated.
The owner subsequently accepted option A: the release child now owns checkout-free artifact
verification, and V1 proceeds with connected standalone-Electron/browser acceptance.

## Historical proposal — preserved, superseded for this V1 proposal

The following earlier body is retained verbatim as history. Its broker, prototype implementation
contract, mandatory intent-storage and broad review-gate instructions do not govern this native
observational MVP. Its broader obligations remain in the existing backlog; none is silently claimed
delivered. Current accepted V1 scope and delivery conditions are above.

<!-- prettier-ignore-start -->
````text
# Correlation and safe event contract

Beads issue: `agent-platform-harness-v1`. Status and scheduling authority: Beads.

Parent: `agent-platform-llm-observability-export`. Proposal label: V1.

## Requirements

Request/task/run/attempt/child/operation IDs; versioned start/wait/end envelopes; no secrets/full state; pre-run failure has correlation. Fixtures distinguish waiting from disconnected.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: `agent-platform-harness-review-gate`.

Downstream new records: `agent-platform-harness-v2`, `agent-platform-harness-v3`, `agent-platform-harness-v4`, `agent-platform-harness-r1`, `agent-platform-harness-r4`, `agent-platform-harness-k1`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Run build, typecheck, lint, format and focused package tests for changed code, plus relevant API/DB/stream integration and browser/Electron journeys. Validate failure paths specified in acceptance, not only success. UI tasks assert visible waiting/error/completion and runtime acknowledgement; persistence tasks exercise restart and duplicate resume. Record applicable Sonar/Problems and hosted gates.

## Definition of done

Request/task/run/attempt/child/operation IDs; versioned start/wait/end envelopes; no secrets/full state; pre-run failure has correlation. Fixtures distinguish waiting from disconnected. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 1–2 provisional person-days.

## Proposed current-stack MVP refinement — September 23

The [MVP plan](../planning/mvp-reliability/plan.md#minimal-state-and-event-foundation-proposed-v1-refinement)
adds precise local persistence, state/freshness, redaction, retention, diagnostic read API and failure
requirements for owner review. It preserves all prior requirements and the existing review blocker.
Implementation is not activated; the older broad modernization plan is not approved by this appendix.

Downstream proposed children additionally include `agent-platform-harness-r3.cancel`,
`agent-platform-harness-r3.reconcile`, and `agent-platform-harness-v4.local`.

### Gherkin E2E Strategy

```gherkin
Feature: Truthful local run state
  Scenario: Approval waiting survives a reload
    Then UI and the persisted read model agree on the waiting state and identifiers
  Scenario: Backend restarts without a terminal result
    Then previous active work is interrupted or unknown until reconciled
    And no action restarts automatically
  Scenario: Optional telemetry is unavailable
    Then execution policy is unchanged and missing diagnostics are visible
  Scenario: Mandatory intent storage fails
    Then a side-effecting action is not dispatched
```
````
<!-- prettier-ignore-end -->
