# Diagnostics MVP — implementation results

Status: PR302 and PR304 delivered to the feature under owner authorization; staging PR303 is blocked by the confirmed runner disk exhaustion and fixture teardown defect below. Earlier pending statements are dated historical snapshots.
Task: [agent-platform-harness-v1](../tasks/agent-platform-harness-v1.md).
Contract: [approved MVP](../planning/agent-observability-mvp.md).
Verification: [T01–T12](../testing/agent-observability-mvp.md).

## Scope and source

The owner accepted P1 option A and authorized implementation. The MVP includes the local SQLite
adapter, safe correlated metadata, bounded retention, readable/JSON reports, a diagnostic command,
and explicit browser/standalone-Electron export. Checkout-free distributable verification belongs
to [the release child](../tasks/agent-platform-electron-release.diagnostics-export.md), which has
real release parentage and depends on V1. The paused orchestration work remains separate.

Implementation is on `task/diagnostic-event-foundation`, based on the reviewed planning tip
`ebf3c279b80e7a3c29db40fc564fe93de9b7f135`, for a tip PR into `feature/agent-observability`.
This result report accompanies the implementation source. The segment PR and branch-specific
Notion metadata bind the pushed revision; hosted checks and mirror receipts must be read at that
actual revision before delivery. No merge or owner acceptance is inferred from local results.

## Actual checks to date

| Area                         | Actual evidence                                                                                                                           | Boundary                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Contract and report privacy  | 16 contract tests passed                                                                                                                  | Strict metadata, scope/order and safe prose reconstruction; not a live-provider test                                              |
| SQLite adapter               | 15 real DB/conformance tests passed                                                                                                       | Restart, sequence, retained-event dedup/conflicts, scoped cursors, idle expiry, bounded queue and real writer-lock behavior       |
| Physical storage             | Two actual file tests passed                                                                                                              | Current macOS/APFS hit 64 MiB SQLITE_FULL and recovered a real hot rollback journal; combined DB/journal stayed within 130 MiB    |
| Shutdown deadline            | One stalled-worker boundary test passed; real held-writer close covered separately                                                        | Stalled worker is a disclosed test double; deadline and loss accounting checked                                                   |
| Existing plugin              | 14 tests passed                                                                                                                           | Raw arguments and free-form errors no longer reach its logger sink                                                                |
| Diagnostic command           | Six real local HTTP tests passed                                                                                                          | Capability, redirect denial, size limit, safe errors, scope, regenerated prose and JSON                                           |
| API integration              | 13 diagnostic integration tests plus the focused pagination repair and 57 prior focused/regression tests passed                           | Real SQLite and actual host-tool effect tests; deterministic provider fixtures                                                    |
| Support exercise             | Independent reviewer identified failed read operation and correlated request/run from the report alone                                    | Actual API process restart verified against the fixture; report does not reveal the resource path or prove live-provider behavior |
| Browser/desktop              | Four connected browser/Electron journeys passed in 32.7 seconds; 47 desktop and 13 web focused tests passed                               | Real UI, BFF, API, SQLite, generated preload and native save path; native picker destination supplied by test fixture             |
| Full repository/hosted gates | Local build/typecheck/lint/format/cycles/docs passed; aggregate 2,734 tests passed with 77 existing optional skips; hosted checks pending | No inherited pass from planning or previous staging consolidation                                                                 |

## Connected evidence and interruption boundaries

The four connected journeys use actual Electron main/generated preload, standalone Next BFF,
API, real SQLite, a separate Chromium browser and deterministic model fixtures. The export case
uses the existing final-text node fixture; the three approval/retry cases use the real local
HTTP-provider path.
They inspect actual saved/downloaded JSON, cancel/no file, denied writes, hostile Origin and IPC
payloads, a real API-child stop followed by a safe partial export, and a full application restart
that retains acknowledged event IDs. The native picker destination/cancel choice is supplied by
the existing test hook; report generation, transport and file writes are real.

Approval and denial journeys reload the view. Their fixed-command runner double performs a real
harmless fixture write: concurrent duplicate approval requests produce one effect; denial produces
none. This checks the existing approval path, not VM isolation. Separate API tests execute the
actual host command and confirm the capability is absent. A real single HTTP 503 is recovered inside the
provider SDK, and the exported outer model outcome stays truthful. Three repeated 503 responses
exhaust the SDK and surface a terminal failure rather than a harness retry because its RetryError
is opaque to the existing classifier. That retained observation is a coverage limitation, not a
reason to change execution retry policy for diagnostics.

