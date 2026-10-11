# Agent diagnostics MVP — verification plan

Status: planned, not executed. Owner: implementer of `agent-platform-harness-v1`.
Source baseline: `7814b59845b52ad5f850bfc99b7baee0e6742a25`.
[Feature contract](../planning/agent-observability-mvp.md) defines R1–R7 and scope limits.
[Task](../tasks/agent-platform-harness-v1.md) owns all scenarios, including final integration.

## Feasibility and isolation

Source review found working API/SQLite integration fixtures, browser Playwright, desktop Electron
harness and a tested main-process Save As pattern. Node 24.14.0 exists locally. Docker Desktop
29.8.0 engine was reachable during planning; Agent Platform containers were not started. Existing
packaged macOS runner was qualified during staging consolidation; recheck its live availability
before scheduling. No new scenario below has been run. No model-provider credentials or spend
are required: use a loopback deterministic provider that emits known retry/error/wait sequences.
This proves application integration, not a real external provider's reliability or latency.

Use unique temporary app-data/SQLite directories per test, isolated API/web ports, fixture sessions
A/B, synthetic canaries and a fresh export directory. Do not use primary app data or production
credentials. Shutdown API/worker, close DB handles and delete only fixture paths in finally hooks.
Controlled time is allowed for age pruning; actual process restart and actual files are mandatory.
The packaged app must load its real bundled UI/backend and native SQLite adapter. Native save dialog
selection/cancellation may be supplied through a test hook; report generation, IPC validation,
fetch and filesystem write may not be mocked in the connected tests.

## Requirement-to-scenario map

| Scenario                        | Requirements | Setup / input and expected assertion                                                                                                                                                                        | Coverage / evidence                                                                                                                                                                                                                 |
| ------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 Unique ingress              | R1           | Invalid JSON, validation failure, direct API request and two concurrent BFF requests with identical caller correlation; unique trusted IDs, bounded caller metadata, no invented run; echo links correctly  | Extend API correlation and web chat-route unit tests; connected API/BFF test asserts persisted distinct request rows                                                                                                                |
| T02 Safe sinks                  | R2, R5       | Canary keys, prompts, paths, URLs, tool results, arbitrary model labels and nested unknown fields through each event/error path; no canary at log/store/API/report; allowed timing/error enums retained     | Plugin schema/projection tests plus integration capture of logger output, actual diagnostic DB and downloaded bytes                                                                                                                 |
| T03 Adapter contract            | R3           | Append/reopen, concurrent writers, duplicate same ID/content, conflicting content, monotonic sequence, stable upper-bound page, cross-scope/invalid/expired cursor, unsupported schema, migration rollback  | Shared conformance tests against real temporary SQLite and lifecycle tests; inspect sequence, count and health, never mutate core DB                                                                                                |
| T04 Retention and bounds        | R4           | Default and changed age/count, invalid settings, maximum-size event, oversized event, queue overflow, SQLite page/rollback-journal cap and pruning                                                          | Fake clock for age only; real files for storage; inspect retained rows, byte sizes and gap counters; prove longer retention does not restore pruned data                                                                            |
| T05 Telemetry outage            | R4, R7       | Hold SQLite reader/writer locks, inspect transient journal/recovery, delay worker acknowledgements, fill storage and kill writer during model/tool run                                                      | Real worker/DB integration; queue remains <=256 including in-flight; underlying tool executes once, no admission/retry change; dropped/uncertain coverage visible                                                                   |
| T06 Main journey and retry      | R1, R5, R7   | Real UI→BFF→API→model double→real harmless fixture tool, known delayed model and retry                                                                                                                      | Browser Playwright plus independent DB/fixture tool counter; report correctly links attempts, timings, safe failure and known token fields; no false additive total                                                                 |
| T07 Waiting/resume/restart      | R1, R3, R7   | Approval-required tool; reload UI; approve/deny; duplicate resume; restart API before terminal observation; disconnect stream                                                                               | Existing sessionChat integration regressions plus connected Playwright: no action before approval, no duplicate effect, denial persists, waiting distinct from stale/unknown; no automatic replay                                   |
| T08 Report and CLI              | R3, R5       | Two sessions plus failed request, active writes during export, >1,000 matching events, deleted history and unknown IDs                                                                                      | API/formatter/CLI tests: stable snapshot, scope validation, explicit truncation/window/gaps, maximum bytes, unknown vs empty; readable summary matches JSON events                                                                  |
| T09 Browser export              | R2, R5, R6   | User selects current session and saves download; select latest failure; tampered scope; API unavailable                                                                                                     | Connected Playwright captures download and inspects JSON/file bytes independently of toast; safe partial report or explicit unavailability, never silent empty success                                                              |
| T10 Packaged desktop export     | R2, R5, R6   | Packaged app creates known failed run; clicks export, main dialog hook chooses temp destination                                                                                                             | Real Electron UI/main/preload/API/SQLite/file journey; actual saved report inspected; basename-only success; no checkout/CLI required                                                                                               |
| T11 Export negative paths       | R2, R6, R7   | Cancel dialog; invalid renderer payload/arbitrary path/URL; missing capability, non-loopback peer, hostile Host/Origin, wildcard binding; disallowed scope; malformed/oversize backend report; write denied | Unit IPC tests plus packaged cancellation/write-failure journeys; no unintended file or network submission, no credential/path leak; API-down packaged partial export saves only projected unverified fields; visible useful errors |
| T12 Integrated support exercise | R1–R7        | Restart after acknowledged successful, retried and failed runs, export from packaged app, give only report to reviewer                                                                                      | Independent reviewer locates known slow/failing step and distinguishes missing data without raw content; retain exact revision, safe report and comparison to fixture truth                                                         |

