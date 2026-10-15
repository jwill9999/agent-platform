# Git delivery MVP — verification plan

Status: local chat/panel and regression evidence is qualified within the recorded fixture limits; normal push passed at `093f7b96`. Current verification-document mirrors, hosted qualification and the genuine Linux visual baseline remain pending. Parent: `agent-platform-ii1`. [Requirements/design](../planning/git-delivery-mvp.md). Final integration owner: `agent-platform-git-delivery-verification`.

## Environments, fixtures and evidence

Unit/API integration use isolated temporary repositories, a real local bare remote, isolated SQLite app data and fixed user identity. Browser uses the real Next.js BFF/API in Docker with writable disposable mounted Project roots. Electron uses the real desktop API/renderer and temporary approved host binding. External model responses are scripted at HTTP; gh creation/query transport is a controllable child executable with persistent fake-server ledger. For GitHub-shaped remote URLs, an independently reviewed owned SSH transport fixture accepts only the exact repository and upload-pack/receive-pack request and delegates to real Git against the corresponding owned bare remote. This preserves matching Git/gh repository identity without a production test exception; actual GitHub networking is simulated. Do not mock frontend routes, application approval service, Git service, DB or Git executable for composed journeys. Runner fixture binary injection is test-only and cannot be configured by model input; production uses canonical executable policy.

No paid/live model calls or live GitHub PR creation. The gh fixture cannot prove real hosted credentials/permissions, rate limits or GitHub compatibility; verify exact arguments/contracts and disclose this limit. Actual local Git commit/index/remote-ref checks are independent evidence. Existing protected staging gates still include genuine security scan and actual packaged VM suite when promotion is authorized; new chat Git host service does not claim VM isolation.

Capture source SHA, test IDs, project/session/approval/operation IDs, Git before/after full hashes/index paths/bare remote refs, redacted gh ledger, structured diagnostics, browser/Electron traces/screenshots and failure logs before cleanup. Each fixture owns and deletes only its temp roots/DB/children. Never use developer checkout or real remote. Ensure sufficient disk before running existing packaged VM suite; preserve evidence before cleanup. Docker was unavailable at planning inspection and is now reachable; verify isolated compose/app health before browser runs. Do not claim product tests ran during planning.

## Requirement-to-scenario matrix

