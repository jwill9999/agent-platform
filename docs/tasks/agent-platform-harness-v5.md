# Visibility journey verification

Beads issue: `agent-platform-harness-v5`. Status and scheduling authority: Beads.

Parent: `agent-platform-llm-observability-export`. Proposal label: V5.

## Requirements

Browser/Electron request→model→tool→approval/retry walkthrough; UI/trace identity agreement, redaction and telemetry outage. Preserve separate broad diagnostics remainder.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: `agent-platform-harness-review-gate`, `agent-platform-harness-v2`, `agent-platform-harness-v3`, `agent-platform-harness-v4`.

Downstream new records: `agent-platform-harness-d2`, `agent-platform-harness-b2`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Run build, typecheck, lint, format and focused package tests for changed code, plus relevant API/DB/stream integration and browser/Electron journeys. Validate failure paths specified in acceptance, not only success. UI tasks assert visible waiting/error/completion and runtime acknowledgement; persistence tasks exercise restart and duplicate resume. Record applicable Sonar/Problems and hosted gates.

## Definition of done

Browser/Electron request→model→tool→approval/retry walkthrough; UI/trace identity agreement, redaction and telemetry outage. Preserve separate broad diagnostics remainder. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 1–2 provisional person-days.
