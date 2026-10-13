# Context/token MVP — verification map

Actual implementation outcomes: [result record](../reviews/context-token-optimisation-results.md).

**Owner:** `agent-platform-context-optimisation`; [plan](../planning/context-token-optimisation-mvp.md).

**Status:** Verification in progress. Baseline `d199ad01`; individual outcomes belong in the result
record and source-bound receipts. Every required row gates the same task.

## Requirements and scenarios

| ID / requirement  | Layer and inputs                                                                                                                             | Required observable assertions                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CT-T01 / R1,R2    | Unit: estimator/projection; short, exact-limit, just-over, Unicode, escaped JSON, tool-heavy definitions                                     | Count the final mapped schemas/messages, include framing margin; accepted estimate <= floor(input budget \* 0.9); deterministic output; provider usage is not relabelled as estimate.                                                                                                                                                                                                              |
| CT-T02 / R3       | Unit: one/multiple calls, matching results, orphan/duplicate/missing results, several turns                                                  | Atomic groups stay chronological and complete; protected latest user and all active-turn groups survive; malformed required history yields typed failure, never silently repaired into different tool arguments. Older intentional pending groups require every missing call to have matching durable approval provenance; test delayed/multi-call pairing and foreign/mismatched proof rejection. |
| CT-T03 / R2,R3    | Unit: both stored strategies, absent new fields and agent create/update/copy                                                                 | Absent/new input16000 and output2048 applied; explicit saved8000 and custom budgets survive read, update, copy and restart; existing configs parse; effective policy distinct from requested strategy; round-trip fields survive. Existing short-message contents remain identical when within budget.                                                                                             |
| CT-T04 / R1,R4    | Harness integration with captured provider requests: first call, several tool iterations, critic-returned revision, transient provider retry | Every reasoning call guarded, retries use identical admitted payload/caps, no double dispatch. Overflow invokes provider zero additional times and no transient retry. Prior effects remain exactly once.                                                                                                                                                                                          |
| CT-T05 / R3,R4    | Real API/SQLite with large historical tool result and synthetic working-memory fields                                                        | Full API history reaches the shared projection before selection; the old cutoff inside a multi-tool group cannot orphan a result. Old complete groups omitted without DB rewrite; latest user, task/goal/decision/file/blocker markers and tool pairing in captured request; persisted history/audit snapshots unchanged except normal new records.                                                |
| CT-T06 / R2,R4    | Real API with oversized mandatory input, oversized required tool group and schemas that alone exhaust budget                                 | Typed failure and stream settlement; composer can recover; no provider request for rejected call. Existing completed effects preserved, failed task status, no success-labelled completion or lost newly completed records.                                                                                                                                                                        |
| CT-T07 / R1,R3,R4 | Approval/resume: Ask approved once, rejected, permission changed to Block, replay, restart                                                   | Capture resumed provider input and cap; actual approval DB/arguments govern dispatch. Approved effect occurs once; rejected/blocked/replayed requests have no prohibited effect. Reasoning overflow after an approved effect reports that effect retained.                                                                                                                                         |
| CT-T08 / R3       | New process/reload with same SQLite; missing/stale memory and another session/project                                                        | Reload scoped existing working memory, preserve available protected state; no foreign canary appears. Stale memory cannot grant permission. Missing required context has explicit gap/error rather than fabricated continuity.                                                                                                                                                                     |
| CT-T09 / R2,R4    | Installed provider serializer against local protocol fixture; length finish and invalid/incomplete tool call                                 | Actual outgoing cap serialized, configured provider/model selection retained; length-limited response marked incomplete; partial invalid arguments never dispatch. Include ordinary success, provider400/429, retry-limit and cancellation regressions.                                                                                                                                            |
| CT-T10 / R5       | Contracts/store/report unit and API integration, old V1 records plus new context records                                                     | Strict old/new parsing, bounded counters/enums, arbitrary-field rejection. Readable summary/CLI distinguish local rejection vs real attempt and estimate vs reported usage. Canary prompts, memory, args/results, API key and paths absent from stored diagnostics/export.                                                                                                                         |
| CT-T11 / R5       | Diagnostics disabled/degraded, truncated export, deliberately dropped event fixture                                                          | Same admission/execution outcome with or without telemetry; coverage accurately reports uncertainty; no clean-review claim from missing data. Existing report behavior stays compatible.                                                                                                                                                                                                           |
| CT-T12 / R1–R5    | Connected browser and Electron Project Chat using deterministic external-provider endpoint and real backend                                  | Long history/tool-loop success, visible overflow and recovery, local report export. UI result agrees with captured payload, DB records, audit and actual disposable tool effects; see Gherkin below.                                                                                                                                                                                               |
| CT-T13 / R1–R5    | Final integrated run on final source, including normal short chat and existing default agent profiles                                        | All required scenarios pass; fresh seeded Personal/Coding profiles complete short requests with input16000 and output2048, real effects and V1 evidence. Explicit saved budgets remain unchanged. No silent tool removal to pass budget. V1 success and failure reports reviewed and findings disposed.                                                                                            |