| ID / requirements | Owner and layer                                                   | Inputs/actions                                                                                                                                                                                                                                              | Required visible result and independent effect                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GD-T01 / R1,R4    | `4hm`; contracts/service unit + real Git API                      | Stage/unstage selected files; rename/delete, spaces/newlines/wildcards/pathspec-magic, traversal/symlink/.git denial                                                                                                                                        | Only literal intended index entries change; rejected paths cause no mutation; unselected and pre-staged entries preserved                                                                                                                                                                                                                                                 |
| GD-T02 / R1,R4    | `4hm`; API + browser/Electron                                     | Review full index including unrelated staged file; commit explicit selection/message; mutate index/HEAD after preview                                                                                                                                       | Exact confirmed tree/parent/message committed once; undisclosed/stale content blocks; failures retain index/worktree; clear success and next action                                                                                                                                                                                                                       |
| GD-T03 / R2,R6    | `0ra`; service/API + browser/Electron                             | Publish existing work branch to real bare remote; second push; missing auth/remote/upstream, detached/protected branch, divergence                                                                                                                          | Ref/upstream exactly expected; visible state and errors; no force push or remote creation, no lost work                                                                                                                                                                                                                                                                   |
| GD-T04 / R2,R6    | `0ra`; contracts/API + browser/Electron                           | Explicit PR base/title/body/draft; existing PR; successful creation followed by failed enrichment                                                                                                                                                           | Exact fixture repo/head/base/body; one creation; URL shown with refresh warning; missing/invalid base blocked, never silent main default                                                                                                                                                                                                                                  |
| GD-T05 / R3,R4    | tools; harness/API + browser/Electron                             | Ask Project Chat to stage, commit, publish, create PR; approve each; panel hidden                                                                                                                                                                           | Real model SDK/graph/dispatch/approval/persistence/service path; same exact Git effects and PR ledger; sequential truthful results and final URL in chat                                                                                                                                                                                                                  |
| GD-T06 / R3,R4    | tools; harness/API + browser/Electron                             | Leave approval pending, deny it, replay resume, alter args/project/root/index/branch/remote between request and resume                                                                                                                                      | No prohibited effect; duplicate claim performs at most one action; changed reviewed identity requires new approval; chat remains usable                                                                                                                                                                                                                                   |
| GD-T07 / R4       | tools; service/harness/API + focused connected case               | Personal Chat, readonly/unapproved Project, another session/project, path escape, forged operation ID, same ID different payload; mixed `workspaceWrite`/`gitMutation`/`network` auto/ask/block; policy changed after preparation                           | Tools unavailable or denied; block wins across initial/resume/direct executor/HTTP, approval never overrides it; local operations do not require network, remote operations do; direct executor/HTTP cannot bypass binding; no credential/raw path leakage, unrelated repo unchanged                                                                                      |
| GD-T08 / R4,R6    | `4hm`,`0ra`, tools; executor/API integration                      | Concurrent panel/chat requests; delayed hook/push/gh; cancellation, timeout, disconnect, process death after effect before response; restart                                                                                                                | API health/session remain responsive while command held; child cleanup bounded; durable unknown/reconciled outcome; no automatic mutation replay or rollback                                                                                                                                                                                                              |
| GD-T09 / R4,R6    | `0ra`, tools; API integration + one browser/Electron unknown case | Repeat completed operation; new call while prior equivalent operation unknown; restart reconcile; ambiguous external actor change; receipt cap/retention; preparation expiry/denial/stale/cancel; human acknowledgement; replay of pruned IDs after restart | Retained completed result reused; no duplicated commit/PR; ambiguous remains unknown even after acknowledgement; only human acknowledgement permits fresh reviewed preparation; 15-minute unexecuted expiry followed by explicit human closed-history deletion recovers capacity; active/unacknowledged records never evicted; missing/pruned IDs never execute or upsert |
| GD-T10 / R5       | `4hm`; component + browser/Electron                               | Hide/show; navigate Projects, reload and native restart; storage throws; narrow viewport; web preview dock changes                                                                                                                                          | Rail consumes no width when hidden, accessible show control survives, preference retained when storage works, no approval loss or network mutation on toggle                                                                                                                                                                                                              |
| GD-T11 / R7       | verification; actual exported diagnostics on both journeys        | Export success plus denied/unknown runs via supported report path                                                                                                                                                                                           | Safe correlated operation outcome, no secrets/prompts/diff contents; verify durable/loss/truncation/coverage before inference; independent Git/ledger agrees                                                                                                                                                                                                              |
| GD-T12 / all      | verification; combined browser/Electron + regression/CI           | Full manual and full hidden-panel chat journey on same final source, return panel and inspect result                                                                                                                                                        | Both paths operate same Project and agree with real repo/ref/PR state; existing chat/MCP/context/Git cases pass; no false completed step after partial failure                                                                                                                                                                                                            |

GD-T09 additionally owns a focused DB upgrade scenario: start with the pre-feature schema and existing sessions, approval and diagnostic rows; apply the receipt migration, restart twice and verify all original rows/identities are preserved. Seed prepared, executing and terminal receipts after upgrade; repeated startup expires only eligible unexecuted preparations, converts interrupted execution to unknown, retains completed results and never launches a process. Repeat stale/pruned-ID resume after restart and assert zero Git/gh effects. Test all-active capacity rejection, expired-preparation capacity recovery through explicit human deletion (expiry alone does not bypass 30-day automatic retention), explicit closed-history deletion and unacknowledged unknown protection. Fake time is permitted for lifecycle boundaries; actual SQLite and Git effects remain real.

GD-T01–09 need unit/API controls because arbitrary error races are deterministic there; the listed connected representative cases also run in browser and Electron. GD-T10 is UI behavior plus persisted preference, no artificial backend mutation assertion. GD-T11 uses existing observability; source-only reasoning is insufficient. GD-T12 owns final cross-task qualification, not just sum of individual test counts.

## Gherkin integrated acceptance

