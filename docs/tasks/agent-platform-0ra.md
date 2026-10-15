# Complete shared publish and pull-request delivery

**Beads issue:** `agent-platform-0ra`

**Spec file:** `docs/tasks/agent-platform-0ra.md`

**Parent epic:** `agent-platform-ii1` — Git workflow UI and in-app web explorer

Status: owner-approved bounded implementation, 14 October 2026; actual task progress remains in Beads. [Feature plan](../planning/git-delivery-mvp.md), [verification](../testing/git-delivery-mvp.md), [review](../reviews/git-delivery-mvp-plan-review.md).

## Task requirements

GD-R2,GD-R4,GD-R6. Retain delivered push/PR work noted at3d31a71/355ca8c, compare actual source before editing. Extract async publish/push/PR operations into same service; require explicit repo/head/base and bounded receipts/reconciliation. Preserve successful mutation if enrichment fails; prevent duplicates after uncertain response. Existing conflict resolution/read-check tools remain unchanged outside necessary adapters.

For reused IDs4hm/0ra this becomes the canonical bounded specification; historical `agent-platform-git-workflow-ui-3.md`/`-4.md` remain preserved evidence. No old task is auto-closed and broader epic work remains separately scoped.

Permission and lifecycle acceptance explicitly includes the plan’s category matrix (block wins at every entry/resume), 15-minute unexecuted expiry, effect-free versus unknown outcomes, human-only unknown acknowledgement, recoverable capacity, fail-closed pruned-ID replay and safe SQLite upgrade. GD-T07/GD-T09 verify the applicable local/remote/chat boundaries; no model or HTTP bypass.

Historical sequencing (superseded by the next paragraph): the initial independently approved amendment permitted only additive isolated contracts/DB/service work and rail visibility before qualified d185 staging incorporation. Runtime endpoint/chat/approval integration and final connected qualification still wait for that exact baseline. Preliminary results do not close this task.

The latest independently reviewed work-order refinement permits runtime integration on qualified `2a848b9a` without importing pending d185 code. Final actual qualified-staging incorporation, semantic conflict review and fresh connected gates remain mandatory before acceptance; this supersedes earlier preliminary-only sequencing wording.

## Dependency order

Upstream: agent-platform-4hm; agent-platform-59i (closed).

Downstream: agent-platform-git-delivery-tools; existing agent-platform-5zg remains downstream for later scope.

Beads hard blockers must match these links. Owner implementation approval is recorded separately; planning completion or a ready status does not grant it.

## Implementation plan and Git workflow

Actual planning branch exists; later task branches below are proposals. Worktree: `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`. Parent `task/git-delivery-commit` → `task/git-delivery-publish`; integration `feature/git-delivery-mvp`, eventual protected staging only under actual grant. Never main. Final acceptance refreshes from actual qualified d185 staging, preserving all documentation and paused branches; the reviewed refinement permits runtime integration on the existing qualified baseline.

Retain delivered push/PR work noted at3d31a71/355ca8c, compare actual source before editing. Extract async publish/push/PR operations into same service; require explicit repo/head/base and bounded receipts/reconciliation. Preserve successful mutation if enrichment fails; prevent duplicates after uncertain response. Existing conflict resolution/read-check tools remain unchanged outside necessary adapters.

Expected paths: shared contracts/DB receipt records, API application service and Project/chat routers, harness system/Git tools and dispatch, existing web Git rail/panel/page and their tests as applicable to this task. Planning task writes only docs/session/Beads. No `packages/workflow-control` edits, global settings, dependencies or new external service. Implement only this task's requirements; review material boundary changes.

## Tests and Gherkin E2E strategy

GD-T03,T04,T08,T09 and manual portion of T12; real bare remote with gh transport fixture, API and both UI modes.

For product tasks, use the exact scenarios in the verification plan. Given a disposable approved Project, when the user performs this task's manual/chat action, then the visible outcome must match independently inspected index/commit/remote/receipt state. Given denied, stale or uncertain input, when it settles, then no prohibited effect occurs and the user sees the safe recovery state. For visibility, given hidden rail and a pending approval, when chat is used or the app restarts, then approval and show control remain available. Planning task: Gherkin execution not applicable; the scenarios are authored only.

## Definition of done and pre-close sign-off

Publish/PR states match actual effects, explicit destinations, errors/unknown states safe and nonblocking; relevant task journeys pass, source review and pushed evidence. Intermediate task local/service+UI integration; no separate PR required. Historical in_progress status does not prove old acceptance complete.

Before close: upstream tasks closed, applicable owner grant recorded, requirement/scenario matrix complete, actual failures repaired/reviewed, meaningful local gates and normal hooks pass, pushed exact source and full mirrors read back, session/Beads updated. For planning, product gates are not applicable; do not invent product test results. Intermediate closure does not certify final feature acceptance. Segment tip waits for its merged PR and exact-head hosted gates.

Owner implementation authorization recorded on 14 October; independent final source/quality review and final owner acceptance remain required. After close, read back closed state and sync Dolt, recording actual completion. Missing required test/publication/merge evidence blocks applicable task completion.

## Current implementation evidence

`task/git-delivery-publish` now exists from pushed local checkpoint `45042d8d`. The shared remote service, panel and controlled external boundaries are implemented and independently reviewed;22 remote regressions and the affected local quality gates pass. Connected browser testing exposed a history-selection recovery defect; its reviewed correction passes8 hook tests and the corrected browser remote journey now passes with zero retries and reviewed real effects. The corrected application also passed Electron local/conflict cases in attempt3 and the remote case in attempt4 with zero retries, as distinct runs. Current checkpoint publication and final integration gates remain pending. See the [current results](../reviews/git-delivery-mvp-plan-review.md#remote-delivery-checkpoint--15-october-2026). Beads remains in progress; preliminary implementation or earlier historical delivery does not close this task.
