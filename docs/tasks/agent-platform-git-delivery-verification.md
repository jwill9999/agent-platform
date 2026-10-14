# Verify and deliver the combined Git workflow slice

**Beads issue:** `agent-platform-git-delivery-verification`

**Spec file:** `docs/tasks/agent-platform-git-delivery-verification.md`

**Parent epic:** `agent-platform-ii1` — Git workflow UI and in-app web explorer

Status: owner-approved bounded implementation, 14 October 2026; actual task progress remains in Beads. [Feature plan](../planning/git-delivery-mvp.md), [verification](../testing/git-delivery-mvp.md), [review](../reviews/git-delivery-mvp-plan-review.md).

## Task requirements

GD-R1–GD-R7. Run all final connected cases and quality gates on combined source; inspect actual diagnostic exports and independent Git/gh fixture effects. Resolve source-review findings, publish complete results/docs/session mirrors, open one tip PR to feature/git-delivery-mvp. No merge until applicable owner grant and all current-head gates clear; later feature-to-staging qualification separate and explicit.

For reused IDs4hm/0ra this becomes the canonical bounded specification; historical `agent-platform-git-workflow-ui-3.md`/`-4.md` remain preserved evidence. No old task is auto-closed and broader epic work remains separately scoped.

Historical sequencing (superseded by the next paragraph): the initial independently approved amendment permitted only additive isolated contracts/DB/service work and rail visibility before qualified d185 staging incorporation. Runtime endpoint/chat/approval integration and final connected qualification still wait for that exact baseline. Preliminary results do not close this task.

The latest independently reviewed work-order refinement permits runtime integration on qualified `2a848b9a` without importing pending d185 code. Final actual qualified-staging incorporation, semantic conflict review and fresh connected gates remain mandatory before acceptance; this supersedes earlier preliminary-only sequencing wording.

## Dependency order

Upstream: agent-platform-git-delivery-tools; agent-platform-local-mvp-promotion (closed after actual prior staging delivery).

Downstream: No bounded-slice downstream; broader epic and7vf remain open.

Beads hard blockers must match these links. Owner implementation approval is recorded separately; planning completion or a ready status does not grant it.

## Implementation plan and Git workflow

Actual planning branch exists; later task branches below are proposals. Worktree: `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`. Parent `task/git-delivery-tools` → `task/git-delivery-verification`; integration `feature/git-delivery-mvp`, eventual protected staging only under actual grant. Never main. Final acceptance refreshes from actual qualified d185 staging, preserving all documentation and paused branches; the reviewed refinement permits runtime integration on the existing qualified baseline.

Run all final connected cases and quality gates on combined source; inspect actual diagnostic exports and independent Git/gh fixture effects. Resolve source-review findings, publish complete results/docs/session mirrors, open one tip PR to feature/git-delivery-mvp. No merge until applicable owner grant and all current-head gates clear; later feature-to-staging qualification separate and explicit.

Expected paths: shared contracts/DB receipt records, API application service and Project/chat routers, harness system/Git tools and dispatch, existing web Git rail/panel/page and their tests as applicable to this task. Planning task writes only docs/session/Beads. No `packages/workflow-control` edits, global settings, dependencies or new external service. Implement only this task's requirements; review material boundary changes.

## Tests and Gherkin E2E strategy

All GD-T01–GD-T12; required browser+Electron paths, package/quality/security gates and real current protected staging VM if promotion authorized.

For product tasks, use the exact scenarios in the verification plan. Given a disposable approved Project, when the user performs this task's manual/chat action, then the visible outcome must match independently inspected index/commit/remote/receipt state. Given denied, stale or uncertain input, when it settles, then no prohibited effect occurs and the user sees the safe recovery state. For visibility, given hidden rail and a pending approval, when chat is used or the app restarts, then approval and show control remain available. Planning task: Gherkin execution not applicable; the scenarios are authored only.

## Definition of done and pre-close sign-off

All required final tests pass with limitations stated; actual results/source/diagnostics reviewed, mirrors/readbacks complete, Beads aligned, segment tip PR merged under owner grant and exact-head hosted checks/reviews clear. Staging readiness claimed only after separate authorized protected merge/tree verification. Does not close broad7vf or ii1.

Before close: upstream tasks closed, applicable owner grant recorded, requirement/scenario matrix complete, actual failures repaired/reviewed, meaningful local gates and normal hooks pass, pushed exact source and full mirrors read back, session/Beads updated. For planning, product gates are not applicable; do not invent product test results. Intermediate closure does not certify final feature acceptance. Segment tip waits for its merged PR and exact-head hosted gates.

Owner implementation authorization recorded on 14 October; independent final source/quality review and final owner acceptance remain required. After close, read back closed state and sync Dolt, recording actual completion. Missing required test/publication/merge evidence blocks applicable task completion.
