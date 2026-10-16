# Stop and local monitoring — verification plan

**Status:** Acceptance contract; implementation qualification in progress. Actual partial results and
failures are in the [results report](../reviews/project-chat-stop-results.md). Baseline and ownership:
[feature plan](../planning/project-chat-stop-mvp.md). Every S scenario is owned by
`agent-platform-harness-r3.cancel`; M scenarios by `agent-platform-local-diagnostics-monitoring`;
Q01 by `agent-platform-local-mvp-stress-review`. This is not a results report.

## Harnesses and evidence

Unit/integration: strict contracts, app DB repositories and real API/harness with deterministic
barriers. Implemented focused files include contracts `runControl.test.ts`, DB `runControl.test.ts`, API
`runControl.integration.test.ts`, existing chat/approval tests and harness `backpressure.test.ts`.
Additional actual API controls cover service uncertainty, provider abort identity, process restart
and resumed-prefix persistence. Browser: Docker API/web/SQLite and inert provider/MCP fixtures,
`e2e/project-chat-stop.spec.ts`. Electron: real app/API/SQLite through
`apps/desktop/e2e/project-chat-stop.e2e.ts`; real VM fixture for a safe supported native cancellation
journey. All fixtures own temp projects/DB/processes and clean only their own resources.

Retain trace/screenshots/video where relevant, HTTP status/timing, typed control rows/versions,
admitted attempt/approval IDs, fixture call/effect ledgers and late-marker results. Inspect persisted
state and actual effects independently of UI or diagnostics. A missing event never proves no effect.
Save successful and failing attempts, not only a green retry. Shareable product diagnostic reports
exclude prompts, provider keys, private paths, tool contents and raw exceptions. Restricted synthetic
test artifacts may contain owned fixture prompts, paths and tool data; keep them access-controlled,
exclude real user secrets, and inspect and sanitize them before publication or sharing. Report
coverage/truncation/health explicitly.

| ID / requirements | Setup and action                                                                           | Expected result and independent proof                                                                                                                                                       | Layers                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| S01 STOP-1,2      | Start via HTTP without renderer; discover identity, block provider setup; POST scoped Stop | <=2s controlled ack after committed fence; status same IDs/version; zero provider admissions; no dependence on mutex or stream ownership                                                    | Contracts/DB/API plus browser/Electron equivalent                      |
| S02 STOP-2,3      | Barrier before admission, request Stop, then release; repeat after admission               | Before: no call. After: report admitted work in flight; fixture may settle, no later call/retry. Record ack and invocation order, not wall-clock guesses                                    | DB/harness/API and connected UI representative                         |
| S03 STOP-3,7      | Delayed cooperative provider/MCP/native action then Stop                                   | Abort reaches supported boundary; cancelled only with settlement proof, no next action; actual child/transport and ledger checked                                                           | Harness/MCP/API, browser/Electron, actual VM native representative     |
| S04 STOP-3,6      | Non-cooperative action crosses deadline and writes late marker                             | stop_requested/outcome_unknown honest; late effect retained, wrapper timeout is not termination, no subsequent action/replay                                                                | Harness/API and browser/Electron                                       |
| S05 STOP-4,5      | Pending approval, Stop, then approve/resume; race Stop after claim before effect           | No stopped-run dispatch, source logical run fences fresh execution ID; approval/Git receipts retained; later independent run unaffected                                                     | Repository/API and browser/Electron                                    |
| S06 STOP-3,4      | Fail first tool/model attempt; Stop during backoff or async hook                           | Retry callback rechecks durable fence; no second admitted attempt, fixture count exact, cancellation reason not provider failure                                                            | Harness/API; representative connected UI                               |
| S07 STOP-1,4      | Repeat Stop, wrong session/run, stale tab, completed old run and new active run            | Idempotent same target; mismatch rejects; completed result preserved; new run continues; no caller-selected actor privilege                                                                 | Contracts/API/headless and browser/Electron                            |
| S08 STOP-6        | Reload, switch Projects/sessions and reconnect after acknowledged Stop                     | Read authoritative target state; no auto replay or cross-selection update; existing obsolete streams still drain unless explicitly stopped                                                  | Browser/Electron and DB/API                                            |
| S09 STOP-6        | Kill owned API process with active, waiting and uncertain work; restart same DB            | Unfinished old process unknown/interrupted; stopped approval remains fenced; no implicit provider/tool replay; explicit new request gets new ID/warning                                     | API process integration and Electron                                   |
| S10 STOP-5,7      | Disable/degrade diagnostics; force mandatory control DB contention/write failure           | Control does not depend on diagnostics; failed mandatory commit never a successful ack; bounded retriable error; no admitted work under unreadable authority                                | DB/API and diagnostic contracts                                        |
| S11 STOP-7        | Distinct user Stop, timeout, disconnect and completion race; export each report            | State/UI/report reasons agree; compatible old V1 events; Stop timing/correlation present when healthy; no business event drops/pending/conflict/truncation in qualification capture         | Contracts/report/API and browser/Electron native exports               |
| S12 STOP-1–7      | Integrated send -> approval -> effect -> Stop -> reload -> explicit new request            | Same service headless/UI; preserved earlier effects; no later dispatch for old run; new run healthy. Existing replies, Git approvals, context budgets, MCP and permissions regressions pass | Connected browser, Electron, real VM representative, final integration |