Additional API tests disconnect an actual TCP socket while a deterministic tool executor is held,
and restart an actual API process while an approval is pending. They assert disconnected/unknown
history and no automatic replay. The disconnect executor is a fixture; the restart case is not a
claim to have killed a running subprocess. Actual approved/denied command effects are tested in
the separate connected approval cases. Waiting observations no longer carry a false tool-error code.

The API retry test additionally drives the unchanged built harness `llmReason` / `withRetry` /
registered plugin callback using a deterministic failure at the SDK boundary. Three attempts yield
one operation with `started`, `retrying`, `retrying`, `failed` observations and attempt numbers
`[1, 1, 2, 3]`. This proves harness-visible retry wiring without claiming SDK-internal visibility.
Initial incorrectly targeted SDK mocks instead produced authentication failures using an invalid
fixture key; those failed attempts are retained separately from the final offline verification.

## Performance evidence

`apps/api/test/diagnostics.performance.test.ts` uses one real loopback HTTP server per mode,
a deterministic model, real application/diagnostic databases and a captured console sink. Each
of three repetitions executes 100 measured requests plus 10 warm-ups with diagnostics disabled,
healthy, or held behind a real SQLite writer lock: 900 measured requests and 90 warm-ups total.
Fresh sessions keep each measured workload the same. It checks actual retained SQLite row counts,
acknowledgements, initial/final health, provider call counts, queue bounds and explicit losses.

The reviewed successful local run retained 660 observations in every healthy repetition with zero
loss. Pending work stayed at or below 256. Maximum enqueue p95 was 0.0082 ms; maximum healthy
request-p95 increase was 0.985 ms. Event-loop-delay samples are retained with every mode.
These meet the local 2 ms enqueue and 20 ms additional request-p95 budgets. They are not a
production load test or a live model/provider performance claim.

Earlier attempts are retained: the initial fixture's dependency resolution needed correction;
inherited external tracing attempted calls that returned HTTP 403, so fixture tracing flags are
now explicitly disabled; a repeated per-request temporary-server fixture timed out or closed a
socket. The corrected benchmark uses a persistent loopback server and bounded request timeouts.
No runtime protection or application timeout was relaxed to make the measurement pass.

## Independent findings and dispositions

Reviewer `visibility_delivery_review` inspected source and evidence. Review assignments are
procedural and do not imply technical isolation of inherited tools.

| Finding       | Correction and recheck                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OBS-AMEND-01  | Explicit release parent-child relation added and read back, preserving its V1 prerequisite                                                                        |
| OBS-CODE-01   | Main export and diagnostic API validation return fixed safe errors; malformed/schema canaries tested                                                              |
| OBS-CODE-02   | Main/API capabilities kept out of general process/task environments; intended API/BFF forwarding remains private; real child-command absence tested               |
| OBS-CODE-03   | Read-path retention enforced transactionally; idle expiry without append/restart/manual prune tested                                                              |
| OBS-CODE-04   | Resume observation occurs after the existing successful claim; original approval/run metadata links the wait and resume; duplicate claims do not invent execution |
| OBS-VERIFY-01 | Benchmark now proves active healthy persistence, nonzero samples and loss behavior; three repetitions and event-loop measurements recorded                        |

OBS-CODE-05 added a generated `x-diagnostics-next-cursor` response header to the existing protected
report route. The real 1,005-event test verifies pages of 1,000 + 5, stable snapshot despite a later
write, cross-scope rejection, and no continuation on terminal/error responses. The shared safe
report body and bounded manual export remain unchanged.

The independent reviewer approved the complete production source, eight-document handoff and
connected evidence against the frozen 66-file source snapshot. The final API fixture isolation
repair also passed its bounded independent recheck; hosted qualification remains separate.

The final source review also reconciled the retention configuration wording: both developer API
and desktop use startup environment settings in this MVP. A config-file loader/settings UI remains
later work; no extra configuration subsystem was added.

## Honest limits

- Idempotence/conflict detection covers retained events only. Pruning removes identity records;
  the same event ID can later receive a new sequence. This is not execution deduplication.
- Harness-visible retries are recorded; internal retries hidden inside a provider SDK are not
  claimed as independently observed attempts.
