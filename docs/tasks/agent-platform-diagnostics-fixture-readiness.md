# Repair: diagnostics process fixture readiness

**Beads issue:** `agent-platform-diagnostics-fixture-readiness`  
**Parent delivery:** `agent-platform-local-mvp-promotion`  
**Status:** Independent source and local verification approved; hosted qualification pending.

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
