# Native adoption validation and owner code review

**Beads issue:** `agent-platform-codex-autonomy-acceptance`. Standalone task linked to [the plan](../planning/codex-developer-autonomy/plan.md).
Owner authorizes execution through tests/CI; no routine phase approval. Canonical Beads root:
`/Users/letuscode/projects/agent-platform`.

## Requirements and implementation plan

Verification/review/evidence/publication/session only; no product/prototype/global code edits.
Read AUT-01–08, supporting manifest and complete plan before changes. Primary Codex owns edits;
independent native critic inspects sources without mutation. Preserve app/prototype/global/dirty bytes.
Native Git/Beads/tools operate within owner scope. No managed qualification prerequisite.

## Dependency order and Git

Upstream: `agent-platform-codex-autonomy-guidance`. Downstream: owner acceptance/integration only.
Create `task/codex-autonomy-acceptance` from pushed `task/codex-autonomy-guidance`.
One cumulative acceptance-tip PR targets `feature/harness-backlog-review`; no main/staging promotion.

## Tests

V-01–07; relevant security regressions and required exact-head hosted gates. [Scenario definitions](../testing/codex-developer-autonomy.md).
Documentation/profile-only work has no new product E2E applicability; preserve existing permission
and denied-effect coverage and inspect required CI. Actual outcomes remain in the linked report.

## Definition of done and sign-off

Requirements in plan and Beads acceptance match; upstream closed; bounded changes independently
reviewed, appropriate local gates and preservation checks pass, full changed-document mirrors read
back, scoped branch pushed. Required executed current-head CI passes and owner gets concrete code-review material. This segment tip remains open pending owner acceptance and merge; no merge is authorized.
Record exact head, findings/dispositions, checks and gaps in [results](../reviews/codex-developer-autonomy.md).
No pilot/paid gateway/automation/global edits. Completion is not claimed in advance.
