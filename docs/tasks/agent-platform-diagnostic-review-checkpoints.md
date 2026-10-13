# Add diagnostic review checkpoints to feature implementation

**Beads issue:** `agent-platform-diagnostic-review-checkpoints`  
**Scope:** standalone contributor-workflow task; no product runtime change.

## Requirements

The owner requested two diagnostic reviews in the development lifecycle: after meaningful
Agent Platform end-to-end testing and before feature completion. At each checkpoint, capture
safe reports, inspect failures/timings/retries/waits/coverage, distinguish evidence from hypotheses,
fix in-scope issues or link Beads follow-ups, and record an outcome even when there are no findings.

Apply the review to features exercising agent execution. Other work may record not applicable.
Reuse still-applicable evidence rather than require redundant tests. Preserve existing acceptance,
security, privacy and authorization boundaries; do not imply continuous monitoring or activate
the V2–V5 backlog. Use the existing [diagnostic guide](../development/diagnostics.md).

## Dependency order

The diagnostics foundation is delivered in PR303 at staging `50cc8727`; this task only documents
how subsequent development uses it. No new blocking edges or downstream feature obligations are
created. Beads remains authoritative for task state; paused orchestration is outside this task.

## Implementation and delivery

Update the [feature-implementation skill](../../.agents/skills/feature-implementation/SKILL.md)
with one scoped section and an explicit reference from its verification step. Preserve the rest
of the skill. Record this task and its handoff separately from the completed diagnostics work.

Branch chain: `feature/diagnostic-review-checkpoints` from staging `50cc8727`, then
`task/diagnostic-review-checkpoints`. Publish only this documentation segment. Merge authority
from the prior diagnostics conversation is not reused; integration remains a separate action.

## Verification

Run the Skill Creator validator, Markdown lint, formatting, local relative-link checks and
`git diff --check`. Inspect the wording against an agent-run feature, a documentation-only change,
an unchanged completion review and an unavailable-report case. These are instruction checks,
not application test results. No runtime build or new agent/VM journey is needed for this edit.
Normal publication hooks and applicable hosted checks still apply to the resulting PR.

The side conversation prohibits subagents; do not claim an independent agent review. Keep that
review limitation explicit for the later integration decision. Publish complete changed document
mirrors with source metadata and read them back under the repository documentation convention.

## Definition of done and sign-off

The skill covers both checkpoints and all five review actions with proportional applicability,
honest evidence limits and linked Beads follow-ups. Documentation validation and full mirror
readback must pass; source must be pushed. As a segment tip, task closure also requires its
feature PR's declared checks and review to clear and actual authorized integration. Until then,
report the skill edit as prepared/published, not active in staging or fully closed.

Actual validation, publication and integration evidence belongs in this issue's Beads notes.
