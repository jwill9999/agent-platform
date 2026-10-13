# Disappearing replies — planning review and execution record

Task: `agent-platform-sizx`. Source reviewed: staging211916739642f5b095ba35100b3b452779969feb.
Documents: [plan](../planning/chat-reply-reliability.md), [spec](../tasks/agent-platform-sizx.md),
[verification](../testing/chat-reply-reliability.md).

## Planning evidence

Current source inspection confirms unconditional restoration replacement, final update by placeholder
ID, missing restoration readiness and incomplete old-operation guards. Existing tests cover parsing,
approvals and completed connected context journeys, not controlled restoration/submission interleavings.
Earlier bug evidence is retained under `/Users/letuscode/.codex/context-token-plan-20261013`; it was
not re-executed in this planning turn. No fresh product-test pass is claimed.

Docker29.8.0 reachable, Electron executable and Chromium cache present on macOS ARM64. Existing
managed-runtime provider/SQLite and browser diagnostic export fixtures inspected. This establishes
feasible provision, not that a current build or journey passed. No account, purchase or installation
is needed for the planned deterministic tests.

## Independent critique

Reviewer: distinct `runner_plan_critic`, using actual current source and the plan-critique skill.
The assignment is read-only responsibility, not technical tool isolation. Final verdict: **approved**, with no actionable findings, after correction recheck on13October.

| Finding | Evidence and disposition                                                                                                                                                                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-C01  | Saved Project requested-session reopen resets resume=false then selects a saved session without restoring it (page.tsx966,1045–1054). Added explicit saved-session entry-point correction to plan/spec/R1 and a real requested-session link/reopen regression to CR-T06. Rechecked and resolved by the critic. |

CR-C02 (low, final metadata recheck): replaced premature “receipts are recorded” wording with
“will be recorded when publication completes” in the review and session. This concerns publication
status only; implementation requirements and test map are unchanged.

## Implementation authorization and investigation

On 13 October the owner approved plan `34d6397b` and authorized bounded implementation, Beads,
critic review and the agreed browser, Electron and diagnostics checks. New merging/promotion remains
reserved. Implementation branch `task/chat-reply-reliability` chains from that planning tip into
`feature/chat-reply-reliability`; paused orchestration remains separate.

Before runtime edits, a production renderer/API/Electron baseline was built from unchanged runtime
`21191673`. Controlled delivery of an actual saved history response reproduced the defect in both
Chromium and Electron: the UI admitted a send, stale history replaced its optimistic message, the
provider completed, and SQLite contained exactly one final assistant that was absent from the UI.
Two successful reproduction assertions confirm the defect, not repaired acceptance. The source
receipt binds 420 baseline build artifacts. Both actual V1 reports were durable and verified with
zero dropped/pending events and a successful request; that is consistent with a UI lifecycle defect.
Diagnostic run success alone cannot establish a visible reply.

Evidence root: `/Users/letuscode/.codex/chat-reply-implementation-20261013`;
`baseline-build-source.json`, `baseline-first.log` and `baseline-first/` retain source, actual response
ordering, traces, screenshots, SQLite and safe diagnostic reports. No user conversations or paid
provider calls were used.

## Implemented behavior and source review

Restoration now reads history and approvals together, gates sending until both succeed, and uses a
15-second deadline with explicit safe failure and manual read-only retry. Each session selection,
layout epoch and admitted operation owns its publications. Stale streams are drained without replay
or cross-session state updates. Synchronous send/approval admission prevents same-tick duplicates;
callers clear drafts/attachments only after acceptance. Users can draft during restoration.

Saved Project links restore correctly. Caller navigation generations also guard asynchronous
selection/binding and later sensor/Project refreshes. Delayed or cancelled picker results cannot
replace a newer selection; the IDE's Change Project cancellation preserves its current conversation.
This remains a frontend lifecycle correction; provider protocols,
SQLite schemas, VM/security policy and paused orchestration are unchanged.

The existing Node Vitest environment remains unchanged. A single web test-only dependency,
`jsdom`28.1.0, supports mounted React19 lifecycle tests on the agreed Node24.14 runtime. Lockfile
peer bindings include the new optional test environment; no production dependency was introduced.

