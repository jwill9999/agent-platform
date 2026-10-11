# Agent diagnostics MVP — verification plan

Status: implementation verification underway; actual outcomes are in the linked result report. Owner: implementer of `agent-platform-harness-v1`.
Source baseline: `7814b59845b52ad5f850bfc99b7baee0e6742a25`.
[Feature contract](../planning/agent-observability-mvp.md) defines R1–R7 and scope limits.
[Task](../tasks/agent-platform-harness-v1.md) owns all scenarios, including final integration.

## Accepted execution boundary

Owner accepted P1 option A on 11 October. Execute T01–T12 against real browser/standalone-Electron
UI, main/preload, API and SQLite, including file export and final report investigation. The strict
checkout-free application-artifact variants transfer to `agent-platform-electron-release.diagnostics-export`.
They remain release acceptance obligations, not skipped MVP passes or V1 closure blockers. Earlier
strict-default references below preserve the reviewed alternatives; this accepted boundary governs
current execution. The result report distinguishes actual execution from remaining qualification.

## Current implementation mapping

Actual outcomes are recorded separately in [the result report](../reviews/agent-observability-mvp-results.md).
The filenames below resolve the earlier proposed test allocation; requirement/scenario IDs and
connected acceptance remain unchanged:

- Contract/privacy: `packages/contracts/test/diagnostics.test.ts`.
- Adapter/physical/deadline: `packages/db/test/diagnostics*.test.ts` and reusable conformance suite.
- API/composed access and restart: `apps/api/test/diagnosticAccess.test.ts`,
  `diagnostics.integration.test.ts`, `diagnosticsProcess.integration.test.ts` and
  `diagnostics.performance.test.ts`.
- Report command: `scripts/diagnostics.test.mjs` after contracts build.
- UI/access/IPC: web diagnostic route/chat tests and desktop diagnostic export/preload tests.
- Real browser and connected Electron share `apps/desktop/e2e/diagnostic-export.e2e.ts`, using
  the actual standalone local BFF/API. Run through the existing desktop `test:e2e` command.
  Its hosted `desktop-e2e` job runs all `*.e2e.ts` and installs Chromium explicitly; the
  separate VM/release-artifact gate is not substituted for these browser/native export checks.

## Feasibility and isolation

Source review found working API/SQLite integration fixtures, browser Playwright, desktop Electron
harness and a tested main-process Save As pattern. Node 24.14.0 exists locally. Docker Desktop
29.8.0 engine was reachable during planning; Agent Platform containers were not started. Existing
packaged macOS runner was qualified during staging consolidation; recheck its live availability
before scheduling. Use the result report for current execution status. No model-provider credentials or spend
are required: use a loopback deterministic provider that emits known retry/error/wait sequences.
This proves application integration, not a real external provider's reliability or latency.

Use unique temporary app-data/SQLite directories per test, isolated API/web ports, fixture sessions
A/B, synthetic canaries and a fresh export directory. Do not use primary app data or production
credentials. Shutdown API/worker, close DB handles and delete only fixture paths in finally hooks.
Controlled time is allowed for age pruning; actual process restart and actual files are mandatory.
Strict T10/T12 require an actual application artifact loading its real bundled UI/backend and native SQLite adapter; that artifact has not been established. The existing repository-launched Electron fixture is a separate connected test layer. Native save dialog
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
recovery, verify bounded retry/loss and unchanged tool effects. These are acceptance assertions; actual measured results and environment limits are recorded
separately in the implementation result report.

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

## Executable verification mapping and artifact feasibility

These are implementation-stage commands, not commands executed during planning. Run from the
repository root under Node 24, with `WORKFLOW_GIT_BINARY=/usr/bin/git`, `VITEST_MAX_FORKS=4` and
`VITEST_MIN_FORKS=1` where required by the existing local test setup. Build first with `pnpm build`.
Use `exec vitest run` for explicit test selection rather than passing a literal extra `--` through
a package script and accidentally running the entire suite.

