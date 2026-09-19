# Reliable connected-local product-agent execution

Beads issue: `agent-platform-harness-reliability`. Status and scheduling authority: Beads.

Parent: `none`. Proposal label: epic/review.

## Requirements

Provisional product-harness runtime modernization, secret-free persistence, safe operation recovery, human commands and whole-task cost accounting. Independent execution with application closed is deferred. Project-delivery orchestration remains separate. Implementation requires reviewed execution scope. Epic is deferred; each child is hard-blocked by joint review because Beads does not support this epic-to-decision blocker.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: None; this is the joint review decision.

Downstream new records: None.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Capability map

- `agent-platform-harness-r1`: Selected modernization and runtime adapter
- `agent-platform-harness-r2`: Persistent state and upgrade policy
- `agent-platform-harness-r3`: Safe action recovery and human commands
- `agent-platform-harness-r4`: Whole-task usage policy
- `agent-platform-harness-r5`: Recovery integration

Architecture: Beads planning → authorized application/runtime execution → evidence and telemetry; Git remains code history.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Validate official-source evidence, candidate version assumptions, dependency graph and decision record; distinguish offline checks from separately authorized provider experiments. No runtime pass may be inferred from documents.

## Definition of done

Provisional product-harness runtime modernization, secret-free persistence, safe operation recovery, human commands and whole-task cost accounting. Independent execution with application closed is deferred. Project-delivery orchestration remains separate. Implementation requires reviewed execution scope. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 12–24 provisional person-days.
