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

The task now continues on `task/git-delivery-load-readiness`, created from actual feature merge `220a5dc0c1d65f884ef5807ee39c4fd845537c3d`. The prior final tip `task/git-delivery-verification` at `83e4bc4e` was delivered by PR329; its complete chained history remains retained. Worktree: `/Users/letuscode/.codex/worktrees/git-delivery-plan/agent-platform`. Parent `task/git-delivery-tools` → `task/git-delivery-verification`; integration `feature/git-delivery-mvp`, eventual protected staging only under actual grant. Never main. Qualified d185 staging `4ffc5fc0` is already incorporated. Before final integration refresh and rehearse again if the protected baseline advances, preserving all documentation and paused branches.

Run all final connected cases and quality gates on combined source; inspect actual diagnostic exports and independent Git/gh fixture effects. Resolve source-review findings, publish complete results/docs/session mirrors, open one tip PR to feature/git-delivery-mvp. No merge until applicable owner grant and all current-head gates clear; later feature-to-staging qualification separate and explicit.

Expected paths: shared contracts/DB receipt records, API application service and Project/chat routers, harness system/Git tools and dispatch, existing web Git rail/panel/page and their tests as applicable to this task. Planning task writes only docs/session/Beads. No `packages/workflow-control` edits, global settings, dependencies or new external service. Implement only this task's requirements; review material boundary changes.

## Tests and Gherkin E2E strategy

All GD-T01–GD-T12; required browser+Electron paths, package/quality/security gates and real current protected staging VM if promotion authorized.

For product tasks, use the exact scenarios in the verification plan. Given a disposable approved Project, when the user performs this task's manual/chat action, then the visible outcome must match independently inspected index/commit/remote/receipt state. Given denied, stale or uncertain input, when it settles, then no prohibited effect occurs and the user sees the safe recovery state. For visibility, given hidden rail and a pending approval, when chat is used or the app restarts, then approval and show control remain available. Planning task: Gherkin execution not applicable; the scenarios are authored only.

## Definition of done and pre-close sign-off

All required final tests pass with limitations stated; actual results/source/diagnostics reviewed, mirrors/readbacks complete, Beads aligned, segment tip PR merged under owner grant and exact-head hosted checks/reviews clear. Staging readiness claimed only after separate authorized protected merge/tree verification. Does not close broad7vf or ii1.

Before close: upstream tasks closed, applicable owner grant recorded, requirement/scenario matrix complete, actual failures repaired/reviewed, meaningful local gates and normal hooks pass, pushed exact source and full mirrors read back, session/Beads updated. For planning, product gates are not applicable; do not invent product test results. Intermediate closure does not certify final feature acceptance. Segment tip waits for its merged PR and exact-head hosted gates.

Owner implementation authorization recorded on 14 October; independent final source/quality review and final owner acceptance remain required. After close, read back closed state and sync Dolt, recording actual completion. Missing required test/publication/merge evidence blocks applicable task completion.

## Current verification handoff — 15 October 2026

The complete implementation is pushed at `093f7b96`, incorporating qualified staging `4ffc5fc0`. Normal hooks passed cycles, build, typecheck and six affected-package suites: contracts128, DB147, desktop187, web366, harness745 and API459. Independent source reviews and actual browser/native evidence reviews have no outstanding actionable findings. Local Sonar/IDE Problems tools were unavailable; required typecheck/lint/tests pass and hosted Sonar/CodeQL remain separate pending gates.

Local connected evidence qualifies all five Git browser scenarios across distinct zero-retry runs, plus31 existing browser cases and one explicitly unqualified pre-existing context prerequisite skip. All39 existing managed-app regression cases have passing evidence across38 original passes and one targeted reviewed Darwin screenshot correction; all three new native chat journeys separately pass. Seven actual V1 reports were reviewed with safe correlation/durability/loss/freshness checks. The post-restart unknown report retains `unfinishedPriorProcess=true`; it is disclosed rather than relabeled clean. Models/GitHub/SSH transport are deterministic fixtures; Git, SQLite, approval persistence, BFF, renderer and managed API are real. Live credentials/provider compatibility and distributed release verification are not established.

The reviewed source includes an accessible Hide panel control and its actual Darwin baseline with unchanged screenshot tolerances. The corresponding Linux screenshot still needs a genuine hosted Linux artifact, independent visual review and qualification. Required hosted checks and review comments must be processed before merge readiness; protected staging additionally requires its actual full scan and packaged VM gate under an applicable owner grant. No green status or implementation instruction grants final owner acceptance or a new feature/staging merge.

The separate P2 [test telemetry isolation finding](agent-platform-test-telemetry-isolation.md) records rejected external tracing uploads observed in test stderr. Exact asynchronous ownership and activation source are unproven; this is not an assertion failure or a waiver. Process-scoped tracing is disabled before imports in future local test commands, with no product/global credential change. The linked follow-up remains outside this bounded MVP and does not expand its implementation.

Evidence root: `/Users/letuscode/.codex/git-delivery-implementation-20261014`. Actual source and normal hooks: `chat-commit-source.json`. Browser review: `browser-git-actual-evidence-review.json`, `integrated-panel-denial-qualification.json`, `browser-regression-attempt2/results.json`. Native and diagnostic review: `chat-native-qualification-manifest.json`, `native-regression-qualification.json`. Full source-bound mirror and Beads readbacks are required before each applicable closure. This tip remains in progress until its declared hosted and authorized integration gates pass; broader ii1/7vf, main and paused PR283 remain separate.

## PR329 qualification checkpoint — 15 October 2026