- Console output is captured in performance fixtures. Physical size/recovery measurements cover
  the local macOS/APFS environment; hosted cross-platform checks remain separate.
- Existing Docker split-network deployment does not satisfy the new private loopback export
  topology. Diagnostics is disabled there without blocking ordinary chat.
- Reports disclose missing, dropped, pruned, pending and unfinished prior-process observations.
  A disconnect does not establish execution failure; overlapping timings must not be summed.
- No dashboard, account, automatic submission, remote storage adapter, paid model experiment,
  release artifact qualification, main promotion or paused orchestration resumption is included.

## Repository regression and quality gate

The full workspace run passed 2,512 tests outside the API and reported 77 existing optional
workflow-control integration skips. Its API run passed 221 and failed one new retry test because
the existing shared `isolate: false` worker had cached an earlier SDK module graph. The bounded
fixture correction resets modules and dynamically imports the app for that test; runtime code,
retry behavior, suite configuration and assertions are unchanged. The complete API rerun passed
all 222 tests across 30 files in 33.87 seconds. Together these establish 2,734 passing tests;
the original failed run is retained, not relabeled as successful.

Full build, typecheck, lint, formatting, cycle check and repository documentation checks passed.
All eight changed documents also passed direct Markdown checks and 100 explicit relative-link
checks. The first docs command encountered generated Playwright failure reports; those artifacts
were preserved outside the source tree and the unchanged documentation command passed. No source
lint exclusions were added. The six CLI boundary tests passed after the contracts build.
IDE Problems/Sonar MCP is unavailable locally; these terminal checks provide the local fallback.
Detailed hosted Sonar/CodeQL and current-head review findings must still be inspected on the PR.

## Hosted quality repair at first implementation revision

PR302 at `77d0ce8e796b45f7388aa6e2a750a3d544a84966` triggered actual hosted Sonar analysis.
Its gate failed with 37 findings, including six Critical complexity reports and a CI security
rating failure on the browser-install command. Local lint had not reported these. The source
repair separates projection/transport/worker helpers, removes nested formatting expressions and
redundant imports/assignments, and preserves runtime decisions and test assertions. No scanner
rule, severity, exclusion or finding dismissal was changed.

The Chromium setup step now invokes the already lockfile-installed `playwright/cli.js` directly
with the same arguments. The installed pnpm wrapper resolves that same file (version 1.59.1);
this is browser/dependency setup rather than a package installation. It neither enables package
lifecycle hooks nor adds an unsupported installer flag to disguise the warning.

Two source-supported minor warnings retain intentional behavior: the exact IPv4-mapped loopback
literal checks the actual socket peer, and sequential stream-reader awaits account for each chunk
before reading another or cancelling oversize input. Parallel prefetch would weaken the byte bound.
These are documented dispositions, not remote dismissals or scanner suppressions.

Core repairs passed 34 affected tests and 120 baseline-versus-refactor report comparisons produced
identical output. UI repairs passed 40 web tests, 21 desktop tests and all four fresh connected
journeys in 33.5 seconds after rebuilding web/API/desktop. Independent review verified all eight
UI source hashes and 23 evidence artifacts. Six CLI boundary tests also passed.

The first affected API run passed 221 tests with one existing `/init` test exceeding its unchanged
five-second timeout during concurrent builds. That exact case passed unchanged in 1.93 seconds;
the original failure remains evidence. The uncontended full API rerun passed all 222 tests across
30 files in 32.19 seconds, with no source, assertion or timeout changes.
Fresh exact-head hosted analysis remains required. Sourcery skipped the initial hosted review;
independent source review supplies the recorded critique, not a claim that Sourcery ran.

The next hosted analysis at `035ac26e881e90c440d45e1e6b5bf24c71252acc` passed the Sonar
quality gate: all three ratings were 1, duplication was 0.0%, hotspots were 100% reviewed, and
no Critical findings remained. One startup-style Major and one redundant-type Minor remained;
a final bounded repair uses a detached promise continuation and simplifies an `unknown` union.
Startup still proceeds independently of diagnostics, and export validation is unchanged. The two
intentional minor warnings above remain disclosed. This earlier hosted pass is not a substitute
for the final repair revision's own analysis.