Additional required cases: S13 (STOP-3/5), run configured sensor feedback/required before-push quality
commands with a barrier, Stop before and after admission, verify command count/owned effect ledger,
no further sensor or model dispatch, and required interrupted sensors are never labelled passed.
Include harness/API and one connected Electron journey. S14 (STOP-3/7), serve a real local provider
503 then pause controlled outer backoff; Stop and verify exactly one actual HTTP request, explicit
SDK internal retry0, diagnostic attempts matching actual HTTP starts, no post-fence request. Include
migration/limit controls in S10: legacy unbound approvals cannot execute, missing/pruned fences never
resume, protected row limits fail closed, settled retention safe. Raw previous events remain readable.

S15 (STOP-1/4/6) verifies observation does not starve explicit control: two stable active views make
at most 26 passive/discovery control GETs in 60 seconds, including their initial reads. Active and
approval-waiting views poll; terminal/null idle views cease. Honor actual 429 retry/reset deadlines
without early passive requests; reject invalid header values safely. Verify immediate Stop, changed
identity, explicit refresh and final settlement reads, plus stale-selection/backoff isolation. Keep
fresh admission/approval checks and existing rate limits. Deliberate navigation bursts in connected
fixtures may wait for their observed budget/reset before a planned action; never replay a mutation,
infer success from 429, or substitute fixture pacing for this production polling guard.

## Monitoring and historical-review acceptance

| ID  | Input/actions                                                                                                 | Required evidence                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01 | Enable local recording once; run app through headless/API and UI clients, restart and query historical window | Retained preference and safe observations survive; bounded writer with version/process/session/run identity; no manual per-run export required                                                                                     |
| M02 | Seed measurable local delay/queue pressure and report/store degradation                                       | Saved Stop/admission/settlement and request/model/tool durations plus periodic event-loop/CPU/RSS/queue/disk samples distinguish observation from cause; failures/gaps visible                                                     |
| M03 | Time advance and fill limits; disabled/unwritable/full DB/storage                                             | Explicit age/count/byte limits enforced; degraded intervals/recording health distinguish missing data; control and chat unaffected; no silent healthy report                                                                       |
| M04 | Inject content/secret/path/raw-error canaries; read metrics and review output through disallowed caller       | Schema projection omits canaries; only existing trusted local capability/origin rules access private monitoring; no upload or widening access                                                                                      |
| M05 | Stop capture/close app, restart uncleanly, request too large or stalled window                                | Bounded shutdown/read/cleanup; retained data survives; truncated/stale/previous-process flags explicit; no unbounded queue/file/process                                                                                            |
| M06 | Give agent only stored window/report for seeded issue after app restart, no live observer                     | Agent identifies suspect interval and evidence-backed candidate, states coverage/confidence, deduplicates existing Beads issue; no unsupported cause/automatic repair; instrumentation overhead and existing benchmark limits pass |

Q01: owner performs [30-minute trial](../tasks/agent-platform-local-mvp-stress-review.md) only after
S01–S15 and M01–M06 meet their declared delivery gates. Export a before/after snapshot and safe
resource history, including failures. Analyse at end and again from saved data later; link issues
and severity/next evidence in Beads. A failed recording preflight postpones the trial, not the Stop
feature's already satisfied tests. Production capacity, external billing and third-party dashboards
remain explicitly unverified.

## Commands and completion gate

Use Node24.14.0, canonical Git, normal hooks and tracing-disabled deterministic fixture settings.
Run affected package tests, build/typecheck/lint/format/cycles/docs. Run focused new browser tests
with `pnpm exec playwright test -c e2e/playwright.config.ts e2e/project-chat-stop.spec.ts`
against the owned Docker fixture stack. Use the existing desktop build commands followed by its
Playwright config for the new Electron file; real desktop Node/native ABI must match. Runtime
startup follows existing Docker or supported desktop paths, never ad-hoc host web/API servers.
Use existing diagnostic CLI and native exports; do not claim Docker bridge browser can access the
private loopback diagnostics endpoint. Capture its reports through an owned trusted local API
client; Electron proves the user export. Recheck current test selectors and recorded source before execution. Exact-head hosted browser/Electron and required actual VM cannot be skipped.

The current Stop result report is [project-chat-stop-results](../reviews/project-chat-stop-results.md).
Its updated S01–S15 local-proof matrix does not mark this contract delivered or waive
hosted/current-head review, publication, integration or monitoring/stress gates. Monitoring uses `docs/reviews/local-diagnostics-monitoring-results.md`. Record all scenario
statuses/evidence and outstanding gaps. Independent critic inspects source plus actual reports and
effects. Sonar/Problems fallback and actual hosted Sonar/CodeQL/security/review gates apply. Never
normalize a failed benchmark, infer cancellation from an HTTP success alone, or claim planned cases
passed. Required unexecuted/failed cases block their owning task; no unit substitute for E2E.
