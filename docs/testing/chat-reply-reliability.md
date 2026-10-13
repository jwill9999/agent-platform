# Disappearing replies — verification plan

Status: owner-approved verification contract; implementation qualification in progress.
Actual results and retained failures: [execution record](../reviews/chat-reply-reliability.md).
Owner/task for every scenario and the final integration gate: `agent-platform-sizx` implementer.
Requirements and scope: [plan](../planning/chat-reply-reliability.md); [spec](../tasks/agent-platform-sizx.md).

## Environment and controlled boundaries

Use isolated real API/SQLite, BFF and production-built renderer, deterministic loopback provider,
synthetic transcripts and two named sessions A/B. Reuse the native fixture's owned ports/profile/data,
network guard, empty external keys and tracing disabled; do not access the user's actual conversations.
No paid model calls. For joined diagnostics use the supported native managed runtime and separate
Chromium page pattern in `apps/desktop/e2e/diagnostic-export.e2e.ts`, plus Electron against its renderer.
Normal Docker browser CI remains required. Docker's old context fixture has no diagnostic capability;
that known absence cannot substitute for the required connected report evidence here.

Delay only delivery of actual history/approval GET responses: fetch the real response first, retain its
body/status, then release at an explicit barrier. Never fabricate success transcripts or replace chat,
SQLite or approval handlers. For faults only inject bounded GET failure/hang. Every held route has a
finally-release and timeout; no arbitrary sleeps to make the race pass. Synthetic provider barriers may
hold a completion/failure so navigation order is deterministic. Save the observed ordering and counts.

## Requirement-to-scenario map

| ID     | Requirements / layer                             | User actions and expected visible result                                                                                                                                                                                                                                                                                                        | Independently checked effects and evidence                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-T01 | R1/R4; baseline regression, browser and Electron | On baseline hold a saved Project history response, send via real UI while enabled, release stale history before model completion; demonstrate missing final reply. After fix use the same hold but assert loading/disabled Send and keyboard refusal, release history AND approvals, submit once; final reply appears once and survives reopen. | Baseline backend completed with one persisted final assistant despite missing UI. Fixed premature POST/provider/audit delta zero; one accepted turn, exact persisted final content equals UI, no duplicate tool audit. Retain trace, screenshot, actual response body and SQLite fixture snapshot.                                                                                                                                                 |
| CR-T02 | R1/R3; lifecycle unit and connected browser      | History returns but pending approvals remain held; Send remains disabled. Release approvals; either ready or pending approval gate, never an intermediate sendable state. Attempt direct hook call and same-tick duplicates.                                                                                                                    | Mount real hook under React lifecycle (including Strict Mode) using React19 act/createRoot and one test-only jsdom dependency, with per-file Vitest DOM environment; parser-only tests are insufficient. Count admitted operation once, denied operations zero. Draft/attachments retained on refusal.                                                                                                                                             |
| CR-T03 | R2; lifecycle unit, browser and Electron         | Switch A→B with delayed A history and then delayed A success/error stream; start B operation; release A callbacks; B text/events/error/busy state unchanged. Include A→B→A and unmount cleanup.                                                                                                                                                 | Distinct generation/operation evidence; old finally never clears B busy. Only A owns A persisted result; B database/audits unaffected by stale UI callbacks. Return to A after completion and show durable result once.                                                                                                                                                                                                                            |
| CR-T04 | R3; unit timers, browser and Electron            | History GET failure, approvals GET failure and 15-second combined timeout give visible recoverable error, blocked Send and Retry history. Retry succeeds, preserving same-session draft/attachments. Late timed-out response cannot overwrite retried history.                                                                                  | Retry produces reads only; no chat/provider/tool effects. Fake clock for unit timeout; controlled bounded connected hang for deadline UI. Release all holds/cleanup. Errors must be safe, without secret or host-path canaries.                                                                                                                                                                                                                    |
| CR-T05 | R2/R4; connected browser and Electron            | Restore a genuine persisted pending approval, verify send remains blocked; approve once and reject in separate fixtures. Duplicate click/direct admission refused. Switch session while a decision is in flight; no stale card/message/status appears in target session.                                                                        | Real approval records, one allowed safe disposable effect/audit on approve, zero on reject, correct resumed reply and terminal card state. Existing MCP uncertain/not-completed behavior retained, no auth bypass.                                                                                                                                                                                                                                 |
| CR-T06 | R1/R3/R4; unit and connected regressions         | New Personal chat, saved Project chat via menu AND actual requested-session link/reopen, existing IDE caller, normal send, controlled stream error and context-limit halt keep correct text/status. Refused sends keep draft; accepted sends clear it once.                                                                                     | Saved-session link/reopen must visibly load the correct prior transcript/approvals before Send; verify the intended Project/session in SQLite. No unnecessary restore for genuinely new session; no POST replay on stream/network failure. Correct user/assistant counts and tool effects. Run existing context-token and MCP approval adjacent tests without changing their assertions. IDE coverage is caller regression only, not new features. |
| CR-T07 | R5; connected Chromium and Electron              | Export the safe report for the fixed successful run and a controlled admitted-run failure; investigator can join report request/session to trace and SQLite.                                                                                                                                                                                    | Validate V1 schema, selected scope, request/session consistency, outcome/timing, durable coverage and dropped/delayed counters. No prompt/credential/host-path canaries in export. Record missing telemetry honestly; UI visibility is established independently by Playwright. Delayed restoration refusal has zero chat effects measured independently of telemetry.                                                                             |
| CR-T08 | R1–R5; final integrated gate                     | On one final source revision run restored send → completed reply → switch/reopen → approval decision → diagnostic export, covering browser and Electron.                                                                                                                                                                                        | All required scenarios terminal pass, full test/quality/review map reconciled, exact source SHA/artifacts retained. This bug's implementer owns the gate before task close; individual helper tests cannot replace it.                                                                                                                                                                                                                             |