```gherkin
Feature: Deliver selected Project changes through either surface
  Background:
    Given an approved disposable Project on a working branch and an isolated bare remote
    And the real app, API, database and Git service are running
    And only the model HTTP and GitHub transport boundaries are deterministic fixtures

  Scenario: Manual delivery preserves unrelated work
    Given selected changes and an unrelated staged change are visible for review
    When I confirm exactly what belongs in the commit and publish the branch
    And I create a pull request with an explicit base and description
    Then the app shows the actual commit, published branch and pull request link
    And independent Git and remote state match only the reviewed operation

  Scenario: Chat delivery with the panel hidden
    Given I have hidden the activity and Git panel
    When I ask the agent to stage selected files, commit, publish and create a pull request
    And I approve each reviewed mutation in chat
    Then each result and the final pull request link are visible in chat
    And reopening the panel shows the same actual repository state

  Scenario: Denied or stale approval has no effect
    Given a chat Git mutation is awaiting approval
    When I deny it or its reviewed repository state changes before approval
    Then no prohibited mutation is performed
    And chat explains the denial or need for a fresh review

  Scenario: A remote response is lost after an effect
    Given the remote accepted the requested action before the response was lost
    When the app reconnects or restarts and I inspect the operation
    Then it reconciles the observed effect or clearly reports an unknown outcome
    And it does not blindly repeat the mutation
```

## Commands and gates

Implementation adds or extends tests under `apps/api/test/`, `packages/harness/test/`, `packages/contracts/test/`, `packages/db/test/`, `apps/web/test/` and `apps/desktop/e2e/project-git-workflow.e2e.ts`. Proposed new tests may use `gitDelivery.test.ts`, `git-delivery-chat.e2e.ts`; these names are planned, not existing files. Existing anchors: projectsRouter, sessionChat.integration, approvalRequestsRouter, gitTools, toolDispatch, project-git-workflow-overview and project-activity tests. Reuse the existing Playwright configuration and native launch helpers, not private UI mounts.

Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, affected package tests via `pnpm --filter <affected-package> test`, direct Markdown checks and cycles. Browser: existing `pnpm test:e2e` against Docker; native: `pnpm --filter @agent-platform/desktop test:e2e` with exact implemented selectors confirmed from package scripts before execution. Preserve normal hook settings from the plan. Exact commands/selectors and counts go in results once run, not guessed as existing tests.

Independent code critique and Sonar/Problems fallback gate required. Inspect latest exact-head hosted checks, actual security findings and review threads even while another job fails. Stage promotion additionally requires current live protection checks, genuine full scan, actual packaged VM, no actionable unresolved comments and guarded merge authority. Fixture passes are not release-artifact/live-provider evidence. No required case silently skipped; fail/inconclusive blocks completion. Record failed/passed/skipped/not-run separately.

Result artifact: update [review/results record](../reviews/git-delivery-mvp-plan-review.md) with implementation evidence or link a dedicated `docs/reviews/git-delivery-mvp-results.md` at implementation; do not relabel planning critique as product qualification.

## Local implementation checkpoint — 14 October

The mounted API/core/adjacent/bootstrap suite passed 112 cases, current focused web suite passed 56, and the full monorepo build passed. Earlier contracts (12), DB lifecycle/upgrade (four), model HTTP (three), installed SDK transport (one) and GitHub transport ledger (ten) results remain bounded evidence. API/web typecheck and touched-file lint passed. Independent source review resolved GD-I01–12; see the review record for exact findings and limits.

GD-T01/T02/T08/T09 local service controls have unit/API evidence; their connected browser/Electron portions remain pending. GD-T03–T07/T11–T12 have no completed composed feature evidence yet. The current connected browser scenario uses real Git through an isolated Docker API, including hidden-only index review, both rename endpoints, cancellation, stale index and preservation of unrelated edits. Fixture source and discovery checks are not an executed test result. Evidence lives outside the repository at `/Users/letuscode/.codex/git-delivery-implementation-20261014`; no secrets or raw user repositories are collected.