T11 additionally asserts browser POST with missing/null/foreign Origin is denied before store access;
BFF never exposes its capability; main and CLI capability paths work; session/run mismatch and
cross-scope cursors fail. A malicious partial IPC payload cannot inject text or identifiers beyond
the typed schema. With the API completely stopped, inspect the packaged saved partial report and
its current-view/unverified/non-durable labels. With no observation, assert explicit unavailable.
T04/T05 assert database <=64 MiB, transient rollback journal <=66 MiB, combined <=130 MiB;
no WAL files are created. Hold a real external read transaction, exercise failed writes and crash
recovery, verify bounded retry/loss and unchanged tool effects. These are future assertions, not
measured guarantees from planning.

## Concrete file/test ownership

Extend `apps/api/test/correlationMiddleware.test.ts`, `observability.integration.test.ts`,
`sessionChat.integration.test.ts`; `apps/web/test/chat-route.test.ts`;
`packages/plugin-observability/test/store.test.ts`, `observability.test.ts`.
Add adapter conformance/lifecycle tests adjacent to the selected SQLite adapter and report tests
beside its formatter. Preserve `packages/db/test/toolExecutions.test.ts` and approval claim tests.
Add `e2e/diagnostics-export.spec.ts` using `e2e/playwright.config.ts`; add
`apps/desktop/e2e/diagnostics-export.e2e.ts` alongside the current Electron configuration, with
explicit packaged mode. Extend desktop IPC/preload and export tests based on
`apps/desktop/test/workspaceResourceExport.test.ts`. These new filenames are proposed, not present.

The implementer must wire the new packaged spec into an actually executed command/workflow;
a test file excluded by the existing packaged selector is not coverage. Retain existing real
packaged macOS VM gate separately; diagnostic export may use a harmless provider/tool fixture,
not claim it requalifies VM sandbox behavior. No required test may be silently skipped.

## Gherkin acceptance journeys

```gherkin
Feature: Share a safe local diagnostic report
  Scenario: Diagnose an external-model request failure
    Given the packaged app uses a deterministic remote-provider fixture
    And the fixture retries once then returns a known safe error category
    When the user exports the current failed request
    Then the real saved file contains distinct attempts and measured timings
    And its readable summary identifies the failing model step
    And it contains no prompt, credential, endpoint or tool payload
    And nothing is uploaded to support

  Scenario: Cancel sharing
    Given the current session has diagnostic history
    When the user cancels the main-process save dialog
    Then no report file is written
    And no diagnostic upload occurs
    And the session continues unchanged

  Scenario: History is incomplete after interruption
    Given a nonterminal observation was acknowledged before an API restart
    When the user exports the session after restart
    Then the prior observation is labeled unknown or interrupted
    And coverage gaps and available time range are explicit
    And no tool is replayed

  Scenario: Persistence failure cannot alter authorization
    Given diagnostics storage is locked or unavailable
    And a tool needs approval
    When the request reaches the approval step
    Then the same approval rule still applies
    And diagnostics reports degraded coverage
    And no new retry or denial is introduced by telemetry
```

## Measurable gates and evidence

T05 compares telemetry disabled, healthy and failed under the same deterministic 100-request
fixture. Record enqueue p95 (<2 ms target), event-loop delay and provider-independent request
overhead (p95 increase <=20 ms target), bounded memory/queue and identical tool effect count.
Measure multiple repetitions on the same machine; retain variance. If budgets fail, fix bounded
telemetry work or obtain a reviewed revised scope; do not weaken thresholds silently. Worker I/O
time is reported separately. This is an MVP regression budget, not a production SLA.

Task gates: affected unit/integration suites, connected browser/export journeys and packaged
T10–T12; build/typecheck/lint/format/cycles, documentation lint/links, detailed Sonar/Problems
inspection and exact-head hosted checks/reviews. IDE Problems was unavailable during planning;
use available Sonar API/hosted findings and disclose any missing diagnostic source. Protected
staging later requires all live rules, actual full security analysis and actual packaged VM.
Do not count skipped/cancelled jobs as executed passes. Final staging authority is separate.

Record results in a new revision-specific report under `docs/reviews/` linked from the task:
scenario, actual command, revision, environment, pass/fail/skipped/blocked/not-run, safe artifact
path/hash, mock boundary and defect disposition. Screenshots/traces must use synthetic data;
inspect artifacts for canaries before sharing. No production session or secrets in test evidence.
All required failed/unexecuted journeys block V1 completion. Broader V5/parent tests remain separate.
