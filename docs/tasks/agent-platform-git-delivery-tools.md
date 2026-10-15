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

The actual current branch is `task/git-delivery-tools`, created from pushed `task/git-delivery-publish` at `2a254204`. Worktree: `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`. Parent `task/git-delivery-publish` → `task/git-delivery-tools`; integration `feature/git-delivery-mvp`, eventual protected staging only under actual grant. Never main. Final acceptance refreshes from actual qualified d185 staging, preserving all documentation and paused branches; the reviewed refinement permits runtime integration on the existing qualified baseline.

Add four typed mutation tools through injected application GitDeliveryPort, current Project binding and shared service; classify writes/risk/capabilities and integrate server-prepared material into existing approval records. Revalidate on resume, retain one-shot claim, deny Personal/readonly/stale/forged calls. Report safe outcomes and known partial success in chat without panel dependency. Do not add generic commands or paused brokers.

Expected paths: shared contracts/DB receipt records, API application service and Project/chat routers, harness system/Git tools and dispatch, existing web Git rail/panel/page and their tests as applicable to this task. Planning task writes only docs/session/Beads. No `packages/workflow-control` edits, global settings, dependencies or new external service. Implement only this task's requirements; review material boundary changes.

## Tests and Gherkin E2E strategy

GD-T05,T06,T07,T08,T09 and chat portion of T12; real SDK/graph/dispatch/approval/DB/service, deterministic model HTTP only.

For product tasks, use the exact scenarios in the verification plan. Given a disposable approved Project, when the user performs this task's manual/chat action, then the visible outcome must match independently inspected index/commit/remote/receipt state. Given denied, stale or uncertain input, when it settles, then no prohibited effect occurs and the user sees the safe recovery state. For visibility, given hidden rail and a pending approval, when chat is used or the app restarts, then approval and show control remain available. Planning task: Gherkin execution not applicable; the scenarios are authored only.

## Definition of done and pre-close sign-off

Approved operations have exact effects, pending/denied/stale/replay have no prohibited effects, diagnostics reflect actual result, browser/Electron chat-only journeys pass, source independently reviewed/pushed. Intermediate task plus composed shared-service gate; no tip PR yet.

Before close: upstream tasks closed, applicable owner grant recorded, requirement/scenario matrix complete, actual failures repaired/reviewed, meaningful local gates and normal hooks pass, pushed exact source and full mirrors read back, session/Beads updated. For planning, product gates are not applicable; do not invent product test results. Intermediate closure does not certify final feature acceptance. Segment tip waits for its merged PR and exact-head hosted gates.

Owner implementation authorization recorded on 14 October; independent final source/quality review and final owner acceptance remain required. After close, read back closed state and sync Dolt, recording actual completion. Missing required test/publication/merge evidence blocks applicable task completion.

## Earlier implementation checkpoint — 15 October 2026 (historical)

The shared core includes actual qualified staging4ffc and is pushed at2a254 with normal build/typecheck/test/cycle hooks and three complete documentation mirrors. Independent review explicitly permits downstream chat implementation while upstream task closure waits for fresh integrated browser and final gates; this is a work-order refinement, not a dependency or acceptance waiver. The earlier sequencing statements are historical and do not require reimporting unqualified source.

The four typed tools now prepare canonical public receipts and persist private operation bindings; the API resumes only the actual claimed approval and rejects changed ownership or data. A dedicated chat card displays saved receipt outcomes and explicit human review/recovery. Independent review approved the frozen backend pre-execution denial closure and sibling tool-call history corrections; `chat-tools-final-review.json` binds that actual verdict to its source manifest. Later recovery-read/agent-assignment and hidden-panel recovery/admission/deletion changes remain under repair/review. Focused test results do not replace connected browser/Electron or actual V1 reports. Docker is recovered with31GiB host space after owner cache cleanup; connected qualification remains pending. No task closure or final source approval is claimed by this checkpoint.

## Reviewed chat integration and connected checkpoint

