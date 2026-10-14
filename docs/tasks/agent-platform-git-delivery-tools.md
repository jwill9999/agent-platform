# Expose approved Git delivery in Project Chat

**Beads issue:** `agent-platform-git-delivery-tools`

**Spec file:** `docs/tasks/agent-platform-git-delivery-tools.md`

**Parent epic:** `agent-platform-ii1` — Git workflow UI and in-app web explorer

Status: owner-approved bounded implementation, 14 October 2026; actual task progress remains in Beads. [Feature plan](../planning/git-delivery-mvp.md), [verification](../testing/git-delivery-mvp.md), [review](../reviews/git-delivery-mvp-plan-review.md).

## Task requirements

GD-R3,GD-R4,GD-R6. Add four typed mutation tools through injected application GitDeliveryPort, current Project binding and shared service; classify writes/risk/capabilities and integrate server-prepared material into existing approval records. Revalidate on resume, retain one-shot claim, deny Personal/readonly/stale/forged calls. Report safe outcomes and known partial success in chat without panel dependency. Do not add generic commands or paused brokers.

For reused IDs4hm/0ra this becomes the canonical bounded specification; historical `agent-platform-git-workflow-ui-3.md`/`-4.md` remain preserved evidence. No old task is auto-closed and broader epic work remains separately scoped.

Permission and lifecycle acceptance explicitly includes the plan’s category matrix (block wins at every entry/resume), 15-minute unexecuted expiry, effect-free versus unknown outcomes, human-only unknown acknowledgement, recoverable capacity, fail-closed pruned-ID replay and safe SQLite upgrade. GD-T07/GD-T09 verify the applicable local/remote/chat boundaries; no model or HTTP bypass.

Historical sequencing (superseded by the next paragraph): the initial independently approved amendment permitted only additive isolated contracts/DB/service work and rail visibility before qualified d185 staging incorporation. Runtime endpoint/chat/approval integration and final connected qualification still wait for that exact baseline. Preliminary results do not close this task.

The latest independently reviewed work-order refinement permits runtime integration on qualified `2a848b9a` without importing pending d185 code. Final actual qualified-staging incorporation, semantic conflict review and fresh connected gates remain mandatory before acceptance; this supersedes earlier preliminary-only sequencing wording.

## Dependency order

Upstream: agent-platform-0ra; agent-platform-git-delivery-plan.

Downstream: agent-platform-git-delivery-verification

Beads hard blockers must match these links. Owner implementation approval is recorded separately; planning completion or a ready status does not grant it.

## Implementation plan and Git workflow

Actual planning branch exists; later task branches below are proposals. Worktree: `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`. Parent `task/git-delivery-publish` → `task/git-delivery-tools`; integration `feature/git-delivery-mvp`, eventual protected staging only under actual grant. Never main. Final acceptance refreshes from actual qualified d185 staging, preserving all documentation and paused branches; the reviewed refinement permits runtime integration on the existing qualified baseline.

Add four typed mutation tools through injected application GitDeliveryPort, current Project binding and shared service; classify writes/risk/capabilities and integrate server-prepared material into existing approval records. Revalidate on resume, retain one-shot claim, deny Personal/readonly/stale/forged calls. Report safe outcomes and known partial success in chat without panel dependency. Do not add generic commands or paused brokers.

Expected paths: shared contracts/DB receipt records, API application service and Project/chat routers, harness system/Git tools and dispatch, existing web Git rail/panel/page and their tests as applicable to this task. Planning task writes only docs/session/Beads. No `packages/workflow-control` edits, global settings, dependencies or new external service. Implement only this task's requirements; review material boundary changes.

## Tests and Gherkin E2E strategy

GD-T05,T06,T07,T08,T09 and chat portion of T12; real SDK/graph/dispatch/approval/DB/service, deterministic model HTTP only.

For product tasks, use the exact scenarios in the verification plan. Given a disposable approved Project, when the user performs this task's manual/chat action, then the visible outcome must match independently inspected index/commit/remote/receipt state. Given denied, stale or uncertain input, when it settles, then no prohibited effect occurs and the user sees the safe recovery state. For visibility, given hidden rail and a pending approval, when chat is used or the app restarts, then approval and show control remain available. Planning task: Gherkin execution not applicable; the scenarios are authored only.

## Definition of done and pre-close sign-off

Approved operations have exact effects, pending/denied/stale/replay have no prohibited effects, diagnostics reflect actual result, browser/Electron chat-only journeys pass, source independently reviewed/pushed. Intermediate task plus composed shared-service gate; no tip PR yet.

Before close: upstream tasks closed, applicable owner grant recorded, requirement/scenario matrix complete, actual failures repaired/reviewed, meaningful local gates and normal hooks pass, pushed exact source and full mirrors read back, session/Beads updated. For planning, product gates are not applicable; do not invent product test results. Intermediate closure does not certify final feature acceptance. Segment tip waits for its merged PR and exact-head hosted gates.

Owner implementation authorization recorded on 14 October; independent final source/quality review and final owner acceptance remain required. After close, read back closed state and sync Dolt, recording actual completion. Missing required test/publication/merge evidence blocks applicable task completion.