Distinct critic `runner_plan_critic` approved the runtime freeze after CR-I01–03 were corrected:

- CR-I01: delayed selection/binding/normalization/creation could select an old conversation.
  Added navigation ownership checks and guarded refresh publication.
- CR-I02: opening the native picker could permit old-Project auto-binding in the same selection.
  Preserve the old conversation while pending and explicitly bind the chosen Project.
- CR-I03: post-bind dialog updates needed another ownership check after the await. Added it.

The source freeze approval is recorded in `runtime-freeze-review.json`; it is not final connected,
hosted or merge qualification. Read-only assignments are procedural, not technical tool isolation.

## Initial source verification

- Baseline: two successful reproduction assertions (Chromium and Electron) confirmed the defect
  against unchanged runtime21191673, before any runtime repair.
- Fixed connected matrix: **18 passed, zero failed/skipped**, nine Chromium and nine source-tree
  Electron cases in one terminal run (3.0 minutes), on one frozen runtime/build. The receipt binds
  source hashes, 420 build artifacts, traces, screenshots, SQLite snapshots and actual reports.
- Normal Docker browser: **one passed**, including teardown, with retained JSON, screenshot,
  trace ZIP and SQLite backup. This uses the real isolated Compose API/BFF/SQLite and a loopback
  provider. It is separate from the native managed-runtime diagnostic-export topology.
- Mounted Home/IDE/hook/composer: **35 passed** across four files (Home9, IDE5, hook18, composer3).
  Actual HomePage and hook run with deferred boundary calls; IDE uses its actual caller/input and a
  mocked hook admission boundary. Connected IDE sending is not claimed. The normal affected-package push gates
  passed412 assertions: web259 across44 files and desktop153 across22 files, zero failed/skipped.
  Earlier web245 results remain retained before the14 new caller tests.
- Full repository typecheck, lint, formatting and cycle check passed. Cycle analysis reported81
  resolution warnings and no cycles. Direct strict TypeScript checks cover the five new desktop E2E
  files that are outside the normal desktop source tsconfig. Scoped test lint/format also passed.
- Eight unchanged adjacent connected regressions passed (context/token5; MCP stdio/HTTP/unknown3),
  zero failed/skipped, in1.0 minute from the required desktop working directory. Normal cumulative
  build/typecheck/test/cycle push hooks passed on implementation commit `699f39c8`; hosted checks
  remain a separate pending gate at this source checkpoint.

Evidence: `connected-final-receipt.json`, `fixed-fourth-full.log`, `fixed-fourth-full/`,
`fixed-build-source.json`, `caller-mounted-final-receipt.json`, `local-quality-checkpoint.json` and
`docker-browser/captured-artifacts/` under the evidence root above. No test timeout, product policy
or required assertion was waived. Source-bound receipts distinguish the uncommitted runtime hashes
used for testing from the eventual commit that carries those exact bytes.

## Diagnostic review and retained findings

Ten complete actual V1 exports cover successful replies, admitted provider failures, approval/denial
and context-limit refusal. Browser downloads and Electron SaveAs exports match the selected session
and actual chat/resume response request IDs. Every export has durable, verified, untruncated coverage,
zero pending/dropped/conflict counters and tested prompt/credential/path canaries absent. Provider
call counts and safe tool effects are independently checked; UI visibility is established by actual
Playwright assertions and SQLite comparisons, not by diagnostic success alone.

The failure reports explain the deliberately injected provider error and context refusal. Restoration
GET failures/timeouts happen before chat admission: wire/provider/SQLite checks prove no run/effect;
absence of a run report is not used as proof. Late operations may still complete in their original
session; navigation is not advertised as server cancellation. No additional product finding arose from those initial diagnostic exports. Subsequent combined and
hosted checks exposed the cold Project binding race described below; later source changes require
fresh connected qualification rather than inheriting the initial freeze. These controlled samples do not establish a latency benchmark.

