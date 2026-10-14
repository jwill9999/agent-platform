# Own desktop startup and shutdown through confirmed child exit

## Summary and authority

Beads: `agent-platform-desktop-startup-lifecycle`. Prerequisite repair for owner-authorized
`agent-platform-local-mvp-promotion`; destination `feature/local-mvp-handoff`, then protected PR321.
The owner authorized routine gate repairs and conditional staging merges, preserving PR283 and
paused work. Independent promotion critic approved this bounded repair before implementation.

## Incident and evidence boundary

PR321 source `749dba13` (execution `727baa30`) failed the packaged permission-policy direct-write
Block journey before model setup. Both attempts of that case recorded 22 API probes ending in ECONNREFUSED
while Electron was alive; the retry also raised ENOTEMPTY during fixture removal. No provider
request, policy assertion or VM start occurred in those failed attempts. The successful VM teardown
receipt therefore does not establish managed API child release. The complete original suite ended
with 11 passes, five failures and three flaky results; other cases also show first-window
timeouts and unverified teardown. All 19 cases require fresh qualification.

Source inspection found pending backend ownership published only after readiness, asynchronous
quit cleanup not awaited, and child-stop code treating a sent signal as proof of exit. These are
concrete lifecycle gaps. Asset copying before API spawn and observed host resource pressure may
contribute to startup delay, but neither is established as the original timeout's cause. Preserve
that uncertainty; do not label this repair a demonstrated fix for every startup failure.

Evidence: `/Users/letuscode/.codex/local-mvp-promotion-20261014/vm-diagnosis` and `critic-pr321`.

## Requirements and bounded implementation

- LIFE-R1: Own pending startup before asynchronous initialization. Mark quitting synchronously,
  prevent premature quit, and cancel/join startup once. Guard backend/renderer/window publication
  and all late continuations after cancellation.
- LIFE-R2: Stop owned API and standalone-renderer children idempotently. A killed flag or SIGKILL
  request is not completion: confirm terminal child close and log-stream completion. Bound failure
  and preserve evidence when release cannot be verified. Handle spawn errors, signal exits and
  races without stopping unrelated processes.
- LIFE-R3: Retain the current 15-second backend and 20-second fixture readiness deadlines and
  existing two-second graceful termination period. No policy changes, generic retries, scan waiver,
  asset-copy optimization or broad architecture changes. Forced termination confirmation is a
  separate bounded cleanup step, not extra readiness time.
- LIFE-R4: Record bounded fixed startup phases and elapsed milliseconds only. No paths, credentials,
  log lines, provider data or arbitrary error messages enter diagnostic attachments. A fixture may
  delete its owned root only after application shutdown confirmation; report secondary cleanup
  errors without replacing primary failure evidence.

## Verification and Gherkin E2E strategy

Deterministic controls cover cancellation before asynchronous secret initialization completes,
during readiness, concurrent with ready success and during renderer startup; no late publication.
Cover normal shutdown, spawn error/no PID, early signal exit, ignored SIGTERM/delayed close after
SIGKILL, unconfirmed exit, repeated stop/quit and log-stream error/completion. Test phase parsing,
bounds, unknown/malicious payload rejection and shutdown confirmation independently.

```gherkin
Feature: Managed desktop lifecycle preserves owned process boundaries
  Scenario: Normal Project policy journey and shutdown
    Given an isolated packaged desktop with its managed API and deterministic provider
    When the user performs the existing direct-write Block journey
    Then the UI reports denial and the persisted file is unchanged
    And closing the app confirms owned child shutdown before fixture deletion

  Scenario: Quit while managed startup is pending
    Given managed desktop startup is held before readiness
    When the user closes the app
    Then pending startup is cancelled and joined
    And no late renderer or window is published
    And owned children terminate before the app exits

  Scenario: Unverified cleanup
    Given an owned child cannot be confirmed stopped within its cleanup bound
    When shutdown is requested
    Then shutdown reports failure and preserves the fixture evidence
```

Use native Electron for lifecycle acceptance; unit controls alone do not establish desktop behavior.
Run the focused previously failing packaged journey with actual signed packaged assets and the
unchanged policy/backend/file assertions. Fresh final-head hosted browser/Electron and the complete
19-test packaged VM suite must pass without unexplained retries. Require genuine full security
analysis, Sonar/CodeQL, independent source/evidence review and all live protection gates.