## Commands and gates planned

Build existing workspace/renderer and desktop fixture artifacts using repository scripts. Run affected
web unit tests with `pnpm --filter @agent-platform/web test`, plus hook lifecycle coverage; targeted
browser `pnpm exec playwright test -c e2e/playwright.config.ts e2e/chat-reply-reliability.spec.ts`
against owned configured services. Desktop:
`pnpm exec playwright test -c apps/desktop/e2e/playwright.electron.config.ts chat-reply-reliability.e2e.ts`.
The connected files now exist; the actual result map records runs and any bounded fixture repairs.
The normal Docker configuration sequences Chromium, the reply regression and MCP onboarding because
these suites share a disposable loopback provider port. Preserve all discovered tests exactly once;
qualify the dependency-enabled matrix without `--no-deps`. Both the conventional `/workspace` mount
and the context fixture's `/context-projects` mount must be available in the isolated test topology.

CR-T06 also covers cold Project reopening when agents arrive before or after the session lookup:
only the current selection may bind, exactly once, after confirming there is no saved session.
Navigation to Home or another Project must invalidate that pending binding; a failed binding must
surface its error without automatic retry. Retain the controlled pre-fix mounted failure and require
both fixed mounted coverage and the existing connected MCP initial-binding journey.

Repeated navigation to an already selected Personal chat must preserve its completed, resumed or
pending conversation. Explicit New conversation must still create a new session. Keep controlled
pre-fix failures and mounted regression assertions for both paths. Project-access fixtures must use
owned directories outside the source checkout: verify their own Git root or genuine no-Git state so
background checks cannot silently inherit the developer's remote. This does not qualify real GitHub
responsiveness; that existing backend issue remains separately tracked as `agent-platform-d185`.

Use Node24.14, canonical `WORKFLOW_GIT_BINARY=/usr/bin/git`, Vitest min/max forks1, tracing disabled
and normal hooks. A pre-existing unrelated hook-baseline bug is recorded separately; diagnose any
actual failure, do not silently skip or weaken gates.

Run affected build/typecheck/lint/format/cycles and related context/MCP regressions. Inspect V1 reports
at investigation, changed journey and final E2E review checkpoints, as required by the implementation
skill. Resolve actual Sonar/Problems and hosted review findings, including while other checks run.
At authorized promotion, every executed/required exact-head hosted gate, actual protected full scan
and packaged macOS VM must pass; source-tree Electron is not that VM qualification. Checkout-free
release/export testing stays with release work, as previously agreed. This UI bug changes no VM
policy, provider protocol or database schema; add lower-level backend tests only if that boundary changes.

Restoration-only failures need not produce an agent-run record; retain the safe UI/network evidence
and verify zero POST/database/tool effects rather than manufacturing a diagnostic event.

Retain baseline failure, final logs/traces/screenshots/video on failure, request counters, synthetic
SQLite/audit snapshots, safe diagnostic exports and review findings under an owned evidence directory.
Run each required scenario with controlled order, preserve first-attempt failures and justify bounded
retries after diagnosis. Required failed/skipped/blocked coverage prevents completion. Baseline reproduction and unit checks are recorded separately; publishing this contract does not
establish that any remaining connected scenario has passed.