Distinct critic `runner_plan_critic` independently verified all136 connected artifact hashes,
readable traces/SQLite, current test-source hashes and all10 exports, approving the connected evidence
with no findings. CR-Q01 added explicit final-reply visibility alongside uniqueness; CR-Q02 made
fixture teardown independent so one failure cannot skip other cleanup. Final Docker evidence is also independently approved: all four retained artifact hashes/sizes,
trace integrity and actual SQLite rows match; POST/provider counts are one with no fixture error.
Adjacent regressions have `adjacent-native-receipt.json`; source review does not imply hosted qualification.

Earlier failures remain available with dispositions:

- The first adjacent run was invoked from repository root instead of the desktop package required
  by its existing relative stdio fixture path. Six cases passed and two failed before chat; all eight
  passed from the correct directory with unchanged test source, timeouts and assertions.
- Automatic/manual Playwright tracing collided before a product assertion. The test now owns and
  retains its explicit trace; no loss of the required capture.
- A stale-operation fixture selected Sessions while it was intentionally disabled during streaming.
  It now uses the available Workspaces/recent-Project navigation before selecting B.
- The rejection fixture expected a Reject button rather than the existing Deny label, then omitted
  the intentional live APPROVAL_REJECTED notice. Exact live combined text, exact persisted model text
  and exact reopened text are now all checked. The recorded denied action had zero effects.
- Docker initially timed out before compilation; read-only engine/builder checks and one bounded
  retry built successfully. Cause is not established. Fixture setup then corrected required execution
  limits, a synthetic stored model key, A-only held reads after B readiness and the actual chat route.
- Repeated Docker setup attempts exhausted the existing rate window during teardown. Only the owned
  API was reset and known fixture records removed with verified responses; fresh terminal tests,
  including cleanup, passed. The final capture stores path-based artifacts that survive successful runs.

No user conversations, paid model calls, Docker pruning or unrelated service changes were used.
Deterministic provider fixtures and source-tree Electron do not qualify live providers, a distributed
release artifact or the protected staging packaged-VM job. Those delivery gates remain separate.

## Hosted review and cumulative-regression repairs

PR314 targets `feature/chat-reply-reliability`. Its initial head `5f09ac45` passed build/unit,
Docker-build, documentation, cycle and secret checks. Sonar's badge and overall gate were green,
but the detailed issue API reported seven open findings, including two critical complexity issues.
The source repair extracts focused journey cleanup/capture helpers and requested-session lookup,
uses an async creation function rather than nested promises, simplifies restoration-status selection,
and uses the native status output element. No scanner rule or assertion was suppressed.
Independent source review approved these bounded changes; current-head hosted analysis remains required.

The normal Docker test review also found shared fixture provider port11434 between context, reply
and MCP suites. The reviewed configuration sequences Chromium → chat-reply → MCP while retaining
all31 discovered cases exactly once. A dependency-enabled run initially exposed an isolated mount
mistake: older workspace tests need their conventional worktree directory at `/workspace`, while
context uses a separate `/context-projects` mount. With both mounts corrected, Chromium23 and the
reply case passed, but MCP's initial Project binding stalled before any model call. No fixture or
production rate limit was weakened.

A deterministic mounted reproduction then proved the caller race: agents can become available while
a Project's saved-session lookup is still pending; clearing only a ref at the end does not trigger
the skipped fallback binding. A deferred, Project-and-generation-owned binding handles this ordering
only after lookup confirms no saved session. Competing navigation invalidates it, and binding failure
does not enqueue an automatic retry. This is within CR-T06's existing Project entry-point scope.

The initial hosted run independently showed four MCP initial-binding failures, plus one desktop
Project-access failure because the new generic composer label replaced the existing contextual
accessible name. The composer now preserves that name. At that checkpoint the Project-access test
was unchanged; the later fixture isolation is described below. One existing provider HTTP transient-retry case first hit JSON EOF and passed its normal
retry; its cause is not established. The existence-before-parse fixture gap is tracked separately in
[diagnostic export file readiness](../tasks/agent-platform-diagnostic-export-file-read.md), with
`discovered-from` provenance rather than a new scope or blocking edge. Initial hosted desktop totals were53 passed, one flaky and one
failed; browser totals were26 passed, four failed and one pre-existing context skip. These are retained
failures, not a passing final gate. Fresh source-bound connected and hosted qualification follows.

