# Architecture decision

Beads issue: `agent-platform-harness-f3`. Status and scheduling authority: Beads.

Parent: `agent-platform-harness-modernization`. Proposal label: F3.

## Requirements

Evidence table: parity, adapter burden, code retired, operational cost, migration/rollback scope. Implementation agent recommends and documents evidence-based order: modernize existing runtime first, migrate directly to framework providers while retiring the replaced SDK, or staged coexistence with removal criteria. Include pinned supported set, instrumentation choice, parity, rollback and avoided rework. Owner reviews architecture choice before dependent implementation; do not assume newest versions validated.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: `agent-platform-harness-review-gate`, `agent-platform-harness-f2`.

Downstream new records: `agent-platform-harness-v2`, `agent-platform-harness-v3`, `agent-platform-harness-r1`, `agent-platform-harness-r4`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Validate official-source evidence, candidate version assumptions, dependency graph and decision record; distinguish offline checks from separately authorized provider experiments. No runtime pass may be inferred from documents.

## Definition of done

Evidence table: parity, adapter burden, code retired, operational cost, migration/rollback scope. Implementation agent recommends and documents evidence-based order: modernize existing runtime first, migrate directly to framework providers while retiring the replaced SDK, or staged coexistence with removal criteria. Include pinned supported set, instrumentation choice, parity, rollback and avoided rework. Owner reviews architecture choice before dependent implementation; do not assume newest versions validated. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 0.5–1 provisional person-days.

## Focused decision contract — planning revision

Use F0–F2 evidence to recommend one order: upgrade current runtime first; migrate directly while retiring replaced SDK responsibilities; or narrowly staged coexistence with a dated removal criterion. Apply must-pass provider/configuration, streaming, tool/permission/approval and Electron requirements before comparing effort. Where evidence is blocked, state whether the decision is provisional and what cannot proceed.

Record chosen mutually compatible pinned set, rejected alternative and reason, adaptation estimate including discarded work, native instrumentation versus application-specific spans, and migration/rollback sequence. Keep connected-local execution with explicit recovery; do not add Agent Server or unattended scheduling to satisfy deferred needs. Re-estimate R1 before it is authorized. This epic selects a path; it does not implement R1 or reopen the visibility workstream.

Return a concise owner decision with evidence links and remaining choices. Owner approval of the concrete migration is required before dependent implementation. If comparison does not establish savings, recommend the smaller supported upgrade or a bounded follow-up rather than force LangChain adoption. Do not close the review gate or mark the epic complete from this document alone.

## Orchestration observation during assessment

Use the [orchestration observation protocol](../planning/harness-modernization/orchestration-observation.md). Record snags as Beads findings with evidence and observed execution mode; supervised assistant work is not an autonomous pilot. New repairs require separately scoped authorization.