Fixture limits: provider responses and capacity errors are deterministic; the application API, session
locks, SQLite, policy/approval service, tool dispatcher and relevant file effects are real. This proves
request construction and local behavior, not live model answer quality, exact provider tokenization,
actual billing or provider-wide TPM guarantees. Do not alter existing tool permissions to ease tests.

## Connected Gherkin strategy

```gherkin
Feature: Bounded context in local Project Chat
  Background:
    Given the connected application uses isolated app data and a disposable Project
    And a local deterministic provider endpoint records only synthetic fixture requests
    And the existing context and output limits are configured through the real API

  Scenario: Continue a long conversation without losing the current task
    Given previous tool exchanges exceed the configured input budget
    And scoped working memory contains the current task and a key decision
    When I send a new request in Project Chat
    Then the expected fixture answer appears and the composer becomes usable again
    And each captured provider request satisfies the estimated budget with valid tool groups
    And the task and decision markers remain in the admitted context
    And prior stored conversation records and completed effects remain intact

  Scenario: Explain a required-context overflow and recover
    Given the latest request and required instructions cannot fit
    When I send that request
    Then I see an actionable context-size error without internal paths or prompt contents
    And no provider request or prohibited tool effect occurs for that rejected call
    When I submit a smaller request that fits
    Then the chat completes normally

  Scenario: Preserve an approved effect when the next reasoning call cannot fit
    Given an Ask action is waiting for approval
    When I approve it through the real approval control
    And its required result exceeds the next reasoning allowance
    Then I see that reasoning stopped and earlier work remains completed
    And the disposable file effect and audit record occur exactly once
    And retrying or reloading does not execute that approved action again

  Scenario: Export the decision locally after restart
    Given a successful long run and a rejected oversized run have durable diagnostic records
    When I restart the test-owned application and reopen the session
    And I export its diagnostic report through the existing export action
    Then the report shows context decisions and honest coverage for the correct session
    And the file contains no synthetic secret, prompt, tool-result or memory canaries
```

CT-T12 runs the long-success and overflow/recovery journeys in both browser and Electron. Approval,
restart and export use Electron plus real API assertions; browser receives its existing regression
suite. Locate actions by accessible labels. Do not substitute component mocks for these journeys.

## Environment and isolation

Planning verified Docker reachable and hosted macOS `dev` runner online/idle. Runtime services and
all fixture prerequisites are not yet provisioned or proven by this plan. At implementation start:

- Use Node24.14 and lockfile dependencies (AI SDK4.3.19, OpenAI adapter1.3.24); no upgrade required.
- Use repo Docker API/web setup for browser tests and existing standalone desktop launch harness for
  native tests, with distinct test-owned projects, app-data, databases and ephemeral ports.
- Reuse `apps/desktop/e2e/support/providerJourney.ts`, provider network guard and diagnostic-export
  helpers; bind server/client to the same explicit loopback address family. Do not stop other apps
  or reuse another task's containers. V5's broader local transport issue stays separately tracked.
- Use synthetic credentials and local provider double; block unintended external model traffic.
  Preserve existing loopback-only diagnostic capability transport. Docker topology is not evidence
  that full local diagnostic export works: export is qualified using its supported desktop topology.
- Capture fixture request bodies only for synthetic test content in bounded local artifacts. Product
  diagnostic exports remain content-free. Capture outcomes before deleting owned disposable resources.

## Measurement and evidence

Retain a baseline and candidate record for identical synthetic workloads: short conversation, long
history, schema-heavy request, multi-iteration tool loop and oversized mandatory input. Record
serialized request bytes, estimated input/output allowance, provider-reported usage when available,
admission decision, group counts and latency. No fabricated token-saving percentage or unqualified
cost claim. Oversized cases must either produce a valid within-estimate request or an explicit local
halt; tests assert which outcome is intended. Short chat must preserve its admitted content and tool
availability when within budget; output cap is the explicit behavior change under review.

For each connected case record tested SHA, settings, fixture boundary, UI trace/screenshot on failure,
request/run/operation correlation, settled API/DB/audit state and file effects. Synthetic before/after
snapshots prove history preservation. Successful and failed V1 reports must include coverage state;
missing required evidence blocks acceptance. Compare evidence at both diagnostic checkpoints, reusing
unchanged source evidence only when valid.

## Quality and delivery gates

Planning validation: direct Markdown (including normally ignored docs), explicit Prettier, references,
manifest/Beads consistency, source-aware independent critique and full Notion readbacks. Runtime rows
above are **not run** during planning; do not report the plan as implemented.

Implementation: affected contract/harness/API/DB/renderer tests, builds, typecheck, lint, formatting,
relevant connected Playwright/Electron journeys, cycles, docs and Sonar/Problems fallback. Inspect
actual current-head hosted checks, review threads and security findings; all required/executed gates
must pass. Feature-targeted VM skips are not staging qualification. A later authorised protected
staging promotion requires genuine full security analysis, actual packaged VM and live protections.

The single owning task retains final feature-integration responsibility through CT-T13. Open a
cumulative task-tip PR into the feature after implementation; close only after declared checks and
actual authorised feature integration. Keep release-artifact verification separate for phase two.