## Repaired-source qualification

The first cumulative runtime/source repair passed42 mounted tests (Home15, hook18, IDE5, composer4),
web typecheck, scoped ESLint and formatting. This includes agents-before/after-lookup, saved custom
agent restoration, navigation invalidation, exactly one binding and no automatic retry after failure.
The critic approved the exact runtime/test hashes in `final-repair-source-review.json`.

A fresh Docker image then passed the complete31-case suite with zero failures, skips or flaky cases
in68.827seconds: Chromium23 with context enabled, reply1, and all seven MCP cases including five chat
permission/effect modes. The dependency-enabled run preserves both workspace mounts and executes
all original assertions; the four previously failing cold Project paths now complete. Receipt
`docker-browser/final-full-verification.json` binds43 retained artifacts and actual project intervals;
owned Compose services were removed with verified cleanup.

The repaired runtime then passed a fresh18-case matrix, nine Chromium and nine Electron, zero
failures/skips in3.9minutes. All ten actual V1 exports again passed request/session linkage, durable
coverage and privacy checks, with independent visible-reply/SQLite/effect assertions. New420-artifact
build receipt `final-repair-build-source.json` and frozen `final-repair-connected-receipt.json`
(SHA-256 `55f1cbe0011ecdf41132e8338117e384e5ce0e7465f94579d129b1e411a88658`)
qualify this repaired source rather than reusing the initial runtime freeze. The unchanged adjacent
Project/context/MCP suite and exact-head hosted analysis remain pending at this checkpoint.

The subsequent expanded adjacent suite passed nine of ten cases. Its first Project-access case
failed the existing five-second Personal-session poll. A bounded instrumented run retained the
original assertions and captured a real creation POST returning201 after4.44seconds, followed by
the correct SQLite session. There were no page errors. The fixture lived inside the source checkout
and inherited its Git root and remote; synchronous GitHub checks are an existing issue,
`agent-platform-d185`, updated with this evidence. The observed delay supports interference, but
does not establish a sole cause. The failed run and instrumentation remain in
`final-repair-adjacent-failed-receipt.json` and `project-access-instrumented-receipt.json`.

Separate mounted controls proved that selecting Personal chat again cleared a completed or pending
conversation without replacement. Current-Personal navigation is now idempotent, while explicit
New conversation remains separate. Completed, pending and resumed repeat controls plus explicit-new
creation pass:46 mounted tests in total, with typecheck/lint/format passing. The critic approved page
hash `75e44aa8` and its exact test source. This defect is not claimed as the adjacent timeout's cause.
The reviewed fixture correction uses external owned temporary directories, preserving explicit Git
and no-Git behavior. Additive probes verify the first Project's own Git root and empty remotes, and
the other two Projects' genuine no-Git state. An AST comparison confirms all342 original assertions
remain in order. A local type alias matches Playwright's existing file-input shape; redundant CI
properties are removed because the preceding environment spread already preserves the same value
or absence. Strict TypeScript, lint, formatting and independent source review pass. No product
endpoint, existing assertion or timeout changed.

