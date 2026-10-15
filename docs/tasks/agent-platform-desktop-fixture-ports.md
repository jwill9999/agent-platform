# Repair: distinct packaged Electron fixture ports

**Beads issue:** `agent-platform-desktop-fixture-ports`  
**Parent delivery:** `agent-platform-local-mvp-promotion`  
**Status:** Implementation and qualification in progress; staging promotion remains blocked.

## Requirements and evidence

PR324's hosted desktop check was green after one retry, but independent artifact review found
one flaky first attempt. The packaged VM fixture selected backend and renderer port `41185`
using two sequential ephemeral allocations that released each reservation before the next.
The renderer therefore displayed the API's `Cannot GET /` response instead of the application.
The retry used distinct ports and passed. This is a confirmed fixture allocation defect;
connection speed and product startup timeout are not established causes.

- FP-R1: Reserve API and renderer ports simultaneously until both values are obtained.
- FP-R2: Release every reservation on success or allocation failure.
- FP-R3: Demonstrate the old collision deterministically and pass the original connected case
  without retries or timeout increases.
- FP-R4: Preserve application behavior, original failure evidence and paused orchestration work.

The source-aware review evidence is retained outside the checkout in
`/Users/letuscode/.codex/local-mvp-promotion-20261014/critic-pr324/qualification-blocker.json`.

## Dependency order and delivery

No upstream implementation task is required: this defect was discovered during completed-source
promotion. The parent promotion has a hard dependency on this repair; its parent-child relationship
is organizational and does not require the parent to close first.

`feature/github-read-responsiveness` at `4e5b340552855f47acccd7d77362c79135389aad`
→ `task/desktop-fixture-ports` → guarded repair PR to the same feature.
The owner already authorized bounded repairs and conditional feature/staging merges. This worker
must not merge staging or clean retained branches; the coordinating agent owns those operations.
After the repair reaches the feature, PR324 requires all new exact-head hosted checks and review.
Earlier scan, VM and browser passes cannot qualify the changed source.

## Implementation and limits

A shared test helper binds two loopback servers while both reservations remain alive, returns the
backend/renderer pair after releasing both, and cleans up partial allocation failure. The packaged
fixture consumes this pair. This prevents self-collision during selection; it does not reserve ports
until the child processes bind, so an unrelated process can still take a port during handoff.
No runtime retry, timeout, readiness policy or production API changes are included.
Other fixtures retain the same older pattern; the three-port webview case needs a complete-group
solution, tracked separately in [the grouped-port follow-up](agent-platform-desktop-grouped-ports.md).
It is not silently treated as fixed by this two-port repair.

## Verification strategy

| Check                                               | Requirement  | Evidence                                                                                    |
| --------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| Deterministic lowest-free allocator                 | FP-R1        | Old sequential helper returns the same port; replacement returns two distinct ports         |
| Second allocation failure                           | FP-R2        | First reservation is released and the error propagates                                      |
| Real loopback sockets                               | FP-R1, FP-R2 | Distinct ports can both be rebound after helper returns                                     |
| Original network-block Electron journey             | FP-R3, FP-R4 | Real Electron/UI/API/SQLite and diagnostics; deterministic provider and VM adapter fixtures |
| Typecheck, lint, format, normal hooks               | FP-R4        | Affected package and source gates                                                           |
| Independent source review and hosted feature checks | FP-R1–4      | Exact pushed head; all actionable review findings resolved                                  |

```gherkin
Feature: Isolated desktop fixture endpoints
  Scenario: A network-blocked Project action remains visibly denied
    Given the packaged desktop fixture has distinct API and renderer ports
    And the Project policy blocks network actions
    When the user requests the network action through Project Chat
    Then the renderer shows the application and the action is denied
    And persisted backend evidence confirms the prohibited action did not execute
```

The existing connected case supplies the UI and durable negative-effect assertions. This fixture
repair does not need another product journey. The ordinary Electron fixture uses deterministic
external boundaries; the separate staging packaged-VM gate must still exercise the actual VM.
Diagnostics must be inspected for completeness and loss before declaring the journey qualified.

## Actual results and sign-off

Independent source, evidence and documentation review approved the bounded repair on 14 October
2026 with no actionable findings. Hosted qualification remains pending. The initial unit test
attempt exposed an ESM mocking issue (`Cannot redefine property: createServer`); switching to the
supported module mock corrected the test setup. All three final focused tests and all 184 desktop unit tests (27 files), desktop typecheck
and scoped ESLint pass. The original connected case passed first attempt (1/1, 6.2 seconds).
Provider-HTTP approve/reject journeys passed first attempt (2/2, 10.7 seconds); a second focused
run with JSON reporter (2/2, 10.8 seconds) retained four body-only diagnostic exports unavailable
from the initial list reporter. All four report durable, verified, untruncated coverage with zero
dropped/conflicting/pruned/pending events, and ready storage. Waiting and completed/denied states
match durable effects. The network-block audit is denied, has no approval request or VM invocation,
and the file remains unchanged. These are real UI/API/SQLite journeys with deterministic model and
VM-adapter fixtures, not actual VM isolation proof. No new diagnostic finding was observed.
The independent review receipt is `port-repair-independent-review.json` in the evidence directory.
Hosted qualification remains pending.
Local IDE Problems / Sonar MCP are unavailable; terminal checks and exact-head hosted Sonar/CodeQL
are the applicable quality evidence. No quality suppression or rule change is authorized.

Completion requires passing the focused tests and connected journey, independent review, full
branch-specific documentation mirrors/readbacks, normal commit/push hooks, exact-head feature
checks and review clearance, and verified guarded task-to-feature merge. Then close/read back and
sync this repair task. Parent promotion remains in progress until its own staging and preservation
gates pass. Broader cleanup and Git delivery planning remain separate.