Existing diagnostics from exercised success/denial journeys must explain correlation, durable state,
coverage and loss honestly. Deterministic model fixtures do not prove live-provider behavior.
No paid calls or user data are required. Do not change unrelated test assertions or timeouts.

## Definition of done

Exact-source local controls and connected evidence pass; source and result review has no actionable
findings; changed documentation is fully mirrored/read back; repair task PR is green and merged into
its feature; PR321 actual full scan/VM/checks/comments qualify and its staging tree is verified;
Beads is closed/read back and synced. Final d185 integration and recovery-protected cleanup remain
owned by the parent promotion task. Implementation and local verification are complete; all new hosted qualification and staging
delivery are still pending.

## Initial implementation verification

The reviewed repair owns pending bootstrap and renderer operations, aborts synchronously on first
quit, joins pending work, reclaims late handles, and requires child close and log-stream completion.
The original two-second graceful stop now has a separate two-second forced-exit confirmation bound;
unverified termination retains evidence and does not emit successful shutdown. Safe phase parsing
allows only fixed phases and finite nonnegative elapsed milliseconds, with bounded capture and
fail-closed shutdown confirmation when capture is truncated. No raw logs enter attachments.

Initial checks: 174 desktop unit tests pass, including actual child failure/abort controls, mocked
Electron event wiring, delayed-close/log controls and malicious phase payloads. Production API,
renderer and desktop builds pass. Focused source lint and type checks pass. Independent source
review found no actionable defect. All 19 signed-runtime packaged journeys then passed on their first attempts: zero failures, skips
or retries, 505.417 seconds. The separate previously failing direct-write Block case also passed
with persisted denial, unchanged file, confirmed child shutdown and released VM fixture. The main
success journey reports an actual ready VM, signed helper and no displayed host path or secret.
All package/helper/asset hashes were independently recomputed against the retained manifest; native
helper source is unchanged since qualified adoption `3ab2f53d`.

Local runs used base `749dba13` plus the uncommitted source hashes in `lifecycle-tested-source.json`,
not the unmodified base: future hosted qualification must use the pushed repair revision. Result
receipts are `lifecycle-vm-results.json`, `lifecycle-runtime-source-verification.json`,
`lifecycle-focused.log`, `lifecycle-unit-all.log` and `critic-pr321` under the evidence directory.
Independent final source, full-suite evidence and diagnostic review approved the repair with no
actionable findings. All 19 cases confirmed shutdown and Electron exit zero; all 18 applicable VM
teardown receipts confirmed release (the unhealthy fixture does not start a VM). Ten actual safe
reports retain waiting/resume/approve/reject correlation and are durable/verified with zero pending,
dropped, conflicting or pruned events and no truncation. No raw paths, keys or prompt fields were
observed. Existing lineage limitations remain tracked by `agent-platform-9wqs`; this repair does not
claim to resolve that follow-up. Deterministic providers do not qualify live-model behavior.

The final independent receipt is `critic-pr321/lifecycle-final-local-qualification.json`. Full
publication/readback and eventual delivery receipts are recorded in Beads and the evidence directory.
Fresh hosted qualification and staging delivery remain pending; no staging qualification is claimed.

## Hosted quality repair

PR322 at `f9934ee6` reported six actionable Sonar findings: phase-parser complexity and key sorting,
two readiness-loop awaits, an unnecessary Set conversion and a truthiness-only array search.
The bounded correction extracts strict phase parsing, checks exact own fields without sorting,
uses sequential asynchronous readiness attempts with the original captured deadline, passes the
pending Set directly and uses a boolean log-error search. Probe calls never overlap; cancellation,
child-exit checks, cleanup bounds and original readiness predicates remain unchanged. No finding
was suppressed and no quality rule, test timeout or security policy was weakened.

Affected verification and fresh hosted qualification are recorded separately from the original
19-case local pass. The original failed Sonar result remains retained; it cannot qualify delivery.
The correction passes 55 focused tests, desktop build/typecheck/lint and two connected Electron journeys
using the signed runtime (real-VM approved shell command and pre-execution direct-write Block),
both on their first attempt without skips in
52.741 seconds. Independent review approved all eight changed source/test files. The new controls
verify sequential probes, deadline expiry, cancellation and actual renderer listener release.
Evidence: `lifecycle-sonar-unit.log`, `lifecycle-sonar-vm-results.json` and `lifecycle-sonar-vm.log`.
