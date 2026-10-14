# Prepare the Git delivery MVP plan

**Beads issue:** `agent-platform-git-delivery-plan`

**Spec file:** `docs/tasks/agent-platform-git-delivery-plan.md`

**Parent epic:** `agent-platform-ii1` — Git workflow UI and in-app web explorer

Status: proposed bounded plan; owner review before implementation. [Feature plan](../planning/git-delivery-mvp.md), [verification](../testing/git-delivery-mvp.md), [review](../reviews/git-delivery-mvp-plan-review.md).

## Task requirements

GD-R1–GD-R7 planning only. Inspect current source and Beads; preserve historical work. Write plan, exact task mapping, tests and review dispositions; obtain independent critic approval; validate/push/full-mirror/read back and sync Beads. Stop for owner review; no product implementation.

For reused IDs4hm/0ra this becomes the canonical bounded specification; historical `agent-platform-git-workflow-ui-3.md`/`-4.md` remain preserved evidence. No old task is auto-closed and broader epic work remains separately scoped.

## Dependency order

Upstream: None; planning may run while prior promotion qualifies.

Downstream: agent-platform-4hm and agent-platform-git-delivery-tools

Beads hard blockers must match these links. Owner implementation approval is recorded separately; planning completion or a ready status does not grant it.

## Implementation plan and Git workflow

Actual planning branch exists; later task branches below are proposals. Worktree: `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`. Parent `feature/git-delivery-mvp` → `task/git-delivery-plan`; integration `feature/git-delivery-mvp`, eventual protected staging only under actual grant. Never main. Planning refreshes from actual qualified d185 staging before implementation, preserving all documentation and paused branches.

Inspect current source and Beads; preserve historical work. Write plan, exact task mapping, tests and review dispositions; obtain independent critic approval; validate/push/full-mirror/read back and sync Beads. Stop for owner review; no product implementation.

Expected paths: shared contracts/DB receipt records, API application service and Project/chat routers, harness system/Git tools and dispatch, existing web Git rail/panel/page and their tests as applicable to this task. Planning task writes only docs/session/Beads. No `packages/workflow-control` edits, global settings, dependencies or new external service. Implement only this task's requirements; review material boundary changes.

## Tests and Gherkin E2E strategy

Documentation consistency, Markdown, formatting, relative links, task/dependency readback and full Notion readback. Product tests not run.

For product tasks, use the exact scenarios in the verification plan. Given a disposable approved Project, when the user performs this task's manual/chat action, then the visible outcome must match independently inspected index/commit/remote/receipt state. Given denied, stale or uncertain input, when it settles, then no prohibited effect occurs and the user sees the safe recovery state. For visibility, given hidden rail and a pending approval, when chat is used or the app restarts, then approval and show control remain available. Planning task: Gherkin execution not applicable; the scenarios are authored only.

## Definition of done and pre-close sign-off

Plan/spec/verification/review/handoff complete, critic findings resolved, pushed revision/full mirrors verified and owner review clearly pending. Planning completion does not approve implementation.

Before close: upstream tasks closed, applicable owner grant recorded, requirement/scenario matrix complete, actual failures repaired/reviewed, meaningful local gates and normal hooks pass, pushed exact source and full mirrors read back, session/Beads updated. For planning, product gates are not applicable; do not invent product test results. Intermediate closure does not certify final feature acceptance. Segment tip waits for its merged PR and exact-head hosted gates.

Reviewer/owner: pending; no implementation acceptance inferred. After close, read back closed state and sync Dolt, recording actual completion. Missing required test/publication/merge evidence blocks applicable task completion.