The final code repair at `7e5ba9d62911414db78cbc4e9dc74de8ebe22941` also passed actual hosted
Sonar analysis: gate OK, no Blocker/Critical/Major findings, and only the two reviewed Minor
warnings remain. Independent review verified the exact source, live check and issue list. Five
compiled-module startup scenarios and two actual API restart tests passed; the export type-only
change passed eight focused tests. Normal push hooks passed all 222 API and 133 desktop tests.
Later documentation clarification changes no executable source; its own hosted checks still apply.

## Hosted performance measurement follow-up

Final handoff revision `1e10a2d0fef657dfd256134ee96d350f2efdb403` passed hosted browser and
Electron journeys, but CI run `38183711144` failed the API benchmark: one request p95 difference
was 25.464694 ms against the unchanged 20 ms limit. The other 221 API tests passed. The initial
benchmark did not retain mode/repetition measurements in hosted CI, so this is a real failed
acceptance observation with insufficient evidence to attribute its cause. Earlier successful
runs do not erase it.

Source review identified the console spy's retained call history as an unnecessary measurement
confounder, not proof of the failure's cause. The bounded fixture repair keeps real production
logger execution while replacing its test output sink with a restoring no-op, and records numeric
measurements before assertions and on failure. A predetermined balanced mode order reduces fixed
order bias across the three repetitions; every comparison is still enforced, without discarding
samples or selecting a best run. CI retains the numeric artifact even when the
job fails. Workloads, healthy persistence/locked writer checks, three repetitions, 100 measured
requests per mode, the 2 ms enqueue bound and 20 ms request-overhead bound remain unchanged.
No runtime behavior, timeout, threshold, retry allowance or test selection is relaxed.

The one planned focused invocation passed all 990 real requests: the largest healthy/locked
request p95 overhead was 0.449458 ms, and the largest enqueue p95 was 0.008459 ms. API lint,
typecheck and formatting passed. Two separate intentional failure controls confirmed that a
mid-request assertion preserves partial numeric evidence and that an artifact-write failure still
restores console/environment state and removes the temporary database. These local results do not
qualify the new hosted revision or establish the earlier failure's cause.

## Final implementation qualification and delivery authorization — 13 October 2026