The later recovery/registry delta is independently approved with45 real SDK/HTTP/SQLite/Git cases. The retained-operation-driven inventory binds actual Project/session/agent, tool call and immutable public review, returns current canonical receipt truth, and strips private execution payloads. Missing or invalid approval records remain recovery-only; all1000 retained receipts and the oldest behind more than1000 deleted approval histories are covered. Trusted canonical Git metadata is inserted only for the four requested known tools during agent assignment; unknown tool references retain their foreign-key behavior. OpenAPI documents the inventory endpoint; seven contract checks pass.

The final UI correction has independent source approval and105 focused passing tests. It restores current receipt truth with the rail hidden, refuses forged approval authority, releases only its own rejected admission latch, permits explicit closed-record deletion, prevents stale Project/session responses and mounts at most ten receipt cards across message and recovery history. User-visible current expiry/cancellation and oldest/latest paging are tested. These changes close GD-CHAT-UI01–03; earlier pending-review statements describe historical checkpoints.

Connected native success and real-backend-restart unknown recovery passed in attempt2; denial passed the separately corrected attempt3, all zero retries. Exact ledgers prove one PR creation for success/unknown and zero Git/PR effect for denial, with model calls5/4/2 and no provider errors. Seven actual safe V1 reports were reviewed independently: scoped correlation, freshness, unique events, redaction canaries and no pending/dropped/conflicting/pruned or truncated data. The post-restart unknown report retains `unfinishedPriorProcess=true`, so it is not described as a clean completed prior process. Before/after63 historical events match and no mutation/model request is replayed. Native fixture errors in earlier count/text expectations remain retained; runtime behavior was not changed to satisfy them.

Full build/typecheck/lint/format/cycle gates pass on this application source. Browser attempt2 passes success and unknown; the separately corrected denial case passes after matching the full rejection paragraph. Fresh manual local/remote panel cases also pass in separate zero-retry runs. The existing browser suite passes31 with one pre-existing optional context prerequisite skip. All39 existing managed-app regression cases pass across38 initial cases plus one targeted12.9-second zero-retry rerun after the reviewed Hide panel Darwin baseline update; screenshot tolerances are unchanged. Normal push, current full mirrors and hosted checks remain pending; Linux visual qualification awaits its genuine hosted capture. Compose diagnostic export correctly denies403; actual diagnostic qualification comes from the managed native application, not a fabricated Compose report. These bounded fixtures do not establish live GitHub authentication, real model-provider behavior or distributed-release readiness.

### Integrated browser result and retained setup failures

All five Git browser cases now have passing zero-retry evidence on the same reviewed application images: chat success/unknown in `browser-chat-attempt2`, denial and remote panel in `integrated-panel-and-denial-final`, and local panel in `integrated-local-final`. These are distinct runs, not a claimed single five-case pass. Independent Git/SQLite/approval/gh ledgers verify exact reviewed commits, bare refs and PR fields; cancellation/denial/stale reviews cause no prohibited effect, and lost responses reconcile with one PR creation. The local fixture now accommodates two observed rate-limit windows within180seconds, retaining each61-second wait bound and every application assertion. No production limit, command deadline or mutation retry changed. The first combined local failure recorded actual429 during onboarding and cleanup; only its four owned records were later cleaned up and verified, with intended Project archival semantics preserved.

The separate existing-browser regression passes31/32, zero retries, with only the unchanged context test's explicit isolated-mount prerequisite skip. That case is not qualified by this run; five context/token managed-app regressions separately pass. An earlier coordinator-created stack mounted a different host root from the existing IDE/resource fixtures, producing five setup failures and nine unexecuted dependencies. The mount was corrected to this private worktree's fixture directory and the complete32-case inventory reran successfully within its declared prerequisite limits. Exact reviewed images are recorded in `browser-regression-runtime/receipt.json`; no application source was changed to mask those failures. Prior failed attempts, traces and owned cleanup evidence remain retained.
