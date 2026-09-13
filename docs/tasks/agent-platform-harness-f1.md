# Candidate provider/package compatibility

Beads issue: `agent-platform-harness-f1`. Status and scheduling authority: Beads.

Parent: `agent-platform-harness-modernization`. Proposal label: F1.

## Requirements

Validate F0 candidate sets through bounded package/offline and separately authorized live checks; Node/ESM/Electron native constraints; configured OpenAI/Anthropic/Ollama URLs, streaming, tools, errors, permissions and approvals. Record unavailable evidence as blocked, not pass.

Connected local execution with explicit recovery is confirmed. Independent execution while the application is closed is deferred. Backlog creation is authorized; implementation, paid experiments and changes to old records are not. Later scope remains provisional.

## Dependency order

Upstream blocking IDs: `agent-platform-harness-review-gate`, `agent-platform-harness-f0`.

Downstream new records: `agent-platform-harness-f2`.

Beads edges are authoritative. Reconcile any changed dependencies there through the journaled broker during an active run; use manual Beads workflow only outside an active run. Do not infer readiness from priority alone.

## Implementation plan

1. Jointly review scope and old-record dispositions; close the review gate only with recorded owner decision and accepted baseline.
2. Refine the bounded execution contract, allowed paths, version choices, budget and branch sequence before assigning implementation.
3. Reuse supported libraries and implement only this issue’s approved requirements, preserving existing authorization.
4. Collect acceptance evidence and reconcile downstream readiness. No autonomous background deployment or obsolete-SDK workaround is implied.

## Tests and verification

Validate official-source evidence, candidate version assumptions, dependency graph and decision record; distinguish offline checks from separately authorized provider experiments. No runtime pass may be inferred from documents.

## Definition of done

Validate F0 candidate sets through bounded package/offline and separately authorized live checks; Node/ESM/Electron native constraints; configured OpenAI/Anthropic/Ollama URLs, streaming, tools, errors, permissions and approvals. Record unavailable evidence as blocked, not pass. Evidence must be linked to exact versions/commit and tests; unknown or unavailable checks are not passes. No old issue closure, removal or supersession without joint review.

Upstream work and required quality gates pass; exact evidence and reviewed decision are in Beads. A framework feature list, open PR or pushed branch alone does not meet acceptance.

## Git and sign-off

This is an unassigned planning record. Implementation branch parent and segment-tip designation must be specified in its approved execution contract before work. Follow feature/task chained branches; intermediate tasks require exact-head checks and declared integration evidence, segment tips additionally require merged PR/hosted gates. No main promotion is authorized.

Reviewer/owner sign-off: pending. Evidence: pending. Effort: 2–4 provisional person-days.