The first local Electron journey passed with zero retries (one test, 11.3 seconds) against the built application. It exercised actual Project onboarding, explicit stage/commit review and confirmation, independently checked the exact commit paths, and retained Publish-summary/stash assertions. Three earlier fixture failures are preserved: missing model prerequisite prevented `/init` submission; premature renderer reload failed; the Publish summary required explicit tab navigation. These were fixture repairs, not product-success claims. The fixture now owns its Electron user-data directory and uses a non-network model configuration; no provider call is required. Browser attempt one failed at the 120-second test deadline; its trace and cleanup error are retained for diagnosis. It does not qualify browser completion. Full monorepo typecheck and lint, plus all touched-file formatting, also passed.

Browser attempt two reached real Git preparation and exposed a fresh-Docker defect: the configured temporary parent did not exist, so copied-index inspection failed. The bounded repair creates that trusted configured parent before its owned temporary directory. A new real-Git regression verifies unchanged real index bytes, HEAD and working contents, with no temporary copy left behind. All 62 current core/router/bootstrap tests and API typecheck/scoped lint passed. Browser fixture corrections wait for the actual Send control and use independent bounded cleanup that preserves the primary error. The updated API is being rebuilt before another connected run.

The critic approved an inert SSH transport fixture for the next remote slice. It binds one exact GitHub host/repository to an owned bare repository and permits only real Git upload-pack/receive-pack; wrong destinations and shell-command suffixes are rejected. Its self-test passed real push/ref inspection and four denied requests. GitHub networking remains simulated, and this does not qualify remote product behavior. Initial missing Node imports found by lint were fixed; scoped lint and formatting pass.

## Earlier chat recovery review controls — 15 October (historical)

The current backend checkpoint passes117 harness and31 composed SDK/API/Git cases, plus four fixture controls, with independent source approval. UI review adds required regressions for GD-T05/GD-T06/GD-T09: restore actual unknown/succeeded/expired outcomes after reload with the rail hidden; expose human closed-history deletion without synthetic approval authority; release a refused decision latch without retry; preserve ownership across Project A→B→A, session changes, unmount and late responses. A retained-operation-driven inventory must find the oldest retained record behind more than1000 deleted approval histories, all1000 current retained records, and real approval-persistence failure records. Missing or malformed approval bindings remain recovery-only with no approve/execute path; existing generic pending approvals retain their behavior. Saved receipt GET failures remain unverified, not success. Connected browser/Electron and actual native V1 success/failure report review remain required on the final corrected source.

## Reviewed chat integration and connected checkpoint

The later recovery/registry delta is independently approved with45 real SDK/HTTP/SQLite/Git cases. The retained-operation-driven inventory binds actual Project/session/agent, tool call and immutable public review, returns current canonical receipt truth, and strips private execution payloads. Missing or invalid approval records remain recovery-only; all1000 retained receipts and the oldest behind more than1000 deleted approval histories are covered. Trusted canonical Git metadata is inserted only for the four requested known tools during agent assignment; unknown tool references retain their foreign-key behavior. OpenAPI documents the inventory endpoint; seven contract checks pass.

The final UI correction has independent source approval and105 focused passing tests. It restores current receipt truth with the rail hidden, refuses forged approval authority, releases only its own rejected admission latch, permits explicit closed-record deletion, prevents stale Project/session responses and mounts at most ten receipt cards across message and recovery history. User-visible current expiry/cancellation and oldest/latest paging are tested. These changes close GD-CHAT-UI01–03; earlier pending-review statements describe historical checkpoints.

Connected native success and real-backend-restart unknown recovery passed in attempt2; denial passed the separately corrected attempt3, all zero retries. Exact ledgers prove one PR creation for success/unknown and zero Git/PR effect for denial, with model calls5/4/2 and no provider errors. Seven actual safe V1 reports were reviewed independently: scoped correlation, freshness, unique events, redaction canaries and no pending/dropped/conflicting/pruned or truncated data. The post-restart unknown report retains `unfinishedPriorProcess=true`, so it is not described as a clean completed prior process. Before/after63 historical events match and no mutation/model request is replayed. Native fixture errors in earlier count/text expectations remain retained; runtime behavior was not changed to satisfy them.