On final page source `75e44aa8`, the fresh Docker matrix passed31/31 with zero failures, skips or
flaky cases in44.339seconds. The critic verified all43 artifact hashes and nonoverlapping project
intervals in `docker-browser/personal-nav-full-verification.json` (SHA-256
`7d56233239cba3cfb1ded57afe3e08ed14419a0d1bde314e6747dd1a68944476`). Owned services were cleaned up.
The same final source then passed all ten adjacent Electron regressions in1.3minutes, zero failures
or skips: Project access2, context5 and MCP3. The formerly failing Project journey completed all its
original assertions and the new isolation probes. Receipt `final-isolated-adjacent-receipt.json`
(SHA-256 `c4b5c08bda616f5d8670c745f14caf898db479ae4b242b4a87d0f39a91c5fca3`) binds45 artifacts
and the same420-artifact build. This qualifies the isolated fixture, not a fix for `agent-platform-d185`.
The final managed reply matrix also passed18/18, zero failures or skips in3.0minutes: nine Chromium
and nine Electron cases. All ten fresh V1 exports again match their actual request/session IDs,
durable verified coverage and privacy assertions; visible replies, SQLite contents, provider calls
and tool effects are checked independently. `final-isolated-connected-receipt.json` (SHA-256
`15186c28a83297b1bd9647d28ccd544dfb469d818e41135a8825cc768fe14471`) and
`final-isolated-build-source.json` bind the final source and420 build artifacts. These final receipts
supersede earlier source checkpoints for current local qualification; they do not erase failed
attempts or qualify a future different source. New exact-head hosted analysis remains required.

The complete final local evidence and four changed documents passed independent review. Normal
commit/push hooks passed build/typecheck/cycles and423 package tests (web270, desktop153) at
`ed63db14`; four full changed Notion bodies and source metadata were verified in
`repair-publication-ed63.json`. Fresh hosted Sonar cleared all seven prior issues, but reported a
new critical `typescript:S4123` on optional undefined entries passed to the cleanup aggregator.
The overall green badge is not treated as clearance. The corrected helper filters only undefined
entries before awaiting the real cleanup promises. Three controls execute the actual helper source
and verify undefined-only input, mixed rejection ordering and independently delayed settlement;
strict TypeScript, lint and formatting pass. Independent review approved its exact source without
changing application behavior or cleanup error collection.

The first representative Electron run reached its reply assertions but failed the diagnostic-export
success-status assertion before cleanup began. It retained a generic native preparation error and
two durable rows; that evidence does not establish the transport status or cause. One bounded
follow-up added only temporary transport/store capture in cleanup, retaining every assertion and
timeout. It passed1/1 in40.1seconds, including two full V1 reports, HTTP200 responses,16 durable
events/12 session events, zero dropped events and successful cleanup. Instrumentation was restored
to exact reviewed helper hash `5d3be44b`;420 current build hashes were unchanged during this run.
Both outcomes remain in `s4123-cleanup-repair-receipt.json` (SHA-256
`d725e45608097c88c282cc27fe8c3ed681c6b96f015bb2f9d86524acf614d9e1`). A successful retry does not
prove the earlier cause or silently repair diagnostic reliability. The unresolved sample is retained
for diagnostics follow-up; no product timeout or assertion was weakened. Earlier complete application
evidence remains bound to its recorded source; new exact-head hosted analysis is still mandatory.

The owner has now accepted the reviewed changes and authorized PR314's merge into its existing
feature destination after all current checks and findings clear, including routine repairs. No
staging/main promotion or paused-work integration is inferred.

## Final hosted diagnostic-export fixture repair

At `1ef391d3`, actual Sonar analysis reports zero open issues and every quality condition passes.
CodeQL and review threads are clear. Hosted verification and browser jobs pass; browser reports30
passed and one existing context-environment skip, distinct from the dedicated local31-case pass.
Electron reports54 passed and one failed diagnostic-export test, including its normal retry.

The fixture treated textarea editability as submission readiness. During restoration the app allows
editing but correctly refuses submission. An instrumented reproduction retained one empty Personal
session, zero messages/events and a native404 response in21ms. The hosted screenshot likewise shows
an empty conversation. `diagnostic-export-empty-session-diagnosis.json` binds this evidence. It does
not establish a slow connection, a flush timeout or the cause of the earlier two-event preparation
failure; that separate sample remains open in the observability follow-up.

The bounded fixture correction waits for session readiness before filling, enabled Send before
Enter, and the actual deterministic completed reply before export in Electron and browser. All
original assertions and timeouts remain. Removing the redundant explicit CI environment property
preserves the existing process environment while satisfying strict TypeScript. Scoped typecheck,
lint and formatting pass; the actual focused journey passes1/1 in30.9seconds, including native and
browser exports, cancellation, failure/partial handling and restart. Independent source review
approved the exact fixture hash `4b6e64a7`; new exact-head hosted qualification remains mandatory.

