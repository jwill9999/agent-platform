# Representative replacement experiment

Beads issue: `agent-platform-harness-f2`. Status and scheduling authority: Beads.

Parent: `agent-platform-harness-modernization`. Proposal label: F2.

## Requirements

One authorized tool loop; explicit preserve/replace map for planner/critic/sensor/DoD, security, approvals, output limits; compare modernized existing runtime vs framework candidate adaptation, removable code and duplicate upgrade effort; use the current implementation as behavioral baseline. No production migration.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: `agent-platform-harness-review-gate`, `agent-platform-harness-f1`.

Downstream new records: `agent-platform-harness-f3`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Validate official-source evidence, candidate version assumptions, dependency graph and decision record; distinguish offline checks from separately authorized provider experiments. No runtime pass may be inferred from documents.

## Definition of done

One authorized tool loop; explicit preserve/replace map for planner/critic/sensor/DoD, security, approvals, output limits; compare modernized existing runtime vs framework candidate adaptation, removable code and duplicate upgrade effort; use the current implementation as behavioral baseline. No production migration. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 2–4 provisional person-days.

## Focused replacement experiment contract — planning revision

After F1, compare the two viable routes on the same bounded journey: configured agent receives a request, invokes an authorized deterministic tool, reports its result, handles a controlled provider/tool error and surfaces an approval wait. Reuse existing security/application services. Do not expand into persistent recovery, knowledge ingestion, product delegation or background scheduling. If one route fails F1 materially, document why the experiment narrows rather than build a knowingly unusable route.

Keep fixtures outside production code until the migration decision. Enumerate generic loop/provider code replaceable, application policy retained, new adapter code required, and planner/critic/sensor/DoD behaviors retained or explicitly out of experiment scope. Count adaptation and maintenance responsibilities as well as changed lines; fewer lines alone are not a decision rule. Identify any preliminary SDK upgrade discarded by direct framework adoption.

Acceptance evidence compares preserved behavior, adapter effort, token/call usage when known, latency observations and migration risks on the same conditions. Unknowns remain unknown. Summarization, critic and fallback calls must be counted if enabled; do not enable extra paid features merely to enrich a comparison. No benchmark performance claim from a single uncontrolled run. Deliver a recommendation input and rollback boundaries, not a product migration.

## Orchestration observation during assessment

Use the [orchestration observation protocol](../planning/harness-modernization/orchestration-observation.md). Record snags as Beads findings with evidence and observed execution mode; supervised assistant work is not an autonomous pilot. New repairs require separately scoped authorization.