Full build/typecheck/lint/format/cycle gates pass on this application source. Browser attempt2 passes success and unknown; the separately corrected denial case passes after matching the full rejection paragraph. Fresh manual local/remote panel cases also pass in separate zero-retry runs. The existing browser suite passes31 with one pre-existing optional context prerequisite skip. All39 existing managed-app regression cases pass across38 initial cases plus one targeted12.9-second zero-retry rerun after the reviewed Hide panel Darwin baseline update; screenshot tolerances are unchanged. Normal push, current full mirrors and hosted checks remain pending; Linux visual qualification awaits its genuine hosted capture. Compose diagnostic export correctly denies403; actual diagnostic qualification comes from the managed native application, not a fabricated Compose report. These bounded fixtures do not establish live GitHub authentication, real model-provider behavior or distributed-release readiness.

### Integrated browser result and retained setup failures

All five Git browser cases now have passing zero-retry evidence on the same reviewed application images: chat success/unknown in `browser-chat-attempt2`, denial and remote panel in `integrated-panel-and-denial-final`, and local panel in `integrated-local-final`. These are distinct runs, not a claimed single five-case pass. Independent Git/SQLite/approval/gh ledgers verify exact reviewed commits, bare refs and PR fields; cancellation/denial/stale reviews cause no prohibited effect, and lost responses reconcile with one PR creation. The local fixture now accommodates two observed rate-limit windows within180seconds, retaining each61-second wait bound and every application assertion. No production limit, command deadline or mutation retry changed. The first combined local failure recorded actual429 during onboarding and cleanup; only its four owned records were later cleaned up and verified, with intended Project archival semantics preserved.

The separate existing-browser regression passes31/32, zero retries, with only the unchanged context test's explicit isolated-mount prerequisite skip. That case is not qualified by this run; five context/token managed-app regressions separately pass. An earlier coordinator-created stack mounted a different host root from the existing IDE/resource fixtures, producing five setup failures and nine unexecuted dependencies. The mount was corrected to this private worktree's fixture directory and the complete32-case inventory reran successfully within its declared prerequisite limits. Exact reviewed images are recorded in `browser-regression-runtime/receipt.json`; no application source was changed to mask those failures. Prior failed attempts, traces and owned cleanup evidence remain retained.

## Final local requirement-to-evidence handoff

Implementation source: pushed `093f7b963a7433fc68e4f0d8a006b48eea412ee0`; final task documentation and any later Linux-only visual correction must retain applicable source/evidence bindings. The full normal affected suites passed as recorded in `chat-commit-source.json`. The following map describes actual local evidence, not hosted or release acceptance.

| Scenarios  | Actual local evidence                                                                                                                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GD-T01/T02 | Contracts/DB and real-Git API suites; local browser final64.218s and fresh managed-app manual panel regression verify literal paths, full index, stale/cancel no effects, exact commit and unrelated work preservation.                                                                              |
| GD-T03/T04 | Remote API22 controls and controlled gh16 controls; browser remote117s plus fresh managed-app remote panel verify reviewed second push, exact PR fields and one lost-response creation/reconcile.                                                                                                    |
| GD-T05/T06 | Harness117 focused controls, actual SDK/API/Git45, web105; three browser and three native chat journeys verify four distinct approvals, denied no-effect and hidden-panel retained outcomes.                                                                                                         |
| GD-T07     | Actual API/dispatch controls enforce Project/session/operation identity, fresh mixed-permission block precedence, expiry and one-shot authority; no model-supplied approved flag/root/command.                                                                                                       |
| GD-T08/T09 | DB lifecycle/upgrade and real-Git/child-process/API controls; native unknown path stops and restarts the same backend database, preserves approvals/audit and never replays the mutation. Explicit human recovery/deletion and1000-record inventory/oldest paging controls pass.                     |
| GD-T10     | Component controls plus browser/local panel hide/show/reload and native hidden-rail backend restart; actual Darwin visual baseline reviewed, Linux visual pending genuine hosted capture.                                                                                                            |
| GD-T11     | Seven supported native V1 exports on success, waiting, denial and unknown-before/after-restart; durable/verified/nontruncated, no dropped/pending/conflicting/pruned events or privacy canaries. Unknown restart explicitly reports unfinished prior process.                                        |
| GD-T12     | All five Git browser cases and42 managed-fixture cases (39 existing plus three new chat) qualified across recorded distinct zero-retry runs. Existing browser regression31pass/1optional prerequisite skip; that skipped context case is unqualified, with separate managed context controls passed. |

