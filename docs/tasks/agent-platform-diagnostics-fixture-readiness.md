# Repair: diagnostics process fixture readiness

**Beads issue:** `agent-platform-diagnostics-fixture-readiness`  
**Parent delivery:** `agent-platform-local-mvp-promotion`  
**Status:** Readiness repair approved; hosted verify failed additional checks; bounded failure evidence independently approved.

## Evidence and bounded scope

PR324 at `5d938b9829ea58b06baf39f5ffa63aac20ee20a3` passed its full security scans,
actual packaged VM, browser and Electron checks, but its verify job failed. The restart test
received HTTP 503 from its single post-restart report read. Its response body was not retained,
so the precise cause is unproven. Source inspection independently identifies a fixture mismatch:
`/health` succeeds before asynchronous diagnostics storage readiness, while diagnostic reads have
a deliberate 200 ms runtime deadline. An independent critic recommended correcting this mismatch.

The same job's repeated benchmark failed its unchanged 20 ms request-p95 overhead bound. Raw
samples show scheduling stalls in both disabled and locked modes, with low enqueue time. This
supports an environmental hypothesis, not proof of cause or a diagnostics performance fix.
The original failures and nine raw samples remain in
`/Users/letuscode/.codex/local-mvp-promotion-20261014`.

- DR-R1: Wait for authenticated diagnostics list reads to report ready storage and no pending events
  before starting the existing process-restart assertions.
- DR-R2: Bound the entire readiness operation, including network/body reads, by the existing nominal
  five-second startup budget; stop on child exit and fail unexpected responses.
- DR-R3: Preserve every single report read, event equality, no-replay, privacy and shutdown assertion.
- DR-R4: Keep production APIs, the 200 ms diagnostic read deadline, benchmark workload and 20 ms/2 ms
  performance limits unchanged. Do not retry reports until they pass.

## Design and delivery

A test-only helper polls `POST /v1/diagnostics/list` with the fixture's local capability. It accepts
only ready storage with zero pending events. Connection refusal, known diagnostics-unavailable 503,
starting state and pending writes can wait within the same overall abort deadline. Other HTTP
responses, malformed health, degraded/disabled/closed state and child exit fail. Fetch and body
consumption share the abort signal. The existing process fixture calls the helper after each spawn;
no application runtime source changes are needed.

Delivery is `task/diagnostics-fixture-readiness` from feature head `5d938b98`, then a guarded repair
PR to `feature/github-read-responsiveness`. The owner already authorized bounded blocker repairs
and conditional merges. The parent promotion has a hard dependency on this repair, while the
parent-child relationship is organizational. All new exact-head feature checks and review must
clear before merging the repair. PR324 then requires fresh protected full scan, actual VM,
quality, browser/Electron and review qualification; older successful gates do not qualify new code.

## Verification and completion

| Check                                                              | Requirements | Expected evidence                                           |
| ------------------------------------------------------------------ | ------------ | ----------------------------------------------------------- |
| Delayed readiness after connection refusal and known 503           | DR-R1        | Only list is polled; capability and bounded query retained  |
| Permanent unavailability and stalled request                       | DR-R2        | Overall startup deadline rejects, including in-flight fetch |
| Unexpected HTTP, malformed/degraded health and child exit          | DR-R2        | Immediate failure rather than silent retries                |
| Actual completed and approval-waiting process restarts             | DR-R1, DR-R3 | Single report reads; exact retained events and no replay    |
| Unchanged repeated diagnostics benchmark                           | DR-R4        | Nine samples within original bounds                         |
| Typecheck, scoped lint/format, normal hooks and independent review | DR-R1–4      | No suppression or runtime policy changes                    |

```gherkin
Feature: Process restart evidence waits for diagnostic storage
  Scenario: HTTP starts before persisted history is ready
    Given a restarted API process is listening while its diagnostics worker starts
    When the fixture waits for diagnostic list readiness
    Then the fixture waits only within the existing startup deadline
    And its one report request retains the original history and no-replay assertions
```

Both actual API process restart cases and the unchanged benchmark passed locally on the changed
fixture. The initial helper test run exposed an invalid UUID in its synthetic health fixture;
correcting that test datum made all nine helper cases pass. API typecheck and scoped ESLint pass. Independent source, evidence and documentation review approved
all five changed files with no actionable findings. The local benchmark artifact contains nine
per-mode summaries, with maximum request-p95 overhead 2.8315 ms; it does not retain individual
request durations. Fresh hosted benchmark evidence remains required.
These tests exercise real child API processes and SQLite with deterministic provider fixtures.
They do not introduce a browser/Electron product change; those exact-head hosted checks and the
actual VM gate remain mandatory for promotion. Existing independently verified browser, Electron
and VM diagnostic evidence at `5d938b98` remains historical evidence, not new-head qualification.

The completion gate is independent source/evidence review, full task/session Notion readbacks,
normal hooks, all exact-head hosted feature checks and resolved comments, followed by guarded
feature merge/tree verification and Beads close/readback/Dolt sync. The parent remains open until
protected staging delivery and preservation/cleanup complete. Local IDE Problems is unavailable;
terminal quality checks plus actual hosted Sonar and CodeQL are required. Preserve main, PR283,
paused orchestration, dirty unrelated work and the active Git delivery MVP branches/worktree.

## Hosted qualification and bounded failure evidence

PR326 at `93b13f472bd402d04260d99b3e4bfc50b9192c64` passed the repaired restart cases
and all nine readiness-helper controls. Its verify job `116130007248` nevertheless failed:

- The exhausted-provider-retry case in `diagnostics.integration.test.ts` returned 503 from its
  single report read. This fixture already awaits storage readiness; the startup repair does not
  explain this separate failure. The response body, store health and flush timing were unavailable.
- The unchanged benchmark completed six samples before failing repetition two: healthy request p95
  54.742748 ms minus disabled 17.334366 ms equals 37.408382 ms, above the existing 20 ms bound.
  Enqueue p95 was 0.022634 ms and healthy event-loop p95 was 55.738367 ms. These observations do not
  prove a cause or a performance fix. The raw artifact records `completed: false`.

The owner-authorized follow-up adds test-only failure evidence to the exhausted-provider case.
It still performs one report request and calls the original flush once with unchanged result/error
propagation. The assertion includes allowlisted response code, safe before/after health, elapsed
read time and whether flush was pending, resolved or rejected. It never includes raw response bodies
or error strings. Production deadlines, benchmark bounds and all report-content assertions remain
unchanged. This improves diagnosis; it is not represented as a fix for the unexplained 503.

The actual integration suite passed all 14 cases locally. Two disposable, removed observation probes
intentionally made flush reject immediately or after 400 ms. Both retained the expected failing 503
assertion, distinguished rejected from pending flush, and did not expose the canary. These are expected
failure controls, not additional passing product tests. Source, probe logs and prior hosted failures
are retained in the promotion evidence directory. Independent source and documentation review approved this addition without actionable findings.
Fresh exact-head qualification remains required.

Independent review of the other PR326 runtime artifacts confirmed 58 first-attempt Electron cases,
31 browser passes plus one existing prerequisite skip, and 17 diagnostic artifacts (16 durable with
no loss, plus the intentional unavailable control). Those passes do not waive the failed verify job.