`diagnostic-export-repair-receipt.json` (SHA-256
`a930048ddb1f5063ac73cf4a630eaa883bc502c730461644b2196d7cc0454986`) binds the fixture and420
unchanged build artifacts. All34 original assertions remain in order, with seven additive controls.
Three full V1 reports each contain five events, durable verified coverage and zero dropped/pending
or truncated data. The backend-unavailable partial report has zero events and explicitly reports
non-durable, unverified coverage. Tested private-data canaries are absent from all four reports.

Source review also identified an unproven initial null-to-bound session draft-remount concern.
The independent critic confirmed that CR-R3 covers same-session refusal, while this separate edge
needs a controlled reproduction. It is recorded in
[the investigation task](../tasks/agent-platform-initial-session-draft.md); no product change or
confirmed defect is claimed for it here.

## Controlled restoration fixture navigation boundary

Revision `61828f33` passed actual Sonar with zero issues, hosted verification and browser checks.
The repaired diagnostic-export journey passed. Electron's remaining failure was CR-T01 Chromium:
Send became enabled and a POST was observed while the test believed restoration reads were held.
The run reports 54 passed/one failed, including the ordinary retry, and remains a failed gate.

The downloaded manual traces establish the fixture ordering on both attempts. Its initial Chromium
navigation had not finished restoration before the scenario installed one-shot GET barriers and
navigated again. Requests from the outgoing page consumed the holds and ended with
`net::ERR_ABORTED`. The active document's later history/approval pair was forwarded and returned 200,
so the application legitimately became ready. The first attempt's POST preceded the obsolete
approval hold's release. This is recorded in `pr314-6182-held-read-trace-diagnosis.json` (SHA-256
`185dd30aa32e216db5b73843f18447f5aa3047fa8b6e879e3ff961084c626c37`), not inferred from a green badge.

The bounded helper correction awaits initial Chromium session readiness before scenario-specific
barriers are installed. Their one-shot behavior and all assertions/timeouts remain intact, including
stale-generation tests. Product code and build artifacts are unchanged. Strict TypeScript, lint,
formatting and diff checks pass. The corrected full connected matrix passes all 18 cases in 5.8 minutes
with zero failures or skips. Its 10 schema-valid V1 diagnostic reports are durable and verified, with
zero dropped, pending or truncated events. Both Chromium and Electron traces show exactly two active
successful restoration reads, with both held responses fulfilled before the first POST. The receipt
`held-read-repair-connected-receipt.json` (SHA-256
`ae483b651f2dd9d5f644f5fced5a9ea47141e16f6237873c07ba5bdd61259507`) binds 137 evidence artifacts and
420 unchanged build artifacts. These deterministic-provider journeys qualify the local fixture
correction; new exact-head hosted checks and review still precede the authorized feature merge.

## Publication and completion boundary

Planning publication is complete at `34d6397b`: five full mirrors/readbacks, normal hooks and Dolt
sync are retained in `/Users/letuscode/.codex/chat-reply-plan-20261013/publication.json`. Implementation
publication follows the pushed implementation `699f39c8` and binds the final documentation revision
and all five changed full bodies; historical pages
and human notes remain intact. Beads stays in progress through its owner-authorized integration gate.
All five initial implementation mirrors were read back at `5f09ac45` (receipt `publication.json`).
PR314 is open; no merge or task closure is claimed. Later substantive changes require updated full
mirrors and source-bound readbacks. Final hosted results and publication receipts are recorded in
Beads against the actual revision; opening a PR does not establish qualification.

## Protected staging qualification and adjacent fixture correction

The previous sections are historical qualification checkpoints. PR314 subsequently merged at
`60b6e36c` with the exact reviewed tree, nine successful executed checks, clean55-test Electron
qualification and no unresolved findings. The owner separately authorized PR315 staging promotion
and delivered-branch cleanup. Beads was reopened for that additional delivery phase.

