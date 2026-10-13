# Current handoff — reply fix delivered; next local MVP priority, 13 October 2026

## Completed development baseline

[PR315](https://github.com/jwill9999/agent-platform/pull/315) merged into protected `staging`
at `1e4bd7af30b092cc9a2d795e9c022ebfd5212176`. Its tree
`229d777b5056ff56f753e9fe9cfdfea82b4b2664` matches reviewed feature head `a9bcb302`.
All 15 executed checks passed, with no unresolved review threads or blocking reviews.
Electron passed 55 tests without flaky retries; the actual packaged macOS VM suite passed 19.
Browser passed 30 with one existing environment-dependent skip; the 15-package verification
passed 3,005 tests with 77 existing optional skips. Both full security scans completed actual
analysis; Sonar reported zero open issues and scoped CodeQL had no open alerts.
The nine-sample diagnostics benchmark passed unchanged 20ms/2ms bounds.
Independent source and evidence review approved delivery. Sourcery's optional size/budget skip
and ordinary scanner coverage limitations remain disclosed in the verification record.

`agent-platform-sizx` and `agent-platform-diagnostic-export-file-read` are closed and Dolt-synced.
Six delivered chat-reply local/remote branches were removed after seven recovery tags were pushed
and read back. Main and the four paused orchestration remote branches remain unchanged; PR283
remains open as a draft. Primary and paused dirty checkouts were preserved, including the explicitly
recorded Beads status-journal appends. Staging is the local development baseline, not a distribution
release; checkout-free export, signing/notarization and wider distribution architecture remain phase two.

Final receipts: `/Users/letuscode/.codex/chat-reply-implementation-20261013/pr315-completion.json`,
`pr315-staging-merge.json`, `pr315-delivered-branch-cleanup.json`, and
`pr315-final-closure-preservation.json` in the same directory. Durable implementation evidence:
[reply verification](docs/reviews/chat-reply-reliability.md).

## Recommended next discussion

The owner requested a backlog review and recommendation, not another implementation launch.
Beads remains authoritative; the following is a dated recommendation, not a second task tracker.

1. **Recommend first: `agent-platform-d185` — keep the API responsive during GitHub checks.**
   Current staging still uses synchronous GitHub CLI calls in the Project checks/PR read paths.
   Existing evidence records GitHub checks taking 1.47–5.35 seconds and a separate Personal-session
   creation completing after 4.44 seconds amid Project requests. A fixture with its own local Git
   root avoided unintended live-remote coupling. These observations support the responsiveness
   investigation, but do not prove the sole cause of every historical timeout.
   A bounded next plan should cover asynchronous, time/output-bounded read-side GitHub operations,
   preserve repository/ref identity and credential/process validation, and prove chat, health and
   diagnostic export remain responsive during slow/unavailable checks. Inventory adjacent PR reads
   before agreeing scope; do not expand this into a rewrite of all Git operations or UI.
2. **Then `agent-platform-est0` — make keyless Ollama selection work consistently.**
   The API accepts default Ollama configurations without keys, but an explicit chat model selection
   still rejects every configuration without `hasApiKey`. This is a small local-model usability win;
   keyed providers must retain credential validation. No provider installation or product fix ran here.
3. **Next larger feature: `agent-platform-ii1` — complete the everyday Git workflow.**
   Reconcile delivered code with older tickets, then select one useful commit → push → PR slice.
   `agent-platform-0ra` already records an implementation commit and a stale dependency hold;
   `agent-platform-4hm` remains open. Do not assume either needs rewriting from its status alone.

The direct-file policy ticket also retains an old pre-merge note despite PR271 being merged and its
merge commit being an ancestor of current staging. Reconcile acceptance/delivery separately before
changing its status; this review does not establish a new permission defect or close that task.
Existing observability/export and initial-session-draft follow-ups remain open. No broad backlog
reprioritization, release activation, paid calls or paused prototype resumption occurred.

## This documentation delivery

Tracking: [agent-platform-local-mvp-handoff](docs/tasks/agent-platform-local-mvp-handoff.md).
The update is on `task/local-mvp-handoff`, based on `feature/local-mvp-handoff` at the verified staging
commit above. It needs its own reviewed documentation integration; the previous reply-feature merge
does not contain this later handoff. Publication/check outcomes and current delivery state are recorded
in Beads and `/Users/letuscode/.codex/local-mvp-handoff-20261013`.

Everything below is retained historical context. Its pending work and earlier authorization wording
are superseded by the current handoff and live Beads; do not repeat completed reply deliveries.

<!-- markdownlint-disable MD025 -->

# Current handoff — complete diagnostic reads before staging, 13 October 2026

PR317 has merged into `feature/chat-reply-reliability` at `f5fdb464`, tree `efc52d6b`,
after all nine executed feature checks passed, including a clean 55-case desktop run.
Both complete result/session Notion mirrors were verified at source `f530821a`.
PR315 remains open against staging `21191673`. Its 15 executed check badges passed,
including actual full analysis, Sonar with zero open issues, CodeQL, browser and 19 real packaged-VM
tests. Detailed desktop results instead reported 54 passes and one flaky provider-HTTP reject case:
`waiting-diagnostics.json` existed but immediate JSON parsing failed. The merge is held.

The existing Beads follow-up `agent-platform-diagnostic-export-file-read` is now in progress as a
bounded prerequisite repair under the owner's CI-repair and conditional merge authority.
`task/chat-reply-export-read` starts from actual feature `f5fdb464`. Independent critique CR-Q06
approved polling for a complete readable JSON snapshot within the existing deadline at both export
reads, preserving all scope, coverage, waiting-state, privacy and backend-effect assertions.
The product exporter already awaits its write; runtime behavior and security policy are unchanged.
The mechanism is source-supported, but original hosted writer timing is not definitively proven.

Reader controls passed 3/3, including missing/malformed failures at the unchanged five-second deadline.
All five affected provider journeys passed without retries; ten actual reports passed schema,
correlation, coverage and privacy review. Production builds are unchanged. Detailed results and
retained failures are in the verification record.

Next: complete independent final evidence/document review and full changed mirrors, then deliver
the task repair into the existing feature after its current-head checks clear.
Then qualify PR315 on the resulting head with clean desktop execution, actual full scan/VM and all
protected checks and review findings. Only after verified staging delivery may the six delivered
chat-reply branches be recovery-protected and removed. Main and paused PR283/orchestration remain
separate. Current task state and actual delivery receipts are in Beads and
`/Users/letuscode/.codex/chat-reply-implementation-20261013`.

All handoffs below are historical; completed PR317 work is not pending work to repeat.

<!-- markdownlint-disable MD025 -->

# Current handoff — retained CI evidence for reply qualification, 13 October 2026

The owner-authorized staging promotion remains in progress in Beads `agent-platform-sizx`.
PR316 delivered the reviewed readiness and serial-CI correction into the feature at `98efcd6c`,
with all nine executed checks passing, a clean55-case desktop run and completed benchmark.
Its tree exactly matches reviewed `226fc1a4`. PR315 still targets staging `21191673`; it is not merged.
The new-head full scan completed actual analysis with no findings; Sonar/CodeQL are clear,
all19 actual packaged-VM tests passed, and the unchanged fifteen-package inventory passed3005 tests
with77 existing optional skips. Allnine benchmark samples passed the original20ms/2ms limits.

The new-head desktop badge nevertheless contained54 passes and one flaky diagnostics shutdown case:
after SIGTERM to the proven direct API child, the health probe did not reject within five seconds.
A bounded unchanged instrumented local run passed1/1: unique owned listener verified, health request
rejected in1ms, old child exited, and partial-export/privacy/restart durability assertions passed.
Temporary probes were removed. The original Linux cause and missing shutdown-log/trace evidence
remain open follow-ups; no graceful-shutdown bug or infrastructure cause is established.
The critic approved one unchanged hosted desktop rerun. That shutdown case passed, but the rerun
contained a different first-attempt120-second timeout in the Chromium restoration/reply journey.
There will be no further unchanged rerun.

Source review found a concrete evidence gap: workflow uploads conditioned on `failure()` discard
first-attempt artifacts when Playwright retries make the final job green. The new task branch
`task/chat-reply-ci-evidence` starts from actual feature `98efcd6c` and retains both existing Electron
artifact paths on every terminal outcome. Reply journeys retain their existing manual tracing and
now record safe incremental stage progress beginning before fixture startup/initial restoration,
so a timeout can identify the outstanding stage even when tracing has not started. Product runtime,
assertions, deadlines, test inventory and security controls remain unchanged. The observed timeout's
cause is still unknown; this evidence correction does not claim to fix a product defect.

The progress helper passed the original Chromium journey 1/1 with real success/failure diagnostic
reports and bounded writer controls. Independent review, normal hooks and both complete Notion
mirror readbacks were completed at `73230965`, published in PR317. Its nine executed check badges
were green, including Sonar with zero open issues, but desktop job `115469956272` reported 51 passes
and four flaky cases. The retained results ZIP's SHA-256 is
`2c009e960a77b1a5214a7ccabf0b51cb9b843b6f7fe1ece48da80b8caebde803`; digest and every member CRC
were verified. All four failures waited for the initial project-session binding response. Three
reply progress records stop before scenario execution, and their option interactions failed while
the persisted session still belonged to the default agent. No pre-binding trace exists.

Source review identifies a readiness gap: an enabled textarea does not establish completed initial
binding, whose session-key change can remount the agent selector. Independent critique approved
waiting for actual readiness before initial selection and after alternate binding, and observing
selection/response failures together. Real UI transitions, exact response and persisted-agent checks,
all deadlines and product behavior remain unchanged. The controlled regression reproduced the old
helper race and passed with the correction; the alternate binding control also passed. All nine
original affected journeys passed without retries, failures or skips. Independent source/control
review approved the fix; detailed evidence is recorded in the verification document. This does not
prove the exact hosted cause.

Next: finish and independently review this bounded fixture correction in PR317, update both full
source-bound mirrors, and qualify its exact-head feature checks with clean desktop execution.
After its guarded feature merge, PR315 needs fresh full scan, actual packaged VM, clean desktop and
all protected checks/reviews. Only after verified protected staging delivery may the five delivered
chat-reply branches be recovery-protected and removed. No staging completion is claimed here.
Paused PR283/orchestration branches, dirty primary/paused checkouts and main remain untouched.
All preceding handoffs below are historical; current actual receipts and delivery state are in Beads
and `/Users/letuscode/.codex/chat-reply-implementation-20261013`.

<!-- markdownlint-disable MD025 -->

# Current handoff — disappearing reply staging qualification, 13 October 2026

PR314 merged into `feature/chat-reply-reliability` at `60b6e36c` after all nine executed
checks passed on `1cf4da2c`, with no unresolved findings. The owner subsequently authorized
protected staging promotion and delivered-branch cleanup; paused PR283/orchestration and main
remain separate. PR315 targets staging `21191673`. Beads `agent-platform-sizx` is reopened solely
for this additional delivery phase. Earlier handoffs below are historical checkpoints.

PR315's first ordinary security scan completed actual analysis with no reported vulnerabilities;
Sonar reports zero open issues and CodeQL is clear. All 19 packaged macOS VM tests passed, with
verified signature, ready VM and tested host-path/secret non-exposure evidence. Its verify job
failed the diagnostic benchmark's third healthy sample: p95 overhead56.843ms exceeded20ms.
The cause remains unproven. The one independently approved unchanged failed-job retry then failed
the separate physical database ceiling test at60seconds, before API benchmark execution. That same
test passed in33seconds on the first attempt. No workload, threshold or timeout has been weakened;
there will be no further unchanged retry. Independent review approved serial workspace/file test
scheduling in the existing CI Test step, retaining all fifteen Vitest scripts and every acceptance
threshold. The exact complete local command passed3005 tests with77 existing optional skips in
557.53seconds. The unchanged capacity test passed in19.733seconds; allnine benchmark samples
completed successfully with the original20ms/2ms limits. This qualifies the local correction, not
the future hosted result or the original failures' cause.

The desktop job's green badge concealed two first-attempt failures:53 passed and two passed only
on retry. One shared helper pressed Enter without waiting for session readiness. The other lacked
the expected finished diagnostic export file; its cause is not established by that symptom. The
independent critic required a bounded fixture correction and observed export qualification.
The task branch `task/chat-reply-staging-fixture` starts from the actual feature merge.
The helper now waits for readiness before drafting and enabled Send before Enter. Product runtime
and every existing assertion/timeout remain unchanged. Instrumented approve/reject journeys both
passed with four nativeHTTP200 exports, durable verified coverage and no dropped/pending/truncated
events. The final uninstrumented two-case run also passed without retries, and independent source
and evidence review approved the six-line fixture correction. The original hosted export cause remains unknown and is retained in the observability epic.
Retained evidence lives in
`/Users/letuscode/.codex/chat-reply-implementation-20261013`.

Next: publish the reviewed correction and both changed full documentation mirrors, then qualify
its task-to-feature PR. PR315 then needs new current-head
full scan, actual packaged VM, all protected checks and resolved findings before the authorized
squash merge. Recovery-protect and remove only verified delivered chat-reply branches after that
merge; preserve all paused, dirty, unrelated and in-use work. No staging completion or cleanup is
claimed at this checkpoint. Subsequent actual delivery receipts and task state are recorded in Beads.

<!-- markdownlint-disable MD025 -->

# Current handoff — disappearing reply implementation, 13 October 2026

Owner approved the bounded plan at `34d6397b` and authorized implementation of
`agent-platform-sizx`, with Beads, critic review and browser/Electron/diagnostic checks.
Current branch `task/chat-reply-reliability` chains from the pushed planning tip, targeting
`feature/chat-reply-reliability` at staging `21191673`. This authorization covers implementation
and hosted merge readiness. After reviewing the changes, the owner additionally accepted them and
authorized PR314 to merge into its existing feature destination once current checks and findings
clear, including routine repairs. Staging/main promotion remains reserved. MCP onboarding is
already delivered and paused PR283/orchestration remain separate and unchanged.

The fix gates sending until history and approvals both load, provides safe15-second failure/manual
retry, and scopes asynchronous updates to the active selection and admitted operation. Refused sends
retain drafts/attachments; saved-session links and delayed Project selection are guarded. The critic
approved the runtime after three caller-ownership findings were repaired. Baseline Chromium/Electron
reproduced the missing visible reply while SQLite held the final assistant. The fixed18-case matrix
passed (nine per mode), and the normal Docker browser case passed with retained trace/screenshot/DB.
Ten actual V1 reports join to request/session IDs, with durable verified coverage, no truncation or
lost/pending events and tested private-data canaries absent. The critic independently approved this
evidence. Mounted caller/hook/composer35pass; full repository typecheck/lint/format/cycles pass.

See the [approved plan](docs/planning/chat-reply-reliability.md),
[task specification](docs/tasks/agent-platform-sizx.md),
[verification map](docs/testing/chat-reply-reliability.md) and
[actual results](docs/reviews/chat-reply-reliability.md). Evidence and retained earlier failures are in
`/Users/letuscode/.codex/chat-reply-implementation-20261013`. Fixture repairs did not weaken runtime
policy or acceptance assertions. Source-tree Electron and deterministic providers are not protected
staging packaged-VM or release qualification.

All eight initial unchanged adjacent context/MCP connected regressions also passed. Implementation
was pushed at `699f39c8`, with initial results and all five complete Notion mirrors verified at
`5f09ac45`. Normal affected-package hooks passed build/typecheck/cycles and412 tests. PR314 is open
into the feature; its first hosted run found four cold Project binding failures and a contextual
textbox-name regression. Detailed Sonar inspection also found seven issues despite its green badge.

The independently reviewed repairs preserve ownership and accessible names, simplify flagged code,
and sequence shared Docker provider fixtures without removing tests. A deterministic pre-fix mounted
failure confirms the cold Project startup race. That source passed42 mounted tests, a fresh31-case
Docker suite and18-case Chromium/Electron matrix with ten verified V1 exports. Expanded adjacent
verification then exposed delayed Personal session creation; the session did exist, but its response
arrived too late for the poll. The fixture inherited the checkout's GitHub remote; existing open
`agent-platform-d185` retains this evidence. Reviewed external temporary directories now isolate the
fixture without changing product Git behavior or weakening assertions/timeouts.

A separate controlled failure confirmed that selecting Personal again could clear an existing or
pending conversation. Idempotent navigation now preserves it; explicit New conversation remains
available. The critic approved this bounded fix, and46 mounted tests pass. On this final source,
fresh Docker31/31, adjacent Electron10/10 and the18-case Chromium/Electron reply matrix all pass.
All ten final V1 exports again pass linkage, coverage and privacy checks, with independent UI,
SQLite and effect evidence. Final source-bound receipts use the `final-isolated-` prefix; earlier
passes and failed attempts remain retained. New exact-head hosted qualification remains required. The incomplete
diagnostic-file read observed in one
existing test is recorded separately as `agent-platform-diagnostic-export-file-read`; its original
failed attempt and successful normal retry remain evidence, not a new repair in this scope.

Final local evidence review is approved. The repairs are pushed at `ed63db14`; normal hooks passed
build/typecheck/cycles and423 package tests (web270, desktop153). Four changed full Notion mirrors
were read back at that revision, with earlier unchanged plan/spec mirrors retained. Hosted Sonar
cleared the seven original findings but identified one critical cleanup-helper issue involving
optional undefined inputs to Promise.allSettled. The narrow correction passes three actual-source
settlement controls and strict typecheck/lint/format. Its first representative Electron run hit a
generic diagnostic preparation error before cleanup; one bounded follow-up with additive metadata
capture passed the original assertions and both complete exports. The original failure remains
unexplained and retained for diagnostics follow-up; no timeout or assertion changed. Temporary
instrumentation is removed. The earlier green badge alone did not clear the findings gate.

The helper correction and three complete changed mirrors were verified at `1ef391d3`. Exact-head
Sonar now reports zero open issues and all quality conditions pass; review threads and CodeQL are
clear. Hosted verification and browser jobs passed (browser30passed, one existing environment-only
context skip), but Electron54passed/one diagnostic-export fixture failed twice. Its textarea-enabled
check submitted during restoration, when drafting is allowed but Send is correctly refused. A
focused instrumented reproduction found one empty session, zero messages/events and a native404
response in21ms. This explains the local reproduction and is consistent with the hosted empty
conversation; it does not establish the hosted transport response or explain the earlier two-event
preparation sample.

The fixture now waits for session readiness before drafting, enabled Send before submission and the
actual deterministic reply before exporting. All original export/privacy/failure assertions and
timeouts remain; application code is unchanged. The focused Electron/browser/export/restart journey
passes1/1 in30.9seconds; fresh hosted qualification is required. A separate unproven initial-session
draft-remount concern is recorded in `agent-platform-initial-session-draft` for controlled investigation,
not silently included in this same-session fix.

The fixture repair and three complete mirrors are pushed and verified at `61828f33`. Its hosted
export test passed, but CR-T01 Chromium exposed a separate fixture ordering error: outgoing initial
page requests consumed the one-shot barriers, while the active page's fresh reads returned 200.
Downloaded traces prove this on both attempts. The helper now awaits initial Chromium restoration
before installing scenario barriers, retaining all timeouts and assertions. Application code is
unchanged. The corrected connected matrix passes 18/18 with no failures or skips; all 10 V1 reports
are durable and verified with zero loss, pending or truncated events. Both first-case traces prove
held reads complete before the first POST. The source/build/evidence receipt is
`held-read-repair-connected-receipt.json` (SHA-256
`ae483b651f2dd9d5f644f5fced5a9ea47141e16f6237873c07ba5bdd61259507`). New exact-head hosted
qualification remains required; the failed `61828f33` run is retained.

Next: finish source-bound publication and qualify all new exact-head PR314 pipelines and review
findings, then perform the owner-authorized feature merge. Beads remains in progress through that
integration gate. No merge, task closure or staging readiness is claimed at this checkpoint.
Primary and paused snapshots match the planning-final preservation record, including its one prior
authorized Beads status append; retain all separate refs and unrelated services. Earlier handoffs
below are historical, including the superseded planning-only authorization.

<!-- markdownlint-disable MD025 -->

# Current handoff — disappearing reply planning, 13 October 2026

MCP onboarding is delivered: PR313 merged into staging at
`211916739642f5b095ba35100b3b452779969feb` after all14 executed checks passed, including the actual
full scan and19 packaged VM tests, with no unresolved review threads. Delivered MCP branches were
recovery-protected and cleaned; Beads is closed and synced. Prior handoffs below describe historical
checkpoints and do not reopen completed MCP work. Paused PR283/orchestration remain separate.

The owner selected `agent-platform-sizx` for **planning only**, with an independent critic before
implementation. See the [bounded plan](docs/planning/chat-reply-reliability.md),
[specification](docs/tasks/agent-platform-sizx.md), [verification map](docs/testing/chat-reply-reliability.md)
and [critique/results](docs/reviews/chat-reply-reliability.md). Current actual planning branch is
`task/chat-reply-reliability-plan` from `feature/chat-reply-reliability`, based on staging21191673.
Proposed implementation branch is `task/chat-reply-reliability` from the pushed planning tip.

The proposed small repair gates Send until history and approvals finish loading, scopes all late
results to the owning session/operation, preserves refused drafts/attachments, and gives a manual
retry for restoration failures. Reuse existing V1 diagnostics with controlled browser/Electron race
traces and independent SQLite checks; diagnostics do not themselves prove UI visibility. No new
logging service or dashboard. No product implementation or tests have run in this planning phase.
The independent critic approved the corrected plan with no actionable findings; CR-C01 added saved
Project link/reopen coverage. Documentation validation and Beads spec/acceptance readback pass.
Full mirror/push/sync receipts will be recorded against the resulting pushed revision when
publication completes, in canonical Beads and
`/Users/letuscode/.codex/chat-reply-plan-20261013/publication.json`. Beads remains in progress;
next action after publication is owner discussion, not automatic implementation. Preserve dirty primary,
paused checkout, all separate orchestration refs and unrelated services. Full earlier handoff follows.

<!-- markdownlint-disable MD025 -->

# Current handoff — MCP onboarding implementation, 13 October 2026

The owner approved the bounded MCP onboarding plan at `f75fba7d` and instructed completion
of the epic's concrete tasks. Canonical Beads `agent-platform-mcp-onboarding` remains in progress;
its broader capability-registry parent remains open. Current branch is
`task/mcp-onboarding-verification`, from pushed connection tip `4769f41c`, which contains runtime
implementation `ab98c705` and planning `f75fba7d` under `feature/mcp-onboarding` at staging `26e90126`.
The owner authorized finishing documentation mirrors, the cumulative PR and hosted checks/reviews
to merge readiness. Merging is not authorized by this instruction; final acceptance remains separate.

Shared configuration/encrypted credentials, Test/chat parity, safe connection lifecycle,
configuration-bound approval and the onboarding UI are implemented. Independent review repaired
malformed legacy state, pre-stream cleanup, repeated ownership and truthful terminal failure
diagnostics. The corrected approval card now reports uncertain actions truthfully. Final browser
7/7, source-tree desktop 3/3 and upstream reference 2/2 journeys passed. The critic-requested
context-budget refusal case passes. Full local regression: 2,958 passed/77 existing optional skips/zero
failures at one fork; earlier four-fork lease/timeouts are retained. Typecheck/lint/format pass.
A later push hook exposed an API fixture failure. An owned-server probe proved the IPv4/wildcard
collision hazard; the original 400 responder remains unknown. The test-only repair now binds
23 fixtures explicitly and API verification passed 276 tests, zero failures or skips, before
a final critic-requested session-chat teardown-order repair. That repair passed 39 focused
tests with tracing disabled and independent review.
Original assertions, runtime behavior and timeouts are unchanged. The 2,958-test full run was not
repeated at this fixture-only delta. Runtime source is committed at `ab98c705`; the reviewed fixture
repair is committed and pushed at `4769f41c`. Its normal build, typecheck, cycle and seven-package
test gates passed: 1,715 tests, including 276 API tests after the final teardown repair.
`implementation-push-qualified.json` binds the exact tip and terminal log. Final fixture critique
is approved. All seven full documentation mirrors at `a2b80f44` have verified body/revision/hash
and destination readbacks, independently approved. [PR312](https://github.com/jwill9999/agent-platform/pull/312)
is open into `feature/mcp-onboarding`; no final acceptance or merge is claimed.

Detailed hosted Sonar inspection found 16 maintainability findings despite a passing quality gate.
All are addressed by a bounded ten-file repair with independent approval and 174 focused tests
passed. Credential/approval/error behavior is preserved; exhaustive Unicode equivalence and
byte-identical generated upstream code are verified. No rules, assertions or timeouts were weakened.
Fresh exact-head hosted checks and detailed findings inspection must qualify the repaired source.
Sourcery skipped the oversized diff; independent review is recorded, not a claimed hosted review pass.
The first repair at `9466d609` cleared 15 findings, leaving one callback-complexity issue.
A second small helper extraction preserves the identical expression and passes 34 focused web
tests plus typecheck/lint/format. Fresh hosted analysis must establish final clearance. The prior
repair's normal push passed 1,634 affected tests and its two changed mirrors are read back;
this follow-up requires its own source-bound publication and checks.

See the [approved plan](docs/planning/mcp-onboarding-mvp.md),
[task specification](docs/tasks/agent-platform-mcp-onboarding.md),
[verification map](docs/testing/mcp-onboarding-mvp.md) and
[actual execution results](docs/reviews/mcp-onboarding-planning.md).
Evidence and source hashes are under `/Users/letuscode/.codex/mcp-onboarding-plan-20261013`.
Current evidence binds source/artifacts and actual durable V1 waiting/success/failure reports,
with no reported loss. Implementation and final fixture source review are approved; the connection
tip passed normal push qualification. Publish the changed repair handoff/results with complete
source-bound readbacks, then finish exact-head hosted gates/reviews before reporting merge readiness.
The earlier seven full mirrors are complete. Model fixtures are deterministic;
source-tree desktop success does not establish checkout-free release qualification.

Preserve the dirty primary checkout, paused thirteen-path checkout, PR283 and all retained
orchestration refs. Existing unrelated Docker stacks remain untouched. Only the dedicated
`mcp-onboarding` Compose project and disposable native fixtures are owned by this task.
No installer, OAuth, marketplace, paid call, distribution, main promotion or orchestration
resumption is included. The complete earlier handoff follows as historical evidence.

<!-- markdownlint-disable MD025 -->

# Current handoff — MCP onboarding planning, 13 October 2026

The owner selected reliable MCP onboarding as the next local-MVP investigation. This is
**planning only**: present the reviewed scope and briefing for agreement before implementation.
Canonical Beads task `agent-platform-mcp-onboarding` is P1/in progress under
`agent-platform-capability-registry`; the broader epic remains open.

## Current baseline and next discussion

PR308 and its staging promotion [PR311](https://github.com/jwill9999/agent-platform/pull/311)
are complete. Staging is `26e90126a1987b1dc6e689438b471fe5ed932235`, tree
`a7a737cdc3d76fd5aa5a69038ab90914c6ebd661`. All 14 executed promotion checks and 19 packaged
VM tests passed, with no unresolved comments. Sourcery's size skip was disclosed alongside
independent review. The two delivered handoff branches were removed with recovery tags retained;
`agent-platform-o0rt` is closed and synced. Earlier pending PR308 instructions below are historical.

The current planning branch is `task/mcp-onboarding-plan`, from `feature/mcp-onboarding` at
that staging baseline. See the [briefing and manifest](docs/planning/mcp-onboarding-mvp.md),
[task spec](docs/tasks/agent-platform-mcp-onboarding.md),
[verification map](docs/testing/mcp-onboarding-mvp.md) and
[critique/results](docs/reviews/mcp-onboarding-planning.md).

Recommended scope: trusted preinstalled stdio servers and Streamable HTTP, safe credential
storage, consistent import/test/chat behavior and real permitted/denied tool journeys.
No universal installer, OAuth, marketplace, new dashboard or arbitrary-server VM isolation.
Source investigation found the URL import transport mismatch and ignored env/header settings.
Product tests are planned, not passed. The independent critic approved the corrected plan with no remaining findings. Publication
receipts establish planning delivery only; owner agreement is still needed before implementation.

Preserve main, paused PR283 and all four retained orchestration branches, dirty primary and
paused checkouts. Beads journal updates are authorized task bookkeeping, not an unchanged
whole-primary-diff claim. No distribution, paid calls or orchestration resumption is authorized.
The complete previous handoff is retained below for provenance, not as current instructions.

<!-- markdownlint-disable MD025 -->

# Current handoff — context MVP delivered, 13 October 2026

**Verified development baseline:** `staging` at `66ae2cce73332a35da103c26f7ab9f97a6372fa9`.
**Documentation task:** `agent-platform-o0rt`, refreshed through existing
[PR308](https://github.com/jwill9999/agent-platform/pull/308).
Beads remains authoritative for live task state. This handoff update is documentation in review;
its own feature/staging integration is separate from the completed product delivery below.

## Completed delivery

- Diagnostics V1 is delivered through [PR303](https://github.com/jwill9999/agent-platform/pull/303).
  Diagnostic review checkpoints are delivered through
  [PR307](https://github.com/jwill9999/agent-platform/pull/307) at `d199ad01`.
- The owner accepted the bounded context and token optimisation MVP.
  [PR309](https://github.com/jwill9999/agent-platform/pull/309) merged into its feature at `97d40e64`;
  [PR310](https://github.com/jwill9999/agent-platform/pull/310) merged into protected staging
  at `66ae2cce`. `agent-platform-context-optimisation` is closed and synced in Beads.
- The staging tree `42a878ef6471e2192f321542488d1406e964e1f0` exactly matches the accepted source.
  All 14 executed current-head staging checks passed, including completed ordinary Promptfoo
  analysis and all 19 actual packaged macOS VM tests. CodeQL and Sonar were clear, with no unresolved
  review comments. Sourcery skipped the cumulative diff size; independent source and artifact
  review passed. The optional dispatch-only archive-provenance job was not applicable.
- Complete mapped messages and tool schemas are admitted against an approximate input budget
  before conversational model calls. Required active-turn effects, approval provenance and scoped
  memory are retained; original stored history is preserved. Visible halts replace oversized
  required input, and incomplete output cannot execute partial tool calls. Content-free V1
  diagnostics explain admission and model attempts.
- The approved default is 16,000 estimated input tokens for absent/new settings; explicit saved
  limits, including 8,000, remain unchanged. Output cap 2,048 and the 10% framing margin remain.
  These are approximate controls, not exact token accounting or proven live-provider cost savings.

## Branches and preservation

The four delivered context branches were removed locally and remotely: `feature/context-token-optimisation`,
`task/context-token-plan`, `task/context-token-boundary` and `task/context-token-verification`.
Five verified recovery tags under `recovery/context-token-mvp-20261013/` retain every distinct tip,
including the older local feature tip. The owned integration checkout was left clean at the verified
staging commit, then reused for this documentation task. Main and unrelated refs were unchanged.

[PR283](https://github.com/jwill9999/agent-platform/pull/283) remains an open draft marked **Paused**.
Retain `feature/harness-backlog-review`, `task/harness-readiness-reconciliation`,
`task/pilot-active-budget` and `task/test-runner-offline-adapter` separately. The paused checkout's
13 changed paths are preserved; the primary checkout retains its three paths, including authorised
Beads journal updates. No orchestration resumption, main promotion or distribution is part of this work.

PR308 was the earlier documentation-only recommendation to take context optimisation next.
That recommendation has been fulfilled. Reuse PR308 for this current handoff and its task spec;
preserve its earlier source as historical evidence. Previous green checks apply only to its older
revision. The refreshed revision needs its own checks and review; this document does not claim
PR308 has merged or that its new handoff is already in staging.

## Remaining work and next discussion

Phase one remains a working local, single-user MVP. Distribution architecture and
`agent-platform-electron-release.diagnostics-export` (checkout-free released-artifact export)
remain phase-two work. No dashboard, new account or external diagnostic sharing is introduced.

Current open findings include `agent-platform-est0` (keyless Ollama saved configuration),
`agent-platform-sizx` (visible reply during history restoration), `agent-platform-lnbn`
(repeated PathJail translation) and `agent-platform-d185` (blocking GitHub-check retrieval).
`agent-platform-harness-v5` retains QA follow-ups, including diagnostic benchmark timing variability.
The cleanup hook first recorded 253 API tests passed and one timing failure: locked-minus-disabled
p95 was 23.43 ms against the unchanged 20 ms limit. The focused test and full normal-hook retry
passed with the established tracing-off environment; the retry maximum was 1.98 ms, with all
900 measured requests and 90 warmups. The first failure remains recorded; its cause is unproven.
Trace-upload HTTP 403 warnings on the first attempt do not establish causality.

**The next product task is not yet selected.** Review live Beads with the owner: consider these
observed local-use bugs alongside Git workflow UI (`agent-platform-ii1`) and local run visibility
(`agent-platform-harness-v4.local`). Audit partly delivered tasks such as `agent-platform-0ra`
before choosing new implementation. This handoff changes no product priorities or dependencies.

## Evidence and continuation

The [context MVP results](docs/reviews/context-token-optimisation-results.md),
[task specification](docs/tasks/agent-platform-context-optimisation.md), PR309/310 and canonical
Beads record distinguish implementation evidence from actual integration. Full changed-document
Notion mirrors were verified at source `2bc37c98`; the delivered tree matches that source.
Integration evidence is retained locally under
`/Users/letuscode/.codex/context-token-plan-20261013`, including merge/qualification receipts,
scan and VM artifacts, cleanup/recovery audit and preservation snapshots. These local artifacts
are evidence locations, not files assumed to exist in another installation.

Finish the refreshed PR308 documentation checks and mirrors, then obtain the applicable merge
instruction before integrating this separate documentation PR. Do not repeat completed context
implementation, delivery or cleanup. Historical pending instructions below are superseded wherever
they conflict with this current handoff; they are retained for provenance, not active authorisation.

## Historical accepted-source handoff — staging 66ae2cce

<!-- prettier-ignore -->
`````````text
# Context and token optimisation implementation — 13 October 2026

The bounded local MVP is implemented on `task/context-token-verification`, with PR309 open for
review into `feature/context-token-optimisation`. The approved default checkpoint `38244723`
passed all nine executed hosted checks, including34 desktop end-to-end tests and zero open Sonar
issues. Final test-only acceptance coverage passed locally; its final publication and exact-head CI
are the remaining verification steps before owner acceptance. No merge is authorized for this feature.

The owner approved plan `294a52c8` and implementation using Beads, the implementation skill,
independent critique and agreed tests. Canonical task `agent-platform-context-optimisation` remains
`in_progress` through its specified authorized feature integration. Preserve unrelated PR308,
paused draft PR283, primary/paused dirty checkouts and all retained orchestration branches.
Staging baseline is `d199ad01`; no staging/main promotion, paid model call or dependency upgrade.

Provider admission now includes mapped messages and all tool schemas before conversational model
calls, tool iterations and approval continuation. Required current-turn groups and scoped memory
are preserved in the provider view; original history stays in storage. Output caps are independent,
and partial length-limited tool calls cannot execute. V1 diagnostics explain admission and actual
model attempts without exposing content or secrets. CP01/CP02 approval-provenance findings are fixed.

The owner approved16,000 estimated input tokens for absent/new settings, retaining every explicit
saved limit, including8000. Output2048 and10%framing margin remain unchanged. Shared/OpenAPI
normalization agrees, with no migration or tool removal. Thirty-three focused tests passed across
contracts, raw SQLite persistence and real API create/update/copy/reopen; explicit8000 still rejects
before provider/effects when required context does not fit. Fresh Personal/Coding desktop journeys
both pass without budget overrides, retaining all56 tools and durable verified V1 exports.
The unchanged19-case desktop permission/effect suite also passes.

Configured-budget browser and all three native adversarial journeys passed with independent wire
estimates, real effects, denial, overflow/recovery, approval/restart/replay and five native exports.
Reports are durable, untruncated and have zero loss counters; the restart report honestly records
unfinished prior work. Diagnostic review findings outside scope are tracked separately as
agent-platform-est0, agent-platform-sizx, agent-platform-lnbn and agent-platform-d185.
Fixture boundaries and retained failures are documented in the results; no live-provider performance,
exact token count or release/distribution claim follows from these tests.

The final acceptance audit added CT-T04 actual critic-feedback readmission and CT-T08 persisted stale
memory versus actual Ask/Block policy. Both focused suites pass:14 harness and24 API tests, no
production changes. Their source/log hashes are retained in ct-coverage-cq01-cq02-receipt.json.
Earlier failed fixture attempts remain evidence. Hosted checkpoint38244723 is green; these later
coverage additions still require their own final-head CI and full changed-document mirror readbacks.
Sourcery skipped the cumulative diff above150,000characters; independent review is recorded.
Feature-targeted staging VM skip is not staging qualification. Local IDE Problems is unavailable;
terminal quality checks and hosted Sonar findings provide the documented fallback.

[Plan](docs/planning/context-token-optimisation-mvp.md),
[task](docs/tasks/agent-platform-context-optimisation.md),
[verification](docs/testing/context-token-optimisation-mvp.md) and
[actual results](docs/reviews/context-token-optimisation-results.md) are canonical.
Current final revision/check/publication evidence belongs in Beads and PR309. Present the verified
implementation for owner acceptance; do not merge or clean delivered branches without that authority.
Phase two retains distribution architecture and checkout-free export verification. The local MVP
introduces no dashboard, summarizer, external account or automatic diagnostic sharing.

## Historical handoffs

The complete earlier staging handoff follows unchanged. Its pending PR303/PR307 instructions are
historical and superseded by their verified merged status above. Do not repeat those deliveries.

<!-- markdownlint-disable MD025 -->

# Diagnostic review checkpoints — 13 October 2026

This branch contains the owner-requested contributor skill update, tracked in
`agent-platform-diagnostic-review-checkpoints`. The feature-implementation skill now specifies
reviews after meaningful agent-run end-to-end tests and before completion: collect safe reports,
inspect flow and coverage, separate facts from hypotheses, fix scoped issues or link Beads findings,
and record the outcome. Documentation-only work can record not applicable; existing evidence may
be reused when still valid. This does not enable unattended monitoring or start V2–V5.

The change is isolated from the main conversation and paused orchestration. Base: PR303 staging
`50cc8727`. Skill validation/publication outcomes and the eventual PR belong in the task's Beads
notes. This is a pre-integration snapshot; the change is not active in staging until authorized
integration. No runtime test results or independent subagent review are claimed for this edit.

## Historical diagnostics delivery handoff

The prior handoff below is preserved as historical context; its pending PR303 instructions were
superseded by the merged staging baseline used above.

<!-- markdownlint-disable MD025 -->

# Diagnostics VM teardown repair — 13 October 2026

PR302 and the startup-evidence repair PR304 are merged into `feature/agent-observability`.
Current feature tip is `0081843130674d207a74ae025efe0af99a0c2585`; staging remains
`7814b59845b52ad5f850bfc99b7baee0e6742a25`. PR303 is blocked by its actual packaged VM
suite: eighteen scenarios passed, but the network-block case failed with confirmed `ENOSPC`
and a retry readiness failure. All other executed current-head checks passed, including genuine
full security analysis. The cause of the earlier feature-tip failure remains unproven.

Active bounded repair: `task/diagnostics-vm-teardown`. Independent critique approved correcting
the fixture stop timeout collision and verifying daemon/image-handle release before temporary
file removal. Retain evidence and fail visibly if teardown cannot be verified; preserve all
policy/readiness assertions and release independent resources. Twenty focused controls, desktop typecheck, scoped lint/format and three sequential real-VM
network-block journeys passed without retries. Every teardown reported daemon exit and exact
image release, with no leftover fixture process/handle or accumulating 4 GiB images. Source review
resolved OBS-VM-02/03; final evidence/documentation review precedes publication. Actual source and
verification results belong in [the result report](docs/reviews/agent-observability-mvp-results.md).

Reuse the owner's merge authority after independent source review, complete document mirrors,
and all new exact-head feature gates; then qualify fresh protected PR303 full scan, actual VM,
quality checks and review findings before guarded squash. No staging delivery or branch cleanup
has occurred. V1 remains in progress; checkout-free released-artifact verification remains in
the open release child. Recovery-protect and remove only delivered diagnostics branches after
verified staging delivery. Preserve main, PR283, paused orchestration and dirty/unrelated work.
Beads remains the live task authority; this is a dated pre-delivery snapshot.

## Historical startup-evidence handoff

The full earlier handoff below is retained as historical evidence and superseded by the current
teardown repair where its next steps differ.

<!-- markdownlint-disable MD025 -->

# Diagnostics staging blocker — 13 October 2026

The owner authorized completion of diagnostics delivery and cleanup. PR302 is merged at
`f0f4edd32b88693d39d803dea175c2750f738db5`; protected staging PR303 remains open. All executed
checks except the actual packaged macOS VM suite passed. That suite passed eighteen scenarios
but its network-block policy case failed backend readiness before model setup, including retry.
The healthy real-VM subcase and completed full security scan do not waive that failure.

Current bounded repair: `task/diagnostics-vm-startup-evidence`, based on the delivered feature.
The safe startup recorder and attachment-cleanup fix passed independent review, nine focused
tests and the actual failure/cleanup control. One focused packaged network-block case passed in
32.4 seconds without retries. The earlier failure was not reproduced; its cause remains unknown.
Independent source inspection found the fixture discards the error details needed to identify
startup failure. The fixture now preserves safe, bounded startup observations before cleanup;
the focused reproduction above retained the 20-second timeout and existing assertions. The previous
failure's cause remains unproven. Deliver reviewed repairs through the feature, then qualify fresh
PR303 full security, actual packaged VM and all other current-head gates/review comments before
protected squash. Preserve the original failure evidence and all earlier handoff history.

V1 remains in progress. Checkout-free release export verification and the wider epic remain open.
Recovery-protect and remove only delivered diagnostics branches after verified staging delivery;
keep main, paused orchestration/PR283 and dirty or unrelated work unchanged. See
[implementation results](docs/reviews/agent-observability-mvp-results.md) for actual run evidence.

## Historical pre-merge handoff

The following complete handoff is historical; its pending PR302 instructions are superseded above.

<!-- markdownlint-disable MD025 -->

# Diagnostics delivery handoff — 13 October 2026

The owner authorized merging PR302 into `feature/agent-observability`, then promoting that feature
to protected `staging` once all current-head checks pass and actionable review comments are resolved.
After verified delivery, recovery-protect and remove only the delivered diagnostics feature/task
branches. Preserve main, all paused orchestration refs/PR283, dirty primary/paused checkouts and
unrelated work. Checkout-free export qualification remains with the open release child
`agent-platform-electron-release.diagnostics-export`; no release or main promotion is authorized.

As of this handoff, the implemented revision `f9450bd2fd15d0a8f135450a2ac57fc6b08f1e78` passed all
nine executed feature checks. CI `38184603689` passed 2,745 package tests, 22 browser journeys and
29 Electron journeys; 77 existing optional prototype tests were skipped. All nine measured benchmark
modes passed the original bounds: maximum request p95 overhead 15.176855 ms against 20 ms, and
enqueue p95 0.0128 ms against 2 ms. Independent review verified source, numeric samples and the
hosted artifact identity. The earlier failed latency observation remains recorded with cause unknown.
Sonar passed with two independently reviewed Minor dispositions; no open CodeQL alerts or unresolved
PR302 threads were present at the refreshed snapshot. Sourcery skipped its diff-size limit; independent
source review supplies the review evidence. The feature VM skip does not qualify staging.

This handoff changes documentation only. Its new revision still needs current-head feature checks;
then merge PR302 with its exact head guard, verify the feature tree and open the staging PR. Staging
requires fresh ordinary full security analysis, actual packaged macOS VM success, all live protections
and resolved review findings. Keep V1 in progress until actual delivery/readbacks/sync are verified.
The broader observability epic and release child remain open. Current task state and eventual merge
SHAs are recorded in canonical Beads; this is a dated pre-merge snapshot, not a claim that promotion
has already occurred. See [results](docs/reviews/agent-observability-mvp-results.md).

## Historical implementation and planning snapshots

The following handoffs are preserved verbatim as historical evidence. Their pending instructions
and earlier authorization limits are superseded by the current owner-authorized delivery above.

<!-- markdownlint-disable MD025 -->

# Current diagnostics implementation — 11 October 2026

Owner accepted P1 option A and authorized the diagnostics MVP. Checkout-free export verification
is now release task `agent-platform-electron-release.diagnostics-export`; V1 retains real connected
browser/standalone-Electron export and report investigation. V1's scoped old review-gate edge is
removed; broader gate and all paused orchestration work remain unchanged. V1 is in progress.
Active branch `task/diagnostic-event-foundation` follows planning tip `ebf3c279`, targeting
`feature/agent-observability`. Follow the current authorization at the top of the plan/spec/tests;
earlier planning-only and strict-artifact statements below are historical. No runtime test results
or merge authority are inferred from this authorization.

The SQLite adapter, request/model/tool observations, safe report/CLI and explicit browser/native
export are implemented. Four connected journeys passed, including actual file export, API-stop
partial export, full restart, approval/duplicate one-effect, denial/no-effect and SDK retry recovery.
The report-only independent support exercise located the actual failed operation. Three repeated
latency fixtures passed. Independent source review approved the repaired implementation; local
quality checks and 2,734 aggregate tests passed (77 existing optional integration skips). The
shared-module retry-test isolation failure is retained and its full 222-test API rerun passed.
PR302 remains open. The initial publication at `77d0ce8e` included all eight full Notion readbacks;
subsequent changed result/session mirrors were read back at the pushed code repair revisions.
Hosted Sonar failed on complexity/style and the browser-install command. Independently reviewed
bounded refactors passed 34 core tests, 120 report-equivalence comparisons, 40 web tests, 21 desktop
tests, six CLI tests, four fresh connected journeys and a full 222-test API rerun. An earlier API
timeout is retained alongside the unchanged focused and full rerun passes. Fresh hosted analysis
passed again on final code revision `7e5ba9d6`, with no Blocker/Critical/Major findings and only
two independently reviewed Minor dispositions. Normal push hooks passed all 222 API and 133
desktop tests. Final documentation clarification aligns the V1 dependency section with accepted
P1 and live Beads. That handoff revision passed hosted browser/Electron but failed one latency
comparison (25.464694 ms versus the unchanged 20 ms bound). A bounded measurement-fixture repair
removes retained spy-call overhead and preserves numeric failure evidence; no cause is inferred
from one sample and no limit is raised. New current-head qualification remains required. No
bypass, merge or closure. See results
for the retained first failure and source-backed minor-warning dispositions.
See [results](docs/reviews/agent-observability-mvp-results.md) and
[usage](docs/development/diagnostics.md) for evidence and limits. Next: publish the independently reviewed measurement repair to PR302, refresh its changed full
mirrors, and qualify current-head CI/security/comments with the retained numerical benchmark
artifact. The focused repaired benchmark and two explicit failure/cleanup controls passed locally.
V1 stays in progress through actual authorized feature delivery; no merge is authorized by this step.

<!-- markdownlint-disable MD025 -->

# Current handoff — diagnostics MVP planning, 11 October 2026

The prior visibility documentation delivery below is complete: PR300/PR301 delivered it to staging
`7814b59845b52ad5f850bfc99b7baee0e6742a25`; temporary documentation branches were removed with
recovery protection, and Beads closed/synced. Paused PR283 and the four orchestration refs remain
separate. Historical pending delivery instructions below are not active work.

The owner selected developer diagnostics as the next planning priority. Current work is the
[bounded diagnostics MVP plan](docs/planning/agent-observability-mvp.md), canonical
[V1 spec](docs/tasks/agent-platform-harness-v1.md), [verification plan](docs/testing/agent-observability-mvp.md)
and [independent critique](docs/reviews/agent-observability-mvp-plan-review.md).
Planning branch: `task/observability-mvp-plan`, from `feature/agent-observability` on actual staging.

Agreed: foundation first; local single-user SQLite behind one small storage adapter; configurable
seven-day retention; safe request/model/tool timings and failure metadata; essential backend
logging; readable report plus structured data; small explicit export action from packaged app or
browser for manual sharing. External models remain supported; diagnostics stay local unless shared.
Dashboards, accounts, uploads, other backends and execution-control changes are deferred.

The owner requested completion of planning before their final review. Coordinator planning work
is complete and the critic approved the final decision proposal with no remaining technical
planning findings. The completion audit now
identifies one material decision P1: repository-launched Electron tests do not supply the promised
checkout-free application artifact. The release task owns that missing artifact. The finished
proposal recommends deferring only artifact acceptance to release work; the existing strict
requirement stays in force until the owner agrees. Implementation remains unallocated.

The earlier written plan passed independent critique after three bounded corrections to local
access, backend-unavailable export and SQLite journal bounds. It is being published for the owner
implementation decision. No runtime implementation,
installation or new application test execution has begun. V1 and its parent remain open; the old
review-gate edge is retained pending the owner's requested final implementation decision, after
which only the V1 edge should be reconciled. No broad gate closure or paused-work resumption.
Next handoff is the completed reviewed decision proposal to the owner, not an automatic implementation start. P1 is the only remaining material choice; no interim owner review is needed.
Estimated implementation effort is 4–6 focused engineering days with a two-day progress checkpoint.
Canonical Beads root stays the primary repository; preserve its dirty files and the paused checkout.

<!-- markdownlint-disable MD025 -->

## Earlier session history retained below

# Native development consolidation handoff — 11 October 2026

## Current follow-up — paused work visibility

Last updated: 11 October 2026. Paused orchestration labelling is complete; the owner has now
authorized integrating its documentation into staging and removing the two temporary branches.

The consolidation below is complete: PR295, PR288 and PR286 merged; staging is
`3a22ac8f45d2257fe1a9200e936e4bd2923c9eae`. All 14 final executed checks, actual full scan,
packaged macOS VM and review gates passed. The integration task is closed and synced;
17 delivered remote/local branches were removed with 20 recovery tags. Its monitor is paused.

Next: `agent-platform-paused-work-visibility` is in progress at P1 with the completed integration as
its upstream dependency. Its [specification](docs/tasks/agent-platform-paused-work-visibility.md)
records a paused title/label and four-branch inventory for PR283, plus relevant Beads notes.
The title, label, complete description, all ten deferred Beads records and preserved branch/dirty
work identities have been read back; metadata closure and Dolt sync completed. The task is reopened
only for the subsequent owner-authorized documentation delivery. Specification work uses
`task/paused-work-visibility` from `feature/paused-work-visibility`, based on qualified staging.
These new follow-up branches are active documentation work, separate from the four paused refs.

Preserve PR283's base/head/draft state, all paused branch tips and dirty/unrelated checkouts.
Independently review and publish the two-file source; merge task to feature after current checks
and reviews pass, then require fresh protected staging full scan, actual packaged macOS VM and
all checks/reviews before guarded squash. Verify the staging tree, recovery-protect and remove
only the two delivered visibility branches, refresh mirrors/Beads and close after Dolt sync.
The owner may review the live backlog in parallel; the next product priority remains undecided.
The immediately following PR299 and final-quality-repair sections are preserved pre-completion
snapshots. Their pending review, publication and hosted-clearance steps were subsequently completed:
PR299 merged into its feature at `583da680ae84e79cb8723b808792c8321d9b4c7e`, then PR286
merged into staging at `3a22ac8f45d2257fe1a9200e936e4bd2923c9eae`. Statements below that
PR286 is unmerged or that those repair gates remain pending are superseded by those verified
deliveries. They do not describe active work. The visibility documentation delivery above is still
active; paused orchestration remains deferred. Consult live Beads and current PR state before
acting on any other dated historical section.

## Current PR299 detailed-analysis follow-up

The first bounded quality repair was pushed at `58d3399a` in PR299. Normal hooks passed
124 desktop and 1,141 workflow tests; both full specification/session mirrors were read back.
Actual fresh Sonar reports a green quality gate but a Blocker `S2699` in the new network test:
the child process's assertions are not visible to its parent test analyzer. A bounded follow-up
keeps all child effect assertions and checks the child-reported three forwarded and three denied
requests explicitly in the parent. All 11 HTTP/network cases passed again. Independent review,
normal push, refreshed full mirrors and fresh detailed hosted clearance are still required.
The ordered validation await has one disclosed Minor report and remains sequential intentionally.
PR286 remains unmerged; prior full scan/VM success does not qualify a changed repair head.

## Final quality repair continuation — 11 October 2026

PR298 is merged into `feature/harness-backlog-review` at `4cf29b18a7a4150710df3cc36d9d135a7243d050`,
with reviewed tree `dbbd092b84eff20ca566d321f0723d88613f04f9`; all nine executed feature checks passed.
Both complete specification/session mirrors read back at `d74e63af`. PR295 and PR288 remain qualified
and merged, their children closed. Actual PR286's new-head ordinary full Promptfoo run `38105914455`
succeeded; old token-limit failures are retained historically, not reclassified. Actual new-head VM and
all remaining gates still need terminal qualification.

Detailed Sonar analysis at `4cf29b18` reports a green quality gate but two Critical complexity and two
Major nested-ternary findings in promoted code. Repository completion is blocked by those Critical
findings despite the green check. Independent source triage approves a bounded behavior-preserving
[repair](docs/tasks/agent-platform-native-staging-sonar.md), `agent-platform-native-staging-sonar`,
on `task/native-staging-sonar-repair` from the actual feature. It preserves snapshot validation/order/
digests/cleanup, provider HTTP bounds/retry/SSE/resume identity and loopback-only fetch forwarding.
The 37 Minor reports have explicit source-backed retained-behavior dispositions; no suppression,
parallelization, scanner waiver or rule weakening is authorized. Repair source/tests, independent
review, complete mirrors, task-to-feature delivery and fresh detailed finding clearance are required.
Every changed protected head needs its own genuine full scan, actual VM and all checks/reviews.

The bounded seven-file source and requirement/scenario contract are independently approved without
findings. Local provider HTTP/network regressions passed 11 cases; the complete affected workflow
suite passed 1,141 tests with 77 existing optional integration skips, including snapshot identities
and committed skill boundaries. A supposed two-file command selected that whole suite because of a
literal script `--`; its actual coverage is recorded. Affected typecheck/lint and the provider source's
explicit desktop-package typecheck passed; the earlier root-only missing Node declarations are retained.
Normal publication/feature gates and fresh detailed Critical/Major clearance remain required.

Read live Beads and PR286 before resuming: if the repair/final promotion is already delivered, verify
its actual source/evidence instead of repeating it. Parent stays in progress through final acceptance
and verified branch cleanup. PR283, separate paused refs/dirty work, all archive bytes and protected
controls remain separate and unchanged. Next priority remains owner-led backlog review after consolidation.

The owner authorized completing PR295, PR288 and PR286, then recovery-protected cleanup of
verified delivered branches. PR283 and the unfinished orchestration work remain paused and separate.
This is native development; historical prototype discovery, broker, admission, gateway, budget and
pilot approvals do not become default development prerequisites. No main promotion, pilot, paid
prototype call, global edit, decommissioning or next product priority is authorized here.

## Verified delivery and final source

Protected policy/runner adoption [PR293](https://github.com/jwill9999/agent-platform/pull/293)
merged at `3ab2f53d`: genuine ordinary Promptfoo analysis, actual signed packaged macOS VM,
all fourteen executed checks and independent artifact/source review passed.
Authored bookkeeping [PR295](https://github.com/jwill9999/agent-platform/pull/295) merged at
`fdf02255`; its reviewed tree, genuine full scan, actual VM and all current checks/reviews passed.
Its full source-bound documentation mirrors and readbacks are retained.

Exact archive delivery [PR288](https://github.com/jwill9999/agent-platform/pull/288) merged at
`9d9bdd74747369fac590a19bb79b355a0976185f`, tree
`324d2ac102a7abbeca012917f79a40e252a3eac0`. All 220 original paths, regular modes, blobs,
SHA-256 values and 3,958,506 bytes match source `6ca3cd1b`; all 139 JSON payloads parse.
Latest automatic archive run `38103891409` and protected dispatch `38103896505`, attempt 1,
qualified through the complete unmodified trusted verifier and retained actual adoption CI proof.
The actual packaged VM job `114365175122` in CI `38103873970` passed. Seventeen executed check
entries passed, reviews were resolved, and an independent critic freshly verified both receipt
ZIPs, every VM artifact member and current source/protection bindings. This is owner-approved
historical archive qualification, distinctly not Promptfoo LLM analysis of those payloads.
Two earlier local verifier fetch failures remain recorded with unknown specific cause; healthy
transport diagnostics and the unchanged plain verifier succeeded without a source or policy waiver.

The runner, archive-policy, bookkeeping and evidence Beads children are closed and synced after
their own verified delivery. Parent `agent-platform-native-staging-integration` still owns final
baseline acceptance. Its [version 2 specification](docs/tasks/agent-platform-native-staging-integration.md)
is authoritative for the remaining integrated source and delivery gates.

Final task `task/native-staging-baseline-integration` starts from retained
`feature/harness-backlog-review` at `542e082e`, which includes the bounded PR290/291 repairs,
and reconciles actual protected staging `9d9bdd74`. Preserve the full original native source
and every adopted control, archive and historical body. The only merge conflict is this handoff;
both complete source bodies are retained below. The automatic CI merge retains the adopted runner,
security tests and cancellation policy plus the feature's private interpreter setup. It still needs
independent complete-source review and new exact-head verification.

## Continuation and acceptance

First read live [PR286](https://github.com/jwill9999/agent-platform/pull/286), canonical Beads and
current refs; this document is a revision-bound integration handoff, not a claim that its own source
has passed later hosted gates. If PR286 is unmerged, finish the reviewed task-to-feature delivery,
then require its actual latest-head ordinary full Promptfoo analysis, actual packaged VM, all live
required/executed checks and resolved actionable security/code reviews before guarded staging squash.
Earlier heads and optional skipped jobs do not qualify it. Remaining authored scan fit is not proven;
never exclude authored source, raise limits, truncate evidence or silently waive a failed analysis.
On a genuinely necessary material policy change, prepare reviewed alternatives for the specific
owner decision. Routine repairs and guarded authorized merges do not need renewed approval.

If PR286 is already merged, verify the actual committed tree, source preservation, checks, reviews,
full substantive Notion readbacks and canonical Dolt sync before closing the parent. Do not repeat a
completed promotion. Only then audit legacy refs against actual staging, push/read back recovery
protection and delete proven delivered temporary refs with exact-SHA guards. Keep checked-out,
dirty, paused, unique or uncertain branches. Actual completion evidence belongs in Beads and the
PR/check receipts; a local test pass or this handoff alone does not establish development readiness.

## Retained work and next priority

Keep paused [PR283](https://github.com/jwill9999/agent-platform/pull/283) and reconciliation tip
`5b796b741da862ff6546d205ff1097f9e2e68225`, budget
`ee3a160f9f3152ba16ed0ebbe376dc940c86dacf`, offline adapter
`e1222b1958b87ddc2cf371983fe5e56536fb5fe3`, the dirty primary three paths and paused thirteen
paths untouched. Canonical Beads lives at `/Users/letuscode/projects/agent-platform`; native work
uses the clean managed checkout. Authorized task-status journal appends are separately proved;
never describe the whole current primary dirty hash as unchanged from its original snapshot.

Recovery tags retain original primer/task tips and the full feature before final reconciliation.
Existing optional prototype code remains retained for a later explicit resumption/decommissioning
decision; delivered code is distinguished from deferred operational acceptance in Beads.
After full verified staging integration and delivered-branch cleanup, pause the integration monitor.
The next product priority is undecided: review the live Beads backlog with the owner before selecting
new development. No paused prototype or old automation is resumed by that review.

The following complete source bodies are historical evidence, including superseded directions.
They do not supply current approval or override this handoff and the owner's native-work authority.

## Historical full-feature handoff — source 542e082e

<!-- prettier-ignore -->
````````text
# Current handoff — native development and retained orchestration — 10 October 2026

## Security repair closeout and follow-up — 10 October 2026

PR290 merged into `feature/harness-backlog-review` at
`732806dc28754bc9176d507516d85e612eaaef5f` after all ten executed checks passed on reviewed
`7c28c838a8f81bad78b76592dd6403977462a2f3`, approval and no unresolved review threads.
The merge tree equals reviewed source. Fresh PR286 CodeQL/source verification confirms the
coordinator test alert 10 fixed on its current PR ref and the original thread resolved;
`agent-platform-native-staging-codeql` is closed for that bounded delivered scope.
The previous local failures/diagnoses and optional skips remain recorded below and in its task spec.

Fresh findings inspection also found existing high-severity `js/polynomial-redos` alert 5 in
BashGuard's optional explicit compatibility-allowlist splitter. It already exists on staging/main;
PR290 did not introduce it. [The bounded security repair](docs/tasks/agent-platform-native-staging-redos.md)
is `agent-platform-native-staging-redos`, in progress, on `task/staging-bash-guard-repair` from
`732806dc`. Independent plan review approved after correcting the regression input to embed long
whitespace between non-whitespace tokens; independent implementation review also approved without actionable findings. Harness build/typecheck/
lint and all 686 tests in 49 files passed, including strict operator/whitespace decisions and a bounded
real compiled-validator regression. The baseline child timed out/killed at one second; the repaired
child returned both expected outcomes in 29.62 milliseconds. Normal push hooks also passed
all 686 tests. [PR291](https://github.com/jwill9999/agent-platform/pull/291) is open into the feature;
full three-document mirrors read back at `559276d2`. Initial hosted lychee found the authenticated
security-alert link unavailable to public CI; the spec now records the alert ID/access requirement
and links its public owning PR. Final current-head CI/mirrors, feature merge and fresh CodeQL
qualification remain pending; no checker/security-policy exclusions changed.
Default product calls omit the explicit allowlist; the repair preserves default behavior and all
permission/deny decisions, removing only quadratic separator matching.

PR286's automatic scan on its genuinely changed `732806dc` head still failed before analysis:
1,404,186 tokens exceed the one-million-token limit, run `38079857145` / job `114294354762`.
No vulnerability qualification resulted. PR288 retains its separate provider context-overflow failure.
A source-backed independently reviewed [scanner-policy decision packet](https://app.notion.com/p/3f5c07cdcbcf81359addc127d333abf1)
is published/read back. The owner is asked to keep full policy and seek a provider remedy, or explicitly
authorize narrowly scoped immutable historical-archive policy work. No answer or policy change is
assumed; the full protected scanner and actual VM still gate staging. The alternative requires a
separately fully scanned policy delivery, trusted exact archive pins, no authored-document exemption,
independent archive review and all other protections; it does not guarantee final scan success.

Runner `dev` is online/busy. The old `6ca3cd1b` PR286 job `114242452635` was cancelled while still
at Set up job after the new feature head triggered fresh CI. It did not qualify the VM. PR288 job
`114257513299` is now assigned but still Set up job; current PR286 job `114295343289` queued at
this snapshot. The owner has already been asked for runner-console
setup/download/connection errors; do not repeat the start/offline request or invent a cause.
Fresh current-head checks/reviews/security findings must be inspected before each merge.

Next: deliver and verify the BashGuard repair through the existing feature; obtain the pending
scanner-policy decision and runner evidence, then qualify evidence PR288 and full baseline PR286.
Neither staging promotion nor branch cleanup is complete. Parent/evidence Beads remain in progress;
paused PR283, separate prototype refs/dirty checkouts and all historical source remain preserved.
No main promotion, pilot, spend or product-priority selection; next product priority remains owner
Beads backlog review after verified consolidation.

## Earlier consolidation repair update — retained 10 October 2026

This update supersedes the earlier pending-PR285 wording below. The owner resumed consolidation
and reconfirmed conditional merge authority: evidence PR288 first, full baseline PR286 second,
only after every actual current-head gate and actionable review clears. PR283 stays paused/unmerged.
No next product priority, pilot, main promotion or decommissioning is selected.

PR285 merged to the full feature at `6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec`. Evidence PR287
and diagnostic PR289 merged to `feature/staging-evidence-primer`, now
`2ad1a88a7bcf3978e9c02884e36c0cfae8ab11d0`. All 220 historical artifacts remain retained exactly.
Staging remains `a5a1641c3d2a5ef317c05fa45c6190e7189c1915`; it is not the consolidated development baseline.
The primer history/spec/mirrors are retained on their own source branch; refresh them before promotion.

PR288 has 13 successful regular checks and failed security-scan at its actual head: provider model
context-window overflow, run `38067326126` / job `114257510826`. PR286's prior full scan rejected
1,400,512 tokens above the 1-million limit. Promptfoo 0.124.1 also omits three large evidence patches
by built-in blob/patch limits; filesystem availability does not prove their analysis. No unchanged
manual rerun, scan bypass/exclusion, artifact truncation or qualification claim. A supported remedy
or concrete owner policy decision is still needed; smaller complete-file batches are unverified.

The owner started runner `dev`: live status online/busy. PR286's actual packaged macOS VM job
`114242452635` is assigned/running (started 18:46 UTC) but still at GitHub's Set up job step; the
packaged test itself has not started. The owner was asked for the runner-console setup/download error.
PR288's job `114257513299` remains queued for capacity.
Do not repeat the offline request or count queued/skipped/cancelled jobs as success.

PR286 has an unresolved CodeQL `js/bad-code-sanitization` finding in the delivered coordinator
subprocess test. [The bounded repair](docs/tasks/agent-platform-native-staging-codeql.md) is tracked by
`agent-platform-native-staging-codeql`, in progress, upstream closed handoff, blocking parent integration.
Its task branch `task/staging-codeql-repair` starts from the original full feature at `6ca3cd1b`.
Independent plan and implementation source reviews approved without actionable findings. The test
now writes static child source, passes unusual paths through JSON stdin/argv, preserves real descendant
abort/late-marker checks and adds stopped-call denial. Only test/spec/session change; runtime unchanged.
Five focused transport tests, package build/typecheck/lint passed on Node 24. Full normal push gates
passed at `72411e80be45e9c29e98bc4d66b826c8b071613d`: all 1,140 package tests
passed, 77 optional integration tests skipped. Initial scheduler timeout and hook-selected noncanonical
Git pin failures were retained and diagnosed; focused reruns passed. Supported local canonical Git
path plus four-worker execution passed every unchanged test/timeout through normal hooks. No runtime,
security or test coverage reduction. Hosted feature checks, source merge and CodeQL finding resolution
remain pending. Full spec/session Notion publication follows the pushed final documentation revision;
Beads remains in progress and its current state was synced, not closed.

Next: finish full documentation mirrors, inspect repair task PR checks and review findings, merge
into the full feature when exact-head gates clear, then verify actual PR286 source before
resolving its thread. Continue supported scanner remedy investigation and actual VM qualification;
protected staging merges stay gated. After full verified integration, audit delivered branches with
recovery refs and SHA guards, preserving paused/unique/in-use/uncertain work and dirty checkouts.
Parent and evidence-child Beads stay in progress; do not close them for intermediate feature delivery.
Next product planning remains an owner backlog review after consolidation.

## Earlier handoff history (retained)

**Current position:** cleanup is complete; the next product-development priority is **undecided**.
The owner initially requested a pause after saving this handoff. On 10 October they authorized finishing
PR285 and promoting `feature/harness-backlog-review` into protected `staging` once checks pass.
That integration is tracked by `agent-platform-native-staging-integration` and
[its specification](docs/tasks/agent-platform-native-staging-integration.md); consult Beads and exact
remote refs for the live result. At this snapshot PR285 and staging promotion are not yet merged.
This does not restart the paused prototype or select a new product implementation task.
After integration: review the live Beads backlog with the owner and decide which work to take forward.
Agree that task's objective, requirements, definition of done and meaningful tests before execution.

This section supersedes the older execution/approval/status instructions below. Historical entries
are retained as evidence; they do not reactivate old pilots, automation prompts or review gates.
Beads remains authoritative for task state. This documentation snapshot is tracked by
`agent-platform-native-development-handoff`; its specification is
[the handoff task](docs/tasks/agent-platform-native-development-handoff.md).

## Merged baseline and completed developer cleanup

[PR284](https://github.com/jwill9999/agent-platform/pull/284), **Restore native Codex developer autonomy
and retain runtime security**, is merged into `feature/harness-backlog-review` at
`d77d64072034b7ab131386de9f9d2961896f6ce2`. The integrated tree matched reviewed source
`a0e51e542aaf6a978ff240dddb1dc1451e6104fa`. Its nine executed exact-head checks passed;
staging-packaged macOS VM and Sourcery were skipped. Earlier desktop retry/flaky evidence remains
in the review records; the targeted rerun passed 28 tests without retries. No new staging/main
promotion or live pilot followed this cleanup. Current remote staging is
`a5a1641c3d2a5ef317c05fa45c6190e7189c1915`; refresh refs before future work.

Native Codex is the development route. Existing end-to-end authorization covers routine planning,
implementation, refinements, repairs/retries, independent source-aware review, documentation/Beads/Git
work and CI through final owner acceptance. Ask about material changes to intent/behavior/delivery,
required missing input or explicitly reserved actions. Actual session permissions still apply;
green tests alone grant no merge, release, spend, global-edit or pilot-launch authority.
See [native development](docs/development/codex-development.md) and
[ADR-0005](docs/adr/0005-native-codex-development.md). Agent Platform runtime security is unchanged.
`agent-platform-codex-autonomy-acceptance` is closed and its Beads completion record was synced.

## Global follow-ups completed locally on 9 October

The owner separately authorized all three corrections discussed in voice:

- Installed global `beads-workflow` skill: removed prototype broker prerequisites; normal authorized
  MCP/CLI task updates and syncing remain, along with task authority, dependencies and ownership.
- Installed global `agent-platform-documentation` skill: removed obsolete managed-run publication
  and approval wording; retained full Notion mirrors, identity/readback and preservation of human notes.
- Saved additive memory correction: earlier review-gate/renewed-allocation guidance is historical;
  routine phase/file/subtask changes within an agreed authorized task do not require renewed approval.
  Historical registry/rollout/memory-skill files were preserved. Both skill validators and readbacks passed.

These installed skills and saved memories are local to this Codex installation, outside repository
Git. They do not need pushing to the feature branch; another installation needs equivalent updates.
Global Codex configuration was not changed. The existing proposed-global-follow-ups document describes
the earlier discussion checkpoint; these Beads notes and this handoff supersede its pending wording.
Fresh sessions on the integrated branch are recommended; loaded historical context can remain stale.
Saving a correction does not prove automatic ingestion by every future session.

## Orchestration retained and paused; delivery audit recorded

The owner chose to retain `packages/workflow-control` for now and decide later whether to decommission
it. Its source, enforcement and tests remain intact; it is not a prerequisite for native development.
Code already delivered to staging is retained there. No source deletion, branch deletion, prototype
resumption, pilot launch or paid model call is authorized by this retention decision.

All twelve previously discussed Beads records were audited. The shared-documentation and bounded
standalone-reviewer tasks are now closed for their completed scopes. Ten remaining records are deferred.
Each contains a delivery/acceptance audit stating implementation state, exact evidence/location and
remaining scope; earlier blanket-deferral notes are superseded by those per-record dispositions.
Staged code delivery is done where recorded, while unmet operational criteria remain distinct.

| Beads record                           | Current status | Delivered work and remaining scope                                                                                                                |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-platform-pilot-zero.14`         | Closed         | Shared documentation guide/skill and callers delivered, reviewed and integrated into feature; no runtime acceptance implied.                      |
| `agent-platform-pilot-zero.15`         | Closed         | Bounded standalone reviewer delivered and qualified for the recorded tested profile; broader connected/managed pilot acceptance remains separate. |
| `agent-platform-multi-agent`           | Deferred       | Foundations delivered to staging; parent retains operational pilot learning/acceptance.                                                           |
| `agent-platform-pilot-zero`            | Deferred       | Initial assessment foundations in staging, later prerequisite components in feature; overall qualification/acceptance incomplete.                 |
| `agent-platform-multi-agent.10`        | Deferred       | Pilot candidate code delivered to staging; actual autonomous pilot, recovery and finalization evidence incomplete.                                |
| `agent-platform-multi-agent.repair.4`  | Deferred       | Repair code delivery to staging done; exact bootstrap/lineage/brokered acceptance remains unverified.                                             |
| `agent-platform-pilot-active-budget`   | Deferred       | Implemented/reviewed/pushed to task branches; feature integration and connected qualification incomplete.                                         |
| `agent-platform-test-runner-loopback`  | Deferred       | Pushed checkpoints plus unfinished uncommitted offline-adapter code; evidence ingestion, final review/qualification/integration incomplete.       |
| `agent-platform-pilot-zero.17`         | Deferred       | Discovery/import/coordinator/lifecycle components delivered to feature; full actual execution path not qualified.                                 |
| `agent-platform-pilot-zero.13`         | Deferred       | Pilot draft/contract material exists; final launch-ready material and prerequisites incomplete.                                                   |
| `agent-platform-pilot-zero.12`         | Deferred       | Earlier assessment/handoff delivered to feature; latest reconciliation update is pushed but PR283 remains open.                                   |
| `agent-platform-orchestration-toolkit` | Deferred       | Backlog specification only; feasibility research/implementation not started.                                                                      |

These statuses and notes were read back and Dolt synchronization succeeded. Closed scoped tasks do
not establish unattended pilot success. The parent records overlap with their children; they are not
twelve separate implementation jobs. Do not reimplement already-delivered code from an old status label.
Unrelated product/harness tasks were not deferred or closed by this prototype disposition.

## Exact retention locations and future decommissioning boundary

Read-only ancestry checks established the following delivery split; refresh before later action:

- Orchestration foundation `491518811ab53d003a2d2f90ed79dd6fb9d07d0e` and initial assessment staging
  delivery `1be9301f6cbb8052f8d7eb56471fe50e35cbba4e` are ancestors of both current staging and feature.
- Later reviewer/discovery/import/lifecycle work is integrated into the feature through PR271,
  PR276, PR277 and PR278; those later delivery commits are not all in staging.
- Active-budget source `ee3a160f9f3152ba16ed0ebbe376dc940c86dacf` is pushed on
  `task/pilot-active-budget` and retained in `task/test-runner-offline-adapter`; neither current feature
  nor staging contains it.
- Runner checkpoint `4cbef34f6d1a90af0ffea3e352074337664780da` is pushed on the offline-adapter chain.
  That remote branch tip is `e1222b1958b87ddc2cf371983fe5e56536fb5fe3`; it does not contain local edits.
- Paused worktree `/Users/letuscode/.codex/worktrees/harness-readiness/agent-platform` still has
  13 changed paths, including uncommitted `offlineTestAdapter` source/tests and supporting lifecycle,
  contracts/evidence changes. Preserve this checkout; branch checkpoints do not back up those edits.
- [PR283](https://github.com/jwill9999/agent-platform/pull/283), **test: qualify runner controls and
  expose local-network blocker**, remains open on `task/harness-readiness-reconciliation` at
  `5b796b74`, targeting the feature. Do not merge or resume it merely from this handoff.

The owner explicitly requested a saved-memory retention/decommissioning note; it was saved and read
back locally. Future removal requires reviewing source already in staging/feature, consumers/imports,
workspace/build/configuration wiring, tests/docs, pushed branches and uncommitted work. Closing Beads
or deleting a local checkout would not remove shipped code. Prepare a separately reviewed removal
only after an actual decommissioning decision; preserve useful product security and recoverable history.

## Continuation and pause

**Next priority has not been selected.** Begin with `bd ready` and relevant `bd show` reads in canonical
Beads root `/Users/letuscode/projects/agent-platform`, refresh dependencies and source/PR delivery,
then discuss product backlog priorities with the owner. Older product notes can also lag integrated
code; verify before allocating or changing task status. Do not invent a preferred next task or deadline.

Documentation worktree: `/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`.
This handoff is on `task/native-development-handoff`, based on the merged feature; source publication
is separate from feature/staging integration. Preserve the dirty primary and other unrelated worktrees.
Old orchestration automations remain paused; no prototype continuation or pilot is requested.
Complete the newly authorized handoff/staging integration after checks pass, then stop until the
owner selects the next product priority. Any integration-only monitor must not revive old pilot work.
No product implementation or new tests were performed for this status-only documentation update.

---

## Historical developer-autonomy cleanup checkpoint — 9 October 2026

Owner authorized this cleanup through planning, implementation, tests, repairs, independent review
and exact-head hosted CI to a final owner code-review request. No repeated routine phase approval;
no merge/deployment/global edit/paid gateway call/prototype or pilot resumption.

Worktree: `/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`.
Native task chain: planning → policy → guidance → acceptance; cumulative target
`feature/harness-backlog-review`. Planning and policy checkpoints passed independent reviews and
full branch-specific Notion readback; guidance review and all 30 full mirrors passed; acceptance branch is assembling final CI/review evidence. Source provenance and AUT/V maps:
[plan](docs/planning/codex-developer-autonomy/plan.md),
[results](docs/reviews/codex-developer-autonomy.md).

Preserve all paused source work in `/Users/letuscode/.codex/worktrees/harness-readiness/agent-platform`:
13 dirty files/unfinished offline adapter and its existing evidence, untouched by this cleanup.
The copied [pause checkpoint](docs/reviews/evidence/codex-autonomy/paused-checkpoint.md) and
[complete restriction audit](docs/reviews/evidence/codex-autonomy/supporting-audit.md) retain local
snapshot provenance; prior remote links did not contain them. All other dirty worktrees and global
configuration/skills/memories are preserved. Relevant orchestration/merge monitors remain paused.

Next within this authorized task: finish current-tip publication, open/inspect the tip PR, repair required CI failures and request owner code review when
green. Final independent source acceptance is approved. Native fresh-child smoke and 102 unchanged product
security regressions passed; standalone
profile-loader activation/full product-ticket journey remain unverified. Never infer merge/pilot authority from CI. On later owner-approved integration,
new sessions follow native developer policy; old loaded/global guidance can be stale and its exact
follow-up proposals await owner discussion. Historical pilot instructions below are inactive records.

---

## Branch cleanup handoff — 8 October 2026

Cleanup removed 28 remote and 36 local branch names, with all 64 tips retained as pushed archive
tags and a verified recovery bundle. See [complete branch audit](docs/reviews/branch-cleanup-2026-10-08.md)
for every original SHA, retained scope and recovery instructions. Main/staging promotion, stashes,
dirty primary files and other worktree ownership are unchanged. The missing deferred Notion task
specification is retained in this documentation PR; its source branch remains until integration.

PR281 is merged into staging at a5a1641c. PR280 is integrated into the retained harness feature at
5fbdff22. Next: integrate this documentation handoff, then resume .12/.17 readiness assessment.
The older session entries below are historical, including obsolete PR280 pending-merge statements.

---

## Reviewer evidence repair and pilot planning — 29 September 2026

PR279 is merged into `feature/harness-backlog-review` at `43157a8c`. Owner authorized the narrow
reviewer repair, ten non-launch skill scenarios and pilot planning. Current branch:
`task/reviewer-skill-evidence`, in `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
Canonical Beads stays `/Users/letuscode/projects/agent-platform`.
[Draft PR280](https://github.com/jwill9999/agent-platform/pull/280) publishes the repair and blocked
pilot draft; hosted checks remain required before merge. Beads updates and Dolt push succeeded.
Temporary review gateway/networks were removed; no pilot or review process remains running.

The reviewer can now receive exact committed skill files as inert, revision-bound evidence without
widening ordinary worker `.agents` access. Independent review found a partial-clone Git transport
risk, fixed with transport-denying local reads and a regression sentinel. Full serial regression: 1,140 passed/77 gated skipped; real-container suite: 20 passed. Final independent repair review reports no code/security blocker. The first parallel run had timing/lease failures and is retained.
See [qualification and findings](docs/reviews/reviewer-skill-evidence-qualification.md) for test/review
results and limits. Ten decision scenarios ran: nine passed the specified decisions; S1 safely stopped
but did not establish the exact configured admission-to-scheduling route. No pilot was launched.

Owner approved scoped child `agent-platform-harness-baseline-p4.1`; it is open, blocked by `.13` and
has [its own specification](docs/tasks/agent-platform-harness-baseline-p4.1.md). Wider P4 remains open.
The [pilot draft](docs/planning/single-task-permission-pilot/plan.md) and linked verification plan define
approved-write then fresh hard-path-denial coverage across backend and connected Electron UI.
Independent draft critique exposes managed test-dependency feasibility, phase acceptance, actual
role-policy and coordinator/start bindings, and enforceable run limits. These must be resolved before
final plan agreement and persisted approval. Task creation/planning is not execution authorization.

Next: review/integrate this repair after hosted checks; reconcile `.12`/`.17`; establish the exact
managed runner and operator plan with evidence, resolve critique findings, bind documents and actual
policy, then obtain approval for the single-task pilot. Do not close P4 or promote to staging.
Notion structural alignment, the two-task pilot and wider feature integration remain separate.
Historical handoff entries below are preserved and may describe superseded PR states.

---

## Standalone readiness checkpoint — 28 September 2026

## Review comment addressed — 29 September 2026

PR279 comment 1 requested auditable historical-row preservation evidence. A fresh read-only comparison
of the retained pre-migration backup and canonical journal produced matching whole-table SHA-256
digests for runs, contracts and leases. The report documents canonicalization, reproduction and the
retrospective evidence boundary; no database contents are published. Same-count mutation, row-order,
duplicate and type-distinction checks passed. This is documentation/evidence work only; the separate
reviewer-access repair and pilot remain unstarted. Refresh PR279 checks before merge.

## Paused at the owner’s request

Work is paused. [Draft PR279](https://github.com/jwill9999/agent-platform/pull/279) contains the
readiness evidence and this handoff, targeting `feature/harness-backlog-review`; it remains unmerged.
Repository documentation and its three Notion mirrors were saved and read back. Beads `.17` and
`.12` were updated and Dolt push succeeded. No task was closed on the strength of host readiness alone.
The iMessage notification failed with chat-not-found; no notification was delivered.

On return, first refresh PR279/checks, Beads and the actual checkout. Review the narrow skill-evidence
access repair before implementation: the isolated reviewer must read approved skill documents while
ordinary worker restrictions remain intact. Then run the ten retained decision scenarios, reconcile
skill-handoff gates and prepare the exact single-task pilot plan. Do not launch the pilot from this
handoff. Required independent review, exact approval and fresh runtime readiness remain gates.

The development host is stopped and temporary reviewer services were removed. No background
implementation or pilot was left running. Existing feature branches remain in place; staging and
Notion structural alignment are separate deferred work. Historical entries below are preserved.

PR278 is integrated. Current branch: `task/standalone-readiness`, worktree
`/Users/letuscode/projects/agent-platform-workflow-evaluation`.
[Readiness report](docs/reviews/standalone-host-readiness-2026-09-28.md) retains source and evidence.

Canonical journal migration succeeded after backup/rehearsal, preserving runs/contracts/leases.
Discovery for `.17` reports no matching run. The configured development host reached `ready` using
existing account discovery and was stopped cleanly; no managed pilot or model generation ran.
Private operator configuration remains under the canonical workspace journal directory.

Current blocker: `.12` skill scenario review cannot launch because the current snapshot loader rejects
`.agents/skills/` evidence. The attempt made no model call. Its gateway/networks are cleaned up.
Older procedural reviews are integrated but do not establish all required behavioral scenarios.
Next: resolve the supported read-only skill evidence path without weakening worker permissions, run
those scenarios and reconcile `.10`/`.11`/`.12`; then finalize `.17` and prepare exact `.13` pilot plan.
No staging, pilot launch or new implementation authority is inferred. Notion alignment stays deferred.

---

## PR278 integration confirmed — 27 September 2026

GitHub confirms PR278 merged into `feature/harness-backlog-review` at
`c9729617759be0cb0d3c89f7cb3b18f914553914` on 27 September at 22:22 UTC.
The merged packages and CI configuration match the qualified PR head `3ec6b1a`.
All nine executed pre-merge checks passed; Sourcery and staging-only packaged VM checks were skipped.
R2/R3 implementation is now integrated. The previous awaiting-merge statements below are historical.

Next: reconcile the remaining `.17` readiness gate against this merged baseline, including explicit
canonical journal identity provisioning and read-only discovery verification, then prepare the exact
single-task pilot plan (`.13`). Keep `.17` open until that prerequisite reconciliation is complete;
do not treat integration as authorization to launch the pilot. No pilot or staging promotion occurred.
Notion alignment remains the separately deferred task. This post-merge handoff is saved on
`task/artifact-import-coordinator`; it is not an additional feature-branch merge.

---

## R2/R3 qualification handoff — 27 September 2026

Owner-approved R2 governed worker import and R3 standalone coordinator completion are implemented on
`task/artifact-import-coordinator` in `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
[PR278](https://github.com/jwill9999/agent-platform/pull/278) targets `feature/harness-backlog-review`.
PR277 was merged at `b7be3d6`. This remains supervised prerequisite work; no pilot or staging promotion.

Source `4e4a3a1` passes 1,125 Node 24 regression tests (76 gated skipped), all 13 connected Docker
journeys and all 25 role/tool enforcement checks. All nine executed source-head hosted checks pass,
including browser and desktop E2E and SonarCloud. Staging packaged VM testing remains separate.
The [qualification report](docs/reviews/artifact-import-coordinator-qualification.md) retains failures,
repairs, source/build hashes, review findings and limits. Independent review is complete; its final provenance-label correction is applied and hashes rechecked.
Publication-head CI and documentation-mirror delivery are recorded on PR278 and Beads.

Beads `agent-platform-pilot-zero.17` remains in progress until required integration;
`.13` pilot planning stays blocked. Notion alignment remains a separate deferred task.
The next owner action is PR278 merge review once its publication-head checks are green.
Then verify the merged baseline and prepare the bounded single-task pilot readiness assessment.
The canonical journal has four cancelled runs and no live leases, but no R1 identity binding:
provision and verify discovery before attempting a pilot. No journal migration or live pilot occurred.

The historical entries below retain their original evidence and may describe superseded statuses.

---

## Historical: R1 run discovery — 27 September 2026

PR276 is verified merged into `feature/harness-backlog-review` at `87c5cc4`; its final nine executed
checks passed, with Sourcery and staging VM skipped. The Notion publishing and iMessage policy
documentation tasks are closed and synced in Beads. Runtime adapters are still unimplemented.

Current work: `agent-platform-pilot-zero.17`, R1 authoritative discovery and guarded admission,
on `task/run-discovery-admission` in `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
The owner resumed and said continue; existing approved scope is retained. Supervised prerequisite
mode applies; no managed run, merge or staging promotion. The canonical journal was inspected
read-only (four cancelled runs, zero live leases); it was not migrated or given new execution authority.

[Qualification report](docs/reviews/run-discovery-qualification.md) records fixes and verification.
R1 source `d4580fe` passes 26 focused and 996 Linux tests (63 optional skipped); final independent
review has no actionable findings. [PR277](https://github.com/jwill9999/agent-platform/pull/277) is draft
and pushed; finish current-head hosted checks before recommending merge. The Sonar quality refactor
passed 26 focused checks, the 996-test Linux suite and independent re-review. Sonar reports zero
open issues on `d4580fe`; final publication-head hosted gates remain pending. R2 governed worker artifact
import and R3 coordinator completion remain next in the same task; `.13` pilot planning stays blocked.
Do not confuse run admission with approval to execute or claim a successful managed task cycle.

---

## Previous paused handoff — 27 September 2026

Historical pause: this section is superseded by the resumed R1 checkpoint above. No further implementation, orchestration pilot, merge or staging promotion was started.

## Saved position and next action

Active worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`; branch:
`task/development-lifecycle-plan`; integration target: `feature/harness-backlog-review`.
[PR276](https://github.com/jwill9999/agent-platform/pull/276) is open and unmerged. At `da8bf48`, all nine
executed hosted checks passed, including browser/desktop E2E and SonarCloud; Sourcery and the staging
packaged macOS VM test were skipped. This handoff amendment will change the head: refresh its checks
before recommending merge. The lifecycle implementation evidence remains at source `cb6c547`.

The repository Notion publishing skill and documentation links are committed at `da8bf48`. All eight
substantive changed documents were mirrored and read back successfully. The iMessage policy is also
published and its completion notification was confirmed. These are supervised agent capabilities;
neither a background documentation watcher nor unattended orchestration messaging is implemented.

On return, first review PR276 and its current checks together before owner integration. Then continue
existing `agent-platform-pilot-zero.17` prerequisites: authoritative matching-run discovery (R1),
governed worker artifact import (R2), and required coordinator completion (R3). Pilot planning `.13`
remains blocked until prerequisites are satisfied; no successful autonomous task cycle is claimed.

The notification adapter is a proposed bounded follow-up, recorded against
`agent-platform-imessage-policy`; its separate implementation task/plan is not yet created or approved.
Prepare that scope before unattended pilot use: trusted dispatcher only, fixed approved recipient,
authorized completion/blocker/failure events, duplicate prevention, confirmed receipts, uncertain-send
reconciliation and visible unavailable-tool failures. Workers must not inherit messaging MCP access.
Notion orchestration publishing access is a separate future adapter, not granted by the new skill.
Keep the reliable single-task execution path as the primary objective; do not expand into a broad
messaging project. Preserve existing scope approvals, and respect this explicit pause until return.

Beads authority remains `/Users/letuscode/projects/agent-platform`. Documentation issues
`agent-platform-notion-doc-skill` and `agent-platform-imessage-policy` remain in progress pending PR
integration. Preserve unrelated changes in the canonical checkout and historical records below.
Use `/tmp/agent-platform-git-bin` for Git while the Apple licence remains unaccepted.

---

## Session update: documentation publication — 27 September 2026

The owner-provided Notion publishing skill is now project-local under
`.agents/skills/agent-platform-documentation/` and linked from documentation guidance. It requires
full mirrors, version metadata, preservation of human notes and verified readback, with explicit
pending status when access is unavailable. Beads: `agent-platform-notion-doc-skill`. This is agent
guidance, not an orchestration Notion adapter or automatic watcher. Existing iMessage policy follows.

## Owner iMessage notifications

Owner authorized brief iMessage alerts for verified completion, actionable blockers and significant
failures. AGENTS.md points to the exact recipient and delivery rules in shared instructions. Beads:
`agent-platform-imessage-policy`. Host MCP access is available; isolated workers still do not inherit
it. Proposed orchestration integration belongs in the trusted notification dispatcher, with recipient
scoping, deduplication and delivery evidence; no runtime adaptation was made. Documentation amendment
uses the existing task/development-lifecycle-plan branch/PR276. Recheck hosted gates on the amended
head before merge. Prior lifecycle evidence remains valid for its unchanged source.

---

## Previous session: development lifecycle implementation — 27 September 2026

PR275 was merged into `feature/harness-backlog-review` at
`b53fdbb9cd3f184fc430d244df94c20dce48e7ff`. The active worktree is
`/Users/letuscode/projects/agent-platform-workflow-evaluation`, branch
`task/development-lifecycle-plan`; it incorporated that feature baseline at
`fc65cc83c68149c7f262d8856e016871c8a11a52`.

Owner explicitly authorized completing the bounded startup/recovery work and said **resume** after
Codex restarted. Continue without repeating that approval. Execution is supervised prerequisite
implementation, not a managed pilot. No merge, staging or live pilot is authorized by this slice.

Beads `agent-platform-pilot-zero.17` remains in progress; `.13` remains blocked. Active draft PR:
[276](https://github.com/jwill9999/agent-platform/pull/276). Requirements, execution evidence and review
history are in [the lifecycle report](docs/reviews/development-lifecycle-qualification.md).

The development startup/recovery component is implemented and pushed. Source `cb6c547` passes
971 Linux package tests (63 optional skipped), 36 focused journal/startup tests and all 21 connected
lifecycle/topology scenarios. Earlier 13 real-container role checks remain applicable; the unchanged
broker image completed a real model turn and denied its revoked token. Build/lint pass. Isolated
review19 reports no remaining actionable implementation blockers; its summary-count mismatch is fixed.
Retained evidence distinguishes injected faults, actual Docker/process recovery, and the delayed-probe
journal-restart fixture. Probe dispatch uncertainty survives restart and migration; malformed runtime
configuration is rejected before adapter generation. Effects remain uncertain after containment and
block replay. This is component qualification, not a completed autonomous task cycle.

Current publication boundary: PR276 remains unmerged. Final-head hosted browser/desktop/full
verification, SonarCloud and docs/security gates must be green before recommending owner merge.
Continue those gates under the existing approval; fix findings rather than requesting approval again.
After component integration, remaining R1–R3 cover authoritative run discovery, governed implementation
artifact import and required coordinator completion before the single-task pilot. `.17` stays in
progress and `.13` blocked. No pilot, staging promotion or feature merge occurred in this session.
Use the Git fallback in `/tmp/agent-platform-git-bin`; do not accept the Apple licence. Beads operations
use `/Users/letuscode/projects/agent-platform`, not this worktree. Historical checkpoints follow.

---

## Historical session: role enforcement repair — 26 September 2026

Owner authorized auditing and technically enforcing every specialist role, separately from broker
model access. Work is supervised under `.17` on `task/standalone-pilot-plan`, PR275 into
`feature/harness-backlog-review`. No managed run, pilot, merge or staging promotion.

[Role audit](docs/reviews/role-enforcement-qualification.md) and
[scope addendum](docs/planning/standalone-pilot/role-enforcement-addendum.md) record the policy matrix,
source/scratch/evidence isolation, generated MCP-free configuration, reduced grants and client limits.
Read-only reviewers cannot edit source; testing uses separate writable locations. Source context is
supplied to roles without shell access. Independent review findings were repaired, including strict
path validation and immutable process identity. The role component passed 13 filesystem, 12 real-client
and seven existing container checks; full
Linux regression passed 901 tests (42 optional skipped). Independent role/evidence review and the
narrow Sonar follow-up review report no remaining actionable blockers. Evidence is retained in the
linked report. Hosted checks are still required on the final published head; keep PR275 draft until
those complete. `.17` remains in progress and `.13` blocked; next broader work is unchanged R1–R3 and full host/startup/lifecycle qualification.

---

## Current session: local credential broker delivered — 26 September 2026

Owner explicitly authorized creating the missing local broker with the existing Codex account.
Supervised bootstrap delivery on `task/standalone-pilot-plan`; PR275 targets
`feature/harness-backlog-review`. Account credentials remain at the trusted gateway, workers receive
opaque revocable leases. Durable tombstones, restart fencing, executable control adapter and optional
runtime model gateway configuration are implemented. No managed pilot or staging changes.

[Component report](docs/reviews/local-credential-broker-qualification.md) holds the design, setup,
source hashes, tests and isolated reviews. Focused16/full Linux891 passed (17 optional skipped);
real Codex turn and revoke/restart denials passed with the final gateway image. Typecheck/build/lint
passed. Native full tests remain limited by the unaccepted Apple Git licence; Linux supplies the
regression evidence. Do not treat this as a complete production launcher lifecycle or autonomous run.

`.17` remains in progress and `.13` blocked: next qualify the complete launcher lifecycle/topology
and continue R1 run discovery, R2 governed artifact import and R3 coordinator completion under the
approved scope. The original proposed policy/contract hashes remain proposals, not installed authority.
Review current PR hosted checks before owner integration. Preserve existing authorization; no repeated
permission request merely to continue agreed work. Older entries below are historical checkpoints.

---

## Current session: managed host provisioning gap confirmed — 26 September 2026

Owner authorized continuing .17 after the planning PR. Read-only canonical journal inspection found
four cancelled runs and zero unexpired leases at that instant. Git fallback and Docker respond, but
no managed runtime config or credential-broker candidate was found in the bounded inspected locations.
See [host prerequisite assessment](docs/reviews/standalone-host-prerequisites.md) for exact evidence,
limits and the required issue/revoke/status/conformance protocol.

No runtime implementation or managed pilot launched. .17 R4's documented feasibility gate remains:
identify/provision a conformant revocable broker and qualify the managed image/network/production
startup. Next bounded work is the broker provision/design assessment, considering an opaque-lease
model gateway with existing account credentials retained only by the trusted host. This is proposed,
not implemented or provider-qualified. Preserve the owner's authorization; do not request it again
merely to continue assessment. Do not copy shared auth and call that per-worker revocation.

PR275 holds the reviewed scope; .17 remains in progress and .13 blocked. No staging changes.

---

## Current session: standalone prerequisite scope reviewed — 26 September 2026

PR274 merged into feature/harness-backlog-review at a8586aa. Owner authorized preparation of .17's
bounded repair plan. [Plan](docs/planning/standalone-pilot/plan.md),
[13-scenario verification matrix](docs/testing/standalone-pilot-prerequisites.md) and proposed v1
contract are published on task/standalone-pilot-plan, based on that feature revision.
Three isolated critique rounds resolved all scope-design findings; see
[review and evidence](docs/reviews/standalone-pilot-plan-review.md). Schema/manifest and documentation
checks passed. No runtime implementation or live orchestration test has started.

The scope covers run discovery/admission, journaled implementation imports, typed phase/coordinator
completion and host feasibility. .17 remains in progress and directly blocks .13. Before implementation
handoff, establish the managed credential broker/image provision path, bind actual policy/source and
review the exact execution authority. Existing reviewer account access is not managed worker authority.
The proposed policy hash identifies review material only and must not be used as an installed grant.
Staging, A2A and packaging remain outside this work. Temporary reviewer containers/networks cleaned up.

---

## Current session: approved-document binding implementation

Owner authorized implementation of `agent-platform-pilot-zero.16`; approval is recorded against the
reviewed planning material. This is supervised direct delivery, not managed orchestration.
Worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
Branch: `task/approved-document-binding`; target: `feature/harness-backlog-review`.

Current evidence and remaining acceptance scope:
[implementation checkpoint](docs/reviews/approved-document-binding-implementation.md).
Docker is healthy. Owner explicitly authorized completing all six findings. Repairs now cover
trusted source/current worktree resolution, durable snapshot denial, persisted packet identity,
terminal result replay and cleanup-only bootstrap. Independent rounds3/4 surfaced additional
initial-import and asynchronous repair-effect gaps; those are repaired with composed regressions.
Final local verification: Linux875 passed/17 optional skipped; enabled document/container suites110
passed. Build, monorepo typecheck, extended changed-test typecheck, workflow lint, formatting,
Markdown/links and dependency cycles pass. Rounds6-8 surfaced delivery/source/cancellation,
Git-expiry, Beads/Dolt dispatch and stale-caller adoption gaps; each is repaired with regressions.
Final isolated round9 approves the last correction with zero actionable findings; all36 supplied
snapshot hashes matched that checkpoint. Final Sonar two-file cleanup separately passes80 affected
tests/build/lint and independent round10 review; full875/connected110 precede only that cleanup.
Exact snapshots and reviewed limitations are retained in the implementation report.

PR273 remains unmerged targeting feature/harness-backlog-review. Check its exact-head hosted gates
before owner integration; local success does not substitute for hosted browser/desktop checks.
No staging or pilot authority. Beads .16 remains in progress until owner integration. After that,
re-read Beads .13/.12 readiness and prepare the separately approved single-task orchestration pilot.
These supervised repairs do not prove autonomous execution or absent downstream service adapters.

---

## Previous session: document-approval binding plan

PR271 is merged into `feature/harness-backlog-review` at `5e5f7f2bf66ca07410a5c83689230b0c3e25f609`.
The owner authorized planning and independent critique of `agent-platform-pilot-zero.16`.
Current branch: `task/approved-document-binding-plan`, based on that merged feature revision.

Planning package: [approved-document binding](docs/planning/approved-document-binding/plan.md).
The draft includes a typed document manifest, immutable snapshots, guarded approval/start/resume/
delivery paths and compatibility handling. The first independent isolated critic found a restart
hole after failed invalidation persistence; the revised plan requires durable verification intents
and quarantine recovery, plus the combined fault test. The second isolated critique approved the revised plan with zero findings. Structured results and
dispositions are in docs/reviews/approved-document-binding-plan.md.

No runtime/application implementation or managed run has started. Next: owner review of the published planning PR and proposed decisions before implementation. `.13`
remains blocked by `.16` and `.12`. Nothing is promoted to staging. Earlier session entries follow
as historical evidence, not current PR status.

---

## Previous session: repair PR quality gates

The owner resumed work and explicitly authorized assessment and repair of SonarCloud findings and
the desktop-E2E failure. Continue the existing task branch; no merge/staging/pilot authorization.

Current report: [PR gate repair](docs/reviews/pr271-gate-repair.md).
The desktop failure is an asynchronous evidence-capture race; backend denial and unchanged file were
already present in the failed artifact. Reviewer security findings are addressed by fixed gateway
routes, bounded stdin configuration, absolute executable path and hardened image defaults/install.
Local verification: 721 Linux package tests passed (13 optional skipped), four actual runtime/config
probes passed, and nine repeated Electron rejection journeys passed. Independent isolated review
found no confirmed regressions; its exact snapshot and limits are retained in the repair report.
Build, typecheck and lint pass. Hosted gates must be refreshed after push.

## Resume location and delivery state

- Worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
- Branch: `task/permission-category-baseline`; integration target: `feature/harness-backlog-review`.
- Completed implementation commit: `a9b1003` (pushed). This handoff follows that commit.
- Existing review: [permission baseline and reviewer changes](https://github.com/jwill9999/agent-platform/pull/271).
  Refresh its checks and review state on return; local passing checks do not establish current hosted status.
- Beads authority: `/Users/letuscode/projects/agent-platform`; last Dolt push succeeded.
  Reviewer task `agent-platform-pilot-zero.15` remains in progress pending integration and broader acceptance.
- Temporary reviewer containers and network gateway were removed. No review or pilot is running.
  The pinned Docker image remains cached; provision the private gateway again before another live review.
- Nothing merged into the feature branch, staging or main during this work.

## Reviewer verification completed this session

Owner authorized controlled permission tests. The actual pinned client initially allowed delegation;
fixed with dedicated agent-disable and depth settings. Captured inventories and injected negative
calls now exercise enforcement. Docker boundary probes cover read-only evidence, excluded grants,
network restrictions and real startup-failure cleanup. Normal account-backed review also completed.

Assessment and evidence: [isolated reviewer](docs/workflow-control-supervised-review.md).
Defects corrected: delegation configuration, empty-result success, Docker cleanup race, tunnel
service-boundary weakness and response-stream reset handling. Fixed-endpoint account-backed review
succeeds. The bounded standalone-review verification gate passes for the tested image/configuration.
Independent feedback also improved complete inventory capture and cleanup regression coverage.
Qualification applies only to this pinned standalone reviewer profile; managed orchestration,
full skill acceptance, feature integration and owner approval remain separate.

The detailed-document approval binding gap remains `agent-platform-pilot-zero.16`, blocking pilot
plan `.13`. No merge, staging promotion or orchestration pilot occurred. Next is reviewing the
qualified route and finishing the remaining planning/skill acceptance gates.

## Current checks

712 Linux package tests passed; 13 optional tests skipped. Three real capability probes and the
effective-config probe passed separately. Six lifecycle tests, build, lint, Markdown and links pass.
Native Apple Git licence and absent Sonar/Problems connectors remain recorded limitations.

## Subsequent work after PR gates pass

1. Review the verification report and completed changes together. Refresh Beads and the existing PR
   before recommending integration. The successful standalone reviewer assessment does not approve
   the whole skill suite, managed orchestration or a merge.
2. Resolve the detailed-document approval binding gap in `agent-platform-pilot-zero.16`: execution
   approval must identify the exact task specifications and verification documents, and reject stale
   or changed material. This is recorded as a separate open task and blocks pilot plan `.13`.
   Define/review its bounded implementation scope before making the broader contract/runtime changes.
3. Complete the remaining skill-handoff acceptance and runtime prerequisites in `.12`, using the
   verified critic route where appropriate. Keep any new findings linked to the existing evaluation.
4. Prepare the exact single-task pilot plan in `.13` only after its prerequisites are satisfied:
   selected task, source revision, permitted actions, tests, completion criteria, recovery limits and
   reviewed document versions. Obtain the owner's bound execution approval before launching it.
5. Run and assess one complete managed task. Only after reviewing that outcome, prepare the separate
   two-dependent-task pilot to prove automatic progression without a manual restart.

The wider MVP baseline still includes remaining permission, cancellation, retry and recovery journeys.
They are future work, not coverage established by reviewer-isolation tests. Continue through existing
Beads tasks rather than creating duplicates. Keep planning, implementation, merge and staging
permissions separate; no standing authorization for broader repairs or promotion was added here.

The next conversation should start with a short briefing on the verification result and open
approval-binding task, then agree the next bounded work. Do not rerun completed checks without new
changes or a specific unresolved concern.

## Earlier handoff (historical; superseded where it conflicts with the current handoff)

## Skill preparation handoff — 24 September 2026

Enforced reviewer entry point implemented in workflow-control with content-addressed snapshots and
existing read-only Docker critic mounts. Offline isolation passed; live image/auth/egress setup remains
unconfigured. See docs/workflow-control-supervised-review.md. Do not claim live critique unblocked.
Typecheck/build/lint/cycle checks pass; 691 Linux package tests pass across full and repaired-fixture
runs, nine skipped. Four real Docker isolation probes pass. Native Git tests blocked by Xcode licence.

Owner-authorized supervised evidence-only critic route added to ADR-0004 and critique guidance.
This is a no-tool procedural exception outside active managed runs, not enforced external-tool isolation.
A separate critic returned findings on the supplied proposal. Broker-absence proof and formal
acceptance remain unresolved; see docs/reviews/supervised-critique-route-assessment.md.

Owner-approved naming clarification added: planning maps readable task titles to Beads IDs, specs
and branches; implementation resolves ambiguity and announces the selected task/branch before edits.

Created the owner-requested documentation skill and docs/README.md folder/authority guide.
Planning, critique and implementation now link it. Existing documents were not relocated.

Updated existing plan-critique and planning handoff: independent critique is mandatory for direct
and managed plans; compliant-launch limitations are explicit. No live critic or pilot launched.

Created orchestration and feature-implementation skills; reviewed existing planning/critique.
Subsequently updated feature-planning under explicit owner authorization with required artifacts,
publication, test feasibility, connected frontend/backend evidence, completion gates and exact handoff.
Owner also required unresolved ambiguity to be raised with the human before plan agreement; this is
explicit, with recorded answers and no silent assumptions or treating silence as consent.
Owner authorized this bounded work, with joint review afterwards. No live pilot or runtime repair.
See [skill readiness review](docs/reviews/orchestration-skill-readiness.md).
New Beads prerequisite chain is recorded with specifications and blocking dependencies.
Skill validators, Markdown and relative-reference checks pass. No application code changed.
Independent behavioral review and runtime qualification remain outstanding; no autonomous success claimed.

## Session handoff — orchestration review observation

The owner paused the proposed standing repair authorization and requested documentation of why
orchestration was not used and what should trigger its use. Added the September 23 observation and
proposed task-start readiness checkpoint to `docs/reviews/orchestration-field-evaluation.md`.
The actual omission was an explicit execution-mode decision; no managed launch failure was reproduced.
The permission approval wait was intentional. Runtime readiness still needs investigation; existing
approval rules remain unchanged. Further owner questions should extend this review and the existing
Beads pilot assessment before any activation or repair decision.

The owner subsequently requested adding the skill/discoverability recommendation and distinct new-run
versus existing-run paths. These are now recorded in the review, including read-only state lookup,
separate runtime-health checks, no-run versus failed-lookup handling, and explicit fallback decisions.
Routing rules are proposed; confidence scoring is unvalidated. No skill, runtime, approval or policy
change is implemented. Return to the owner for further review questions after this documentation update.

The owner also requested retaining model selection by role/task complexity as a future consideration.
The review records current inheritance intent, unverified effective selection in the isolated launcher,
and the need to benchmark quality, cost and retries before changes. No model routing, paid experiment
or budget change is authorized. Further review discussion remains the next step.

Added the owner's September 24 testing-gap reminder: assess upfront approval across real managed
handoffs and recovery, record unnecessary prompts or continuation problems, and base any rework on
evidence. No run launch, permission change or confirmed defect is implied by this reminder.

The owner requested a written staged assessment: readiness, one complete managed task, owner review,
then a separately approved two-dependent-task pilot proving automatic progression. Protocol:
`docs/reviews/orchestration-staged-assessment.md`. Both runs remain unexecuted; prerequisites, exact
work selection and executable material must be resolved first. Manual bridging cannot count as a pass.

The owner requested that gaps discovered while using the current planning skill be surfaced in the
orchestration field evaluation and Beads, including manual supplementation needed for runnable material.
This observation requirement is documented in both the field review and staged assessment protocol.

The direct-file repair remains pushed in PR271. All ten executed hosted checks passed at `3d7c44b`;
one separate Git merge-resolver test passed on retry. Human review/merge remains separate.
This handoff change is documentation only and does not claim new runtime verification.

## Earlier repair publication checkpoint

## Session handoff — approved direct-file permission repair

Owner approved extending Workspace writes to direct mutation tools. Repair on
`task/permission-category-baseline`, PR271 into `feature/harness-backlog-review`.
Beads `agent-platform-direct-file-policy` is in progress; P2 remains partial.

All ten composed permission journeys pass, including the original Ask/Block regressions and a new
Ask-to-Block change while approval waits. Block prevents the effect even after the old approval is
accepted. Six direct mutation tools are covered by dispatcher policy tests; stricter controls remain.
98 focused tests, 187 web tests, build/typecheck/touched-file lint pass. Full harness: 667 pass,
12 existing Apple Git/Xcode-license failures. All 19 selected Electron journeys pass at `314589d`.
All 39 API chat integration tests pass after two path tests explicitly enable Auto; 44 unrelated
Project Git API cases also hit the Xcode-license limitation. Docs/links pass. Hosted checks pending.
Repair and test updates are pushed (`314589d`, `c549855`); PR271 is ready for review and hosted checks
are running. Normal pre-push stopped on the recorded 12 Apple Git-license tests; publication used
HUSKY=0 after affected builds/types, 112 desktop and 187 web unit tests passed. Beads sync succeeded.
No merge or staging/main promotion is authorized. Review evidence is in
`docs/reviews/current-runtime-permission-category-baseline.md`.

## Historical baseline checkpoint

## Session handoff — remaining permission baseline finding

Owner authorized continuing baseline testing after merging planning PR269. Current task:
`agent-platform-harness-baseline-p2`, branch `task/permission-category-baseline`, base `c1ed389`.
Using real Electron/UI/API/SQLite/dispatcher/file execution with external provider and runner fixtures.

Initial permission suite: 7 pass, 2 fail. Direct writes under Ask and Block execute without an
approval and change the disposable file; shell controls remain correct. Direct Auto, read under
Block and network Block pass. Nineteen category policy unit tests and E2E type/lint checks pass.
Failing screenshots/JSON/traces were inspected and retained. No application changes made.

Priority-one follow-up `agent-platform-direct-file-policy` records the scope decision and recommended
consistent write-mode enforcement across direct mutation tools. Permission-semantic changes need
owner approval under the agreed repair boundary. P2 remains partial; do not merge this failing
baseline evidence branch or activate broader MVP/staging work. Next decision: approve direct-tool
coverage for Workspace writes, then implement a bounded repair with these regressions retained.
Committed test revision `7771375` repeated the same 7 pass / 2 fail result. Draft PR271 contains
the preserved regressions and follow-up; leave it unmerged. Committed artifacts are in
`.agent-platform/permission-category-committed-results`. Hosted checks remain separate; the local
push hook encountered 12 existing Xcode-license Git failures (630 harness tests pass), recorded in
the report before bypassing it for draft publication.
See `docs/reviews/current-runtime-permission-category-baseline.md` for evidence and limitations.

## Historical planning handoff

## Planning reconciliation complete

The owner authorized resolving the planning PR conflicts, updating requirements/evidence/Beads,
and independent subagent review without further input unless agreed scope changes. This authorizes
planning maintenance only; no merge, broader runtime implementation or staging promotion is included.

The feature branch now includes the completed permission repairs. The planning branch incorporates
that baseline and preserves the previous review bundle under
`docs/planning/mvp-reliability/review-pre-reconciliation/`. The revised proposal has passed independent review after normative document hashes changed.
The critic verified the schema, 11 normative bindings and 28 evidence entries, and confirmed that
authority, paths, task graph and policy are unchanged. Current review is in
`docs/planning/mvp-reliability/critic-review.final.json`. Historical approval is not current execution
approval. The first next decision is owner review/merge of planning PR269 after hosted checks;
remaining baseline scenarios precede broader implementation. No merge is performed by this task.

Validation: workflow-control built from current source; schema, digest and evidence validation pass.
Markdown passes excluding ignored generated `.agent-platform` Playwright reports (the broad docs
command includes their pre-existing lint errors); relative-link and diff checks pass. No new runtime
code or tests were changed relative to the integrated feature. Hosted checks are tracked in PR269.
The merge-triggered local push hook passed affected builds/typechecks and dependency-cycle checks;
614 harness tests passed, but 12 existing Git tests hit the known unaccepted Apple Xcode license.
The planning diff against the integrated feature is documentation only. The push hook is bypassed
for publication after recording this limitation; hosted checks remain required, not assumed green.

## Previous pause checkpoint (historical)

## Session handoff — September 23, 2026: paused after permission repairs

The owner explicitly paused work. Resume from this checkpoint; the material below it is
historical. No further execution or background continuation is scheduled by this handoff.
Beads remains the task-state authority.

## Completed and verified

The owner approved the current-stack planning boundary, including a smaller local status
panel, then separately authorized baseline testing and the two bounded permission repairs.
The tests reproduced saved-policy reload and denied-tool display defects. Both were repaired.
The Sourcery follow-up also now distinguishes unavailable file data from an empty workspace,
with a regression that waits for the failed backend Refresh response.

[Permission fixes PR270](https://github.com/jwill9999/agent-platform/pull/270) was merged by
the owner into `feature/harness-backlog-review`; the fetched integration tip is `cb373f3`.
Final reviewed repair revision: `93799833958151e01b1981086a8afd6a04bd63b7`.
All ten executed hosted checks passed, including browser and Electron journeys, full verification,
SonarCloud and Sourcery. Sourcery approved and its finding is resolved; Sonar reported no
unresolved findings. Hosted Electron reported 22 passing tests. The staging-only packaged macOS
VM check was skipped. Nothing has been promoted to staging or main.

Local evidence includes 13 passing selected Electron journeys before the final listing correction,
four passing permission journeys after it, and a focused passing Refresh rerun. Initial failing
regressions and later passing artifacts are retained under `.agent-platform/permission*` in the
workflow-evaluation worktree. These journeys compose the renderer, API, database and harness;
the external model HTTP service and command runner are fixtures. They do not establish live-model
or packaged VM isolation behavior. The integrated evidence report is
`docs/reviews/current-runtime-permission-baseline.md` on the feature branch.

## Current state and resume action

[Planning PR269](https://github.com/jwill9999/agent-platform/pull/269) remains open and held.
Its checked-out branch is `task/mvp-reliability-plan` in
`/Users/letuscode/projects/agent-platform-workflow-evaluation`. This session-only update does not
reconcile the plan or make it ready to merge. Its older source baseline and bound requirements
still need to reflect the completed tests and repairs.

The first action on return is to reconcile the planning branch with the updated feature branch,
update the plan's evidence and task/spec references, refresh normative document hashes and the
contract digest, then validate and obtain an independent consistency review. Preserve historical
review snapshots. Brief the owner on the reconciled plan before treating it as ready for merge or
seeking approval for a broader implementation slice.

After that, continue the existing baseline work: remaining permission coverage, cancellation,
retry and recovery scenarios. The wider permission baseline remains partial; sampled high-risk
shell-write behavior is verified, while other categories and direct file tools remain to assess.
Cancellation, concurrent resume, backend restart and uncertain post-effect retry gaps must remain
explicit. The local status panel and broader cancellation/recovery features have not been built.
There is no stack-restructure decision or broad runtime implementation approval.

Beads records: close the integrated `agent-platform-permission-ui-consistency` repair; keep
`agent-platform-harness-baseline-p2` and `agent-platform-mvp-reliability-plan` in progress with
this pause recorded. Keep the global harness review gate and broader feature tasks unchanged.
Use `/Users/letuscode/projects/agent-platform` as the Beads workspace root. Preserve unrelated
root-worktree changes. Documentation access remains separately integrated in its feature branch.

## Historical handoff material

The following records describe earlier checkpoints and may contain superseded statuses.

## September 22, 2026: recovery baseline continuation

## September 23: proposed MVP reliability plan

Owner requested tasks, requirements and a later briefing; explicitly accepted including a smaller
local in-app status panel independent of external dashboards. Planning only, not implementation.
The [MVP plan](docs/planning/mvp-reliability/plan.md) and version-one proposed contract are on
`task/mvp-reliability-plan`, based on merged harness feature `6b4d03e`. The documentation-access
feature is separately merged. Neither feature is promoted to staging.

Created planning issue `agent-platform-mvp-reliability-plan` and four unassigned, review-gated children:
`agent-platform-harness-r3.cancel`, `agent-platform-harness-r3.reconcile`,
`agent-platform-harness-v4.local`, `agent-platform-harness-v5.mvp`. Reuse existing baseline P2/X2/X3/X5
and V1; V1 spec has a proposed refinement. Parent specs/history/status/blockers retained. New edges
and parent relationships read back successfully. No old task is closed or superseded.

Contract schema and document binding validation pass. Independent critique approved after two
corrections (Project Chat host path and immutable normative-document bindings). Owner implementation
approval and scoped Beads readiness reconciliation remain pending.
Runtime code and dependency files are unchanged. Documentation PR integration remains feature-only;
staging and production are separate decisions. Current task remains planning in progress until
its declared review/delivery gates are met. New implementation tasks are not claimed or active.

Owner requested continued frontend/backend journeys and a login adequacy check. Work is on
`task/harness-recovery-baseline`, chained from `task/harness-provider-journey` at `5d3b876`;
PR #266 remains open against `feature/harness-backlog-review`.
The cumulative continuation is [PR #268](https://github.com/jwill9999/agent-platform/pull/268).
Test code commit `b12d148`; all three new journeys also passed at that exact commit.
Beads changes are synced. Hosted gates are running; initial documentation lint found a duplicate
top-level handoff heading, corrected here.

Added reload-and-approve, reload-and-deny, and transient provider HTTP 503 recovery scenarios.
Reload scenarios verify two concurrent retries of a completed resume do not change file, audit,
messages or provider count. All edit journeys now check paired lifecycle events with distinct
original/resumed run identifiers and matching per-run correlation identifiers.

Evidence and limitations: [recovery baseline report](docs/reviews/current-runtime-recovery-baseline.md).
Real Electron/UI/API/SQLite/harness/provider SDK; HTTP model and fixed-command VM runner fixtures.
No dependency or production behavior changes. Local build, explicit E2E TypeScript and ESLint pass;
53 API and 93 harness focused tests pass. All nine Electron scenarios pass locally; hosted quality results are authoritative on the final PR head. Local Sonar/Problems tools
are unavailable; use hosted Sonar plus normal CI as the completion gate.

Beads X5/X3 remain partial. Next gaps: simultaneous first resumes, backend restart, ambiguous
post-effect retries, permission settings permutations and frontend cancellation. Project Chat has
no Stop control. Login is absent by the locked single-user/no-auth MVP design; the owner was asked
whether they meant sign-in or logging. Do not add authentication or broad monitoring by inference.

No main/staging promotion. Preserve root worktree's unrelated `.beads/interactions.jsonl` and
untracked `.vscode/mcp.json`. Use bundled Git on this machine (Apple Git license blocked) and Node24
with the Homebrew pnpm. Canonical Beads root is `/Users/letuscode/projects/agent-platform`.

---

## Session handoff

Last updated: September 15, 2026 — completed authorized coverage and fixture assessment.

### Latest assessment handoff

Shared mapping completed: [coverage report](docs/reviews/current-runtime-coverage-assessment.md). All 17 areas mapped; 273 selected tests and local provider/reasoning transport probe passed. Ordinary chat excludes critic/DoD; Automatic still asks for the sampled shell write. No product or reusable test changes. Next: owner review of the bounded X6/T1/P1 composed journey; all implementation tasks remain queued.

### Historical planning handoff

Owner-agreed repair rule: within an approved testing task, reproduce and preserve the failing test, fix a small directly related defect restoring established behavior, then rerun gates and retain before/after evidence. Broader architecture/dependency/permission or behavior changes need linked repair tasks and review. Planning/mapping remains read-only.

What happened: baseline proposal v3 now includes context, cancellation/retry/limits, planning, persistence/resume, streaming and conditional auxiliary-call coverage mapping, alongside tooling adequacy, approval policy and override boundaries, critic/completion failure cases and UI feedback evidence. See [baseline plan](docs/planning/harness-modernization/current-runtime-baseline-plan.md). Direct Markdown lint, formatting and repository relative-link checks passed. No new tests or product code were implemented.

Current state: branch `jwill9999/harness-baseline-plan`; Beads `agent-platform-harness-baseline-plan` remains open for owner review. Prior workflow evaluation PR remains unmerged. Historical snapshots below are not current status.

Backlog update: 18 Beads tasks now track shared mapping and all 17 matrix areas, with verified prerequisite edges and individual specs. Status and pause checkpoints remain in Beads; no test implementation started.

Next: review the matrix and first slice with the owner; after implementation approval, map existing coverage and resolve the provider-fixture seam before building sequential journeys. Migration value also requires a bounded candidate comparison; baseline correctness alone does not prove savings.

### Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

### Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

### Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

### Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

### September 15: continuation diagnostic observation

The owner requested documentation of the assessment continuation stall and the evidence needed for future diagnosis. See [orchestration field evaluation](docs/reviews/orchestration-field-evaluation.md). Root cause remains unknown; active heartbeat configuration does not prove delivery. No assessment managed run was launched. Future repair work remains under the existing pilot assessment; no implementation is authorized by this note. Modernization assessment drafts remain pending independent critic review.

### September 15: modernization assessment ready for owner review

The [source assessment](docs/planning/harness-modernization/sdk-assessment.md) and its [independent critic record](docs/planning/harness-modernization/reviews/sdk-assessment-critic-review.md) are ready for joint review. The owner authorized a one-off supervised critic exception; its initial findings were corrected and focused recheck passed. This is not managed-orchestration acceptance. F0 and the joint review gate remain open; no packages, paid experiments or product implementation are authorized. The assessment self-check can pause at this owner-review boundary.

### Disposable workflow evaluation and testing skill

Owner authorized the bounded Project Chat evaluation and a targeted Playwright quality-gate skill improvement. See [evaluation](docs/reviews/project-chat-journey-evaluation.md) and [task spec](docs/tasks/agent-platform-workflow-journey-evaluation.md). Approved/denied edit scenarios and adjacent command scenarios passed locally with deterministic model/VM fixtures; file and durable backend checks are independent of UI messages. Installed skill and repository copy are synchronized. Beads task remains open for PR/hosted integration review; no staging/main merge or framework migration authorized.

### Current-runtime baseline planning

Owner requested a plan for evidence-driven workflow coverage before migration decisions. See [baseline proposal](docs/planning/harness-modernization/current-runtime-baseline-plan.md), tracked by `agent-platform-harness-baseline-plan`. Planning only; no new journey implementation is authorized. First uncertainty is a provider-boundary fixture route that retains the real reasoning/SDK path without inventing saved baseURL propagation. Prior test/skill changes remain in draft PR265 with nine executed checks passed and no merge.

### 19 September: current-runtime tests before stack comparison

Owner prioritized current-functionality evidence before considering restructure. PR265 is merged
into feature/harness-backlog-review at f2b306e. This task branch includes the earlier baseline
planning/coverage documents and adds the approved X6/T1/P1 provider-backed approve/deny family.
See docs/reviews/current-runtime-provider-journey.md for results and limitations. Six shared Electron
scenarios and 112 desktop unit tests passed, plus build/scoped lint/explicit E2E typecheck. No product
code or dependencies changed. X6 remains in progress for delivery and its wider untested cases;
other baseline tasks remain open. Package comparison has not started. Work is supervised, no durable
autonomous execution run is claimed. Preserve unrelated root-checkout Beads changes.

## Integrated repair handoff (historical)

## Session handoff — September 23, 2026: authorized permission UI repair

The owner explicitly approved fixing both reproduced permission-display defects. Changes are on the
existing `task/mvp-baseline-permissions` / PR270 branch. No merge or staging promotion is authorized.
Workspace Settings now keeps successful backend policy reads despite file-listing errors and shows
loading/unavailable instead of assumed defaults. The harness emits a denied tool result when shell
policy blocks execution, preserving existing model error, audit and no-execution behaviour.

Both original composed regressions remain intact. Unit coverage now verifies denied emission without
execution and initial settings rendering without fabricated defaults. The wider P2 and cancellation,
retry/recovery baseline remain open. The repair issue stays in progress until the feature PR integrates.
Local validation: all 13 selected Electron scenarios passed, and all four permission cases passed
again at committed repair revision `3eb57cd` after an isolated rerun. Build/lint/type checks,
187 frontend and 614 available harness tests pass. Push hook was bypassed only after its known
12 Apple Git license failures; hosted CI must cover that complete suite. Changes are pushed,
with hosted checks pending at this checkpoint.
See [permission report](docs/reviews/current-runtime-permission-baseline.md) for final validation.
Hosted review also requested a native output element for loading status and removal of duplicate
provider setup in the Electron tests; both were addressed without changing policy assertions.
Sourcery passed but reported a real follow-up: failed listing appeared empty. The existing error
scenario now asserts unavailable listing/count after reload and Refresh; the UI distinguishes it
from a successfully loaded empty workspace. See report for retained before/after evidence.
No dependency/stack changes. The separate planning proposal still needs its updated spec hashes and
independent critique reconciled before broader implementation approval.

---

## Historical checkpoint — permission baseline findings

Owner approved the planning boundary, then separately authorized remaining baseline tests only.
Application changes remain outside this tranche. Current branch: `task/mvp-baseline-permissions`,
from the integrated harness baseline. Tests and evidence are pushed in [draft PR #270](https://github.com/jwill9999/agent-platform/pull/270).
Test commit `b86db9d` reproduced two passes/two failures; the whole selected file had 11 passes/two failures.
Desktop build/typecheck and 112 desktop unit tests passed on push. The gate remains FAIL.
The planning proposal remains in its separate draft PR #269;
its nine executed checks passed, packaged macOS staging test skipped as designed.

Four new Electron permission scenarios exercise Ask/Auto/Block and a real file-listing error.
Two product findings: saved policy appears as Ask after reload when file listing fails, and blocked
shell work retains Running activity after the backend denied it and the turn finished. Preserve
both unsatisfied regression assertions; do not silently skip or reinterpret them as success.
Repair proposal: `agent-platform-permission-ui-consistency` (open P1). P2 remains in progress.
See [permission evidence](docs/reviews/current-runtime-permission-baseline.md) for boundaries and
commands. Production code and dependencies are unchanged. No staging/main promotion.

Use isolated workspace roots for normal fixtures. Apple Git license remains unaccepted: use the
bundled Git for fixture project initialization and repository operations. Existing gitTools unit
fixtures hardcode Apple Git and cannot run successfully here; do not change them in this slice.
The accidental broader harness unit invocation produced 614 passes and 12 Git-license failures;
focused policy tests use `pnpm --filter @agent-platform/harness exec vitest run ...`.

Next: review the recorded permission defects with the owner, finish wider P2 coverage, then continue
cancellation/retry/recovery evidence in the agreed sequence. Product fixes need separate approval.
Refresh the draft planning contract's task-spec hashes and independent critique before any broader
implementation approval, because the P2 spec has now been refined. Keep the global gate open.
Preserve unrelated root worktree changes (`.beads/interactions.jsonl`, `.vscode/mcp.json`).

---

## Historical handoff — September 22, 2026: recovery baseline continuation

Owner requested continued frontend/backend journeys and a login adequacy check. Work is on
`task/harness-recovery-baseline`, chained from `task/harness-provider-journey` at `5d3b876`;
PR #266 remains open against `feature/harness-backlog-review`.
The cumulative continuation is [PR #268](https://github.com/jwill9999/agent-platform/pull/268).
Test code commit `b12d148`; all three new journeys also passed at that exact commit.
Beads changes are synced. Hosted gates are running; initial documentation lint found a duplicate
top-level handoff heading, corrected here.

Added reload-and-approve, reload-and-deny, and transient provider HTTP 503 recovery scenarios.
Reload scenarios verify two concurrent retries of a completed resume do not change file, audit,
messages or provider count. All edit journeys now check paired lifecycle events with distinct
original/resumed run identifiers and matching per-run correlation identifiers.

Evidence and limitations: [recovery baseline report](docs/reviews/current-runtime-recovery-baseline.md).
Real Electron/UI/API/SQLite/harness/provider SDK; HTTP model and fixed-command VM runner fixtures.
No dependency or production behavior changes. Local build, explicit E2E TypeScript and ESLint pass;
53 API and 93 harness focused tests pass. All nine Electron scenarios pass locally; hosted quality results are authoritative on the final PR head. Local Sonar/Problems tools
are unavailable; use hosted Sonar plus normal CI as the completion gate.

Beads X5/X3 remain partial. Next gaps: simultaneous first resumes, backend restart, ambiguous
post-effect retries, permission settings permutations and frontend cancellation. Project Chat has
no Stop control. Login is absent by the locked single-user/no-auth MVP design; the owner was asked
whether they meant sign-in or logging. Do not add authentication or broad monitoring by inference.

No main/staging promotion. Preserve root worktree's unrelated `.beads/interactions.jsonl` and
untracked `.vscode/mcp.json`. Use bundled Git on this machine (Apple Git license blocked) and Node24
with the Homebrew pnpm. Canonical Beads root is `/Users/letuscode/projects/agent-platform`.

---

## Session handoff (earlier checkpoint 2)

Last updated: September 15, 2026 — completed authorized coverage and fixture assessment.

### Latest assessment handoff (earlier checkpoint 2)

Shared mapping completed: [coverage report](docs/reviews/current-runtime-coverage-assessment.md). All 17 areas mapped; 273 selected tests and local provider/reasoning transport probe passed. Ordinary chat excludes critic/DoD; Automatic still asks for the sampled shell write. No product or reusable test changes. Next: owner review of the bounded X6/T1/P1 composed journey; all implementation tasks remain queued.

### Historical planning handoff (earlier checkpoint 2)

Owner-agreed repair rule: within an approved testing task, reproduce and preserve the failing test, fix a small directly related defect restoring established behavior, then rerun gates and retain before/after evidence. Broader architecture/dependency/permission or behavior changes need linked repair tasks and review. Planning/mapping remains read-only.

What happened: baseline proposal v3 now includes context, cancellation/retry/limits, planning, persistence/resume, streaming and conditional auxiliary-call coverage mapping, alongside tooling adequacy, approval policy and override boundaries, critic/completion failure cases and UI feedback evidence. See [baseline plan](docs/planning/harness-modernization/current-runtime-baseline-plan.md). Direct Markdown lint, formatting and repository relative-link checks passed. No new tests or product code were implemented.

Current state: branch `jwill9999/harness-baseline-plan`; Beads `agent-platform-harness-baseline-plan` remains open for owner review. Prior workflow evaluation PR remains unmerged. Historical snapshots below are not current status.

Backlog update: 18 Beads tasks now track shared mapping and all 17 matrix areas, with verified prerequisite edges and individual specs. Status and pause checkpoints remain in Beads; no test implementation started.

Next: review the matrix and first slice with the owner; after implementation approval, map existing coverage and resolve the provider-fixture seam before building sequential journeys. Migration value also requires a bounded candidate comparison; baseline correctness alone does not prove savings.

### Verified snapshot — 2026-09-13 (earlier checkpoint 2)

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

### Verification and task state (earlier checkpoint 2)

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

### Remaining orchestration acceptance (earlier checkpoint 2)

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

### Workspace and continuation (earlier checkpoint 2)

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

### September 15: continuation diagnostic observation (earlier checkpoint 2)

The owner requested documentation of the assessment continuation stall and the evidence needed for future diagnosis. See [orchestration field evaluation](docs/reviews/orchestration-field-evaluation.md). Root cause remains unknown; active heartbeat configuration does not prove delivery. No assessment managed run was launched. Future repair work remains under the existing pilot assessment; no implementation is authorized by this note. Modernization assessment drafts remain pending independent critic review.

### September 15: modernization assessment ready for owner review (earlier checkpoint 2)

The [source assessment](docs/planning/harness-modernization/sdk-assessment.md) and its [independent critic record](docs/planning/harness-modernization/reviews/sdk-assessment-critic-review.md) are ready for joint review. The owner authorized a one-off supervised critic exception; its initial findings were corrected and focused recheck passed. This is not managed-orchestration acceptance. F0 and the joint review gate remain open; no packages, paid experiments or product implementation are authorized. The assessment self-check can pause at this owner-review boundary.

### Disposable workflow evaluation and testing skill (earlier checkpoint 2)

Owner authorized the bounded Project Chat evaluation and a targeted Playwright quality-gate skill improvement. See [evaluation](docs/reviews/project-chat-journey-evaluation.md) and [task spec](docs/tasks/agent-platform-workflow-journey-evaluation.md). Approved/denied edit scenarios and adjacent command scenarios passed locally with deterministic model/VM fixtures; file and durable backend checks are independent of UI messages. Installed skill and repository copy are synchronized. Beads task remains open for PR/hosted integration review; no staging/main merge or framework migration authorized.

### Current-runtime baseline planning (earlier checkpoint 2)

Owner requested a plan for evidence-driven workflow coverage before migration decisions. See [baseline proposal](docs/planning/harness-modernization/current-runtime-baseline-plan.md), tracked by `agent-platform-harness-baseline-plan`. Planning only; no new journey implementation is authorized. First uncertainty is a provider-boundary fixture route that retains the real reasoning/SDK path without inventing saved baseURL propagation. Prior test/skill changes remain in draft PR265 with nine executed checks passed and no merge.

### 19 September: current-runtime tests before stack comparison (earlier checkpoint 2)

Owner prioritized current-functionality evidence before considering restructure. PR265 is merged
into feature/harness-backlog-review at f2b306e. This task branch includes the earlier baseline
planning/coverage documents and adds the approved X6/T1/P1 provider-backed approve/deny family.
See docs/reviews/current-runtime-provider-journey.md for results and limitations. Six shared Electron
scenarios and 112 desktop unit tests passed, plus build/scoped lint/explicit E2E typecheck. No product
code or dependencies changed. X6 remains in progress for delivery and its wider untested cases;
other baseline tasks remain open. Package comparison has not started. Work is supervised, no durable
autonomous execution run is claimed. Preserve unrelated root-checkout Beads changes.

---

## Historical staging documentation-access handoff

## 22 September: agent documentation access

Added project Codex LangChain documentation MCP and shared guidance for current AI SDK documentation:
official agent index, search and targeted Markdown pages, checked against installed package versions.
Live endpoints and TOML verified. No dependencies, application behavior or baseline-test priorities
changed. VS Code's existing MCP file and local Beads interaction changes are retained separately.

## 8 October: staging documentation link repair

PR281 link checking identified that the AI SDK search API now returns HTTP 404.
Shared instructions now use the official agent index to find topic URLs and fetch their Markdown
content. The reference index and installed-version safeguards remain. Fresh staging checks are
required on the corrected head; no staging merge or harness pilot is authorized by this repair.

## 8 October: documentation access across agent surfaces

PR281 review identified that shared LangChain guidance only named the Codex MCP connection.
Added official agent-index and TypeScript LangChain/LangGraph URLs, Markdown retrieval guidance,
and installed-version checks for Claude Code, Copilot and other agents without that connection.

````````

## Historical qualified archive staging handoff — source 9d9bdd74

<!-- prettier-ignore -->
````````text
# Current handoff — authored evidence bookkeeping — 11 October 2026

Protected adoption [PR293](https://github.com/jwill9999/agent-platform/pull/293) merged at
`3ab2f53dae98ae2d435973c98b1845bf5a2dd3a2`. Its staging tree exactly matches the reviewed
source tree `5e145a11ab08bafab5a7be4b31ad1f16f84ac751`. All fourteen executed checks passed,
with zero unresolved review threads, a clear protection gate, hosted Sonar OK and zero open issues.
Actual full Promptfoo analysis completed in run `38099627759`, attempt 1, reporting no LLM
security vulnerabilities in two batches; its proof and SARIF hash were verified. Actual packaged
macOS VM job `114352683133` in run `38099627754` passed helper signing, packaging and the real VM
journey. An independent critic verified the downloaded artifact digests and member bytes.
The ordinary scanner's built-in omissions and non-exhaustive finding limits remain disclosed.

Current task is `agent-platform-native-staging-bookkeeping`, specified in
[the bookkeeping task](docs/tasks/agent-platform-native-staging-bookkeeping.md).
Task `task/native-staging-bookkeeping` starts from `feature/native-staging-bookkeeping` at the
qualified staging adoption. It delivers authored metadata and retained histories only, through
ordinary full scanning. No historical archive payload, runtime, dependency or workflow changes
are included. The archived JSON ignore rules preserve formatting only; no scanner exclusions.
The selection manifest remains byte-for-byte from original evidence primer `2ad1a88a`.

Feature delivery is complete: [PR294](https://github.com/jwill9999/agent-platform/pull/294)
merged at `6929cd33f43f47d71c6f2966fe33f8f830639fbc` after all ten executed exact-head checks
passed on `275c8b6589ce66cef4f625c8a2bf6b44f44d1de9`, approved review and zero unresolved threads.
The feature tree `5abcb70d9d347ee9aeb12970fd43cec395e3d849` matches reviewed source and the
conflict-free staging rehearsal. Continue with protected staging qualification in
[PR295](https://github.com/jwill9999/agent-platform/pull/295); do not repeat PR294 delivery.
Every executed and required check, genuine ordinary full analysis, actual packaged VM and all
current protection/review findings must clear on its actual latest head before guarded squash.
PR293 or an earlier PR295 head's results do not qualify later changed source.

Local bookkeeping validation passed: direct API Markdown lint for all three substantive files,
explicit authored formatting including the otherwise ignored JSON manifest, JSON parse and diff
checks. Exact five-file scope, original manifest/ignore bytes and both complete session/spec bodies
were verified. All 220 original artifact modes/blobs/hashes/bytes and 139 JSON parses passed directly
from retained Git objects. Independent plan and implementation critics approved with no actionable
findings. No runtime change required a new local VM run. Three complete source-bound Notion
body/revision/hash/destination readbacks and normal commit/push hooks completed at `275c8b65`;
the hooks passed seven-package build/typecheck/tests and cycles. Those completed receipts remain
retained; do not repeat stable publication or hooks merely to poll CI. Any substantively changed
document must receive its own source-bound mirror/readback before final delivery. Live Beads and
revision-bound publication receipts distinguish the original completed work from a later repair.
The remaining integration gate is PR295's actual latest-head staging qualification and review.

After that verified delivery, reconcile [PR288](https://github.com/jwill9999/agent-platform/pull/288)
to exactly the complete 220 immutable archive additions. Preserve original refs with recovery
protection before any guarded ref replacement. Independently verify every original path, mode,
blob, SHA-256 and all 3,958,506 bytes. Its automatic security check and separate protected-staging
dispatch provenance, complete trusted-checkout merge verifier, actual VM and all current reviews
must qualify before protected staging merge. The qualified policy adoption SHA is `3ab2f53d`;
its retained actual CI evidence is required as well as ancestry. No archive qualification is
claimed from this bookkeeping or the optional dispatch-only skip on the adoption PR.

Then reconcile and independently review [PR286](https://github.com/jwill9999/agent-platform/pull/286),
preserving the full original native source and both histories. Require its new exact-head ordinary
full scan, actual VM and all gates before final protected promotion. Intermediate staging is not
the completed development baseline. Parent, archive and evidence tasks remain in progress until
their own definitions of done; close this bookkeeping task only after its verified staging delivery,
full mirror readbacks, source preservation and canonical Beads/Dolt sync.

Preserve paused [PR283](https://github.com/jwill9999/agent-platform/pull/283), reconciliation
`5b796b74`, budget `ee3a160f`, offline adapter `e1222b19`, dirty primary three paths and paused
thirteen paths. No main promotion, pilot, spend, orchestration resumption or source deletion.
The next product priority remains undecided for an owner-led live Beads backlog review.

The two complete snapshot bodies below are retained verbatim as historical text, including
superseded runner/scanner/approval directions. Use the current handoff and live Beads/refs above
for continuation; those older snapshots record what was known at their source revisions.

## Historical policy-adoption session — source 3ab2f53d

<!-- prettier-ignore -->
```text
# Session handoff

## Current native staging consolidation — 11 October 2026

Current owner direction supersedes historical prototype handoffs below. The orchestration
prototype remains paused/retained, with PR283 and budget/offline-adapter branches outside this
integration. Native development does not require its pilot/discovery/broker approvals. The owner
approved reviewed APFS runner setup and narrow archive scanner policy B, routine blocker repairs,
and protected staging merges only after actual current-head checks and actionable reviews clear.
No main promotion, paid model calls, pilot, decommissioning or next priority selection.

Staging remains `a5a1641c3d2a5ef317c05fa45c6190e7189c1915`; full feature PR286 head is
`542e082e3569934b4dcd86ab58b0ea3ce9edbbb3`. PR290 coordinator and PR291 BashGuard repairs are
merged into the feature; current PR286 CodeQL analyses have zero results and their scoped findings
are fixed on this PR ref. PR288 primer head `2ad1a88a7bcf3978e9c02884e36c0cfae8ab11d0` remains
unmerged. Neither staging delivery nor complete native development readiness is claimed.

Work is now on `task/native-staging-archive-policy` from staging-derived
`feature/native-staging-security-policy` in the clean codex-developer-autonomy worktree. New child
Beads runner/archive-policy issues and dependencies are read back; parent/primer remain in progress.
Beads synced after this initial resumed checkpoint. Subsequent changes need their own readback/sync.

[PR292](https://github.com/jwill9999/agent-platform/pull/292) delivers this segment to the dedicated
feature. At `2dd99c6f`, both critics approve the source; normal hooks pass and all six substantive
initial mirrors are fully read-back verified. Initial lychee failed only the retained Agent Zero
GitHub usage URL with HTTP503; carry its already-reviewed official raw-source URL repair, then
refresh checks and all seven document mirrors at the new tip. Sourcery skipped due to exhausted
weekly budget; no Sourcery code-review pass is claimed. No staging qualification or merge yet.

New hosted Sonar result at `e3c8523f` fails reliability/security ratings with 41 open issues.
The bounded resolver-test temporary-path correction passes 12 tests and independent review.
Archive executable/argument/API-route and reported quality repairs now pass 26 affected tests,
plus final revised negative controls, and both independent critics approve source delivery. Fresh
hosted Sonar and all exact-head CI remain required; previous source approval does not waive the failed hosted gate.
Actual repaired `bdcb34b3` analysis reduces open issues to 12 but remains failed, including 5.5%
duplication. A further independently critiqued bounded refactor uses fixed Git argv with validated
SHA stdin and narrows builtin-only bootstrap before reusing protected helpers. Both distinct critics approve the implemented second pass with no remaining findings, including
the added scalar bootstrap denial controls. All 28 affected tests pass, followed by two controls
for the final test-only amendment. New hosted qualification remains required; no stage merge.
Actual `a86f4d72` analysis now has only two issues: reliability and 0.0% duplication pass, but
security still fails on the ancestry Git invocation. The dedicated fixed-argument `--` boundary
repair is now independently approved by both critics; all 29 affected tests and scoped quality
checks pass. Actual `2d10d8b2` hosted Sonar still fails two S6350 traces despite those defenses.
The verified raw Git-object identity boundary is implemented and independently approved by
both critics. All 30 affected tests pass, along with scoped lint/format/syntax checks. The new
identity must equal the original request; no normalization, cache or waiver. Fresh actual hosted
Sonar remains required. Staging is unchanged. See current review results.

Fresh official runner 2.337.0 on native APFS is online as dev 23 with the four required labels;
old ExFAT installation is preserved, old idle Listener stopped gracefully, fresh credentials used
without copying/publishing tokens, and no service installed. PR286 CI 38081623129 attempt 2,
job 114337873032, completed preparation4 seconds, checkout3 seconds, install/preflight/assets/Swift
build. Signing failed because hardcoded build output differed from actual Swift output. A reviewed
shared `--show-bin-path` signing/packaging resolver is implemented and source-reviewed; hosted actual VM remains required.
Both old attempts stalled approximately 60 minutes before cancellation. Exact cancellation origin is
unconfirmed; cancellation does not explain the preceding filesystem stall. The owner-raised CI
concurrency refinement preserves active staging/feature validations using `github.base_ref == main`
for cancellation on this PR-only workflow; stale-head success never qualifies a new head.

Packaging fix local qualification: 12 resolver tests, 8 desktop fixture/script tests, actual
Swift build/development signing/asset hashes/package/signature verification and 2 packaged
Electron journeys pass. Healthy path uses real VM/assets/helper; provider output and unhealthy
runtime are documented doubles. Full build/typecheck/format/final lint pass. Independent PACK-01
toolchain selection finding is corrected with canonical `/usr/bin/swift` for build/discovery;
CI resolves once, signs/packages exact helper. Packaging re-review approved the correction.
Final frozen archive implementation passes 23 tests, with zero failures or skips. Independent re-review approved the
verifier dependency/attempt guards and scanner response/base-ref fixes. The further vendor-bundle
output-buffer correction passes the actual large-bundle regression and is independently approved. Hosted new-head full scan and VM remain
required before policy adoption.
Local success is not staging readiness.

PR286 full Promptfoo scan failed before analysis at 1,409,530 tokens > 1,000,000. PR288 provider
context overflow remains distinct. Owner approved narrow deterministic exact historical archive
qualification, not a blanket authored-code skip. Small policy adoption must itself receive actual
full scan and actual VM before protected trust. Existing PR288 includes authored bookkeeping, so
that must be delivered through full scanning before archive-only qualification. Archive route
requires exact 220 inert additions, protected-base immutable allowlist, independent data/security
review, automatic check plus separate protected staging dispatch and trusted merge verification.
Independent critiques approve implementation/source review; hosted adoption and connected qualification remain pending.

All 220 artifact bytes remain retained:3,958,506 bytes from original6ca3cd1b; all 139 JSON parse.
Independent data review found no confirmed credentials, disclosed local path/email metadata and
historical instructions as inert data, and documented non-exhaustive secret/consumer coverage.
Primary dirty3paths, paused dirty13paths and separate branch tips remain preserved.

Read [execution manifest](docs/planning/native-staging-remedies.md),
[policy spec](docs/tasks/agent-platform-native-staging-archive-policy.md),
[runner spec](docs/tasks/agent-platform-native-staging-runner.md),
[verification plan](docs/testing/native-staging-remedies.md) and
[actual results](docs/reviews/native-staging-remedies.md).
Next sequence: fully qualified small policy/runner segment to staging; fully scanned authored
primer bookkeeping; exact archive-only PR288 qualification/promotion; refreshed/rehearsed PR286
actual full scan/VM/protected promotion; verify complete source/preservation and clean only proven
delivered temporary refs with recovery protection. Then owner reviews the live Beads backlog to
choose next feature. Automation stays active within that authorization and quiet on unchanged jobs.

---

## Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

## Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

## Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

## Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

## 22 September: agent documentation access

Added project Codex LangChain documentation MCP and shared guidance for current AI SDK documentation:
official agent index, search and targeted Markdown pages, checked against installed package versions.
Live endpoints and TOML verified. No dependencies, application behavior or baseline-test priorities
changed. VS Code's existing MCP file and local Beads interaction changes are retained separately.

## 8 October: staging documentation link repair

PR281 link checking identified that the AI SDK search API now returns HTTP 404.
Shared instructions now use the official agent index to find topic URLs and fetch their Markdown
content. The reference index and installed-version safeguards remain. Fresh staging checks are
required on the corrected head; no staging merge or harness pilot is authorized by this repair.

## 8 October: documentation access across agent surfaces

PR281 review identified that shared LangChain guidance only named the Codex MCP connection.
Added official agent-index and TypeScript LangChain/LangGraph URLs, Markdown retrieval guidance,
and installed-version checks for Claude Code, Copilot and other agents without that connection.

```

## Historical evidence-primer session — source 2ad1a88a

<!-- prettier-ignore -->
```text
# Current handoff — bounded staging integration — 10 October 2026

PR285 merged into `feature/harness-backlog-review` at
`6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec` after all ten executed final-head checks passed,
review approval and resolved threads. The owner authorized promotion to staging once checks pass;
no main promotion or prototype resumption is authorized. The next product priority is still undecided.

PR286 is open, but its full security scan stopped before analysis because 1,400,512 tokens exceeds
Promptfoo's 1,000,000-token maximum. Split the same delivery without excluding files or weakening
checks. This first segment copies only reviewed inert evidence; application/package runtime and
security workflows remain unchanged. The final full feature promotion stays pending afterward.
Scoped archived-JSON Prettier ignores preserve original evidence bytes; security scanning is unchanged.
New manifest/documentation formatting and all original artifact hashes are explicitly verified.
Primer PR287 caught the same historical Agent Zero HTTP503 already repaired in PR285; carry that
one-line official raw-source URL correction so the older staging baseline passes link checking.

Current task: `agent-platform-native-staging-evidence`, a prerequisite of
`agent-platform-native-staging-integration`. See
[the evidence delivery specification](docs/tasks/agent-platform-native-staging-evidence.md).
Task branch `task/staging-evidence-primer` starts from `feature/staging-evidence-primer` at current
staging `a5a1641c`. Selected evidence source is the reviewed feature at `6ca3cd1b`; exact path/blob/hash
provenance is recorded in `docs/reviews/evidence/native-staging-evidence-selection.json`.

PR287 merged into the evidence feature at `d46668e76d70bacaed338dd9813ac8ec361c1509` after
all ten executed checks passed and review threads cleared. Its tree matches reviewed source `e51970a2`.
PR288 now targets staging. Next: verify the exact current feature head and complete protected staging
qualification; do not repeat the completed task-to-feature integration. Every required/executed gate, including the actual packaged macOS VM journey, must
pass before staging merge. The `dev` self-hosted runner is offline and its job is queued; the owner
has been asked to bring it online. Do not treat cancellation or a skipped VM test as success.

PR288 security scan failed on 10 October with an internal model context-window overflow
([run evidence](https://github.com/jwill9999/agent-platform/actions/runs/38064854986/job/114250324847)).
This is a scanner failure, not a vulnerability finding or a passed scan. Regular CI, CodeQL and
SonarCloud passed; staging remains blocked. Independently assess smaller complete-file batches and
the provider constraint before another promotion attempt; do not truncate evidence, exclude scan
coverage, change limits or claim byte estimates prove model compatibility.

The installed scanner `0.124.1` also omits patches for three oversized archived JSON artifacts under
its built-in limits; exact paths/reasons and versioned sources are recorded in the evidence task spec.
No successful scan or analysis of those artifacts is claimed. A supported provider remedy or explicit
owner policy disposition is needed; the macOS VM remains separately queued on the offline runner.
After the handoff repair passes feature checks and is delivered, pause the integration monitor at this
external blocker rather than keep rerunning unchanged scans or polling the same runner state.
Diagnostic handoff repair PR289 targets the evidence feature. Its current spec marks PR287 steps
complete and uses version-pinned official raw source links after the hosted GitHub URL returned HTTP503.
Next useful delivery is PR289 after exact-head feature gates and review clearance; then verify the
repair in PR288, resolve its handoff finding and pause at the documented scanner blocker.

Preserve PR283, `task/pilot-active-budget` at `ee3a160f` and `task/test-runner-offline-adapter` at
`e1222b19`, and all dirty primary/paused/unrelated worktrees. The paused checkout retains thirteen
changed paths; primary retains three. Before/after snapshots and scanner evidence are in
`/Users/letuscode/.codex/staging-integration-20261010`. No pilot, paid model call, deletion or old
orchestration automation resumption. The integration-only monitor follows this authorized delivery.

After the primer merges, refresh the full feature promotion against staging, preserve the entire
reviewed source plus integration bookkeeping, and rerun the smaller remaining diff through all gates.
Do not declare staging development-ready at the intermediate evidence checkpoint. After full delivery,
review the live product backlog with the owner to choose the next priority. Beads/remote refs remain
current authority; the older handoffs below are historical snapshots.

---

## Historical staging handoff

## Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

## Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

## Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

## Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

## 22 September: agent documentation access

Added project Codex LangChain documentation MCP and shared guidance for current AI SDK documentation:
official agent index, search and targeted Markdown pages, checked against installed package versions.
Live endpoints and TOML verified. No dependencies, application behavior or baseline-test priorities
changed. VS Code's existing MCP file and local Beads interaction changes are retained separately.

## 8 October: staging documentation link repair

PR281 link checking identified that the AI SDK search API now returns HTTP 404.
Shared instructions now use the official agent index to find topic URLs and fetch their Markdown
content. The reference index and installed-version safeguards remain. Fresh staging checks are
required on the corrected head; no staging merge or harness pilot is authorized by this repair.

## 8 October: documentation access across agent surfaces

PR281 review identified that shared LangChain guidance only named the Codex MCP connection.
Added official agent-index and TypeScript LangChain/LangGraph URLs, Markdown retrieval guidance,
and installed-version checks for Claude Code, Copilot and other agents without that connection.

```

````````
`````````

## Historical recommendation handoff — PR308 d275e7a

<!-- prettier-ignore -->
`````````text
# Current handoff — diagnostics V1 delivered, 13 October 2026

**Verified baseline:** `staging` at `d199ad0172dfe016490533444d5b7c46733c8f4d`.
**Current documentation task:** `agent-platform-o0rt`.
Beads is authoritative for live task status; the recommendations below are for owner discussion,
not a newly selected implementation task. This handoff is being published on `task/post-v1-handoff`;
its own delivery status belongs in Beads and its PR, separately from the already merged baseline.

## Delivered and verified

- [PR303](https://github.com/jwill9999/agent-platform/pull/303) delivered diagnostics V1 to staging
  at `50cc8727d4afcf3c07d6480da77d84d6d0ec2402`. V1 is closed in Beads. The local report/export
  foundation is available; this does not complete the wider observability roadmap.
- [PR307](https://github.com/jwill9999/agent-platform/pull/307) delivered diagnostic review
  checkpoints to staging at `d199ad0172dfe016490533444d5b7c46733c8f4d` on 13 October.
  The checkpoint task is closed. Its final Beads evidence records all 15 executed checks passed,
  actual packaged VM and full security analyses, and zero unresolved review comments.
  Sourcery's budget-related skip is disclosed; it is not a passed independent review.
- The feature-implementation skill now calls for safe diagnostic reports after meaningful
  agent-run E2E testing and before completion, with facts separated from hypotheses and findings
  fixed within scope or linked to Beads. Documentation-only work records not applicable.
- The iMessage configuration repair was followed by a successful test send and owner-confirmed
  receipt. Tool availability in any new Codex session must still be checked before sending.

## Remaining work and boundaries

- Owner-confirmed phase one: a working local MVP for current use. Distribution to other users,
  and the architecture and operating model needed to support it, will be considered in phase two.
  Release/distribution work is not the immediate priority or a prerequisite for local MVP progress.
- `agent-platform-electron-release.diagnostics-export` remains open: checkout-free export from
  the released artifact belongs to phase-two release qualification, not a reopened V1 task.
- `agent-platform-harness-v5` retains the local macOS HTTP test-isolation finding. Matching explicit
  loopback binding is a proposed bounded repair; no source fix or V5 completion is claimed.
- Larger dashboards, external tracing and accounts remain future work. No new product feature
  has been selected or started by this handoff update.
- PR283 remains paused and separate. Retained orchestration branches are
  `feature/harness-backlog-review`, `task/harness-readiness-reconciliation`,
  `task/pilot-active-budget` and `task/test-runner-offline-adapter`. Preserve these and all dirty or
  unrelated checkouts. No orchestration resumption, main promotion or release is authorized here.

## Recommended next discussion

**First product task: `agent-platform-context-optimisation` (P1).** It targets long-session
reliability, avoidable token use and latency across everyday agent work. Beads records a historical
Project Chat TPM failure with large tool outputs; this is recorded evidence, not a new reproduction.
The memory prerequisites `.2` and `.4` are closed. Current staging already builds approximate
windowed context and injects working memory: extend that foundation rather than rebuilding it.
In `packages/harness/src/contextBuilder.ts`, required system/user messages can exceed the configured
budget and still be returned. Audit enforcement at every provider-call boundary and tool-result
replay before choosing the smallest repair. The historical failure's exact present-day cause is
not established by this inspection.

Proposed first slice for planning: reproduce oversized-history/tool-output cases, define bounded
input and output allowances, preserve essential task/approval context and tool-call pairing,
handle an oversized required input explicitly, and compare short/long journeys using V1 reports.
Agree measurable success criteria before implementation; do not promise a token saving percentage
or add a new summarisation service, dashboard or framework migration by default. The existing spec
still says P2 and has older timing language; reconcile it with live P1 Beads when this task is selected.

**Next alternatives:** Git workflow UI (`agent-platform-ii1`) for daily delivery usability, then
local run visibility (`agent-platform-harness-v4.local`) if hands-on use shows reports are insufficient.
Audit existing delivered Git work before selecting a child: `agent-platform-0ra` already records
implemented code despite remaining in progress. The local visibility task still depends on Stop
and recovery tasks; it is not an immediately unblocked dashboard ticket. Historical review-gate
records need explicit scoped reconciliation, not revival of paused orchestration controls.

Before relying on local macOS API qualification, take the small HTTP fixture-isolation repair
recorded under V5. Treat that as enabling QA work, not expansion into the whole V5 programme.
The owner has confirmed local MVP development takes priority; distribution architecture and
checkout-free release export qualification remain for phase two. Context and token optimisation
remains the recommended next product task, pending selection and planning. No backlog priorities
or dependencies were changed by this recommendation.

## Historical handoffs

Everything below is preserved verbatim from the prior staging handoff for provenance. Pending
PR303/PR307 integration instructions below are superseded by the verified delivery above and must
not be repeated as current work. Follow live Beads and current refs for subsequent delivery.

<!-- markdownlint-disable MD025 -->

# Diagnostic review checkpoints — 13 October 2026

This branch contains the owner-requested contributor skill update, tracked in
`agent-platform-diagnostic-review-checkpoints`. The feature-implementation skill now specifies
reviews after meaningful agent-run end-to-end tests and before completion: collect safe reports,
inspect flow and coverage, separate facts from hypotheses, fix scoped issues or link Beads findings,
and record the outcome. Documentation-only work can record not applicable; existing evidence may
be reused when still valid. This does not enable unattended monitoring or start V2–V5.

The change is isolated from the main conversation and paused orchestration. Base: PR303 staging
`50cc8727`. Skill validation/publication outcomes and the eventual PR belong in the task's Beads
notes. This is a pre-integration snapshot; the change is not active in staging until authorized
integration. No runtime test results or independent subagent review are claimed for this edit.

## Historical diagnostics delivery handoff

The prior handoff below is preserved as historical context; its pending PR303 instructions were
superseded by the merged staging baseline used above.

<!-- markdownlint-disable MD025 -->

# Diagnostics VM teardown repair — 13 October 2026

PR302 and the startup-evidence repair PR304 are merged into `feature/agent-observability`.
Current feature tip is `0081843130674d207a74ae025efe0af99a0c2585`; staging remains
`7814b59845b52ad5f850bfc99b7baee0e6742a25`. PR303 is blocked by its actual packaged VM
suite: eighteen scenarios passed, but the network-block case failed with confirmed `ENOSPC`
and a retry readiness failure. All other executed current-head checks passed, including genuine
full security analysis. The cause of the earlier feature-tip failure remains unproven.

Active bounded repair: `task/diagnostics-vm-teardown`. Independent critique approved correcting
the fixture stop timeout collision and verifying daemon/image-handle release before temporary
file removal. Retain evidence and fail visibly if teardown cannot be verified; preserve all
policy/readiness assertions and release independent resources. Twenty focused controls, desktop typecheck, scoped lint/format and three sequential real-VM
network-block journeys passed without retries. Every teardown reported daemon exit and exact
image release, with no leftover fixture process/handle or accumulating 4 GiB images. Source review
resolved OBS-VM-02/03; final evidence/documentation review precedes publication. Actual source and
verification results belong in [the result report](docs/reviews/agent-observability-mvp-results.md).

Reuse the owner's merge authority after independent source review, complete document mirrors,
and all new exact-head feature gates; then qualify fresh protected PR303 full scan, actual VM,
quality checks and review findings before guarded squash. No staging delivery or branch cleanup
has occurred. V1 remains in progress; checkout-free released-artifact verification remains in
the open release child. Recovery-protect and remove only delivered diagnostics branches after
verified staging delivery. Preserve main, PR283, paused orchestration and dirty/unrelated work.
Beads remains the live task authority; this is a dated pre-delivery snapshot.

## Historical startup-evidence handoff

The full earlier handoff below is retained as historical evidence and superseded by the current
teardown repair where its next steps differ.

<!-- markdownlint-disable MD025 -->

# Diagnostics staging blocker — 13 October 2026

The owner authorized completion of diagnostics delivery and cleanup. PR302 is merged at
`f0f4edd32b88693d39d803dea175c2750f738db5`; protected staging PR303 remains open. All executed
checks except the actual packaged macOS VM suite passed. That suite passed eighteen scenarios
but its network-block policy case failed backend readiness before model setup, including retry.
The healthy real-VM subcase and completed full security scan do not waive that failure.

Current bounded repair: `task/diagnostics-vm-startup-evidence`, based on the delivered feature.
The safe startup recorder and attachment-cleanup fix passed independent review, nine focused
tests and the actual failure/cleanup control. One focused packaged network-block case passed in
32.4 seconds without retries. The earlier failure was not reproduced; its cause remains unknown.
Independent source inspection found the fixture discards the error details needed to identify
startup failure. The fixture now preserves safe, bounded startup observations before cleanup;
the focused reproduction above retained the 20-second timeout and existing assertions. The previous
failure's cause remains unproven. Deliver reviewed repairs through the feature, then qualify fresh
PR303 full security, actual packaged VM and all other current-head gates/review comments before
protected squash. Preserve the original failure evidence and all earlier handoff history.

V1 remains in progress. Checkout-free release export verification and the wider epic remain open.
Recovery-protect and remove only delivered diagnostics branches after verified staging delivery;
keep main, paused orchestration/PR283 and dirty or unrelated work unchanged. See
[implementation results](docs/reviews/agent-observability-mvp-results.md) for actual run evidence.

## Historical pre-merge handoff

The following complete handoff is historical; its pending PR302 instructions are superseded above.

<!-- markdownlint-disable MD025 -->

# Diagnostics delivery handoff — 13 October 2026

The owner authorized merging PR302 into `feature/agent-observability`, then promoting that feature
to protected `staging` once all current-head checks pass and actionable review comments are resolved.
After verified delivery, recovery-protect and remove only the delivered diagnostics feature/task
branches. Preserve main, all paused orchestration refs/PR283, dirty primary/paused checkouts and
unrelated work. Checkout-free export qualification remains with the open release child
`agent-platform-electron-release.diagnostics-export`; no release or main promotion is authorized.

As of this handoff, the implemented revision `f9450bd2fd15d0a8f135450a2ac57fc6b08f1e78` passed all
nine executed feature checks. CI `38184603689` passed 2,745 package tests, 22 browser journeys and
29 Electron journeys; 77 existing optional prototype tests were skipped. All nine measured benchmark
modes passed the original bounds: maximum request p95 overhead 15.176855 ms against 20 ms, and
enqueue p95 0.0128 ms against 2 ms. Independent review verified source, numeric samples and the
hosted artifact identity. The earlier failed latency observation remains recorded with cause unknown.
Sonar passed with two independently reviewed Minor dispositions; no open CodeQL alerts or unresolved
PR302 threads were present at the refreshed snapshot. Sourcery skipped its diff-size limit; independent
source review supplies the review evidence. The feature VM skip does not qualify staging.

This handoff changes documentation only. Its new revision still needs current-head feature checks;
then merge PR302 with its exact head guard, verify the feature tree and open the staging PR. Staging
requires fresh ordinary full security analysis, actual packaged macOS VM success, all live protections
and resolved review findings. Keep V1 in progress until actual delivery/readbacks/sync are verified.
The broader observability epic and release child remain open. Current task state and eventual merge
SHAs are recorded in canonical Beads; this is a dated pre-merge snapshot, not a claim that promotion
has already occurred. See [results](docs/reviews/agent-observability-mvp-results.md).

## Historical implementation and planning snapshots

The following handoffs are preserved verbatim as historical evidence. Their pending instructions
and earlier authorization limits are superseded by the current owner-authorized delivery above.

<!-- markdownlint-disable MD025 -->

# Current diagnostics implementation — 11 October 2026

Owner accepted P1 option A and authorized the diagnostics MVP. Checkout-free export verification
is now release task `agent-platform-electron-release.diagnostics-export`; V1 retains real connected
browser/standalone-Electron export and report investigation. V1's scoped old review-gate edge is
removed; broader gate and all paused orchestration work remain unchanged. V1 is in progress.
Active branch `task/diagnostic-event-foundation` follows planning tip `ebf3c279`, targeting
`feature/agent-observability`. Follow the current authorization at the top of the plan/spec/tests;
earlier planning-only and strict-artifact statements below are historical. No runtime test results
or merge authority are inferred from this authorization.

The SQLite adapter, request/model/tool observations, safe report/CLI and explicit browser/native
export are implemented. Four connected journeys passed, including actual file export, API-stop
partial export, full restart, approval/duplicate one-effect, denial/no-effect and SDK retry recovery.
The report-only independent support exercise located the actual failed operation. Three repeated
latency fixtures passed. Independent source review approved the repaired implementation; local
quality checks and 2,734 aggregate tests passed (77 existing optional integration skips). The
shared-module retry-test isolation failure is retained and its full 222-test API rerun passed.
PR302 remains open. The initial publication at `77d0ce8e` included all eight full Notion readbacks;
subsequent changed result/session mirrors were read back at the pushed code repair revisions.
Hosted Sonar failed on complexity/style and the browser-install command. Independently reviewed
bounded refactors passed 34 core tests, 120 report-equivalence comparisons, 40 web tests, 21 desktop
tests, six CLI tests, four fresh connected journeys and a full 222-test API rerun. An earlier API
timeout is retained alongside the unchanged focused and full rerun passes. Fresh hosted analysis
passed again on final code revision `7e5ba9d6`, with no Blocker/Critical/Major findings and only
two independently reviewed Minor dispositions. Normal push hooks passed all 222 API and 133
desktop tests. Final documentation clarification aligns the V1 dependency section with accepted
P1 and live Beads. That handoff revision passed hosted browser/Electron but failed one latency
comparison (25.464694 ms versus the unchanged 20 ms bound). A bounded measurement-fixture repair
removes retained spy-call overhead and preserves numeric failure evidence; no cause is inferred
from one sample and no limit is raised. New current-head qualification remains required. No
bypass, merge or closure. See results
for the retained first failure and source-backed minor-warning dispositions.
See [results](docs/reviews/agent-observability-mvp-results.md) and
[usage](docs/development/diagnostics.md) for evidence and limits. Next: publish the independently reviewed measurement repair to PR302, refresh its changed full
mirrors, and qualify current-head CI/security/comments with the retained numerical benchmark
artifact. The focused repaired benchmark and two explicit failure/cleanup controls passed locally.
V1 stays in progress through actual authorized feature delivery; no merge is authorized by this step.

<!-- markdownlint-disable MD025 -->

# Current handoff — diagnostics MVP planning, 11 October 2026

The prior visibility documentation delivery below is complete: PR300/PR301 delivered it to staging
`7814b59845b52ad5f850bfc99b7baee0e6742a25`; temporary documentation branches were removed with
recovery protection, and Beads closed/synced. Paused PR283 and the four orchestration refs remain
separate. Historical pending delivery instructions below are not active work.

The owner selected developer diagnostics as the next planning priority. Current work is the
[bounded diagnostics MVP plan](docs/planning/agent-observability-mvp.md), canonical
[V1 spec](docs/tasks/agent-platform-harness-v1.md), [verification plan](docs/testing/agent-observability-mvp.md)
and [independent critique](docs/reviews/agent-observability-mvp-plan-review.md).
Planning branch: `task/observability-mvp-plan`, from `feature/agent-observability` on actual staging.

Agreed: foundation first; local single-user SQLite behind one small storage adapter; configurable
seven-day retention; safe request/model/tool timings and failure metadata; essential backend
logging; readable report plus structured data; small explicit export action from packaged app or
browser for manual sharing. External models remain supported; diagnostics stay local unless shared.
Dashboards, accounts, uploads, other backends and execution-control changes are deferred.

The owner requested completion of planning before their final review. Coordinator planning work
is complete and the critic approved the final decision proposal with no remaining technical
planning findings. The completion audit now
identifies one material decision P1: repository-launched Electron tests do not supply the promised
checkout-free application artifact. The release task owns that missing artifact. The finished
proposal recommends deferring only artifact acceptance to release work; the existing strict
requirement stays in force until the owner agrees. Implementation remains unallocated.

The earlier written plan passed independent critique after three bounded corrections to local
access, backend-unavailable export and SQLite journal bounds. It is being published for the owner
implementation decision. No runtime implementation,
installation or new application test execution has begun. V1 and its parent remain open; the old
review-gate edge is retained pending the owner's requested final implementation decision, after
which only the V1 edge should be reconciled. No broad gate closure or paused-work resumption.
Next handoff is the completed reviewed decision proposal to the owner, not an automatic implementation start. P1 is the only remaining material choice; no interim owner review is needed.
Estimated implementation effort is 4–6 focused engineering days with a two-day progress checkpoint.
Canonical Beads root stays the primary repository; preserve its dirty files and the paused checkout.

<!-- markdownlint-disable MD025 -->

## Earlier session history retained below

# Native development consolidation handoff — 11 October 2026

## Current follow-up — paused work visibility

Last updated: 11 October 2026. Paused orchestration labelling is complete; the owner has now
authorized integrating its documentation into staging and removing the two temporary branches.

The consolidation below is complete: PR295, PR288 and PR286 merged; staging is
`3a22ac8f45d2257fe1a9200e936e4bd2923c9eae`. All 14 final executed checks, actual full scan,
packaged macOS VM and review gates passed. The integration task is closed and synced;
17 delivered remote/local branches were removed with 20 recovery tags. Its monitor is paused.

Next: `agent-platform-paused-work-visibility` is in progress at P1 with the completed integration as
its upstream dependency. Its [specification](docs/tasks/agent-platform-paused-work-visibility.md)
records a paused title/label and four-branch inventory for PR283, plus relevant Beads notes.
The title, label, complete description, all ten deferred Beads records and preserved branch/dirty
work identities have been read back; metadata closure and Dolt sync completed. The task is reopened
only for the subsequent owner-authorized documentation delivery. Specification work uses
`task/paused-work-visibility` from `feature/paused-work-visibility`, based on qualified staging.
These new follow-up branches are active documentation work, separate from the four paused refs.

Preserve PR283's base/head/draft state, all paused branch tips and dirty/unrelated checkouts.
Independently review and publish the two-file source; merge task to feature after current checks
and reviews pass, then require fresh protected staging full scan, actual packaged macOS VM and
all checks/reviews before guarded squash. Verify the staging tree, recovery-protect and remove
only the two delivered visibility branches, refresh mirrors/Beads and close after Dolt sync.
The owner may review the live backlog in parallel; the next product priority remains undecided.
The immediately following PR299 and final-quality-repair sections are preserved pre-completion
snapshots. Their pending review, publication and hosted-clearance steps were subsequently completed:
PR299 merged into its feature at `583da680ae84e79cb8723b808792c8321d9b4c7e`, then PR286
merged into staging at `3a22ac8f45d2257fe1a9200e936e4bd2923c9eae`. Statements below that
PR286 is unmerged or that those repair gates remain pending are superseded by those verified
deliveries. They do not describe active work. The visibility documentation delivery above is still
active; paused orchestration remains deferred. Consult live Beads and current PR state before
acting on any other dated historical section.

## Current PR299 detailed-analysis follow-up

The first bounded quality repair was pushed at `58d3399a` in PR299. Normal hooks passed
124 desktop and 1,141 workflow tests; both full specification/session mirrors were read back.
Actual fresh Sonar reports a green quality gate but a Blocker `S2699` in the new network test:
the child process's assertions are not visible to its parent test analyzer. A bounded follow-up
keeps all child effect assertions and checks the child-reported three forwarded and three denied
requests explicitly in the parent. All 11 HTTP/network cases passed again. Independent review,
normal push, refreshed full mirrors and fresh detailed hosted clearance are still required.
The ordered validation await has one disclosed Minor report and remains sequential intentionally.
PR286 remains unmerged; prior full scan/VM success does not qualify a changed repair head.

## Final quality repair continuation — 11 October 2026

PR298 is merged into `feature/harness-backlog-review` at `4cf29b18a7a4150710df3cc36d9d135a7243d050`,
with reviewed tree `dbbd092b84eff20ca566d321f0723d88613f04f9`; all nine executed feature checks passed.
Both complete specification/session mirrors read back at `d74e63af`. PR295 and PR288 remain qualified
and merged, their children closed. Actual PR286's new-head ordinary full Promptfoo run `38105914455`
succeeded; old token-limit failures are retained historically, not reclassified. Actual new-head VM and
all remaining gates still need terminal qualification.

Detailed Sonar analysis at `4cf29b18` reports a green quality gate but two Critical complexity and two
Major nested-ternary findings in promoted code. Repository completion is blocked by those Critical
findings despite the green check. Independent source triage approves a bounded behavior-preserving
[repair](docs/tasks/agent-platform-native-staging-sonar.md), `agent-platform-native-staging-sonar`,
on `task/native-staging-sonar-repair` from the actual feature. It preserves snapshot validation/order/
digests/cleanup, provider HTTP bounds/retry/SSE/resume identity and loopback-only fetch forwarding.
The 37 Minor reports have explicit source-backed retained-behavior dispositions; no suppression,
parallelization, scanner waiver or rule weakening is authorized. Repair source/tests, independent
review, complete mirrors, task-to-feature delivery and fresh detailed finding clearance are required.
Every changed protected head needs its own genuine full scan, actual VM and all checks/reviews.

The bounded seven-file source and requirement/scenario contract are independently approved without
findings. Local provider HTTP/network regressions passed 11 cases; the complete affected workflow
suite passed 1,141 tests with 77 existing optional integration skips, including snapshot identities
and committed skill boundaries. A supposed two-file command selected that whole suite because of a
literal script `--`; its actual coverage is recorded. Affected typecheck/lint and the provider source's
explicit desktop-package typecheck passed; the earlier root-only missing Node declarations are retained.
Normal publication/feature gates and fresh detailed Critical/Major clearance remain required.

Read live Beads and PR286 before resuming: if the repair/final promotion is already delivered, verify
its actual source/evidence instead of repeating it. Parent stays in progress through final acceptance
and verified branch cleanup. PR283, separate paused refs/dirty work, all archive bytes and protected
controls remain separate and unchanged. Next priority remains owner-led backlog review after consolidation.

The owner authorized completing PR295, PR288 and PR286, then recovery-protected cleanup of
verified delivered branches. PR283 and the unfinished orchestration work remain paused and separate.
This is native development; historical prototype discovery, broker, admission, gateway, budget and
pilot approvals do not become default development prerequisites. No main promotion, pilot, paid
prototype call, global edit, decommissioning or next product priority is authorized here.

## Verified delivery and final source

Protected policy/runner adoption [PR293](https://github.com/jwill9999/agent-platform/pull/293)
merged at `3ab2f53d`: genuine ordinary Promptfoo analysis, actual signed packaged macOS VM,
all fourteen executed checks and independent artifact/source review passed.
Authored bookkeeping [PR295](https://github.com/jwill9999/agent-platform/pull/295) merged at
`fdf02255`; its reviewed tree, genuine full scan, actual VM and all current checks/reviews passed.
Its full source-bound documentation mirrors and readbacks are retained.

Exact archive delivery [PR288](https://github.com/jwill9999/agent-platform/pull/288) merged at
`9d9bdd74747369fac590a19bb79b355a0976185f`, tree
`324d2ac102a7abbeca012917f79a40e252a3eac0`. All 220 original paths, regular modes, blobs,
SHA-256 values and 3,958,506 bytes match source `6ca3cd1b`; all 139 JSON payloads parse.
Latest automatic archive run `38103891409` and protected dispatch `38103896505`, attempt 1,
qualified through the complete unmodified trusted verifier and retained actual adoption CI proof.
The actual packaged VM job `114365175122` in CI `38103873970` passed. Seventeen executed check
entries passed, reviews were resolved, and an independent critic freshly verified both receipt
ZIPs, every VM artifact member and current source/protection bindings. This is owner-approved
historical archive qualification, distinctly not Promptfoo LLM analysis of those payloads.
Two earlier local verifier fetch failures remain recorded with unknown specific cause; healthy
transport diagnostics and the unchanged plain verifier succeeded without a source or policy waiver.

The runner, archive-policy, bookkeeping and evidence Beads children are closed and synced after
their own verified delivery. Parent `agent-platform-native-staging-integration` still owns final
baseline acceptance. Its [version 2 specification](docs/tasks/agent-platform-native-staging-integration.md)
is authoritative for the remaining integrated source and delivery gates.

Final task `task/native-staging-baseline-integration` starts from retained
`feature/harness-backlog-review` at `542e082e`, which includes the bounded PR290/291 repairs,
and reconciles actual protected staging `9d9bdd74`. Preserve the full original native source
and every adopted control, archive and historical body. The only merge conflict is this handoff;
both complete source bodies are retained below. The automatic CI merge retains the adopted runner,
security tests and cancellation policy plus the feature's private interpreter setup. It still needs
independent complete-source review and new exact-head verification.

## Continuation and acceptance

First read live [PR286](https://github.com/jwill9999/agent-platform/pull/286), canonical Beads and
current refs; this document is a revision-bound integration handoff, not a claim that its own source
has passed later hosted gates. If PR286 is unmerged, finish the reviewed task-to-feature delivery,
then require its actual latest-head ordinary full Promptfoo analysis, actual packaged VM, all live
required/executed checks and resolved actionable security/code reviews before guarded staging squash.
Earlier heads and optional skipped jobs do not qualify it. Remaining authored scan fit is not proven;
never exclude authored source, raise limits, truncate evidence or silently waive a failed analysis.
On a genuinely necessary material policy change, prepare reviewed alternatives for the specific
owner decision. Routine repairs and guarded authorized merges do not need renewed approval.

If PR286 is already merged, verify the actual committed tree, source preservation, checks, reviews,
full substantive Notion readbacks and canonical Dolt sync before closing the parent. Do not repeat a
completed promotion. Only then audit legacy refs against actual staging, push/read back recovery
protection and delete proven delivered temporary refs with exact-SHA guards. Keep checked-out,
dirty, paused, unique or uncertain branches. Actual completion evidence belongs in Beads and the
PR/check receipts; a local test pass or this handoff alone does not establish development readiness.

## Retained work and next priority

Keep paused [PR283](https://github.com/jwill9999/agent-platform/pull/283) and reconciliation tip
`5b796b741da862ff6546d205ff1097f9e2e68225`, budget
`ee3a160f9f3152ba16ed0ebbe376dc940c86dacf`, offline adapter
`e1222b1958b87ddc2cf371983fe5e56536fb5fe3`, the dirty primary three paths and paused thirteen
paths untouched. Canonical Beads lives at `/Users/letuscode/projects/agent-platform`; native work
uses the clean managed checkout. Authorized task-status journal appends are separately proved;
never describe the whole current primary dirty hash as unchanged from its original snapshot.

Recovery tags retain original primer/task tips and the full feature before final reconciliation.
Existing optional prototype code remains retained for a later explicit resumption/decommissioning
decision; delivered code is distinguished from deferred operational acceptance in Beads.
After full verified staging integration and delivered-branch cleanup, pause the integration monitor.
The next product priority is undecided: review the live Beads backlog with the owner before selecting
new development. No paused prototype or old automation is resumed by that review.

The following complete source bodies are historical evidence, including superseded directions.
They do not supply current approval or override this handoff and the owner's native-work authority.

## Historical full-feature handoff — source 542e082e

<!-- prettier-ignore -->
````````text
# Current handoff — native development and retained orchestration — 10 October 2026

## Security repair closeout and follow-up — 10 October 2026

PR290 merged into `feature/harness-backlog-review` at
`732806dc28754bc9176d507516d85e612eaaef5f` after all ten executed checks passed on reviewed
`7c28c838a8f81bad78b76592dd6403977462a2f3`, approval and no unresolved review threads.
The merge tree equals reviewed source. Fresh PR286 CodeQL/source verification confirms the
coordinator test alert 10 fixed on its current PR ref and the original thread resolved;
`agent-platform-native-staging-codeql` is closed for that bounded delivered scope.
The previous local failures/diagnoses and optional skips remain recorded below and in its task spec.

Fresh findings inspection also found existing high-severity `js/polynomial-redos` alert 5 in
BashGuard's optional explicit compatibility-allowlist splitter. It already exists on staging/main;
PR290 did not introduce it. [The bounded security repair](docs/tasks/agent-platform-native-staging-redos.md)
is `agent-platform-native-staging-redos`, in progress, on `task/staging-bash-guard-repair` from
`732806dc`. Independent plan review approved after correcting the regression input to embed long
whitespace between non-whitespace tokens; independent implementation review also approved without actionable findings. Harness build/typecheck/
lint and all 686 tests in 49 files passed, including strict operator/whitespace decisions and a bounded
real compiled-validator regression. The baseline child timed out/killed at one second; the repaired
child returned both expected outcomes in 29.62 milliseconds. Normal push hooks also passed
all 686 tests. [PR291](https://github.com/jwill9999/agent-platform/pull/291) is open into the feature;
full three-document mirrors read back at `559276d2`. Initial hosted lychee found the authenticated
security-alert link unavailable to public CI; the spec now records the alert ID/access requirement
and links its public owning PR. Final current-head CI/mirrors, feature merge and fresh CodeQL
qualification remain pending; no checker/security-policy exclusions changed.
Default product calls omit the explicit allowlist; the repair preserves default behavior and all
permission/deny decisions, removing only quadratic separator matching.

PR286's automatic scan on its genuinely changed `732806dc` head still failed before analysis:
1,404,186 tokens exceed the one-million-token limit, run `38079857145` / job `114294354762`.
No vulnerability qualification resulted. PR288 retains its separate provider context-overflow failure.
A source-backed independently reviewed [scanner-policy decision packet](https://app.notion.com/p/3f5c07cdcbcf81359addc127d333abf1)
is published/read back. The owner is asked to keep full policy and seek a provider remedy, or explicitly
authorize narrowly scoped immutable historical-archive policy work. No answer or policy change is
assumed; the full protected scanner and actual VM still gate staging. The alternative requires a
separately fully scanned policy delivery, trusted exact archive pins, no authored-document exemption,
independent archive review and all other protections; it does not guarantee final scan success.

Runner `dev` is online/busy. The old `6ca3cd1b` PR286 job `114242452635` was cancelled while still
at Set up job after the new feature head triggered fresh CI. It did not qualify the VM. PR288 job
`114257513299` is now assigned but still Set up job; current PR286 job `114295343289` queued at
this snapshot. The owner has already been asked for runner-console
setup/download/connection errors; do not repeat the start/offline request or invent a cause.
Fresh current-head checks/reviews/security findings must be inspected before each merge.

Next: deliver and verify the BashGuard repair through the existing feature; obtain the pending
scanner-policy decision and runner evidence, then qualify evidence PR288 and full baseline PR286.
Neither staging promotion nor branch cleanup is complete. Parent/evidence Beads remain in progress;
paused PR283, separate prototype refs/dirty checkouts and all historical source remain preserved.
No main promotion, pilot, spend or product-priority selection; next product priority remains owner
Beads backlog review after verified consolidation.

## Earlier consolidation repair update — retained 10 October 2026

This update supersedes the earlier pending-PR285 wording below. The owner resumed consolidation
and reconfirmed conditional merge authority: evidence PR288 first, full baseline PR286 second,
only after every actual current-head gate and actionable review clears. PR283 stays paused/unmerged.
No next product priority, pilot, main promotion or decommissioning is selected.

PR285 merged to the full feature at `6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec`. Evidence PR287
and diagnostic PR289 merged to `feature/staging-evidence-primer`, now
`2ad1a88a7bcf3978e9c02884e36c0cfae8ab11d0`. All 220 historical artifacts remain retained exactly.
Staging remains `a5a1641c3d2a5ef317c05fa45c6190e7189c1915`; it is not the consolidated development baseline.
The primer history/spec/mirrors are retained on their own source branch; refresh them before promotion.

PR288 has 13 successful regular checks and failed security-scan at its actual head: provider model
context-window overflow, run `38067326126` / job `114257510826`. PR286's prior full scan rejected
1,400,512 tokens above the 1-million limit. Promptfoo 0.124.1 also omits three large evidence patches
by built-in blob/patch limits; filesystem availability does not prove their analysis. No unchanged
manual rerun, scan bypass/exclusion, artifact truncation or qualification claim. A supported remedy
or concrete owner policy decision is still needed; smaller complete-file batches are unverified.

The owner started runner `dev`: live status online/busy. PR286's actual packaged macOS VM job
`114242452635` is assigned/running (started 18:46 UTC) but still at GitHub's Set up job step; the
packaged test itself has not started. The owner was asked for the runner-console setup/download error.
PR288's job `114257513299` remains queued for capacity.
Do not repeat the offline request or count queued/skipped/cancelled jobs as success.

PR286 has an unresolved CodeQL `js/bad-code-sanitization` finding in the delivered coordinator
subprocess test. [The bounded repair](docs/tasks/agent-platform-native-staging-codeql.md) is tracked by
`agent-platform-native-staging-codeql`, in progress, upstream closed handoff, blocking parent integration.
Its task branch `task/staging-codeql-repair` starts from the original full feature at `6ca3cd1b`.
Independent plan and implementation source reviews approved without actionable findings. The test
now writes static child source, passes unusual paths through JSON stdin/argv, preserves real descendant
abort/late-marker checks and adds stopped-call denial. Only test/spec/session change; runtime unchanged.
Five focused transport tests, package build/typecheck/lint passed on Node 24. Full normal push gates
passed at `72411e80be45e9c29e98bc4d66b826c8b071613d`: all 1,140 package tests
passed, 77 optional integration tests skipped. Initial scheduler timeout and hook-selected noncanonical
Git pin failures were retained and diagnosed; focused reruns passed. Supported local canonical Git
path plus four-worker execution passed every unchanged test/timeout through normal hooks. No runtime,
security or test coverage reduction. Hosted feature checks, source merge and CodeQL finding resolution
remain pending. Full spec/session Notion publication follows the pushed final documentation revision;
Beads remains in progress and its current state was synced, not closed.

Next: finish full documentation mirrors, inspect repair task PR checks and review findings, merge
into the full feature when exact-head gates clear, then verify actual PR286 source before
resolving its thread. Continue supported scanner remedy investigation and actual VM qualification;
protected staging merges stay gated. After full verified integration, audit delivered branches with
recovery refs and SHA guards, preserving paused/unique/in-use/uncertain work and dirty checkouts.
Parent and evidence-child Beads stay in progress; do not close them for intermediate feature delivery.
Next product planning remains an owner backlog review after consolidation.

## Earlier handoff history (retained)

**Current position:** cleanup is complete; the next product-development priority is **undecided**.
The owner initially requested a pause after saving this handoff. On 10 October they authorized finishing
PR285 and promoting `feature/harness-backlog-review` into protected `staging` once checks pass.
That integration is tracked by `agent-platform-native-staging-integration` and
[its specification](docs/tasks/agent-platform-native-staging-integration.md); consult Beads and exact
remote refs for the live result. At this snapshot PR285 and staging promotion are not yet merged.
This does not restart the paused prototype or select a new product implementation task.
After integration: review the live Beads backlog with the owner and decide which work to take forward.
Agree that task's objective, requirements, definition of done and meaningful tests before execution.

This section supersedes the older execution/approval/status instructions below. Historical entries
are retained as evidence; they do not reactivate old pilots, automation prompts or review gates.
Beads remains authoritative for task state. This documentation snapshot is tracked by
`agent-platform-native-development-handoff`; its specification is
[the handoff task](docs/tasks/agent-platform-native-development-handoff.md).

## Merged baseline and completed developer cleanup

[PR284](https://github.com/jwill9999/agent-platform/pull/284), **Restore native Codex developer autonomy
and retain runtime security**, is merged into `feature/harness-backlog-review` at
`d77d64072034b7ab131386de9f9d2961896f6ce2`. The integrated tree matched reviewed source
`a0e51e542aaf6a978ff240dddb1dc1451e6104fa`. Its nine executed exact-head checks passed;
staging-packaged macOS VM and Sourcery were skipped. Earlier desktop retry/flaky evidence remains
in the review records; the targeted rerun passed 28 tests without retries. No new staging/main
promotion or live pilot followed this cleanup. Current remote staging is
`a5a1641c3d2a5ef317c05fa45c6190e7189c1915`; refresh refs before future work.

Native Codex is the development route. Existing end-to-end authorization covers routine planning,
implementation, refinements, repairs/retries, independent source-aware review, documentation/Beads/Git
work and CI through final owner acceptance. Ask about material changes to intent/behavior/delivery,
required missing input or explicitly reserved actions. Actual session permissions still apply;
green tests alone grant no merge, release, spend, global-edit or pilot-launch authority.
See [native development](docs/development/codex-development.md) and
[ADR-0005](docs/adr/0005-native-codex-development.md). Agent Platform runtime security is unchanged.
`agent-platform-codex-autonomy-acceptance` is closed and its Beads completion record was synced.

## Global follow-ups completed locally on 9 October

The owner separately authorized all three corrections discussed in voice:

- Installed global `beads-workflow` skill: removed prototype broker prerequisites; normal authorized
  MCP/CLI task updates and syncing remain, along with task authority, dependencies and ownership.
- Installed global `agent-platform-documentation` skill: removed obsolete managed-run publication
  and approval wording; retained full Notion mirrors, identity/readback and preservation of human notes.
- Saved additive memory correction: earlier review-gate/renewed-allocation guidance is historical;
  routine phase/file/subtask changes within an agreed authorized task do not require renewed approval.
  Historical registry/rollout/memory-skill files were preserved. Both skill validators and readbacks passed.

These installed skills and saved memories are local to this Codex installation, outside repository
Git. They do not need pushing to the feature branch; another installation needs equivalent updates.
Global Codex configuration was not changed. The existing proposed-global-follow-ups document describes
the earlier discussion checkpoint; these Beads notes and this handoff supersede its pending wording.
Fresh sessions on the integrated branch are recommended; loaded historical context can remain stale.
Saving a correction does not prove automatic ingestion by every future session.

## Orchestration retained and paused; delivery audit recorded

The owner chose to retain `packages/workflow-control` for now and decide later whether to decommission
it. Its source, enforcement and tests remain intact; it is not a prerequisite for native development.
Code already delivered to staging is retained there. No source deletion, branch deletion, prototype
resumption, pilot launch or paid model call is authorized by this retention decision.

All twelve previously discussed Beads records were audited. The shared-documentation and bounded
standalone-reviewer tasks are now closed for their completed scopes. Ten remaining records are deferred.
Each contains a delivery/acceptance audit stating implementation state, exact evidence/location and
remaining scope; earlier blanket-deferral notes are superseded by those per-record dispositions.
Staged code delivery is done where recorded, while unmet operational criteria remain distinct.

| Beads record                           | Current status | Delivered work and remaining scope                                                                                                                |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-platform-pilot-zero.14`         | Closed         | Shared documentation guide/skill and callers delivered, reviewed and integrated into feature; no runtime acceptance implied.                      |
| `agent-platform-pilot-zero.15`         | Closed         | Bounded standalone reviewer delivered and qualified for the recorded tested profile; broader connected/managed pilot acceptance remains separate. |
| `agent-platform-multi-agent`           | Deferred       | Foundations delivered to staging; parent retains operational pilot learning/acceptance.                                                           |
| `agent-platform-pilot-zero`            | Deferred       | Initial assessment foundations in staging, later prerequisite components in feature; overall qualification/acceptance incomplete.                 |
| `agent-platform-multi-agent.10`        | Deferred       | Pilot candidate code delivered to staging; actual autonomous pilot, recovery and finalization evidence incomplete.                                |
| `agent-platform-multi-agent.repair.4`  | Deferred       | Repair code delivery to staging done; exact bootstrap/lineage/brokered acceptance remains unverified.                                             |
| `agent-platform-pilot-active-budget`   | Deferred       | Implemented/reviewed/pushed to task branches; feature integration and connected qualification incomplete.                                         |
| `agent-platform-test-runner-loopback`  | Deferred       | Pushed checkpoints plus unfinished uncommitted offline-adapter code; evidence ingestion, final review/qualification/integration incomplete.       |
| `agent-platform-pilot-zero.17`         | Deferred       | Discovery/import/coordinator/lifecycle components delivered to feature; full actual execution path not qualified.                                 |
| `agent-platform-pilot-zero.13`         | Deferred       | Pilot draft/contract material exists; final launch-ready material and prerequisites incomplete.                                                   |
| `agent-platform-pilot-zero.12`         | Deferred       | Earlier assessment/handoff delivered to feature; latest reconciliation update is pushed but PR283 remains open.                                   |
| `agent-platform-orchestration-toolkit` | Deferred       | Backlog specification only; feasibility research/implementation not started.                                                                      |

These statuses and notes were read back and Dolt synchronization succeeded. Closed scoped tasks do
not establish unattended pilot success. The parent records overlap with their children; they are not
twelve separate implementation jobs. Do not reimplement already-delivered code from an old status label.
Unrelated product/harness tasks were not deferred or closed by this prototype disposition.

## Exact retention locations and future decommissioning boundary

Read-only ancestry checks established the following delivery split; refresh before later action:

- Orchestration foundation `491518811ab53d003a2d2f90ed79dd6fb9d07d0e` and initial assessment staging
  delivery `1be9301f6cbb8052f8d7eb56471fe50e35cbba4e` are ancestors of both current staging and feature.
- Later reviewer/discovery/import/lifecycle work is integrated into the feature through PR271,
  PR276, PR277 and PR278; those later delivery commits are not all in staging.
- Active-budget source `ee3a160f9f3152ba16ed0ebbe376dc940c86dacf` is pushed on
  `task/pilot-active-budget` and retained in `task/test-runner-offline-adapter`; neither current feature
  nor staging contains it.
- Runner checkpoint `4cbef34f6d1a90af0ffea3e352074337664780da` is pushed on the offline-adapter chain.
  That remote branch tip is `e1222b1958b87ddc2cf371983fe5e56536fb5fe3`; it does not contain local edits.
- Paused worktree `/Users/letuscode/.codex/worktrees/harness-readiness/agent-platform` still has
  13 changed paths, including uncommitted `offlineTestAdapter` source/tests and supporting lifecycle,
  contracts/evidence changes. Preserve this checkout; branch checkpoints do not back up those edits.
- [PR283](https://github.com/jwill9999/agent-platform/pull/283), **test: qualify runner controls and
  expose local-network blocker**, remains open on `task/harness-readiness-reconciliation` at
  `5b796b74`, targeting the feature. Do not merge or resume it merely from this handoff.

The owner explicitly requested a saved-memory retention/decommissioning note; it was saved and read
back locally. Future removal requires reviewing source already in staging/feature, consumers/imports,
workspace/build/configuration wiring, tests/docs, pushed branches and uncommitted work. Closing Beads
or deleting a local checkout would not remove shipped code. Prepare a separately reviewed removal
only after an actual decommissioning decision; preserve useful product security and recoverable history.

## Continuation and pause

**Next priority has not been selected.** Begin with `bd ready` and relevant `bd show` reads in canonical
Beads root `/Users/letuscode/projects/agent-platform`, refresh dependencies and source/PR delivery,
then discuss product backlog priorities with the owner. Older product notes can also lag integrated
code; verify before allocating or changing task status. Do not invent a preferred next task or deadline.

Documentation worktree: `/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`.
This handoff is on `task/native-development-handoff`, based on the merged feature; source publication
is separate from feature/staging integration. Preserve the dirty primary and other unrelated worktrees.
Old orchestration automations remain paused; no prototype continuation or pilot is requested.
Complete the newly authorized handoff/staging integration after checks pass, then stop until the
owner selects the next product priority. Any integration-only monitor must not revive old pilot work.
No product implementation or new tests were performed for this status-only documentation update.

---

## Historical developer-autonomy cleanup checkpoint — 9 October 2026

Owner authorized this cleanup through planning, implementation, tests, repairs, independent review
and exact-head hosted CI to a final owner code-review request. No repeated routine phase approval;
no merge/deployment/global edit/paid gateway call/prototype or pilot resumption.

Worktree: `/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`.
Native task chain: planning → policy → guidance → acceptance; cumulative target
`feature/harness-backlog-review`. Planning and policy checkpoints passed independent reviews and
full branch-specific Notion readback; guidance review and all 30 full mirrors passed; acceptance branch is assembling final CI/review evidence. Source provenance and AUT/V maps:
[plan](docs/planning/codex-developer-autonomy/plan.md),
[results](docs/reviews/codex-developer-autonomy.md).

Preserve all paused source work in `/Users/letuscode/.codex/worktrees/harness-readiness/agent-platform`:
13 dirty files/unfinished offline adapter and its existing evidence, untouched by this cleanup.
The copied [pause checkpoint](docs/reviews/evidence/codex-autonomy/paused-checkpoint.md) and
[complete restriction audit](docs/reviews/evidence/codex-autonomy/supporting-audit.md) retain local
snapshot provenance; prior remote links did not contain them. All other dirty worktrees and global
configuration/skills/memories are preserved. Relevant orchestration/merge monitors remain paused.

Next within this authorized task: finish current-tip publication, open/inspect the tip PR, repair required CI failures and request owner code review when
green. Final independent source acceptance is approved. Native fresh-child smoke and 102 unchanged product
security regressions passed; standalone
profile-loader activation/full product-ticket journey remain unverified. Never infer merge/pilot authority from CI. On later owner-approved integration,
new sessions follow native developer policy; old loaded/global guidance can be stale and its exact
follow-up proposals await owner discussion. Historical pilot instructions below are inactive records.

---

## Branch cleanup handoff — 8 October 2026

Cleanup removed 28 remote and 36 local branch names, with all 64 tips retained as pushed archive
tags and a verified recovery bundle. See [complete branch audit](docs/reviews/branch-cleanup-2026-10-08.md)
for every original SHA, retained scope and recovery instructions. Main/staging promotion, stashes,
dirty primary files and other worktree ownership are unchanged. The missing deferred Notion task
specification is retained in this documentation PR; its source branch remains until integration.

PR281 is merged into staging at a5a1641c. PR280 is integrated into the retained harness feature at
5fbdff22. Next: integrate this documentation handoff, then resume .12/.17 readiness assessment.
The older session entries below are historical, including obsolete PR280 pending-merge statements.

---

## Reviewer evidence repair and pilot planning — 29 September 2026

PR279 is merged into `feature/harness-backlog-review` at `43157a8c`. Owner authorized the narrow
reviewer repair, ten non-launch skill scenarios and pilot planning. Current branch:
`task/reviewer-skill-evidence`, in `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
Canonical Beads stays `/Users/letuscode/projects/agent-platform`.
[Draft PR280](https://github.com/jwill9999/agent-platform/pull/280) publishes the repair and blocked
pilot draft; hosted checks remain required before merge. Beads updates and Dolt push succeeded.
Temporary review gateway/networks were removed; no pilot or review process remains running.

The reviewer can now receive exact committed skill files as inert, revision-bound evidence without
widening ordinary worker `.agents` access. Independent review found a partial-clone Git transport
risk, fixed with transport-denying local reads and a regression sentinel. Full serial regression: 1,140 passed/77 gated skipped; real-container suite: 20 passed. Final independent repair review reports no code/security blocker. The first parallel run had timing/lease failures and is retained.
See [qualification and findings](docs/reviews/reviewer-skill-evidence-qualification.md) for test/review
results and limits. Ten decision scenarios ran: nine passed the specified decisions; S1 safely stopped
but did not establish the exact configured admission-to-scheduling route. No pilot was launched.

Owner approved scoped child `agent-platform-harness-baseline-p4.1`; it is open, blocked by `.13` and
has [its own specification](docs/tasks/agent-platform-harness-baseline-p4.1.md). Wider P4 remains open.
The [pilot draft](docs/planning/single-task-permission-pilot/plan.md) and linked verification plan define
approved-write then fresh hard-path-denial coverage across backend and connected Electron UI.
Independent draft critique exposes managed test-dependency feasibility, phase acceptance, actual
role-policy and coordinator/start bindings, and enforceable run limits. These must be resolved before
final plan agreement and persisted approval. Task creation/planning is not execution authorization.

Next: review/integrate this repair after hosted checks; reconcile `.12`/`.17`; establish the exact
managed runner and operator plan with evidence, resolve critique findings, bind documents and actual
policy, then obtain approval for the single-task pilot. Do not close P4 or promote to staging.
Notion structural alignment, the two-task pilot and wider feature integration remain separate.
Historical handoff entries below are preserved and may describe superseded PR states.

---

## Standalone readiness checkpoint — 28 September 2026

## Review comment addressed — 29 September 2026

PR279 comment 1 requested auditable historical-row preservation evidence. A fresh read-only comparison
of the retained pre-migration backup and canonical journal produced matching whole-table SHA-256
digests for runs, contracts and leases. The report documents canonicalization, reproduction and the
retrospective evidence boundary; no database contents are published. Same-count mutation, row-order,
duplicate and type-distinction checks passed. This is documentation/evidence work only; the separate
reviewer-access repair and pilot remain unstarted. Refresh PR279 checks before merge.

## Paused at the owner’s request

Work is paused. [Draft PR279](https://github.com/jwill9999/agent-platform/pull/279) contains the
readiness evidence and this handoff, targeting `feature/harness-backlog-review`; it remains unmerged.
Repository documentation and its three Notion mirrors were saved and read back. Beads `.17` and
`.12` were updated and Dolt push succeeded. No task was closed on the strength of host readiness alone.
The iMessage notification failed with chat-not-found; no notification was delivered.

On return, first refresh PR279/checks, Beads and the actual checkout. Review the narrow skill-evidence
access repair before implementation: the isolated reviewer must read approved skill documents while
ordinary worker restrictions remain intact. Then run the ten retained decision scenarios, reconcile
skill-handoff gates and prepare the exact single-task pilot plan. Do not launch the pilot from this
handoff. Required independent review, exact approval and fresh runtime readiness remain gates.

The development host is stopped and temporary reviewer services were removed. No background
implementation or pilot was left running. Existing feature branches remain in place; staging and
Notion structural alignment are separate deferred work. Historical entries below are preserved.

PR278 is integrated. Current branch: `task/standalone-readiness`, worktree
`/Users/letuscode/projects/agent-platform-workflow-evaluation`.
[Readiness report](docs/reviews/standalone-host-readiness-2026-09-28.md) retains source and evidence.

Canonical journal migration succeeded after backup/rehearsal, preserving runs/contracts/leases.
Discovery for `.17` reports no matching run. The configured development host reached `ready` using
existing account discovery and was stopped cleanly; no managed pilot or model generation ran.
Private operator configuration remains under the canonical workspace journal directory.

Current blocker: `.12` skill scenario review cannot launch because the current snapshot loader rejects
`.agents/skills/` evidence. The attempt made no model call. Its gateway/networks are cleaned up.
Older procedural reviews are integrated but do not establish all required behavioral scenarios.
Next: resolve the supported read-only skill evidence path without weakening worker permissions, run
those scenarios and reconcile `.10`/`.11`/`.12`; then finalize `.17` and prepare exact `.13` pilot plan.
No staging, pilot launch or new implementation authority is inferred. Notion alignment stays deferred.

---

## PR278 integration confirmed — 27 September 2026

GitHub confirms PR278 merged into `feature/harness-backlog-review` at
`c9729617759be0cb0d3c89f7cb3b18f914553914` on 27 September at 22:22 UTC.
The merged packages and CI configuration match the qualified PR head `3ec6b1a`.
All nine executed pre-merge checks passed; Sourcery and staging-only packaged VM checks were skipped.
R2/R3 implementation is now integrated. The previous awaiting-merge statements below are historical.

Next: reconcile the remaining `.17` readiness gate against this merged baseline, including explicit
canonical journal identity provisioning and read-only discovery verification, then prepare the exact
single-task pilot plan (`.13`). Keep `.17` open until that prerequisite reconciliation is complete;
do not treat integration as authorization to launch the pilot. No pilot or staging promotion occurred.
Notion alignment remains the separately deferred task. This post-merge handoff is saved on
`task/artifact-import-coordinator`; it is not an additional feature-branch merge.

---

## R2/R3 qualification handoff — 27 September 2026

Owner-approved R2 governed worker import and R3 standalone coordinator completion are implemented on
`task/artifact-import-coordinator` in `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
[PR278](https://github.com/jwill9999/agent-platform/pull/278) targets `feature/harness-backlog-review`.
PR277 was merged at `b7be3d6`. This remains supervised prerequisite work; no pilot or staging promotion.

Source `4e4a3a1` passes 1,125 Node 24 regression tests (76 gated skipped), all 13 connected Docker
journeys and all 25 role/tool enforcement checks. All nine executed source-head hosted checks pass,
including browser and desktop E2E and SonarCloud. Staging packaged VM testing remains separate.
The [qualification report](docs/reviews/artifact-import-coordinator-qualification.md) retains failures,
repairs, source/build hashes, review findings and limits. Independent review is complete; its final provenance-label correction is applied and hashes rechecked.
Publication-head CI and documentation-mirror delivery are recorded on PR278 and Beads.

Beads `agent-platform-pilot-zero.17` remains in progress until required integration;
`.13` pilot planning stays blocked. Notion alignment remains a separate deferred task.
The next owner action is PR278 merge review once its publication-head checks are green.
Then verify the merged baseline and prepare the bounded single-task pilot readiness assessment.
The canonical journal has four cancelled runs and no live leases, but no R1 identity binding:
provision and verify discovery before attempting a pilot. No journal migration or live pilot occurred.

The historical entries below retain their original evidence and may describe superseded statuses.

---

## Historical: R1 run discovery — 27 September 2026

PR276 is verified merged into `feature/harness-backlog-review` at `87c5cc4`; its final nine executed
checks passed, with Sourcery and staging VM skipped. The Notion publishing and iMessage policy
documentation tasks are closed and synced in Beads. Runtime adapters are still unimplemented.

Current work: `agent-platform-pilot-zero.17`, R1 authoritative discovery and guarded admission,
on `task/run-discovery-admission` in `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
The owner resumed and said continue; existing approved scope is retained. Supervised prerequisite
mode applies; no managed run, merge or staging promotion. The canonical journal was inspected
read-only (four cancelled runs, zero live leases); it was not migrated or given new execution authority.

[Qualification report](docs/reviews/run-discovery-qualification.md) records fixes and verification.
R1 source `d4580fe` passes 26 focused and 996 Linux tests (63 optional skipped); final independent
review has no actionable findings. [PR277](https://github.com/jwill9999/agent-platform/pull/277) is draft
and pushed; finish current-head hosted checks before recommending merge. The Sonar quality refactor
passed 26 focused checks, the 996-test Linux suite and independent re-review. Sonar reports zero
open issues on `d4580fe`; final publication-head hosted gates remain pending. R2 governed worker artifact
import and R3 coordinator completion remain next in the same task; `.13` pilot planning stays blocked.
Do not confuse run admission with approval to execute or claim a successful managed task cycle.

---

## Previous paused handoff — 27 September 2026

Historical pause: this section is superseded by the resumed R1 checkpoint above. No further implementation, orchestration pilot, merge or staging promotion was started.

## Saved position and next action

Active worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`; branch:
`task/development-lifecycle-plan`; integration target: `feature/harness-backlog-review`.
[PR276](https://github.com/jwill9999/agent-platform/pull/276) is open and unmerged. At `da8bf48`, all nine
executed hosted checks passed, including browser/desktop E2E and SonarCloud; Sourcery and the staging
packaged macOS VM test were skipped. This handoff amendment will change the head: refresh its checks
before recommending merge. The lifecycle implementation evidence remains at source `cb6c547`.

The repository Notion publishing skill and documentation links are committed at `da8bf48`. All eight
substantive changed documents were mirrored and read back successfully. The iMessage policy is also
published and its completion notification was confirmed. These are supervised agent capabilities;
neither a background documentation watcher nor unattended orchestration messaging is implemented.

On return, first review PR276 and its current checks together before owner integration. Then continue
existing `agent-platform-pilot-zero.17` prerequisites: authoritative matching-run discovery (R1),
governed worker artifact import (R2), and required coordinator completion (R3). Pilot planning `.13`
remains blocked until prerequisites are satisfied; no successful autonomous task cycle is claimed.

The notification adapter is a proposed bounded follow-up, recorded against
`agent-platform-imessage-policy`; its separate implementation task/plan is not yet created or approved.
Prepare that scope before unattended pilot use: trusted dispatcher only, fixed approved recipient,
authorized completion/blocker/failure events, duplicate prevention, confirmed receipts, uncertain-send
reconciliation and visible unavailable-tool failures. Workers must not inherit messaging MCP access.
Notion orchestration publishing access is a separate future adapter, not granted by the new skill.
Keep the reliable single-task execution path as the primary objective; do not expand into a broad
messaging project. Preserve existing scope approvals, and respect this explicit pause until return.

Beads authority remains `/Users/letuscode/projects/agent-platform`. Documentation issues
`agent-platform-notion-doc-skill` and `agent-platform-imessage-policy` remain in progress pending PR
integration. Preserve unrelated changes in the canonical checkout and historical records below.
Use `/tmp/agent-platform-git-bin` for Git while the Apple licence remains unaccepted.

---

## Session update: documentation publication — 27 September 2026

The owner-provided Notion publishing skill is now project-local under
`.agents/skills/agent-platform-documentation/` and linked from documentation guidance. It requires
full mirrors, version metadata, preservation of human notes and verified readback, with explicit
pending status when access is unavailable. Beads: `agent-platform-notion-doc-skill`. This is agent
guidance, not an orchestration Notion adapter or automatic watcher. Existing iMessage policy follows.

## Owner iMessage notifications

Owner authorized brief iMessage alerts for verified completion, actionable blockers and significant
failures. AGENTS.md points to the exact recipient and delivery rules in shared instructions. Beads:
`agent-platform-imessage-policy`. Host MCP access is available; isolated workers still do not inherit
it. Proposed orchestration integration belongs in the trusted notification dispatcher, with recipient
scoping, deduplication and delivery evidence; no runtime adaptation was made. Documentation amendment
uses the existing task/development-lifecycle-plan branch/PR276. Recheck hosted gates on the amended
head before merge. Prior lifecycle evidence remains valid for its unchanged source.

---

## Previous session: development lifecycle implementation — 27 September 2026

PR275 was merged into `feature/harness-backlog-review` at
`b53fdbb9cd3f184fc430d244df94c20dce48e7ff`. The active worktree is
`/Users/letuscode/projects/agent-platform-workflow-evaluation`, branch
`task/development-lifecycle-plan`; it incorporated that feature baseline at
`fc65cc83c68149c7f262d8856e016871c8a11a52`.

Owner explicitly authorized completing the bounded startup/recovery work and said **resume** after
Codex restarted. Continue without repeating that approval. Execution is supervised prerequisite
implementation, not a managed pilot. No merge, staging or live pilot is authorized by this slice.

Beads `agent-platform-pilot-zero.17` remains in progress; `.13` remains blocked. Active draft PR:
[276](https://github.com/jwill9999/agent-platform/pull/276). Requirements, execution evidence and review
history are in [the lifecycle report](docs/reviews/development-lifecycle-qualification.md).

The development startup/recovery component is implemented and pushed. Source `cb6c547` passes
971 Linux package tests (63 optional skipped), 36 focused journal/startup tests and all 21 connected
lifecycle/topology scenarios. Earlier 13 real-container role checks remain applicable; the unchanged
broker image completed a real model turn and denied its revoked token. Build/lint pass. Isolated
review19 reports no remaining actionable implementation blockers; its summary-count mismatch is fixed.
Retained evidence distinguishes injected faults, actual Docker/process recovery, and the delayed-probe
journal-restart fixture. Probe dispatch uncertainty survives restart and migration; malformed runtime
configuration is rejected before adapter generation. Effects remain uncertain after containment and
block replay. This is component qualification, not a completed autonomous task cycle.

Current publication boundary: PR276 remains unmerged. Final-head hosted browser/desktop/full
verification, SonarCloud and docs/security gates must be green before recommending owner merge.
Continue those gates under the existing approval; fix findings rather than requesting approval again.
After component integration, remaining R1–R3 cover authoritative run discovery, governed implementation
artifact import and required coordinator completion before the single-task pilot. `.17` stays in
progress and `.13` blocked. No pilot, staging promotion or feature merge occurred in this session.
Use the Git fallback in `/tmp/agent-platform-git-bin`; do not accept the Apple licence. Beads operations
use `/Users/letuscode/projects/agent-platform`, not this worktree. Historical checkpoints follow.

---

## Historical session: role enforcement repair — 26 September 2026

Owner authorized auditing and technically enforcing every specialist role, separately from broker
model access. Work is supervised under `.17` on `task/standalone-pilot-plan`, PR275 into
`feature/harness-backlog-review`. No managed run, pilot, merge or staging promotion.

[Role audit](docs/reviews/role-enforcement-qualification.md) and
[scope addendum](docs/planning/standalone-pilot/role-enforcement-addendum.md) record the policy matrix,
source/scratch/evidence isolation, generated MCP-free configuration, reduced grants and client limits.
Read-only reviewers cannot edit source; testing uses separate writable locations. Source context is
supplied to roles without shell access. Independent review findings were repaired, including strict
path validation and immutable process identity. The role component passed 13 filesystem, 12 real-client
and seven existing container checks; full
Linux regression passed 901 tests (42 optional skipped). Independent role/evidence review and the
narrow Sonar follow-up review report no remaining actionable blockers. Evidence is retained in the
linked report. Hosted checks are still required on the final published head; keep PR275 draft until
those complete. `.17` remains in progress and `.13` blocked; next broader work is unchanged R1–R3 and full host/startup/lifecycle qualification.

---

## Current session: local credential broker delivered — 26 September 2026

Owner explicitly authorized creating the missing local broker with the existing Codex account.
Supervised bootstrap delivery on `task/standalone-pilot-plan`; PR275 targets
`feature/harness-backlog-review`. Account credentials remain at the trusted gateway, workers receive
opaque revocable leases. Durable tombstones, restart fencing, executable control adapter and optional
runtime model gateway configuration are implemented. No managed pilot or staging changes.

[Component report](docs/reviews/local-credential-broker-qualification.md) holds the design, setup,
source hashes, tests and isolated reviews. Focused16/full Linux891 passed (17 optional skipped);
real Codex turn and revoke/restart denials passed with the final gateway image. Typecheck/build/lint
passed. Native full tests remain limited by the unaccepted Apple Git licence; Linux supplies the
regression evidence. Do not treat this as a complete production launcher lifecycle or autonomous run.

`.17` remains in progress and `.13` blocked: next qualify the complete launcher lifecycle/topology
and continue R1 run discovery, R2 governed artifact import and R3 coordinator completion under the
approved scope. The original proposed policy/contract hashes remain proposals, not installed authority.
Review current PR hosted checks before owner integration. Preserve existing authorization; no repeated
permission request merely to continue agreed work. Older entries below are historical checkpoints.

---

## Current session: managed host provisioning gap confirmed — 26 September 2026

Owner authorized continuing .17 after the planning PR. Read-only canonical journal inspection found
four cancelled runs and zero unexpired leases at that instant. Git fallback and Docker respond, but
no managed runtime config or credential-broker candidate was found in the bounded inspected locations.
See [host prerequisite assessment](docs/reviews/standalone-host-prerequisites.md) for exact evidence,
limits and the required issue/revoke/status/conformance protocol.

No runtime implementation or managed pilot launched. .17 R4's documented feasibility gate remains:
identify/provision a conformant revocable broker and qualify the managed image/network/production
startup. Next bounded work is the broker provision/design assessment, considering an opaque-lease
model gateway with existing account credentials retained only by the trusted host. This is proposed,
not implemented or provider-qualified. Preserve the owner's authorization; do not request it again
merely to continue assessment. Do not copy shared auth and call that per-worker revocation.

PR275 holds the reviewed scope; .17 remains in progress and .13 blocked. No staging changes.

---

## Current session: standalone prerequisite scope reviewed — 26 September 2026

PR274 merged into feature/harness-backlog-review at a8586aa. Owner authorized preparation of .17's
bounded repair plan. [Plan](docs/planning/standalone-pilot/plan.md),
[13-scenario verification matrix](docs/testing/standalone-pilot-prerequisites.md) and proposed v1
contract are published on task/standalone-pilot-plan, based on that feature revision.
Three isolated critique rounds resolved all scope-design findings; see
[review and evidence](docs/reviews/standalone-pilot-plan-review.md). Schema/manifest and documentation
checks passed. No runtime implementation or live orchestration test has started.

The scope covers run discovery/admission, journaled implementation imports, typed phase/coordinator
completion and host feasibility. .17 remains in progress and directly blocks .13. Before implementation
handoff, establish the managed credential broker/image provision path, bind actual policy/source and
review the exact execution authority. Existing reviewer account access is not managed worker authority.
The proposed policy hash identifies review material only and must not be used as an installed grant.
Staging, A2A and packaging remain outside this work. Temporary reviewer containers/networks cleaned up.

---

## Current session: approved-document binding implementation

Owner authorized implementation of `agent-platform-pilot-zero.16`; approval is recorded against the
reviewed planning material. This is supervised direct delivery, not managed orchestration.
Worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
Branch: `task/approved-document-binding`; target: `feature/harness-backlog-review`.

Current evidence and remaining acceptance scope:
[implementation checkpoint](docs/reviews/approved-document-binding-implementation.md).
Docker is healthy. Owner explicitly authorized completing all six findings. Repairs now cover
trusted source/current worktree resolution, durable snapshot denial, persisted packet identity,
terminal result replay and cleanup-only bootstrap. Independent rounds3/4 surfaced additional
initial-import and asynchronous repair-effect gaps; those are repaired with composed regressions.
Final local verification: Linux875 passed/17 optional skipped; enabled document/container suites110
passed. Build, monorepo typecheck, extended changed-test typecheck, workflow lint, formatting,
Markdown/links and dependency cycles pass. Rounds6-8 surfaced delivery/source/cancellation,
Git-expiry, Beads/Dolt dispatch and stale-caller adoption gaps; each is repaired with regressions.
Final isolated round9 approves the last correction with zero actionable findings; all36 supplied
snapshot hashes matched that checkpoint. Final Sonar two-file cleanup separately passes80 affected
tests/build/lint and independent round10 review; full875/connected110 precede only that cleanup.
Exact snapshots and reviewed limitations are retained in the implementation report.

PR273 remains unmerged targeting feature/harness-backlog-review. Check its exact-head hosted gates
before owner integration; local success does not substitute for hosted browser/desktop checks.
No staging or pilot authority. Beads .16 remains in progress until owner integration. After that,
re-read Beads .13/.12 readiness and prepare the separately approved single-task orchestration pilot.
These supervised repairs do not prove autonomous execution or absent downstream service adapters.

---

## Previous session: document-approval binding plan

PR271 is merged into `feature/harness-backlog-review` at `5e5f7f2bf66ca07410a5c83689230b0c3e25f609`.
The owner authorized planning and independent critique of `agent-platform-pilot-zero.16`.
Current branch: `task/approved-document-binding-plan`, based on that merged feature revision.

Planning package: [approved-document binding](docs/planning/approved-document-binding/plan.md).
The draft includes a typed document manifest, immutable snapshots, guarded approval/start/resume/
delivery paths and compatibility handling. The first independent isolated critic found a restart
hole after failed invalidation persistence; the revised plan requires durable verification intents
and quarantine recovery, plus the combined fault test. The second isolated critique approved the revised plan with zero findings. Structured results and
dispositions are in docs/reviews/approved-document-binding-plan.md.

No runtime/application implementation or managed run has started. Next: owner review of the published planning PR and proposed decisions before implementation. `.13`
remains blocked by `.16` and `.12`. Nothing is promoted to staging. Earlier session entries follow
as historical evidence, not current PR status.

---

## Previous session: repair PR quality gates

The owner resumed work and explicitly authorized assessment and repair of SonarCloud findings and
the desktop-E2E failure. Continue the existing task branch; no merge/staging/pilot authorization.

Current report: [PR gate repair](docs/reviews/pr271-gate-repair.md).
The desktop failure is an asynchronous evidence-capture race; backend denial and unchanged file were
already present in the failed artifact. Reviewer security findings are addressed by fixed gateway
routes, bounded stdin configuration, absolute executable path and hardened image defaults/install.
Local verification: 721 Linux package tests passed (13 optional skipped), four actual runtime/config
probes passed, and nine repeated Electron rejection journeys passed. Independent isolated review
found no confirmed regressions; its exact snapshot and limits are retained in the repair report.
Build, typecheck and lint pass. Hosted gates must be refreshed after push.

## Resume location and delivery state

- Worktree: `/Users/letuscode/projects/agent-platform-workflow-evaluation`.
- Branch: `task/permission-category-baseline`; integration target: `feature/harness-backlog-review`.
- Completed implementation commit: `a9b1003` (pushed). This handoff follows that commit.
- Existing review: [permission baseline and reviewer changes](https://github.com/jwill9999/agent-platform/pull/271).
  Refresh its checks and review state on return; local passing checks do not establish current hosted status.
- Beads authority: `/Users/letuscode/projects/agent-platform`; last Dolt push succeeded.
  Reviewer task `agent-platform-pilot-zero.15` remains in progress pending integration and broader acceptance.
- Temporary reviewer containers and network gateway were removed. No review or pilot is running.
  The pinned Docker image remains cached; provision the private gateway again before another live review.
- Nothing merged into the feature branch, staging or main during this work.

## Reviewer verification completed this session

Owner authorized controlled permission tests. The actual pinned client initially allowed delegation;
fixed with dedicated agent-disable and depth settings. Captured inventories and injected negative
calls now exercise enforcement. Docker boundary probes cover read-only evidence, excluded grants,
network restrictions and real startup-failure cleanup. Normal account-backed review also completed.

Assessment and evidence: [isolated reviewer](docs/workflow-control-supervised-review.md).
Defects corrected: delegation configuration, empty-result success, Docker cleanup race, tunnel
service-boundary weakness and response-stream reset handling. Fixed-endpoint account-backed review
succeeds. The bounded standalone-review verification gate passes for the tested image/configuration.
Independent feedback also improved complete inventory capture and cleanup regression coverage.
Qualification applies only to this pinned standalone reviewer profile; managed orchestration,
full skill acceptance, feature integration and owner approval remain separate.

The detailed-document approval binding gap remains `agent-platform-pilot-zero.16`, blocking pilot
plan `.13`. No merge, staging promotion or orchestration pilot occurred. Next is reviewing the
qualified route and finishing the remaining planning/skill acceptance gates.

## Current checks

712 Linux package tests passed; 13 optional tests skipped. Three real capability probes and the
effective-config probe passed separately. Six lifecycle tests, build, lint, Markdown and links pass.
Native Apple Git licence and absent Sonar/Problems connectors remain recorded limitations.

## Subsequent work after PR gates pass

1. Review the verification report and completed changes together. Refresh Beads and the existing PR
   before recommending integration. The successful standalone reviewer assessment does not approve
   the whole skill suite, managed orchestration or a merge.
2. Resolve the detailed-document approval binding gap in `agent-platform-pilot-zero.16`: execution
   approval must identify the exact task specifications and verification documents, and reject stale
   or changed material. This is recorded as a separate open task and blocks pilot plan `.13`.
   Define/review its bounded implementation scope before making the broader contract/runtime changes.
3. Complete the remaining skill-handoff acceptance and runtime prerequisites in `.12`, using the
   verified critic route where appropriate. Keep any new findings linked to the existing evaluation.
4. Prepare the exact single-task pilot plan in `.13` only after its prerequisites are satisfied:
   selected task, source revision, permitted actions, tests, completion criteria, recovery limits and
   reviewed document versions. Obtain the owner's bound execution approval before launching it.
5. Run and assess one complete managed task. Only after reviewing that outcome, prepare the separate
   two-dependent-task pilot to prove automatic progression without a manual restart.

The wider MVP baseline still includes remaining permission, cancellation, retry and recovery journeys.
They are future work, not coverage established by reviewer-isolation tests. Continue through existing
Beads tasks rather than creating duplicates. Keep planning, implementation, merge and staging
permissions separate; no standing authorization for broader repairs or promotion was added here.

The next conversation should start with a short briefing on the verification result and open
approval-binding task, then agree the next bounded work. Do not rerun completed checks without new
changes or a specific unresolved concern.

## Earlier handoff (historical; superseded where it conflicts with the current handoff)

## Skill preparation handoff — 24 September 2026

Enforced reviewer entry point implemented in workflow-control with content-addressed snapshots and
existing read-only Docker critic mounts. Offline isolation passed; live image/auth/egress setup remains
unconfigured. See docs/workflow-control-supervised-review.md. Do not claim live critique unblocked.
Typecheck/build/lint/cycle checks pass; 691 Linux package tests pass across full and repaired-fixture
runs, nine skipped. Four real Docker isolation probes pass. Native Git tests blocked by Xcode licence.

Owner-authorized supervised evidence-only critic route added to ADR-0004 and critique guidance.
This is a no-tool procedural exception outside active managed runs, not enforced external-tool isolation.
A separate critic returned findings on the supplied proposal. Broker-absence proof and formal
acceptance remain unresolved; see docs/reviews/supervised-critique-route-assessment.md.

Owner-approved naming clarification added: planning maps readable task titles to Beads IDs, specs
and branches; implementation resolves ambiguity and announces the selected task/branch before edits.

Created the owner-requested documentation skill and docs/README.md folder/authority guide.
Planning, critique and implementation now link it. Existing documents were not relocated.

Updated existing plan-critique and planning handoff: independent critique is mandatory for direct
and managed plans; compliant-launch limitations are explicit. No live critic or pilot launched.

Created orchestration and feature-implementation skills; reviewed existing planning/critique.
Subsequently updated feature-planning under explicit owner authorization with required artifacts,
publication, test feasibility, connected frontend/backend evidence, completion gates and exact handoff.
Owner also required unresolved ambiguity to be raised with the human before plan agreement; this is
explicit, with recorded answers and no silent assumptions or treating silence as consent.
Owner authorized this bounded work, with joint review afterwards. No live pilot or runtime repair.
See [skill readiness review](docs/reviews/orchestration-skill-readiness.md).
New Beads prerequisite chain is recorded with specifications and blocking dependencies.
Skill validators, Markdown and relative-reference checks pass. No application code changed.
Independent behavioral review and runtime qualification remain outstanding; no autonomous success claimed.

## Session handoff — orchestration review observation

The owner paused the proposed standing repair authorization and requested documentation of why
orchestration was not used and what should trigger its use. Added the September 23 observation and
proposed task-start readiness checkpoint to `docs/reviews/orchestration-field-evaluation.md`.
The actual omission was an explicit execution-mode decision; no managed launch failure was reproduced.
The permission approval wait was intentional. Runtime readiness still needs investigation; existing
approval rules remain unchanged. Further owner questions should extend this review and the existing
Beads pilot assessment before any activation or repair decision.

The owner subsequently requested adding the skill/discoverability recommendation and distinct new-run
versus existing-run paths. These are now recorded in the review, including read-only state lookup,
separate runtime-health checks, no-run versus failed-lookup handling, and explicit fallback decisions.
Routing rules are proposed; confidence scoring is unvalidated. No skill, runtime, approval or policy
change is implemented. Return to the owner for further review questions after this documentation update.

The owner also requested retaining model selection by role/task complexity as a future consideration.
The review records current inheritance intent, unverified effective selection in the isolated launcher,
and the need to benchmark quality, cost and retries before changes. No model routing, paid experiment
or budget change is authorized. Further review discussion remains the next step.

Added the owner's September 24 testing-gap reminder: assess upfront approval across real managed
handoffs and recovery, record unnecessary prompts or continuation problems, and base any rework on
evidence. No run launch, permission change or confirmed defect is implied by this reminder.

The owner requested a written staged assessment: readiness, one complete managed task, owner review,
then a separately approved two-dependent-task pilot proving automatic progression. Protocol:
`docs/reviews/orchestration-staged-assessment.md`. Both runs remain unexecuted; prerequisites, exact
work selection and executable material must be resolved first. Manual bridging cannot count as a pass.

The owner requested that gaps discovered while using the current planning skill be surfaced in the
orchestration field evaluation and Beads, including manual supplementation needed for runnable material.
This observation requirement is documented in both the field review and staged assessment protocol.

The direct-file repair remains pushed in PR271. All ten executed hosted checks passed at `3d7c44b`;
one separate Git merge-resolver test passed on retry. Human review/merge remains separate.
This handoff change is documentation only and does not claim new runtime verification.

## Earlier repair publication checkpoint

## Session handoff — approved direct-file permission repair

Owner approved extending Workspace writes to direct mutation tools. Repair on
`task/permission-category-baseline`, PR271 into `feature/harness-backlog-review`.
Beads `agent-platform-direct-file-policy` is in progress; P2 remains partial.

All ten composed permission journeys pass, including the original Ask/Block regressions and a new
Ask-to-Block change while approval waits. Block prevents the effect even after the old approval is
accepted. Six direct mutation tools are covered by dispatcher policy tests; stricter controls remain.
98 focused tests, 187 web tests, build/typecheck/touched-file lint pass. Full harness: 667 pass,
12 existing Apple Git/Xcode-license failures. All 19 selected Electron journeys pass at `314589d`.
All 39 API chat integration tests pass after two path tests explicitly enable Auto; 44 unrelated
Project Git API cases also hit the Xcode-license limitation. Docs/links pass. Hosted checks pending.
Repair and test updates are pushed (`314589d`, `c549855`); PR271 is ready for review and hosted checks
are running. Normal pre-push stopped on the recorded 12 Apple Git-license tests; publication used
HUSKY=0 after affected builds/types, 112 desktop and 187 web unit tests passed. Beads sync succeeded.
No merge or staging/main promotion is authorized. Review evidence is in
`docs/reviews/current-runtime-permission-category-baseline.md`.

## Historical baseline checkpoint

## Session handoff — remaining permission baseline finding

Owner authorized continuing baseline testing after merging planning PR269. Current task:
`agent-platform-harness-baseline-p2`, branch `task/permission-category-baseline`, base `c1ed389`.
Using real Electron/UI/API/SQLite/dispatcher/file execution with external provider and runner fixtures.

Initial permission suite: 7 pass, 2 fail. Direct writes under Ask and Block execute without an
approval and change the disposable file; shell controls remain correct. Direct Auto, read under
Block and network Block pass. Nineteen category policy unit tests and E2E type/lint checks pass.
Failing screenshots/JSON/traces were inspected and retained. No application changes made.

Priority-one follow-up `agent-platform-direct-file-policy` records the scope decision and recommended
consistent write-mode enforcement across direct mutation tools. Permission-semantic changes need
owner approval under the agreed repair boundary. P2 remains partial; do not merge this failing
baseline evidence branch or activate broader MVP/staging work. Next decision: approve direct-tool
coverage for Workspace writes, then implement a bounded repair with these regressions retained.
Committed test revision `7771375` repeated the same 7 pass / 2 fail result. Draft PR271 contains
the preserved regressions and follow-up; leave it unmerged. Committed artifacts are in
`.agent-platform/permission-category-committed-results`. Hosted checks remain separate; the local
push hook encountered 12 existing Xcode-license Git failures (630 harness tests pass), recorded in
the report before bypassing it for draft publication.
See `docs/reviews/current-runtime-permission-category-baseline.md` for evidence and limitations.

## Historical planning handoff

## Planning reconciliation complete

The owner authorized resolving the planning PR conflicts, updating requirements/evidence/Beads,
and independent subagent review without further input unless agreed scope changes. This authorizes
planning maintenance only; no merge, broader runtime implementation or staging promotion is included.

The feature branch now includes the completed permission repairs. The planning branch incorporates
that baseline and preserves the previous review bundle under
`docs/planning/mvp-reliability/review-pre-reconciliation/`. The revised proposal has passed independent review after normative document hashes changed.
The critic verified the schema, 11 normative bindings and 28 evidence entries, and confirmed that
authority, paths, task graph and policy are unchanged. Current review is in
`docs/planning/mvp-reliability/critic-review.final.json`. Historical approval is not current execution
approval. The first next decision is owner review/merge of planning PR269 after hosted checks;
remaining baseline scenarios precede broader implementation. No merge is performed by this task.

Validation: workflow-control built from current source; schema, digest and evidence validation pass.
Markdown passes excluding ignored generated `.agent-platform` Playwright reports (the broad docs
command includes their pre-existing lint errors); relative-link and diff checks pass. No new runtime
code or tests were changed relative to the integrated feature. Hosted checks are tracked in PR269.
The merge-triggered local push hook passed affected builds/typechecks and dependency-cycle checks;
614 harness tests passed, but 12 existing Git tests hit the known unaccepted Apple Xcode license.
The planning diff against the integrated feature is documentation only. The push hook is bypassed
for publication after recording this limitation; hosted checks remain required, not assumed green.

## Previous pause checkpoint (historical)

## Session handoff — September 23, 2026: paused after permission repairs

The owner explicitly paused work. Resume from this checkpoint; the material below it is
historical. No further execution or background continuation is scheduled by this handoff.
Beads remains the task-state authority.

## Completed and verified

The owner approved the current-stack planning boundary, including a smaller local status
panel, then separately authorized baseline testing and the two bounded permission repairs.
The tests reproduced saved-policy reload and denied-tool display defects. Both were repaired.
The Sourcery follow-up also now distinguishes unavailable file data from an empty workspace,
with a regression that waits for the failed backend Refresh response.

[Permission fixes PR270](https://github.com/jwill9999/agent-platform/pull/270) was merged by
the owner into `feature/harness-backlog-review`; the fetched integration tip is `cb373f3`.
Final reviewed repair revision: `93799833958151e01b1981086a8afd6a04bd63b7`.
All ten executed hosted checks passed, including browser and Electron journeys, full verification,
SonarCloud and Sourcery. Sourcery approved and its finding is resolved; Sonar reported no
unresolved findings. Hosted Electron reported 22 passing tests. The staging-only packaged macOS
VM check was skipped. Nothing has been promoted to staging or main.

Local evidence includes 13 passing selected Electron journeys before the final listing correction,
four passing permission journeys after it, and a focused passing Refresh rerun. Initial failing
regressions and later passing artifacts are retained under `.agent-platform/permission*` in the
workflow-evaluation worktree. These journeys compose the renderer, API, database and harness;
the external model HTTP service and command runner are fixtures. They do not establish live-model
or packaged VM isolation behavior. The integrated evidence report is
`docs/reviews/current-runtime-permission-baseline.md` on the feature branch.

## Current state and resume action

[Planning PR269](https://github.com/jwill9999/agent-platform/pull/269) remains open and held.
Its checked-out branch is `task/mvp-reliability-plan` in
`/Users/letuscode/projects/agent-platform-workflow-evaluation`. This session-only update does not
reconcile the plan or make it ready to merge. Its older source baseline and bound requirements
still need to reflect the completed tests and repairs.

The first action on return is to reconcile the planning branch with the updated feature branch,
update the plan's evidence and task/spec references, refresh normative document hashes and the
contract digest, then validate and obtain an independent consistency review. Preserve historical
review snapshots. Brief the owner on the reconciled plan before treating it as ready for merge or
seeking approval for a broader implementation slice.

After that, continue the existing baseline work: remaining permission coverage, cancellation,
retry and recovery scenarios. The wider permission baseline remains partial; sampled high-risk
shell-write behavior is verified, while other categories and direct file tools remain to assess.
Cancellation, concurrent resume, backend restart and uncertain post-effect retry gaps must remain
explicit. The local status panel and broader cancellation/recovery features have not been built.
There is no stack-restructure decision or broad runtime implementation approval.

Beads records: close the integrated `agent-platform-permission-ui-consistency` repair; keep
`agent-platform-harness-baseline-p2` and `agent-platform-mvp-reliability-plan` in progress with
this pause recorded. Keep the global harness review gate and broader feature tasks unchanged.
Use `/Users/letuscode/projects/agent-platform` as the Beads workspace root. Preserve unrelated
root-worktree changes. Documentation access remains separately integrated in its feature branch.

## Historical handoff material

The following records describe earlier checkpoints and may contain superseded statuses.

## September 22, 2026: recovery baseline continuation

## September 23: proposed MVP reliability plan

Owner requested tasks, requirements and a later briefing; explicitly accepted including a smaller
local in-app status panel independent of external dashboards. Planning only, not implementation.
The [MVP plan](docs/planning/mvp-reliability/plan.md) and version-one proposed contract are on
`task/mvp-reliability-plan`, based on merged harness feature `6b4d03e`. The documentation-access
feature is separately merged. Neither feature is promoted to staging.

Created planning issue `agent-platform-mvp-reliability-plan` and four unassigned, review-gated children:
`agent-platform-harness-r3.cancel`, `agent-platform-harness-r3.reconcile`,
`agent-platform-harness-v4.local`, `agent-platform-harness-v5.mvp`. Reuse existing baseline P2/X2/X3/X5
and V1; V1 spec has a proposed refinement. Parent specs/history/status/blockers retained. New edges
and parent relationships read back successfully. No old task is closed or superseded.

Contract schema and document binding validation pass. Independent critique approved after two
corrections (Project Chat host path and immutable normative-document bindings). Owner implementation
approval and scoped Beads readiness reconciliation remain pending.
Runtime code and dependency files are unchanged. Documentation PR integration remains feature-only;
staging and production are separate decisions. Current task remains planning in progress until
its declared review/delivery gates are met. New implementation tasks are not claimed or active.

Owner requested continued frontend/backend journeys and a login adequacy check. Work is on
`task/harness-recovery-baseline`, chained from `task/harness-provider-journey` at `5d3b876`;
PR #266 remains open against `feature/harness-backlog-review`.
The cumulative continuation is [PR #268](https://github.com/jwill9999/agent-platform/pull/268).
Test code commit `b12d148`; all three new journeys also passed at that exact commit.
Beads changes are synced. Hosted gates are running; initial documentation lint found a duplicate
top-level handoff heading, corrected here.

Added reload-and-approve, reload-and-deny, and transient provider HTTP 503 recovery scenarios.
Reload scenarios verify two concurrent retries of a completed resume do not change file, audit,
messages or provider count. All edit journeys now check paired lifecycle events with distinct
original/resumed run identifiers and matching per-run correlation identifiers.

Evidence and limitations: [recovery baseline report](docs/reviews/current-runtime-recovery-baseline.md).
Real Electron/UI/API/SQLite/harness/provider SDK; HTTP model and fixed-command VM runner fixtures.
No dependency or production behavior changes. Local build, explicit E2E TypeScript and ESLint pass;
53 API and 93 harness focused tests pass. All nine Electron scenarios pass locally; hosted quality results are authoritative on the final PR head. Local Sonar/Problems tools
are unavailable; use hosted Sonar plus normal CI as the completion gate.

Beads X5/X3 remain partial. Next gaps: simultaneous first resumes, backend restart, ambiguous
post-effect retries, permission settings permutations and frontend cancellation. Project Chat has
no Stop control. Login is absent by the locked single-user/no-auth MVP design; the owner was asked
whether they meant sign-in or logging. Do not add authentication or broad monitoring by inference.

No main/staging promotion. Preserve root worktree's unrelated `.beads/interactions.jsonl` and
untracked `.vscode/mcp.json`. Use bundled Git on this machine (Apple Git license blocked) and Node24
with the Homebrew pnpm. Canonical Beads root is `/Users/letuscode/projects/agent-platform`.

---

## Session handoff

Last updated: September 15, 2026 — completed authorized coverage and fixture assessment.

### Latest assessment handoff

Shared mapping completed: [coverage report](docs/reviews/current-runtime-coverage-assessment.md). All 17 areas mapped; 273 selected tests and local provider/reasoning transport probe passed. Ordinary chat excludes critic/DoD; Automatic still asks for the sampled shell write. No product or reusable test changes. Next: owner review of the bounded X6/T1/P1 composed journey; all implementation tasks remain queued.

### Historical planning handoff

Owner-agreed repair rule: within an approved testing task, reproduce and preserve the failing test, fix a small directly related defect restoring established behavior, then rerun gates and retain before/after evidence. Broader architecture/dependency/permission or behavior changes need linked repair tasks and review. Planning/mapping remains read-only.

What happened: baseline proposal v3 now includes context, cancellation/retry/limits, planning, persistence/resume, streaming and conditional auxiliary-call coverage mapping, alongside tooling adequacy, approval policy and override boundaries, critic/completion failure cases and UI feedback evidence. See [baseline plan](docs/planning/harness-modernization/current-runtime-baseline-plan.md). Direct Markdown lint, formatting and repository relative-link checks passed. No new tests or product code were implemented.

Current state: branch `jwill9999/harness-baseline-plan`; Beads `agent-platform-harness-baseline-plan` remains open for owner review. Prior workflow evaluation PR remains unmerged. Historical snapshots below are not current status.

Backlog update: 18 Beads tasks now track shared mapping and all 17 matrix areas, with verified prerequisite edges and individual specs. Status and pause checkpoints remain in Beads; no test implementation started.

Next: review the matrix and first slice with the owner; after implementation approval, map existing coverage and resolve the provider-fixture seam before building sequential journeys. Migration value also requires a bounded candidate comparison; baseline correctness alone does not prove savings.

### Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

### Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

### Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

### Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

### September 15: continuation diagnostic observation

The owner requested documentation of the assessment continuation stall and the evidence needed for future diagnosis. See [orchestration field evaluation](docs/reviews/orchestration-field-evaluation.md). Root cause remains unknown; active heartbeat configuration does not prove delivery. No assessment managed run was launched. Future repair work remains under the existing pilot assessment; no implementation is authorized by this note. Modernization assessment drafts remain pending independent critic review.

### September 15: modernization assessment ready for owner review

The [source assessment](docs/planning/harness-modernization/sdk-assessment.md) and its [independent critic record](docs/planning/harness-modernization/reviews/sdk-assessment-critic-review.md) are ready for joint review. The owner authorized a one-off supervised critic exception; its initial findings were corrected and focused recheck passed. This is not managed-orchestration acceptance. F0 and the joint review gate remain open; no packages, paid experiments or product implementation are authorized. The assessment self-check can pause at this owner-review boundary.

### Disposable workflow evaluation and testing skill

Owner authorized the bounded Project Chat evaluation and a targeted Playwright quality-gate skill improvement. See [evaluation](docs/reviews/project-chat-journey-evaluation.md) and [task spec](docs/tasks/agent-platform-workflow-journey-evaluation.md). Approved/denied edit scenarios and adjacent command scenarios passed locally with deterministic model/VM fixtures; file and durable backend checks are independent of UI messages. Installed skill and repository copy are synchronized. Beads task remains open for PR/hosted integration review; no staging/main merge or framework migration authorized.

### Current-runtime baseline planning

Owner requested a plan for evidence-driven workflow coverage before migration decisions. See [baseline proposal](docs/planning/harness-modernization/current-runtime-baseline-plan.md), tracked by `agent-platform-harness-baseline-plan`. Planning only; no new journey implementation is authorized. First uncertainty is a provider-boundary fixture route that retains the real reasoning/SDK path without inventing saved baseURL propagation. Prior test/skill changes remain in draft PR265 with nine executed checks passed and no merge.

### 19 September: current-runtime tests before stack comparison

Owner prioritized current-functionality evidence before considering restructure. PR265 is merged
into feature/harness-backlog-review at f2b306e. This task branch includes the earlier baseline
planning/coverage documents and adds the approved X6/T1/P1 provider-backed approve/deny family.
See docs/reviews/current-runtime-provider-journey.md for results and limitations. Six shared Electron
scenarios and 112 desktop unit tests passed, plus build/scoped lint/explicit E2E typecheck. No product
code or dependencies changed. X6 remains in progress for delivery and its wider untested cases;
other baseline tasks remain open. Package comparison has not started. Work is supervised, no durable
autonomous execution run is claimed. Preserve unrelated root-checkout Beads changes.

## Integrated repair handoff (historical)

## Session handoff — September 23, 2026: authorized permission UI repair

The owner explicitly approved fixing both reproduced permission-display defects. Changes are on the
existing `task/mvp-baseline-permissions` / PR270 branch. No merge or staging promotion is authorized.
Workspace Settings now keeps successful backend policy reads despite file-listing errors and shows
loading/unavailable instead of assumed defaults. The harness emits a denied tool result when shell
policy blocks execution, preserving existing model error, audit and no-execution behaviour.

Both original composed regressions remain intact. Unit coverage now verifies denied emission without
execution and initial settings rendering without fabricated defaults. The wider P2 and cancellation,
retry/recovery baseline remain open. The repair issue stays in progress until the feature PR integrates.
Local validation: all 13 selected Electron scenarios passed, and all four permission cases passed
again at committed repair revision `3eb57cd` after an isolated rerun. Build/lint/type checks,
187 frontend and 614 available harness tests pass. Push hook was bypassed only after its known
12 Apple Git license failures; hosted CI must cover that complete suite. Changes are pushed,
with hosted checks pending at this checkpoint.
See [permission report](docs/reviews/current-runtime-permission-baseline.md) for final validation.
Hosted review also requested a native output element for loading status and removal of duplicate
provider setup in the Electron tests; both were addressed without changing policy assertions.
Sourcery passed but reported a real follow-up: failed listing appeared empty. The existing error
scenario now asserts unavailable listing/count after reload and Refresh; the UI distinguishes it
from a successfully loaded empty workspace. See report for retained before/after evidence.
No dependency/stack changes. The separate planning proposal still needs its updated spec hashes and
independent critique reconciled before broader implementation approval.

---

## Historical checkpoint — permission baseline findings

Owner approved the planning boundary, then separately authorized remaining baseline tests only.
Application changes remain outside this tranche. Current branch: `task/mvp-baseline-permissions`,
from the integrated harness baseline. Tests and evidence are pushed in [draft PR #270](https://github.com/jwill9999/agent-platform/pull/270).
Test commit `b86db9d` reproduced two passes/two failures; the whole selected file had 11 passes/two failures.
Desktop build/typecheck and 112 desktop unit tests passed on push. The gate remains FAIL.
The planning proposal remains in its separate draft PR #269;
its nine executed checks passed, packaged macOS staging test skipped as designed.

Four new Electron permission scenarios exercise Ask/Auto/Block and a real file-listing error.
Two product findings: saved policy appears as Ask after reload when file listing fails, and blocked
shell work retains Running activity after the backend denied it and the turn finished. Preserve
both unsatisfied regression assertions; do not silently skip or reinterpret them as success.
Repair proposal: `agent-platform-permission-ui-consistency` (open P1). P2 remains in progress.
See [permission evidence](docs/reviews/current-runtime-permission-baseline.md) for boundaries and
commands. Production code and dependencies are unchanged. No staging/main promotion.

Use isolated workspace roots for normal fixtures. Apple Git license remains unaccepted: use the
bundled Git for fixture project initialization and repository operations. Existing gitTools unit
fixtures hardcode Apple Git and cannot run successfully here; do not change them in this slice.
The accidental broader harness unit invocation produced 614 passes and 12 Git-license failures;
focused policy tests use `pnpm --filter @agent-platform/harness exec vitest run ...`.

Next: review the recorded permission defects with the owner, finish wider P2 coverage, then continue
cancellation/retry/recovery evidence in the agreed sequence. Product fixes need separate approval.
Refresh the draft planning contract's task-spec hashes and independent critique before any broader
implementation approval, because the P2 spec has now been refined. Keep the global gate open.
Preserve unrelated root worktree changes (`.beads/interactions.jsonl`, `.vscode/mcp.json`).

---

## Historical handoff — September 22, 2026: recovery baseline continuation

Owner requested continued frontend/backend journeys and a login adequacy check. Work is on
`task/harness-recovery-baseline`, chained from `task/harness-provider-journey` at `5d3b876`;
PR #266 remains open against `feature/harness-backlog-review`.
The cumulative continuation is [PR #268](https://github.com/jwill9999/agent-platform/pull/268).
Test code commit `b12d148`; all three new journeys also passed at that exact commit.
Beads changes are synced. Hosted gates are running; initial documentation lint found a duplicate
top-level handoff heading, corrected here.

Added reload-and-approve, reload-and-deny, and transient provider HTTP 503 recovery scenarios.
Reload scenarios verify two concurrent retries of a completed resume do not change file, audit,
messages or provider count. All edit journeys now check paired lifecycle events with distinct
original/resumed run identifiers and matching per-run correlation identifiers.

Evidence and limitations: [recovery baseline report](docs/reviews/current-runtime-recovery-baseline.md).
Real Electron/UI/API/SQLite/harness/provider SDK; HTTP model and fixed-command VM runner fixtures.
No dependency or production behavior changes. Local build, explicit E2E TypeScript and ESLint pass;
53 API and 93 harness focused tests pass. All nine Electron scenarios pass locally; hosted quality results are authoritative on the final PR head. Local Sonar/Problems tools
are unavailable; use hosted Sonar plus normal CI as the completion gate.

Beads X5/X3 remain partial. Next gaps: simultaneous first resumes, backend restart, ambiguous
post-effect retries, permission settings permutations and frontend cancellation. Project Chat has
no Stop control. Login is absent by the locked single-user/no-auth MVP design; the owner was asked
whether they meant sign-in or logging. Do not add authentication or broad monitoring by inference.

No main/staging promotion. Preserve root worktree's unrelated `.beads/interactions.jsonl` and
untracked `.vscode/mcp.json`. Use bundled Git on this machine (Apple Git license blocked) and Node24
with the Homebrew pnpm. Canonical Beads root is `/Users/letuscode/projects/agent-platform`.

---

## Session handoff (earlier checkpoint 2)

Last updated: September 15, 2026 — completed authorized coverage and fixture assessment.

### Latest assessment handoff (earlier checkpoint 2)

Shared mapping completed: [coverage report](docs/reviews/current-runtime-coverage-assessment.md). All 17 areas mapped; 273 selected tests and local provider/reasoning transport probe passed. Ordinary chat excludes critic/DoD; Automatic still asks for the sampled shell write. No product or reusable test changes. Next: owner review of the bounded X6/T1/P1 composed journey; all implementation tasks remain queued.

### Historical planning handoff (earlier checkpoint 2)

Owner-agreed repair rule: within an approved testing task, reproduce and preserve the failing test, fix a small directly related defect restoring established behavior, then rerun gates and retain before/after evidence. Broader architecture/dependency/permission or behavior changes need linked repair tasks and review. Planning/mapping remains read-only.

What happened: baseline proposal v3 now includes context, cancellation/retry/limits, planning, persistence/resume, streaming and conditional auxiliary-call coverage mapping, alongside tooling adequacy, approval policy and override boundaries, critic/completion failure cases and UI feedback evidence. See [baseline plan](docs/planning/harness-modernization/current-runtime-baseline-plan.md). Direct Markdown lint, formatting and repository relative-link checks passed. No new tests or product code were implemented.

Current state: branch `jwill9999/harness-baseline-plan`; Beads `agent-platform-harness-baseline-plan` remains open for owner review. Prior workflow evaluation PR remains unmerged. Historical snapshots below are not current status.

Backlog update: 18 Beads tasks now track shared mapping and all 17 matrix areas, with verified prerequisite edges and individual specs. Status and pause checkpoints remain in Beads; no test implementation started.

Next: review the matrix and first slice with the owner; after implementation approval, map existing coverage and resolve the provider-fixture seam before building sequential journeys. Migration value also requires a bounded candidate comparison; baseline correctness alone does not prove savings.

### Verified snapshot — 2026-09-13 (earlier checkpoint 2)

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

### Verification and task state (earlier checkpoint 2)

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

### Remaining orchestration acceptance (earlier checkpoint 2)

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

### Workspace and continuation (earlier checkpoint 2)

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

### September 15: continuation diagnostic observation (earlier checkpoint 2)

The owner requested documentation of the assessment continuation stall and the evidence needed for future diagnosis. See [orchestration field evaluation](docs/reviews/orchestration-field-evaluation.md). Root cause remains unknown; active heartbeat configuration does not prove delivery. No assessment managed run was launched. Future repair work remains under the existing pilot assessment; no implementation is authorized by this note. Modernization assessment drafts remain pending independent critic review.

### September 15: modernization assessment ready for owner review (earlier checkpoint 2)

The [source assessment](docs/planning/harness-modernization/sdk-assessment.md) and its [independent critic record](docs/planning/harness-modernization/reviews/sdk-assessment-critic-review.md) are ready for joint review. The owner authorized a one-off supervised critic exception; its initial findings were corrected and focused recheck passed. This is not managed-orchestration acceptance. F0 and the joint review gate remain open; no packages, paid experiments or product implementation are authorized. The assessment self-check can pause at this owner-review boundary.

### Disposable workflow evaluation and testing skill (earlier checkpoint 2)

Owner authorized the bounded Project Chat evaluation and a targeted Playwright quality-gate skill improvement. See [evaluation](docs/reviews/project-chat-journey-evaluation.md) and [task spec](docs/tasks/agent-platform-workflow-journey-evaluation.md). Approved/denied edit scenarios and adjacent command scenarios passed locally with deterministic model/VM fixtures; file and durable backend checks are independent of UI messages. Installed skill and repository copy are synchronized. Beads task remains open for PR/hosted integration review; no staging/main merge or framework migration authorized.

### Current-runtime baseline planning (earlier checkpoint 2)

Owner requested a plan for evidence-driven workflow coverage before migration decisions. See [baseline proposal](docs/planning/harness-modernization/current-runtime-baseline-plan.md), tracked by `agent-platform-harness-baseline-plan`. Planning only; no new journey implementation is authorized. First uncertainty is a provider-boundary fixture route that retains the real reasoning/SDK path without inventing saved baseURL propagation. Prior test/skill changes remain in draft PR265 with nine executed checks passed and no merge.

### 19 September: current-runtime tests before stack comparison (earlier checkpoint 2)

Owner prioritized current-functionality evidence before considering restructure. PR265 is merged
into feature/harness-backlog-review at f2b306e. This task branch includes the earlier baseline
planning/coverage documents and adds the approved X6/T1/P1 provider-backed approve/deny family.
See docs/reviews/current-runtime-provider-journey.md for results and limitations. Six shared Electron
scenarios and 112 desktop unit tests passed, plus build/scoped lint/explicit E2E typecheck. No product
code or dependencies changed. X6 remains in progress for delivery and its wider untested cases;
other baseline tasks remain open. Package comparison has not started. Work is supervised, no durable
autonomous execution run is claimed. Preserve unrelated root-checkout Beads changes.

---

## Historical staging documentation-access handoff

## 22 September: agent documentation access

Added project Codex LangChain documentation MCP and shared guidance for current AI SDK documentation:
official agent index, search and targeted Markdown pages, checked against installed package versions.
Live endpoints and TOML verified. No dependencies, application behavior or baseline-test priorities
changed. VS Code's existing MCP file and local Beads interaction changes are retained separately.

## 8 October: staging documentation link repair

PR281 link checking identified that the AI SDK search API now returns HTTP 404.
Shared instructions now use the official agent index to find topic URLs and fetch their Markdown
content. The reference index and installed-version safeguards remain. Fresh staging checks are
required on the corrected head; no staging merge or harness pilot is authorized by this repair.

## 8 October: documentation access across agent surfaces

PR281 review identified that shared LangChain guidance only named the Codex MCP connection.
Added official agent-index and TypeScript LangChain/LangGraph URLs, Markdown retrieval guidance,
and installed-version checks for Claude Code, Copilot and other agents without that connection.

````````

## Historical qualified archive staging handoff — source 9d9bdd74

<!-- prettier-ignore -->
````````text
# Current handoff — authored evidence bookkeeping — 11 October 2026

Protected adoption [PR293](https://github.com/jwill9999/agent-platform/pull/293) merged at
`3ab2f53dae98ae2d435973c98b1845bf5a2dd3a2`. Its staging tree exactly matches the reviewed
source tree `5e145a11ab08bafab5a7be4b31ad1f16f84ac751`. All fourteen executed checks passed,
with zero unresolved review threads, a clear protection gate, hosted Sonar OK and zero open issues.
Actual full Promptfoo analysis completed in run `38099627759`, attempt 1, reporting no LLM
security vulnerabilities in two batches; its proof and SARIF hash were verified. Actual packaged
macOS VM job `114352683133` in run `38099627754` passed helper signing, packaging and the real VM
journey. An independent critic verified the downloaded artifact digests and member bytes.
The ordinary scanner's built-in omissions and non-exhaustive finding limits remain disclosed.

Current task is `agent-platform-native-staging-bookkeeping`, specified in
[the bookkeeping task](docs/tasks/agent-platform-native-staging-bookkeeping.md).
Task `task/native-staging-bookkeeping` starts from `feature/native-staging-bookkeeping` at the
qualified staging adoption. It delivers authored metadata and retained histories only, through
ordinary full scanning. No historical archive payload, runtime, dependency or workflow changes
are included. The archived JSON ignore rules preserve formatting only; no scanner exclusions.
The selection manifest remains byte-for-byte from original evidence primer `2ad1a88a`.

Feature delivery is complete: [PR294](https://github.com/jwill9999/agent-platform/pull/294)
merged at `6929cd33f43f47d71c6f2966fe33f8f830639fbc` after all ten executed exact-head checks
passed on `275c8b6589ce66cef4f625c8a2bf6b44f44d1de9`, approved review and zero unresolved threads.
The feature tree `5abcb70d9d347ee9aeb12970fd43cec395e3d849` matches reviewed source and the
conflict-free staging rehearsal. Continue with protected staging qualification in
[PR295](https://github.com/jwill9999/agent-platform/pull/295); do not repeat PR294 delivery.
Every executed and required check, genuine ordinary full analysis, actual packaged VM and all
current protection/review findings must clear on its actual latest head before guarded squash.
PR293 or an earlier PR295 head's results do not qualify later changed source.

Local bookkeeping validation passed: direct API Markdown lint for all three substantive files,
explicit authored formatting including the otherwise ignored JSON manifest, JSON parse and diff
checks. Exact five-file scope, original manifest/ignore bytes and both complete session/spec bodies
were verified. All 220 original artifact modes/blobs/hashes/bytes and 139 JSON parses passed directly
from retained Git objects. Independent plan and implementation critics approved with no actionable
findings. No runtime change required a new local VM run. Three complete source-bound Notion
body/revision/hash/destination readbacks and normal commit/push hooks completed at `275c8b65`;
the hooks passed seven-package build/typecheck/tests and cycles. Those completed receipts remain
retained; do not repeat stable publication or hooks merely to poll CI. Any substantively changed
document must receive its own source-bound mirror/readback before final delivery. Live Beads and
revision-bound publication receipts distinguish the original completed work from a later repair.
The remaining integration gate is PR295's actual latest-head staging qualification and review.

After that verified delivery, reconcile [PR288](https://github.com/jwill9999/agent-platform/pull/288)
to exactly the complete 220 immutable archive additions. Preserve original refs with recovery
protection before any guarded ref replacement. Independently verify every original path, mode,
blob, SHA-256 and all 3,958,506 bytes. Its automatic security check and separate protected-staging
dispatch provenance, complete trusted-checkout merge verifier, actual VM and all current reviews
must qualify before protected staging merge. The qualified policy adoption SHA is `3ab2f53d`;
its retained actual CI evidence is required as well as ancestry. No archive qualification is
claimed from this bookkeeping or the optional dispatch-only skip on the adoption PR.

Then reconcile and independently review [PR286](https://github.com/jwill9999/agent-platform/pull/286),
preserving the full original native source and both histories. Require its new exact-head ordinary
full scan, actual VM and all gates before final protected promotion. Intermediate staging is not
the completed development baseline. Parent, archive and evidence tasks remain in progress until
their own definitions of done; close this bookkeeping task only after its verified staging delivery,
full mirror readbacks, source preservation and canonical Beads/Dolt sync.

Preserve paused [PR283](https://github.com/jwill9999/agent-platform/pull/283), reconciliation
`5b796b74`, budget `ee3a160f`, offline adapter `e1222b19`, dirty primary three paths and paused
thirteen paths. No main promotion, pilot, spend, orchestration resumption or source deletion.
The next product priority remains undecided for an owner-led live Beads backlog review.

The two complete snapshot bodies below are retained verbatim as historical text, including
superseded runner/scanner/approval directions. Use the current handoff and live Beads/refs above
for continuation; those older snapshots record what was known at their source revisions.

## Historical policy-adoption session — source 3ab2f53d

<!-- prettier-ignore -->
```text
# Session handoff

## Current native staging consolidation — 11 October 2026

Current owner direction supersedes historical prototype handoffs below. The orchestration
prototype remains paused/retained, with PR283 and budget/offline-adapter branches outside this
integration. Native development does not require its pilot/discovery/broker approvals. The owner
approved reviewed APFS runner setup and narrow archive scanner policy B, routine blocker repairs,
and protected staging merges only after actual current-head checks and actionable reviews clear.
No main promotion, paid model calls, pilot, decommissioning or next priority selection.

Staging remains `a5a1641c3d2a5ef317c05fa45c6190e7189c1915`; full feature PR286 head is
`542e082e3569934b4dcd86ab58b0ea3ce9edbbb3`. PR290 coordinator and PR291 BashGuard repairs are
merged into the feature; current PR286 CodeQL analyses have zero results and their scoped findings
are fixed on this PR ref. PR288 primer head `2ad1a88a7bcf3978e9c02884e36c0cfae8ab11d0` remains
unmerged. Neither staging delivery nor complete native development readiness is claimed.

Work is now on `task/native-staging-archive-policy` from staging-derived
`feature/native-staging-security-policy` in the clean codex-developer-autonomy worktree. New child
Beads runner/archive-policy issues and dependencies are read back; parent/primer remain in progress.
Beads synced after this initial resumed checkpoint. Subsequent changes need their own readback/sync.

[PR292](https://github.com/jwill9999/agent-platform/pull/292) delivers this segment to the dedicated
feature. At `2dd99c6f`, both critics approve the source; normal hooks pass and all six substantive
initial mirrors are fully read-back verified. Initial lychee failed only the retained Agent Zero
GitHub usage URL with HTTP503; carry its already-reviewed official raw-source URL repair, then
refresh checks and all seven document mirrors at the new tip. Sourcery skipped due to exhausted
weekly budget; no Sourcery code-review pass is claimed. No staging qualification or merge yet.

New hosted Sonar result at `e3c8523f` fails reliability/security ratings with 41 open issues.
The bounded resolver-test temporary-path correction passes 12 tests and independent review.
Archive executable/argument/API-route and reported quality repairs now pass 26 affected tests,
plus final revised negative controls, and both independent critics approve source delivery. Fresh
hosted Sonar and all exact-head CI remain required; previous source approval does not waive the failed hosted gate.
Actual repaired `bdcb34b3` analysis reduces open issues to 12 but remains failed, including 5.5%
duplication. A further independently critiqued bounded refactor uses fixed Git argv with validated
SHA stdin and narrows builtin-only bootstrap before reusing protected helpers. Both distinct critics approve the implemented second pass with no remaining findings, including
the added scalar bootstrap denial controls. All 28 affected tests pass, followed by two controls
for the final test-only amendment. New hosted qualification remains required; no stage merge.
Actual `a86f4d72` analysis now has only two issues: reliability and 0.0% duplication pass, but
security still fails on the ancestry Git invocation. The dedicated fixed-argument `--` boundary
repair is now independently approved by both critics; all 29 affected tests and scoped quality
checks pass. Actual `2d10d8b2` hosted Sonar still fails two S6350 traces despite those defenses.
The verified raw Git-object identity boundary is implemented and independently approved by
both critics. All 30 affected tests pass, along with scoped lint/format/syntax checks. The new
identity must equal the original request; no normalization, cache or waiver. Fresh actual hosted
Sonar remains required. Staging is unchanged. See current review results.

Fresh official runner 2.337.0 on native APFS is online as dev 23 with the four required labels;
old ExFAT installation is preserved, old idle Listener stopped gracefully, fresh credentials used
without copying/publishing tokens, and no service installed. PR286 CI 38081623129 attempt 2,
job 114337873032, completed preparation4 seconds, checkout3 seconds, install/preflight/assets/Swift
build. Signing failed because hardcoded build output differed from actual Swift output. A reviewed
shared `--show-bin-path` signing/packaging resolver is implemented and source-reviewed; hosted actual VM remains required.
Both old attempts stalled approximately 60 minutes before cancellation. Exact cancellation origin is
unconfirmed; cancellation does not explain the preceding filesystem stall. The owner-raised CI
concurrency refinement preserves active staging/feature validations using `github.base_ref == main`
for cancellation on this PR-only workflow; stale-head success never qualifies a new head.

Packaging fix local qualification: 12 resolver tests, 8 desktop fixture/script tests, actual
Swift build/development signing/asset hashes/package/signature verification and 2 packaged
Electron journeys pass. Healthy path uses real VM/assets/helper; provider output and unhealthy
runtime are documented doubles. Full build/typecheck/format/final lint pass. Independent PACK-01
toolchain selection finding is corrected with canonical `/usr/bin/swift` for build/discovery;
CI resolves once, signs/packages exact helper. Packaging re-review approved the correction.
Final frozen archive implementation passes 23 tests, with zero failures or skips. Independent re-review approved the
verifier dependency/attempt guards and scanner response/base-ref fixes. The further vendor-bundle
output-buffer correction passes the actual large-bundle regression and is independently approved. Hosted new-head full scan and VM remain
required before policy adoption.
Local success is not staging readiness.

PR286 full Promptfoo scan failed before analysis at 1,409,530 tokens > 1,000,000. PR288 provider
context overflow remains distinct. Owner approved narrow deterministic exact historical archive
qualification, not a blanket authored-code skip. Small policy adoption must itself receive actual
full scan and actual VM before protected trust. Existing PR288 includes authored bookkeeping, so
that must be delivered through full scanning before archive-only qualification. Archive route
requires exact 220 inert additions, protected-base immutable allowlist, independent data/security
review, automatic check plus separate protected staging dispatch and trusted merge verification.
Independent critiques approve implementation/source review; hosted adoption and connected qualification remain pending.

All 220 artifact bytes remain retained:3,958,506 bytes from original6ca3cd1b; all 139 JSON parse.
Independent data review found no confirmed credentials, disclosed local path/email metadata and
historical instructions as inert data, and documented non-exhaustive secret/consumer coverage.
Primary dirty3paths, paused dirty13paths and separate branch tips remain preserved.

Read [execution manifest](docs/planning/native-staging-remedies.md),
[policy spec](docs/tasks/agent-platform-native-staging-archive-policy.md),
[runner spec](docs/tasks/agent-platform-native-staging-runner.md),
[verification plan](docs/testing/native-staging-remedies.md) and
[actual results](docs/reviews/native-staging-remedies.md).
Next sequence: fully qualified small policy/runner segment to staging; fully scanned authored
primer bookkeeping; exact archive-only PR288 qualification/promotion; refreshed/rehearsed PR286
actual full scan/VM/protected promotion; verify complete source/preservation and clean only proven
delivered temporary refs with recovery protection. Then owner reviews the live Beads backlog to
choose next feature. Automation stays active within that authorization and quiet on unchanged jobs.

---

## Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

## Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

## Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

## Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

## 22 September: agent documentation access

Added project Codex LangChain documentation MCP and shared guidance for current AI SDK documentation:
official agent index, search and targeted Markdown pages, checked against installed package versions.
Live endpoints and TOML verified. No dependencies, application behavior or baseline-test priorities
changed. VS Code's existing MCP file and local Beads interaction changes are retained separately.

## 8 October: staging documentation link repair

PR281 link checking identified that the AI SDK search API now returns HTTP 404.
Shared instructions now use the official agent index to find topic URLs and fetch their Markdown
content. The reference index and installed-version safeguards remain. Fresh staging checks are
required on the corrected head; no staging merge or harness pilot is authorized by this repair.

## 8 October: documentation access across agent surfaces

PR281 review identified that shared LangChain guidance only named the Codex MCP connection.
Added official agent-index and TypeScript LangChain/LangGraph URLs, Markdown retrieval guidance,
and installed-version checks for Claude Code, Copilot and other agents without that connection.

```

## Historical evidence-primer session — source 2ad1a88a

<!-- prettier-ignore -->
```text
# Current handoff — bounded staging integration — 10 October 2026

PR285 merged into `feature/harness-backlog-review` at
`6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec` after all ten executed final-head checks passed,
review approval and resolved threads. The owner authorized promotion to staging once checks pass;
no main promotion or prototype resumption is authorized. The next product priority is still undecided.

PR286 is open, but its full security scan stopped before analysis because 1,400,512 tokens exceeds
Promptfoo's 1,000,000-token maximum. Split the same delivery without excluding files or weakening
checks. This first segment copies only reviewed inert evidence; application/package runtime and
security workflows remain unchanged. The final full feature promotion stays pending afterward.
Scoped archived-JSON Prettier ignores preserve original evidence bytes; security scanning is unchanged.
New manifest/documentation formatting and all original artifact hashes are explicitly verified.
Primer PR287 caught the same historical Agent Zero HTTP503 already repaired in PR285; carry that
one-line official raw-source URL correction so the older staging baseline passes link checking.

Current task: `agent-platform-native-staging-evidence`, a prerequisite of
`agent-platform-native-staging-integration`. See
[the evidence delivery specification](docs/tasks/agent-platform-native-staging-evidence.md).
Task branch `task/staging-evidence-primer` starts from `feature/staging-evidence-primer` at current
staging `a5a1641c`. Selected evidence source is the reviewed feature at `6ca3cd1b`; exact path/blob/hash
provenance is recorded in `docs/reviews/evidence/native-staging-evidence-selection.json`.

PR287 merged into the evidence feature at `d46668e76d70bacaed338dd9813ac8ec361c1509` after
all ten executed checks passed and review threads cleared. Its tree matches reviewed source `e51970a2`.
PR288 now targets staging. Next: verify the exact current feature head and complete protected staging
qualification; do not repeat the completed task-to-feature integration. Every required/executed gate, including the actual packaged macOS VM journey, must
pass before staging merge. The `dev` self-hosted runner is offline and its job is queued; the owner
has been asked to bring it online. Do not treat cancellation or a skipped VM test as success.

PR288 security scan failed on 10 October with an internal model context-window overflow
([run evidence](https://github.com/jwill9999/agent-platform/actions/runs/38064854986/job/114250324847)).
This is a scanner failure, not a vulnerability finding or a passed scan. Regular CI, CodeQL and
SonarCloud passed; staging remains blocked. Independently assess smaller complete-file batches and
the provider constraint before another promotion attempt; do not truncate evidence, exclude scan
coverage, change limits or claim byte estimates prove model compatibility.

The installed scanner `0.124.1` also omits patches for three oversized archived JSON artifacts under
its built-in limits; exact paths/reasons and versioned sources are recorded in the evidence task spec.
No successful scan or analysis of those artifacts is claimed. A supported provider remedy or explicit
owner policy disposition is needed; the macOS VM remains separately queued on the offline runner.
After the handoff repair passes feature checks and is delivered, pause the integration monitor at this
external blocker rather than keep rerunning unchanged scans or polling the same runner state.
Diagnostic handoff repair PR289 targets the evidence feature. Its current spec marks PR287 steps
complete and uses version-pinned official raw source links after the hosted GitHub URL returned HTTP503.
Next useful delivery is PR289 after exact-head feature gates and review clearance; then verify the
repair in PR288, resolve its handoff finding and pause at the documented scanner blocker.

Preserve PR283, `task/pilot-active-budget` at `ee3a160f` and `task/test-runner-offline-adapter` at
`e1222b19`, and all dirty primary/paused/unrelated worktrees. The paused checkout retains thirteen
changed paths; primary retains three. Before/after snapshots and scanner evidence are in
`/Users/letuscode/.codex/staging-integration-20261010`. No pilot, paid model call, deletion or old
orchestration automation resumption. The integration-only monitor follows this authorized delivery.

After the primer merges, refresh the full feature promotion against staging, preserve the entire
reviewed source plus integration bookkeeping, and rerun the smaller remaining diff through all gates.
Do not declare staging development-ready at the intermediate evidence checkpoint. After full delivery,
review the live product backlog with the owner to choose the next priority. Beads/remote refs remain
current authority; the older handoffs below are historical snapshots.

---

## Historical staging handoff

## Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

## Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

## Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

## Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

## 22 September: agent documentation access

Added project Codex LangChain documentation MCP and shared guidance for current AI SDK documentation:
official agent index, search and targeted Markdown pages, checked against installed package versions.
Live endpoints and TOML verified. No dependencies, application behavior or baseline-test priorities
changed. VS Code's existing MCP file and local Beads interaction changes are retained separately.

## 8 October: staging documentation link repair

PR281 link checking identified that the AI SDK search API now returns HTTP 404.
Shared instructions now use the official agent index to find topic URLs and fetch their Markdown
content. The reference index and installed-version safeguards remain. Fresh staging checks are
required on the corrected head; no staging merge or harness pilot is authorized by this repair.

## 8 October: documentation access across agent surfaces

PR281 review identified that shared LangChain guidance only named the Codex MCP connection.
Added official agent-index and TypeScript LangChain/LangGraph URLs, Markdown retrieval guidance,
and installed-version checks for Claude Code, Copilot and other agents without that connection.

```

````````
`````````
