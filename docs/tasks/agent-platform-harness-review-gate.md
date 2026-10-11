# Review harness backlog and authorize the first bounded tranche

Beads issue: `agent-platform-harness-review-gate`. Status and scheduling authority: Beads.

Parent: `none`. Proposal label: epic/review.

## Requirements

Jointly review proposal version 2, old/new mapping, unified priorities and dependencies. Preserve connected local execution with explicit recovery; background execution deferred. Confirm active feature integration baseline and unfinished acceptance obligations. Record approved scope, ownership, formal execution-plan requirements and paid experiment limit or offline-only restriction. Creating this backlog does not approve implementation.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: None; this is the joint review decision.

Downstream new records: `agent-platform-harness-v1`, `agent-platform-harness-v2`, `agent-platform-harness-v3`, `agent-platform-harness-v4`, `agent-platform-harness-v5`, `agent-platform-harness-f0`, `agent-platform-harness-f1`, `agent-platform-harness-f2`, `agent-platform-harness-f3`, `agent-platform-harness-r1`, `agent-platform-harness-r2`, `agent-platform-harness-r3`, `agent-platform-harness-r4`, `agent-platform-harness-r5`, `agent-platform-harness-k1`, `agent-platform-harness-k2`, `agent-platform-harness-k4`, `agent-platform-harness-d1`, `agent-platform-harness-d2`, `agent-platform-harness-b1`, `agent-platform-harness-b2`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Validate official-source evidence, candidate version assumptions, dependency graph and decision record; distinguish offline checks from separately authorized provider experiments. No runtime pass may be inferred from documents.

## Definition of done

Jointly review proposal version 2, old/new mapping, unified priorities and dependencies. Preserve connected local execution with explicit recovery; background execution deferred. Confirm active feature integration baseline and unfinished acceptance obligations. Record approved scope, ownership, formal execution-plan requirements and paid experiment limit or offline-only restriction. Creating this backlog does not approve implementation. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: Owner review; no implementation estimate.