Exact implementation head `f9450bd2fd15d0a8f135450a2ac57fc6b08f1e78` completed all nine executed
feature checks. [CI run 38184603689](https://github.com/jwill9999/agent-platform/actions/runs/38184603689)
passed 2,745 package tests (77 existing optional workflow-control tests skipped), 22 browser journeys
and 29 Electron journeys. Current Sonar passed with zero Blocker/Critical/Major findings and the two
reviewed Minor dispositions above. The refreshed PR302 snapshot had no open CodeQL alerts or
unresolved review threads. Sourcery skipped its 150,000-character diff limit; it is not a passed review.
Independent source and evidence reviews found no actionable findings.

Hosted benchmark artifact `11719062938`, run attempt 1, contains all 900 measured requests plus
90 warm-ups. Independent review verified the live run/head/job association, ZIP digest
`7de4cb46624de40edc86d729fdfdabdabdf166a21a2c7c086f35e85a62dd6129`, its complete JSON member and
all recomputed p95 values. Healthy modes retained 660 events each with no drops; held-writer modes
reported bounded losses. Maximum request overhead was 15.176855 ms against 20 ms, and maximum
enqueue p95 was 0.0128 ms against 2 ms. Every comparison passed; no sample was discarded and no
limit was raised. The original failure remains real and its specific cause remains unknown.

The owner now authorizes PR302 feature integration, protected staging promotion after genuine
current-head gates/reviews, and recovery-protected cleanup of delivered diagnostics branches.
This documentation-only handoff amendment requires its own current-head feature qualification.
The staging promotion additionally requires ordinary completed security analysis, actual packaged
macOS VM success and all live protections/reviews. Feature-targeted VM skips do not satisfy that gate.
Actual promotion/cleanup and final Beads closure remain pending at this dated snapshot; retain their
resulting SHAs/check evidence in canonical Beads. Release-child and paused-work boundaries remain
unchanged. No main promotion is included.

## Earlier qualification snapshot (superseded above)

Connected T06/T07/T12 and local quality/regression checks passed. The implementation and quality
repairs were committed and pushed with normal hooks, and all eight substantive document mirrors
were read back in full at their recorded source revisions. Qualify the measurement repair
with its current-head feature CI/reviews, retained numeric benchmark artifact and refreshed changed mirrors, then record
actual completion evidence in Beads. Merge and final owner acceptance retain their actual
authorization boundaries.

## Protected staging attempt and startup evidence repair — 13 October 2026

PR302 merged into `feature/agent-observability` at
`f0f4edd32b88693d39d803dea175c2750f738db5` after all nine executed checks passed on
`e79f9c3179f9c806dd9f7879d9b0b0ccc0395a28`, with no unresolved review findings. Its tree
`80e092cead216ca4e851190200a7991ef830e22f` matched the independently reviewed source and staging
rehearsal. The owner explicitly authorized this merge and conditional staging delivery.

Protected PR303's first CI run `38320874174` passed build, browser, desktop and Docker jobs.
The ordinary full Promptfoo run `38320874093` completed real analysis (three batches, no reported
LLM vulnerabilities), verified against its source-bound proof and downloaded SARIF. CodeQL and
Sonar also passed. The staging benchmark passed all nine modes within the original limits,
with maximum request-p95 overhead 1.952530 ms and enqueue p95 0.020160 ms.

The mandatory packaged macOS VM job `115048391318` failed one of nineteen scenarios: the
network-block policy journey failed its backend readiness poll before model configuration,
both initially and on its configured retry. Eighteen scenarios passed. Healthy VM evidence
confirms signed packaging, a ready VM and no host-path/secret exposure for that subcase; it does
not qualify a failed suite. No staging merge or delivered-branch deletion followed this failure.

The old polling code discards HTTP status and transport errors, while cleanup removes startup
logs before they are preserved. No provider request, approval or tool effect occurred in the
failed scenario. Source inspection confirms a nonready command runner alone produces degraded
HTTP 200, not the failed readiness predicate. The historical failure's root cause is unproven.
Independent critique approved a bounded, fixture-only startup evidence repair and a focused
reproduction, retaining the existing 20-second poll and all policy assertions. Raw health errors,
log messages, environment values and paths must not be exported. Runtime behavior and security
policy remain unchanged; new exact-head qualification is required before delivery.

The process observation refers to Electron, not its API child. Stderr inspection begins after
`electron.launch` resolves and records only a fixed allowlist of error codes from a bounded prefix;
earlier output or a launch failure can remain unavailable. A successful reproduction would not
retroactively establish the original failure's cause. Review also identified that attachment failure
must not skip provider/VM/temporary-directory cleanup; that failure path is part of the repair checks.

The repaired fixture passed nine focused tests covering actual refused/503 responses, an exited
child, bounded/nonterminating response bodies, secret canaries, stderr bounds and cleanup on
attachment failure. An additional external Playwright control copied the actual hook/close helper
and intentionally failed both the test and attachment: all five cleanup markers were reached, the original
failure remained first, and the attachment failure surfaced after cleanup. Independent re-review
closed OBS-VM-01. Desktop typecheck and backend/renderer/desktop builds passed; scoped lint,
formatting and Markdown checks passed. These are fixture/quality results, not staging qualification.

One focused packaged network-block reproduction then passed in 32.4 seconds, with retries disabled,
using the existing signed packaged VM resources and deterministic HTTP model provider. Its saved
policy evaluation verifies the blocked policy and persisted backend effects. This did not reproduce
the original startup failure; its cause remains unknown. The fixture change repairs the evidence
blind spot, not a demonstrated application defect. New task-to-feature and full staging checks
remain required; none of the old-head passes qualifies the revised head.

PR304's first hosted Sonar gate was OK but its issue list identified one Major S3358 nested
conditional in the startup helper. The follow-up extracts equivalent branching without suppression
or runtime changes. All nine affected tests, lint and formatting passed. Independent equivalence
review and new hosted qualification remain separate from the earlier successful packaged case.

## Second staging attempt: disk exhaustion and VM teardown — 13 October

Feature repair PR304 merged at `0081843130674d207a74ae025efe0af99a0c2585` after ten
executed checks passed on `40388cfd4abe12bf0a7d78294db3a02c17007c4e`, approved review and
zero unresolved threads. Its tree exactly equals the reviewed source. Fresh PR303 CI
`38324590084` passed every executed gate except the packaged macOS suite, which again passed
eighteen scenarios and failed the network-block case. The first attempt now directly reports
`ENOSPC` while creating its result directory and failure to attach startup evidence; the retry
failed backend readiness before model setup. The runner had 621 MiB available during upload
and about 37 GiB after job cleanup. This proves disk exhaustion for this attempt; it does not
retroactively establish the cause of the earlier `f0f4edd3` failure.

Source review found **OBS-VM-02**: fixture shutdown allows 20 seconds for a native helper that
itself waits 20 seconds before escalating to forced termination. The fixture can interrupt that
escalation, ignores the stop failure, and unlinks its runtime image while a VM still holds it.
The hosted log records eight orphaned `macos-vm-runner` processes terminated at job end.
Read-only local inspection also found a retained focused-test VM holding an unlinked 4 GiB image.
The source defect and retained handles support the teardown repair; exact historical per-process
allocation during the failed run was not measured.

The independently approved bounded repair is fixture-only: allow native stop escalation to
finish, verify the captured daemon has exited and no process holds the exact image before
removing temporary files, retain the root and fail visibly when verification is inconclusive,
and release provider/timer resources independently. Readiness, policy assertions and overall test
timeouts stay unchanged. Negative cleanup controls and three sequential real VM lifecycles passed as recorded below.

Fresh ordinary Promptfoo analysis `38324590109`, attempt 1, completed three batches with no
reported vulnerabilities on `00818431`. The independent reviewer verified the live run/job,
ZIP digest, both artifact members, receipt/SARIF bindings and raw completed provider response.
CLI 0.124.1 and the disclosed built-in blob/patch omissions remain unchanged. Sonar passed with
the two prior Minor dispositions; there were no open scoped CodeQL alerts or unresolved review
threads. Those passes do not waive the failed VM suite or qualify a future changed head.

The new hosted benchmark also passed all nine modes and the original bounds: maximum measured
request-p95 increase 3.040543 ms against 20 ms, maximum enqueue p95 0.023657 ms against 2 ms,
and 660 retained observations with zero loss in each healthy repetition. Writer-lock losses
were reported explicitly. It uses deterministic providers, not production load.

### Teardown review and negative controls

Independent review **OBS-VM-03** found that an Electron/provider close rejection could skip
later cleanup. Every resource action is now attempted through an ordered cleanup collector;
trace/attachment failures cannot bypass closure, and a later successful VM result cannot erase
a prior cleanup failure. Fixed labels are reported after cleanup without replacing the original
test failure. Roots are retained whenever release cannot be verified.

The first corrected source passed twenty focused tests: eleven teardown controls and nine
startup-evidence controls. Failure-injection cleanup tests prove every callback is reached;
they are not themselves real VM teardown proof. A separate real stubborn-child test verifies
that a successful stop acknowledgement does not substitute for observed process exit.
The equivalent helper decomposition passed independent re-review and the same twenty tests;
desktop typecheck, scoped lint, formatting and diff checks passed.

### Actual sequential VM evidence

Three separate real packaged-VM network-block journeys passed without retries, skips or flaky
outcomes: Playwright durations were 43.505, 32.694 and 30.119 seconds within the unchanged
60-second test limit. Each run used the existing signed helper and pinned VM assets, actual
Electron/API/policy persistence and the deterministic external HTTP model fixture. Every saved
policy evaluation passed `network: block`; each teardown attachment reports `ok: true`,
`daemonExited: true` and `imageReleased: true`.

Post-run process/handle snapshots found no fixture daemon or deleted fixture-image holder.
Available disk space after the three runs was 46,101,192 / 46,132,528 / 46,130,532 KiB,
which did not show the previous per-run 4 GiB image retention. A prior focused-test orphan was
separately cleaned up only after exact PID, executable, runtime and deleted-image ownership were
verified; both its daemon and virtualization process were observed to exit. No unrelated process
was signalled and no retained checkout or evidence was removed.

The fixture now allows 25 seconds for the helper's existing 20-second graceful-stop/escalation
sequence, then uses a three-second polling window for daemon and exact-image release, with each
holder probe limited to one second. A final probe may finish after that window. This changes the
cleanup caller budget, not readiness, policy, native implementation or overall test limits.
The local sequential exercise verifies this cleanup behavior; it does not replace fresh exact-head
feature checks, ordinary full staging security analysis or the entire hosted macOS suite. The
original failed runs and their cause/coverage boundaries remain retained above.