PR315's initial ordinary scan performed actual analysis with no reported vulnerabilities. Sonar and
CodeQL are clear. All19 actual packaged macOS VM tests passed with signature/ready-VM/user-exposure
evidence verified. These results do not erase its failed diagnostic benchmark: repetition3 had
healthy p9573.268ms versus disabled16.425ms, a56.843ms overhead above20ms. Other275 API tests passed;
allnine measurements were retained with `completed=false`. No cause is established. The critic
approved one unchanged failed verify-job retry, preserving workload, thresholds and the first failure.

The desktop job badge was successful, but its detailed log reports53 passed and two flaky cases:
provider-HTTP approve/reject journeys with reload recovery. The reject case did not show `/init`
after Enter; source review found the helper does not wait for the bound session and enabled Send.
CR-Q03 requires the same readiness sequence already qualified in the diagnostic-export fixture.
The approve case did not create `finished-diagnostics.json` within5000ms. Absence alone does not
establish whether export preparation, transport, destination or writing failed. No hosted desktop
traces were uploaded because the final job succeeded; original logs are retained in
`pr315-desktop-attempt1.log` and summarized by `pr315-desktop-flaky-triage.json`.

The bounded task branch `task/chat-reply-staging-fixture` starts from the delivered feature source.
The helper now waits for the ready-session status before drafting and enabled Send before Enter;
product runtime and all existing assertions/timeouts are unchanged. The instrumented affected
approve/reject reload journeys passed2/2. Allfour native report responses wereHTTP200: waiting
reports took164/165ms and finished reports5ms each. Selected events grew10-to-21 for approve and
10-to-19 for reject, matching the local diagnostic store; durable verified coverage, zero dropped
or pending events and no truncation were retained. Both destinations existed and exactlytwo save
destinations were consumed per case. This does not establish the original hosted cause. That
unknown sample remains recorded in `agent-platform-llm-observability-export`; a repeat symptom
requires further investigation. Temporary observation code was removed before final qualification. New exact-head feature and protected staging checks remain mandatory before
merge. Current receipts and subsequent delivery state are recorded against the actual revision in
Beads; the old green job badge is not a clean first-attempt desktop result.

The final uninstrumented affected two-case run passed2/2 in13.0seconds, with no failures, retries or
skips. Strict TypeScript, ESLint, formatting and diff checks pass. Receipt
`pr315-packaged-fixture-receipt.json` (SHA-256
`0488a2ba2fd67cf70fe3038aa9652e7825871454f86eb557b21674f2b8f28abe`) binds all30 artifacts,
four schema-valid final V1 reports and420 unchanged build files. The independent critic approved
source hash `cc1a4aa40b652a51a84fb78456405156a941db355b54c2b030d6846313d9f004` with no findings.

The unchanged verify retry failed a different test: the actual diagnostic database ceiling test
reached its60-second timeout;142 other DB tests passed. The API benchmark did not run in that
attempt. The first run's identical capacity test passed in33seconds. Both failed attempts are
retained; no hosted root cause or successful benchmark retry is claimed. The independently reviewed
CI-only correction serializes workspace and file execution using the installed Vitest2.1.9 CLI. All
fifteen workspace test scripts, including workflow-control's build prerequisite, remain selected.
The full physical workload,60-second test deadline and benchmark20ms/2ms limits are unchanged. This
reduces competing test load without proving the original hosted cause. The exact complete serial
command passed3005 tests with77 existing optional skips across all15 workspaces in557.53seconds.
The DB suite passed143/143, including the unchanged capacity test in19.733seconds; API276/276 passed.
The benchmark records `completed=true`, allnine samples,900 measured requests and90 warmups under
the original20ms request-overhead and2ms enqueue limits. Healthy overheads were -0.772ms,1.167ms
and1.019ms; healthy retained660 events per repetition with zero drops. Locked-store loss remains
explicit:404,404 and418 events. The maximum enqueue p95 was0.006666ms. Existing production build
and worker source remained unchanged. Local execution fits the existing30-minute job budget, but
actual hosted duration and all new-head gates still require qualification. Full logs, source/test
inventory and measurements are retained in the `pr315-serial-` evidence files.