PR329 is open into `feature/git-delivery-mvp`. Its initial hosted Sonar/browser/desktop failures
have bounded independently reviewed source and fixture repairs. The detailed local results,
failed invocations, diagnostic review and exact source limits are in the
[verification results](../testing/git-delivery-mvp.md#pr329-quality-repair-checkpoint--15-october-2026)
and [review record](../reviews/git-delivery-mvp-plan-review.md#pr329-quality-repair-review--15-october-2026).
Final exact-head hosted Sonar, browser/desktop/quality checks, resolved findings, complete current
mirrors and owner acceptance remain required. Keep this task in progress; no merge or staging
readiness follows from local approval. The prior413767-byte session remains an exact suffix.

## PR330 renderer readiness and Git selection repair — 15 October 2026

PR329 is delivered to `feature/git-delivery-mvp` at `220a5dc0` after all nine executed
exact-head checks and independent source/evidence review. The owner authorized guarded feature
and staging merges after actual tests, protection checks and review findings clear, followed by
recovery-protected cleanup. Protected staging PR330 still targets `4ffc5fc0`; it is held through
this repair, with main and paused PR283/four orchestration branches separate.

PR330 had fourteen green executed check conclusions at `220a5dc0`, but its actual Electron
report was `ok:false`: sixty expected passes and one flaky local Git-panel case. Its first
attempt failed at a single reload with `ERR_CONNECTION_REFUSED`; a retry passed. GD-E01 records
that a retry-green job is insufficient clean qualification. The prior ordinary full Promptfoo
analysis (seven batches), nineteen first-attempt packaged VM tests, browser journeys and raw
nine-sample benchmark were independently qualified for that old source only. Sonar was OK with
31 minor observations and no major/critical findings; scoped CodeQL was clear. Sourcery's
oversized-diff skip is a limitation, not approval. None qualifies the future changed head.

Two controlled actual Electron failure/control pairs established that reloading while initial
renderer navigation remains pending can reject bootstrap and reclaim both services. Waiting
for the exact owned renderer origin with `waitUntil: 'load'` before one real reload preserved
healthy services. The old hosted trace cannot establish its historical cause. All three Git
fixture launches now reuse that existing load boundary and paired-port allocator. Safe bounded
startup/parent status is attached before cleanup; attachment errors preserve primary failures
while independent owned cleanup runs (GD-F01). This metadata does not prove renderer-child
health or expose child stderr, credentials, response bodies or session contents.

The first repeated readiness run was eight passes and one divergent-pull failure, not nine
passes: Refresh detached and the screenshot showed Activity. Two completed natural probe invocations passed five/five and three/three without reproducing
that ordering. A separately interrupted invocation retained three completed passes, one interrupted
case and six unrun cases (exit130); it is not a clean completed invocation. A separate controlled real session-response
probe did prove a product defect: Git selected on the initial rail, then releasing the actual
successful session POST remounted the session-keyed chat and reset the rail to Activity. Its
final diagnostic lookup consumed the remaining test budget; that instrumentation limitation
and the original failure remain retained. Attribution of the earlier eight/one failure remains
inference, while the controlled post-click reset is observed evidence.

Only the Activity/Git selection is lifted into project-scoped page state. It survives canonical
binding and same-project session changes, resets immediately on project/Home changes, and
rejects obsolete callbacks, including return to the same project. The rail is controlled by that
one value. Chat keys/reset semantics, session/message/approval ownership and Git authorization
remain intact. No visibility persistence, runtime startup handling, API policy or dependency
changes are introduced. The divergent native fixture holds a real backend response until Git
is selected, then verifies canonical binding and preserved Git selection/content before the
original Refresh, pull, merge and push assertions. No synthetic successful session response,
extra click retry, raised deadline or removed effect check qualifies the fix.

Actual local qualification: 37 focused web tests pass, including deferred binding with the real
page/rail and independently reset chat draft, same-project sessions, hide/show, Home/project
reset and obsolete callbacks. Production web build, post-build typecheck, scoped lint/format and
fixture TypeScript pass. Running typecheck concurrently with Next build initially encountered
missing generated types; the sequential post-build run passed. Existing tool-discovery/lint
failures and all diagnostic probe limitations are retained, not relabeled as product failures.
All three actual native Git-panel journeys repeated three times pass 9/9, with retries disabled,
zero flakes/skips, duration 134.047s. Nine decoded inline startup attachments
have distinct ports, the owned page origin, a ready window and live parent before cleanup, with
no observed cancellation/truncation. Seven source files have independent approval with exact
hashes in `pr330-selection-source-review.json`.

Evidence root: `/Users/letuscode/.codex/git-delivery-implementation-20261014`;
`pr330-initial-load-repro/verification.json`, `pr330-initial-load-repro/divergent-read-probe/`
(including `delayed-session/`), the retained eight/one run `pr330-readiness-native-nine-final/`,
`pr330-selection-native-nine/results.json`, `pr330-selection-startup-attachments/`, and
`pr330-view-ownership-tests.log`/`pr330-view-web-build.log`/`pr330-view-typecheck-final.log`.

The task continues on `task/git-delivery-load-readiness` from the actual feature merge. Next are
normal commit/push, complete four-document branch mirrors/readbacks, final independent review,
and a repair PR to the existing feature. Its guarded merge must precede new PR330 exact-head
full security analysis, actual packaged VM, clean browser/Electron and diagnostic evidence,
benchmark, live protections and resolved reviews. Existing seven business-run V1 exports remain
retained; this selection repair does not change event collection, and new hosted acceptance
reports must confirm the actual application flow. Keep Beads verification in progress through
verified staging delivery, preservation, delivered-branch cleanup and final sync. Broader ii1/7vf,
P2 test-telemetry work, main and paused orchestration remain outside this delivery.