CI, exact-head hosted Sonar/CodeQL/security findings/review threads and actual protected packaged VM are not inferred from these local counts. Retain failed attempts and diagnostic limitations. A default-suite external tracing403 observation is tracked separately in `agent-platform-test-telemetry-isolation`; future local commands disable process tracing before imports and explicit telemetry testing must use an owned endpoint. No production diagnostics or required gate is suppressed.

## PR329 quality repair checkpoint — 15 October 2026

Initial hosted head `e0df35f1` passed verify, Docker, documentation, cycles and GitGuardian, but
failed Sonar (17 critical, 24 major and 58 minor findings), browser discovery and Linux desktop
checks. Sourcery skipped because the diff exceeded its 20,000-line retrieval limit; this is not a
review pass. Raw failures remain in `pr329-ci-initial-failures.log` under the existing evidence root.

Independent reviews approved bounded complexity refactors, deterministic ordinal Git-path ordering,
unchanged approval/effect/recovery semantics, accessible receipt rendering and a private checked
Docker fixture directory with fixed host executables. GD-S01 further extracts the synchronous
approval claim and Git validation without adding an await or moving cleanup; its final 60 actual
SDK/HTTP/SQLite/Git tests pass. The estimated complexity is within the limit; only fresh hosted
Sonar can confirm clearance. No suppression, scanner exclusion, rule change or protection waiver
was introduced.

Browser discovery now selects `.spec.ts` journeys. The 22 Node fixture controls, including the
installed SDK check, run explicitly after the CI build and pass locally. Linux no longer attempts
the macOS-only caffeinate helper. The Linux screenshot baseline is the genuine captured image
from run38683875976/artifact11950280169, adding only the agreed Hide panel control; thresholds are
unchanged. A Project panel fixture now waits for bound-session send admission. Its three final
local cases pass, including merge resolution. The historical remote renderer connection refusal
has no confirmed cause; bounded startup metadata is captured without retries or a production fix.

Local qualification is deliberately split by source and invocation:

- Reviewed UI151, core76, harness114 and actual API60 tests pass; the final synchronous-claim
  extraction reran the API60. Full build/typecheck/lint/format/cycles pass, with final API
  build/typecheck/lint and strict seven-entry fixture typecheck separately passing.
- All five Git browser journeys pass without retries. The existing browser suite passes31 with
  one unchanged optional context-fixture prerequisite skip. These Docker images predate GD-S01;
  all other reviewed runtime bytes match, but the final router was not Docker-tested in that run.
  Final exact-head hosted browser qualification remains mandatory. Compose diagnostics correctly
  return intentional403 denials; they are not successful V1 exports.
- The broad managed-app run passes56 and fails two MCP fixtures because the coordinator invoked
  them from the repository root rather than the desktop package. Correct-cwd execution then passes
  all three MCP cases and all three final Git chat cases in one six-case, zero-retry run. All61
  managed-fixture scenarios have passing evidence across these distinct invocations, not one
  all-green broad run. The final three panel cases also pass separately after fixture corrections.
- Seven final native Git V1 exports cover success, denial and real backend restart. Independent
  review confirmed their exact final runtime binding, durability/privacy/no loss and conservative
  unknown state. Earlier seven-body review is retained; restarted unknown history explicitly
  retains `unfinishedPriorProcess=true`. Deterministic model/gh/SSH boundaries and node-double VM
  cases do not establish live-provider, release-artifact or protected real-VM qualification.

Evidence: `pr329-repair-source-freeze.json`, `pr329-final-repair-source-freeze.json`,
`pr329-browser-git-repaired`, `pr329-browser-regression`, `pr329-native-regression`,
`pr329-native-final-six`, `pr329-native-panel-final` and corresponding quality logs in
`/Users/letuscode/.codex/git-delivery-implementation-20261014`. Failed invocations, typecheck
configuration attempts and initial hosted failures are retained. Current source reviews are
bounded approvals; fresh exact-head Sonar, hosted browser/desktop/quality gates and review findings
remain pending. PR329 is open into `feature/git-delivery-mvp`; no merge readiness or task closure is
claimed. Final owner acceptance/merge authority remains reserved. Main, PR283 and paused
orchestration remain separate.

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
