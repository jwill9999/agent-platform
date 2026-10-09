# Native developer policy and profiles

**Beads issue:** `agent-platform-codex-autonomy-policy`. Standalone task linked to [the plan](../planning/codex-developer-autonomy/plan.md).
Owner authorizes execution through tests/CI; no routine phase approval. Canonical Beads root:
`/Users/letuscode/projects/agent-platform`.

## Requirements and implementation plan

Shared instructions, .codex/config.toml and six agent profiles; new native development guide and ADR0005 (created here so guide links resolve; overall reviewed scope unchanged).
Read AUT-01–08, supporting manifest and complete plan before changes. Primary Codex owns edits;
independent native critic inspects sources without mutation. Preserve app/prototype/global/dirty bytes.
Native Git/Beads/tools operate within owner scope. No managed qualification prerequisite.

## Dependency order and Git

Upstream: `agent-platform-codex-autonomy-plan`. Downstream: agent-platform-codex-autonomy-guidance.
Create `task/codex-autonomy-policy` from pushed `task/codex-autonomy-plan`.
One cumulative acceptance-tip PR targets `feature/harness-backlog-review`; no main/staging promotion.

## Tests

V-01 structural/semantic review and V-02 preservation. [Scenario definitions](../testing/codex-developer-autonomy.md).
Documentation/profile-only work has no new product E2E applicability; preserve existing permission
and denied-effect coverage and inspect required CI. Actual outcomes remain in the linked report.

## Definition of done and sign-off

Requirements in plan and Beads acceptance match; upstream closed; bounded changes independently
reviewed, appropriate local gates and preservation checks pass, full changed-document mirrors read
back, scoped branch pushed. Intermediate handoff is accepted locally; final hosted integration belongs to acceptance task.
Record exact head, findings/dispositions, checks and gaps in [results](../reviews/codex-developer-autonomy.md).
No pilot/paid gateway/automation/global edits. Completion is not claimed in advance.