| Layer                         | Command / planned entry point                                                                                                                                      | Prerequisites and limits                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01–T08 plugin tests          | `pnpm --filter @agent-platform/plugin-observability exec vitest run`                                                                                               | Includes new projection/store/report tests; native adapter tests remain in its actual owning package                                                                                    |
| T01–T08 API integration       | `pnpm --filter @agent-platform/api exec vitest run test/correlationMiddleware.test.ts test/observability.integration.test.ts test/sessionChat.integration.test.ts` | Add new diagnostic integration filenames to the selected command as implemented; real temporary SQLite, no live provider                                                                |
| Storage regressions           | `pnpm --filter @agent-platform/db exec vitest run`                                                                                                                 | Temporary databases only; require adapter conformance and worker lifecycle cases in their eventual owner package                                                                        |
| BFF/desktop unit boundary     | `pnpm --filter @agent-platform/web exec vitest run test/chat-route.test.ts` and `pnpm --filter @agent-platform/desktop exec vitest run`                            | Include new route/export/IPC denial tests explicitly; no claim these prove packaged delivery                                                                                            |
| T06–T09 browser               | `pnpm exec playwright test -c e2e/playwright.config.ts e2e/diagnostics-export.spec.ts --workers=1`                                                                 | New spec/fixture must launch API and web on actual loopback free ports, set `BASE_URL`/`API_URL`, share private server capability, then clean them up                                   |
| Connected standalone Electron | `pnpm --filter @agent-platform/desktop test:e2e e2e/diagnostics-export.e2e.ts`                                                                                     | New spec reuses actual standalone renderer/API/SQLite and main dialog hook; existing script builds before Playwright; still repository-launched                                         |
| Existing protected VM gate    | Current `staging-packaged-macos-vm-e2e` job and its existing signing/resource preparation                                                                          | Keep actual VM qualification unchanged; its exact current selector only runs `packaged-vm-command.e2e.ts`                                                                               |
| Strict artifact T10/T12       | Artifact executable path supplied by release task; Playwright `electron.launch({ executablePath })` from temporary cwd with development paths removed              | No runnable app artifact/build command exists yet; blocked input, not a passing/skipped test. Record artifact hash, bundled runtime/native module identities and no-checkout assertions |

Implementation must add `diagnostics-export.e2e.ts` explicitly to an executed hosted Electron
selector and, where needed, a macOS diagnostic journey step. The existing protected job's selector
will not discover it automatically. Preserve the VM selector and every existing check; do not
replace real VM coverage with diagnostics fixtures. Strict artifact verification also removes
`AGENT_PLATFORM_DESKTOP_NODE_PATH`, source-path overrides and developer PATH conveniences, and
checks that loaded runtime/module/renderer paths belong to the supplied bundle.

The implementation owner supplies the isolated loopback browser fixture; it must actually start
Next with `--hostname 127.0.0.1` and a free port, start the API with `HOST=127.0.0.1`, seed safe
sessions and wait for readiness. Merely asserting a URL or setting a boolean is not evidence of
binding. Missing capability or unsafe binding produces explicit denied/unavailable diagnostics.
The current API child uses Node 24, so its better-sqlite3 binary must be built for that Node ABI
(`pnpm rebuild:native` is the existing repair command when the native binding does not match).
The new diagnostics worker runs in the API child's same runtime; do not load a Node-built binding
inside Electron main or substitute an in-memory adapter to hide an ABI error. Record Node version,
modules ABI and binding load result in test evidence. For an eventual shipped artifact, release work
must provide its chosen bundled runtime and matching binding; this plan does not choose an Electron
Node ABI migration on behalf of the release task.

No new Docker profile is required for this local journey; the current Docker setup is available
for existing regression gates, not proof of local-only diagnostic access.

[Decision P1](../planning/agent-observability-mvp.md#completion-audit--packaged-artifact-decision-p1)
explains the recommended bounded split and the unchanged strict default. Until the owner decides,
T10/T12's checkout-free acceptance remains required and blocked on artifact provision. The 4–6 day
estimate covers diagnostics, not application distribution work. Planning is ready for that concrete
review; implementation readiness must not be reported until the selected dependency/DoD is recorded.
