# Complete shared publish and pull-request delivery

**Beads issue:** `agent-platform-0ra`

**Spec file:** `docs/tasks/agent-platform-0ra.md`

**Parent epic:** `agent-platform-ii1` — Git workflow UI and in-app web explorer

Status: proposed bounded plan; owner review before implementation. [Feature plan](../planning/git-delivery-mvp.md), [verification](../testing/git-delivery-mvp.md), [review](../reviews/git-delivery-mvp-plan-review.md).

## Task requirements

GD-R2,GD-R4,GD-R6. Retain delivered push/PR work noted at3d31a71/355ca8c, compare actual source before editing. Extract async publish/push/PR operations into same service; require explicit repo/head/base and bounded receipts/reconciliation. Preserve successful mutation if enrichment fails; prevent duplicates after uncertain response. Existing conflict resolution/read-check tools remain unchanged outside necessary adapters.

For reused IDs4hm/0ra this becomes the canonical bounded specification; historical `agent-platform-git-workflow-ui-3.md`/`-4.md` remain preserved evidence. No old task is auto-closed and broader epic work remains separately scoped.

Permission and lifecycle acceptance explicitly includes the plan’s category matrix (block wins at every entry/resume), 15-minute unexecuted expiry, effect-free versus unknown outcomes, human-only unknown acknowledgement, recoverable capacity, fail-closed pruned-ID replay and safe SQLite upgrade. GD-T07/GD-T09 verify the applicable local/remote/chat boundaries; no model or HTTP bypass.

## Dependency order

Upstream: agent-platform-4hm; agent-platform-59i (closed).

Downstream: agent-platform-git-delivery-tools; existing agent-platform-5zg remains downstream for later scope.

Beads hard blockers must match these links. Owner implementation approval is recorded separately; planning completion or a ready status does not grant it.

## Implementation plan and Git workflow

Actual planning branch exists; later task branches below are proposals. Worktree: `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`. Parent `task/git-delivery-commit` → `task/git-delivery-publish`; integration `feature/git-delivery-mvp`, eventual protected staging only under actual grant. Never main. Planning refreshes from actual qualified d185 staging before implementation, preserving all documentation and paused branches.

Retain delivered push/PR work noted at3d31a71/355ca8c, compare actual source before editing. Extract async publish/push/PR operations into same service; require explicit repo/head/base and bounded receipts/reconciliation. Preserve successful mutation if enrichment fails; prevent duplicates after uncertain response. Existing conflict resolution/read-check tools remain unchanged outside necessary adapters.

Expected paths: shared contracts/DB receipt records, API application service and Project/chat routers, harness system/Git tools and dispatch, existing web Git rail/panel/page and their tests as applicable to this task. Planning task writes only docs/session/Beads. No `packages/workflow-control` edits, global settings, dependencies or new external service. Implement only this task's requirements; review material boundary changes.

## Tests and Gherkin E2E strategy

GD-T03,T04,T08,T09 and manual portion of T12; real bare remote with gh transport fixture, API and both UI modes.

For product tasks, use the exact scenarios in the verification plan. Given a disposable approved Project, when the user performs this task's manual/chat action, then the visible outcome must match independently inspected index/commit/remote/receipt state. Given denied, stale or uncertain input, when it settles, then no prohibited effect occurs and the user sees the safe recovery state. For visibility, given hidden rail and a pending approval, when chat is used or the app restarts, then approval and show control remain available. Planning task: Gherkin execution not applicable; the scenarios are authored only.

## Definition of done and pre-close sign-off

Publish/PR states match actual effects, explicit destinations, errors/unknown states safe and nonblocking; relevant task journeys pass, source review and pushed evidence. Intermediate task local/service+UI integration; no separate PR required. Historical in_progress status does not prove old acceptance complete.

Before close: upstream tasks closed, applicable owner grant recorded, requirement/scenario matrix complete, actual failures repaired/reviewed, meaningful local gates and normal hooks pass, pushed exact source and full mirrors read back, session/Beads updated. For planning, product gates are not applicable; do not invent product test results. Intermediate closure does not certify final feature acceptance. Segment tip waits for its merged PR and exact-head hosted gates.

Reviewer/owner: pending; no implementation acceptance inferred. After close, read back closed state and sync Dolt, recording actual completion. Missing required test/publication/merge evidence blocks applicable task completion.