## Refreshed staging evidence and retry artifact retention

PR316 merged at `98efcd6c` after allnine executed checks passed on `226fc1a4`; feature Electron
passed55/55 without flaky retries, and benchmark `completed=true`. The feature tree and staging
rehearsal equal the reviewed source. PR315's fresh ordinary scan38442728388/job115453155522 performed
actual analysis with no findings. Download ZIP SHA-256
`ad12d8da3d25057895e99ecf7bcd053c01f78bf1aea6a930f4948105a19546e9` and all member/proof/SARIF
bindings were independently verified. Sonar has zero open issues, scoped CodeQL is clear. Actual VM
job115453157185 passed19 tests; ZIP SHA-256
`77d86642bcb79f192d74f21c5ae8fa3489f153fe82f0bbb8fccf4d6f00c4c96f` binds the verified signature,
ready VM, manifests and tested host-path/secret non-exposure. These are CI development checks,
not release signing/notarization; scanner built-in omissions remain disclosed.

The hosted serial inventory passed3005 tests with77 existing optional skips in15 packages. The
physical test file completed in28.066seconds, retaining its original deadlines. Benchmark artifact
SHA-256 `1a082876f8798c7f7e28262107f9688896b73b71c0825990f20e179a9198d486` has `completed=true`
and allnine samples under the original20ms/2ms limits. Actual logs and source-bound receipts remain
in the `pr315-*-98ef` evidence files. Passing these gates does not erase the desktop observations.

Desktop job115453157230 passed54 cases and retried one diagnostics-export case: its health probe did
not observe connection refusal within5000ms after SIGTERM to the proven owned API child. No hosted
trace was uploaded because the final job was green. The unchanged instrumented local case passed
1/1 first attempt in7.9seconds, with unique owned listener before signal, first health refusal in1ms,
old PID subsequently gone and the expected deliberately restarted child. All original partial-export,
privacy and durable-history assertions passed. Shutdown logs were unavailable at the probed location;
no absence-of-logging claim or exact Linux failure cause follows. Temporary instrumentation was removed
and source restored exactly. Receipt `pr315-shutdown-probe-receipt.json` SHA-256
`a2d19d412e258ec99ad53270c0360643455f0213aa124d3e385ea936420f6056` records this bounded evidence.

The independent critic approved one unchanged hosted desktop-job rerun, requiring a clean result.
Job115460532545 passed the shutdown case but reported54 passes and a different first-attempt120-second
timeout in CR-T01/02/06/07 Chromium restoration. Its log supplies no awaited-stage stack, and again
failure-only uploads lost first-attempt evidence. The exact cause remains unknown. No further
unchanged rerun is authorized by this diagnostic disposition; existing14 green check badges do not
qualify this desktop result. Both observations are retained in the open observability epic.

Independent source critique approved a bounded evidence correction: always upload the two existing
Electron report/results paths, retaining their existing contents and retention policy, and record
safe incremental fixture-stage progress before startup/restoration/scenario/export/cleanup waits.
Manual tracing ownership remains unchanged. This changes test observability, not application
behavior, test assertions, deadlines, retry policy or scanner rules. Fresh source review, focused
verification, full documentation readbacks and hosted checks remain required. Later actual results
are recorded below and in Beads; old-head successes do not qualify a changed head.

Focused verification of the final progress helper passed the original Chromium restoration journey
1/1 in10.6seconds without retries or skips. Its37 safe progress records end with completed journey,
process cleanup and provider cleanup; both actual V1 diagnostic reports are schema-valid, and all
existing success/failure/correlation/privacy assertions passed. Two source-backed controls passed
for the128-entry bound/omission reporting and write-failure handling without cleanup interruption.
Strict TypeScript, lint, formatting and diff checks pass. Receipt `ci-evidence-helper-receipt.json`
SHA-256 `38a95fdf26a43b624a9b011dbab2b42f4b6543bd3cb6d52f6b2a7250b57e439f` binds source,
artifacts and420 unchanged production build files. No original hosted cause is claimed.
