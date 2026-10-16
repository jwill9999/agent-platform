# Shared harness Stop implementation and qualification

**Date:** 16 October 2026. **Beads:** `agent-platform-harness-r3.cancel`, IN_PROGRESS.
**Status:** Working implementation; partial local qualification, not delivered or ready for owner stress testing.
**Source:** `task/project-chat-stop` into `feature/project-chat-stop`. Early local test provenance
was documentation ancestry `1b574dbc5fc9e0151d1ed8beac5a2ddc0f02c06e` with dirty implementation
source; that historical commit alone does not contain or identify the tested implementation.
The final reviewed file-hash receipt binds implementation bytes; Beads and publication metadata
record the immutable pushed revision and actual PR/mirror state without a self-referential commit
in this document. Product baseline is staging `cf5f04524c25c29635b0d84bda4e76282f28ddcb`.
**Local results checkpoint:** 16 October 2026, 00:56 UTC; qualification is still in progress at writing.
This checkpoint is not hosted qualification, merge or stress-test approval.
[Approved plan](../planning/project-chat-stop-mvp.md);
[acceptance contract](../testing/project-chat-stop-mvp.md).

## Authority and implemented scope

The owner approved Stop followed by durable monitoring, with Beads, independent critique and agreed
tests. Routine repairs are included. Merge/release, paid calls, new CLI/voice clients and automatic
remediation remain reserved. Only Stop's obsolete hard review-gate dependency was removed; its
broader parent and the global review gate remain deferred/open. PR283, paused orchestration refs
and unrelated dirty work are separate.

The application owns logical-run identity, durable admission attempts and a Stop fence in the main
SQLite database. Strict read/Stop APIs support headless callers; Project Chat is the first UI client.
Stop bypasses the execution mutex, stale targets cannot stop a newer run, and approval continuations
retain logical identity. Unfinished previous-process work remains interrupted/unknown without replay.
An actionable pending approval prevents conflicting starts until resumed or explicitly stopped;
expired display receipts do not silently release logical authority.

Provider, tool, sensor, quality-command and retry starts use the same fence after asynchronous
preparation. Supported signals are forwarded. AI SDK internal retries are disabled at the controlled
chat call; outer retry admission remains observable. A timed-out wrapper, returned command callback,
disconnected network request or uncertain Git receipt is not proof that its effect ended. Unknown
work fences further automatic dispatch and retains prior effects/receipts. Genuine pre-Stop failure
remains failure. Late original-promise settlement can refine uncertainty only with actual evidence.

The client discovers state before response headers and after reload, distinguishes stopping from
known cancellation/uncertainty, and preserves partial replies and completed approval history.
Selection changes alone are not Stop. Browser-origin checks protect the new mutation while trusted
headless clients use backend authority. Ask/Auto/Block, path, project, secrets, Git receipt and MCP
controls remain. Safe Stop/admission/settlement events extend V1 diagnostics; the separate periodic
resource monitoring task has **not started**.

## Actual local results

Counts below are separate runs/overlapping subsets, not an additive total. Source changed between
runs; earlier successes do not automatically qualify the final combined source.

| Layer                          | Actual evidence and result                                                                                                                                                                                                                                                      | Qualification boundary                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts and DB               | 11 contract cases; 15 focused real SQLite control cases passed, including migration, bounded write contention, retention/fences, restart identity and uncertainty reason preservation.                                                                                          | Focused local controls; final combined integration still required.                                                                                                                     |
| Application/API                | 30 service/HTTP cases passed; later service suite has 26 passed with six actual Git-tool/strict-receipt controls. Actual API tests cover preflight mutex, stale/cross-session targets, failed mandatory writes, pending/claimed approval and fresh-run isolation.               | Deterministic barriers and declared effect boundaries; not browser qualification.                                                                                                      |
| Real SDK and history           | 28 cases passed in provider-abort/service regression. All five resumed-history boundary cases passed after repairs, preserving real append effects and exactly-once history before Stop or hook failure.                                                                        | Actual local HTTP SDK, real SQLite and owned files, no paid model.                                                                                                                     |
| Process restart                | One process integration passed: owned compiled API child killed/restarted on the same DB; unfinished active/waiting identity retained, stopped approval still fenced, no provider replay, explicit fresh run works.                                                             | Real API process/SQLite/SDK with loopback provider. Does not prove recovery of arbitrary remote effects.                                                                               |
| Harness                        | Retained full regression 768 passed, then 76 affected boundary controls passed. Real descendants and server-applied network effects remain honestly uncertain.                                                                                                                  | Selected source snapshots; final combined review remains.                                                                                                                              |
| Web                            | Latest approval-readiness regression passed 397 tests across 55 files, following the earlier 395 navigation suite. Origin controls passed 27; session regression passed 39.                                                                                                     | Component/API/BFF controls, not Docker browser execution.                                                                                                                              |
| Diagnostics                    | Six real API/SQLite export cases passed; MCP/diagnostic regression passed 22. Checks include safe correlation, waiting, known Stop, uncertain late effects, timeout/disconnect/failure categories and coverage/privacy canaries.                                                | Safe V1 run reports; periodic resource/history monitoring remains absent.                                                                                                              |
| Build and quality              | Full workspace build, typecheck, lint and cycles completed successfully; scoped formatting passed.                                                                                                                                                                              | Captured before subsequent focused repairs. No hosted Sonar/CodeQL or exact committed-head gate yet.                                                                                   |
| API broad regression           | Earlier broad run retained 510 passed/3 failed (performance and Git deadlines). New current non-performance run retained 514 passed/6 failed (Git client-abort receipt and all five resumed-history cases).                                                                     | Broad suite is not reported green. Failures remain in the evidence.                                                                                                                    |
| Isolated diagnostics benchmark | Unchanged benchmark passed 900 measured requests, three rotated repetitions. Maximum relative p95 overhead 4.756792 ms (limit 20 ms); enqueue p95 0.024833 ms (limit 2 ms). Healthy captures retained 1,100 events each, zero drops; deliberately locked captures report drops. | No threshold normalization or proven CPU/GC/disk root cause; concurrent scheduling is a hypothesis.                                                                                    |
| Isolated Git regression        | All 22 real-bare-Git/inert-GitHub boundary tests passed with existing deadlines.                                                                                                                                                                                                | Does not erase broad-suite timeout failures or prove a connection-speed cause.                                                                                                         |
| Connected Electron             | Latest five-case run passed in 50.4 seconds: provider Stop, approval Stop, completed effect, genuine provider failure and sensor Stop. Earlier failures/traces remain retained.                                                                                                 | Independent review approved all five journeys and six safe exports; Final fresh full Electron 67 regression remains unqualified; mixed-source exploratory failures are retained below. |
| Docker browser                 | Final pinned-fixture Docker Stop suite passed 5/5 in 32.3 seconds, with independent artifact approval; earlier failed/incomplete attempts retained.                                                                                                                             | Acknowledgements 11.07–22.07 ms; SQLite/control/late effects/no replay/privacy independently inspected. Private Docker 403 proves denial only; native exports are separate.            |
| Packaged VM                    | Exploratory real-VM Stop passed with 88 ms acknowledgement; fresh signed real-VM Stop representative also passed 1/1 in 47.8 seconds, with honest unknown and late effects.                                                                                                     | That source snapshot passed 1/1 in 47.8 seconds, acknowledgement 8.180916 ms, with independent artifact approval. Final representative on subsequent repaired source remains required. |

The earlier independently inspected signed-VM Stop capture contains 43 durable verified events, ready coverage, zero
drops/pending/conflicts, no truncation and no privacy canaries. Its standalone safe report is
42,353 bytes, SHA-256 `7ce278daa704fed0382d4df56701880e9ba6be1b6d3c02995426598145c535dd`,
matching both attachment and receipt. Independent review verified all 350 ZIP members/CRC and 49
selected prelaunch source/runtime hashes against the bytes of that captured snapshot. This selected-file binding is not
a complete-tree or reproducible-build attestation. The earlier 88 ms exploratory capture remains
separate. The required actual-VM Stop representative is one case; the 20 helper cases belong to the
67-case Electron regression and must not be described as 20 real-VM executions.

## Scenario status against S01–S14

“Partial” means the cited backend/focused proof exists but required connected/final-source evidence
is still missing. It never means the acceptance scenario is complete.

| ID  | Actual proof available                                                                                                                      | Status and remaining gap                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | Headless identity/read/Stop, blocked preflight and committed acknowledgement independent of mutex.                                          | Partial; Docker Stop acknowledgement/status passed; current combined source qualification remains.                                                |
| S02 | Atomic admission barriers, no post-fence model/tool/retry; admitted work separately recorded.                                               | Partial; Docker Stop ledgers independently approved; final combined source qualification remains.                                                 |
| S03 | Actual SDK signal/settlement controls and exploratory actual guest Stop; MCP/native boundaries exercised locally.                           | Partial; required signed real-VM representative/artifact review passed; Docker passed; final current-source VM and combined qualification remain. |
| S04 | Real descendant/network late effects and strict Git unknown/executing/malformed receipts retain uncertainty and prevent next admission.     | Partial; Docker late-effect/no-replay ledgers approved; final fresh Electron/current-source VM remain.                                            |
| S05 | Pending resume refused without killing waiting authority; approve/claim/Stop races and legacy-unbound denial; same-ID continuation once.    | Partial; connected Stop approval/effect journeys and Git 49 passed; fresh full Electron/API qualification remains.                                |
| S06 | Controlled retry/backoff and asynchronous preparation gates; actual SDK abort reason preserved; genuine error remains distinct.             | Partial; representative connected Stop evidence passed; final combined source/results gate remains.                                               |
| S07 | Duplicate Stop, session mismatch, stale/completed target, new run and caller identity rejection.                                            | Partial; scoped controls passed; fresh full Electron stale-selection/next-run regression remains.                                                 |
| S08 | 397 web cases include session inventory/selection and approval-readiness repairs; reload discovery implemented.                             | Partial; Docker Stop selection/reload proof passed; adjacent browser and fresh full Electron remain.                                              |
| S09 | Actual compiled child restart on same DB passed; provider ledger unchanged until explicit new run; old approvals denied.                    | Partial; real process proof passed, required Electron regression/final snapshot pending.                                                          |
| S10 | Real SQLite writer contention fails boundedly without ack/abort; migration/retention and diagnostics-independent authority controls passed. | Focused proof passed; final combined integration and coverage review pending.                                                                     |
| S11 | Actual V1 exports distinguish Stop, timeout, disconnect, failure and uncertainty, preserve coverage/privacy.                                | Partial; six Electron exports and earlier native export independently approved; current-source full qualification remains.                        |
| S12 | Underlying API/approval effects, existing session/MCP/Git/context/reply controls exercised; broad failures disclosed.                       | Incomplete; final connected suites, broad failure disposition and combined quality/critic gates pending.                                          |
| S13 | Sensor/quality-command admission, bounded descendant fixture and no false passed status implemented; sensor fixture repaired.               | Partial; Electron and final pinned-fixture Docker sensor journeys passed independent inspection; final integration remains.                       |
| S14 | Real loopback SDK HTTP503/backoff/request-count controls retain explicit SDK retry0 and post-fence denial.                                  | Focused controls passed; final source/results review and diagnostic attempt reconciliation pending.                                               |

M01–M06 are not run: durable monitoring implementation has not started. Q01 is not run and remains
blocked by both actual Stop and monitoring deliveries. No readiness for owner stress testing or
production release follows this checkpoint.

## Retained failures and repairs

- **SDK abort identity:** The first Electron provider-stop journey exposed a genuine product error:
  the SDK surfaced an aborted stream as a provider failure. The narrow repair preserves the owned
  abort identity rather than matching arbitrary messages. Actual SDK regression proves known Stop
  and genuine HTTP500 remain distinct. Earlier approval fixture failures also confused execution IDs
  with logical IDs; tests now inspect their explicit binding.
- **Session inventory (S08):** Initial connected reload/new-session checks could not select the fresh
  server-created session because the local inventory was stale. The client refresh repair passed
  the 395-case web suite; final connected rerun remains a separate gate.
- **Completed approval prefix:** Stopping a following model turn could lose the earlier completed
  tool pair from persisted history. The fix persists that completed prefix before continuation,
  including the post-claim hook boundary and terminal halt path. First failing evidence and all
  five passing final API boundary cases are retained; no effect rollback is claimed.
- **Sensor fixture setup (S13):** The disposable project inherited package-manager version selection,
  causing package-manager setup instead of reaching its controlled sensor command. Its owned `.npmrc`
  disables version management and its explicit package-manager field pins pnpm 9.15.4 in the actual
  project cwd; this prevents the older Corepack fallback to an unpinned version. This is a
  fixture repair, not a product permission relaxation; sensor start/late-release assertions remain.
- **API performance/deadline failures:** Broad runs failed performance and Git deadlines under
  concurrent work. Isolated unchanged benchmark and Git22 controls pass. High event-loop delay with
  fast enqueue supports a scheduling-contention hypothesis, not an established cause or permission
  to mark the broad run passed. All original outcomes remain available.
- **Packaged VM artifact gap:** The exploratory test attached the safe report body only; the list
  reporter did not persist a standalone file, and fixture cleanup removed the original. The test
  now saves `stop-durable-diagnostics.json`, verifies its SHA-256/bytes, attaches its path and records
  prelaunch source/compiled-runtime hashes plus actual served web assets. Dirty HEAD is explicitly
  ancestry only. Type/lint/collection controls pass; a fresh actual signed real-VM run passed 1/1 in 47.8 seconds and independent review approved
  its persisted artifacts.
- Earlier route-validation and diagnostic-category regressions were repaired and reverified. An
  inherited tracing-exporter HTTP403 is retained; final deterministic controls explicitly disable
  tracing. No exporter success, paid provider or undisclosed external model is claimed.

The combined API attempt (`api-full-current-nonperformance.log`) retained 514 passes/six failures:
one actual Git client-abort receipt defect and five resumed-history fixture failures. The Git
pre-dispatch hook could leave an unexecuted owned receipt prepared; the source repair and actual
Stop/disconnect/post-claim negative controls passed the complete 49-case Git file in 33.79 seconds.
The five history failures reproduced alongside diagnostic tests because a cached module retained
a mock SDK closure. Fixture-only module reset and dynamic real-app import repaired the isolation;
the same combined 19 controls passed in 10.14 seconds with all effect/history assertions retained.
These subset passes do not erase the original full-suite failure or qualify a final combined run.

Final Docker Stop 5/5 passed in 32.3 seconds with five ZIP CRC/attachment-byte checks and independently
verified API/control rows, effect journals and privacy. The exact project cwd uses pnpm 9.15.4 through
the shared fixture's explicit package-manager pin; an older warm sensor test had used an unpinned
Corepack fallback and is not represented as this final gate. An adjacent context journey passed;
a reply journey hit the existing 100/min fixture rate limit and is paced against the actual reset
header for requalification, without changing product limiter policy. The full 67-case Electron
exploratory mixed-source run retained 33 passes, three failures, one interruption and 30 unrun cases;
its diagnostic 503 and approval-readiness findings require disposition/current-source rerun. Do not
infer a network or resource root cause from these outcomes alone.

## Environment and delivery gaps

Initial heavy work was held at 11–13 GiB host free space against the 20 GiB reserve. Owner cleanup
restored approximately 47 GiB; about 40 GiB remains at this checkpoint. Recheck before heavy runs.
Full host build, VM prerequisite/helper build/sign/package and exploratory guest execution passed.
Docker storage allowance is separate; unknown user data and global caches were not deleted.

The pending gates are nine remaining adjacent browser cases, final fresh current-source Electron 67
regression (including 20 controlled-helper cases), signed real-VM Stop representative, full API/normal
hook qualification and independent final combined source/results critique. The unchanged isolated
benchmark has passed; a new performance claim still needs its own recorded controlled source/run. Delivery requires normal commit/push/PR, full source-bound documentation mirrors/readbacks and
all exact-head hosted quality/security/review gates; use their actual receipts for current state. Local IDE Problems are
unavailable; record the supported fallback and actual hosted Sonar/CodeQL rather than inventing a
pass. Beads remains IN_PROGRESS. No merge authority is manufactured from local success.

The Docker Stop suite itself is qualified, but the later adjacent reply bootstrap hit HTTP429 and
then global Docker RPC/readiness calls stalled. Read-only pressure observations are retained in
`docker-pressure-observation.json`; high swap and slow probes are observations, not a proven singular
cause. Engine recovery/owner restart decision is pending. Preserve unknown data and all original
attempts; do not relax rate limits, add timeouts to pass, or claim the remaining browser cases ran.

Source implementation/review and the scoped passes support a normal commit/push and draft PR for
hosted qualification while this local environment blocker is addressed. A draft PR, mirror or green
subset does not waive the remaining local/connected tests, task DoD, exact-head hosted checks,
review findings or reserved actual merge grant. No all-green, delivered or stress-ready claim is made.

The latest preservation receipt covers 12 other checkouts, main/staging and paused refs. It
reconstructs the original primary dirty diff after exactly two authorized status-journal rows;
there is no claim that the current whole dirty diff hash is unchanged. See `preservation-final.json`.

Monitoring remains a separate authorized follow-up, with its own recording/retention/resource/privacy
and historical-only diagnosis gates. No monitoring sampler, recurring review automation or owner
stress trial is running. Paused orchestration, main and unrelated checkouts remain untouched.

## Evidence and publication handoff

Evidence root: `/Users/letuscode/.codex/project-chat-stop-implementation-20261016`. These are local
files; do not infer remote availability from their presence. Publication must bind an immutable pushed
implementation revision, every full source body/readback and the actual destination. Preserve
historical notes/pages. Beads/publication receipts establish whether that work has completed; an
early dirty-tree HEAD is not the final implementation identity.

Key retained logs/receipts:

- `run-control-uncertainty-service-tests-final.log`, `run-control-git-receipt-service-tests-final.log`,
  `run-control-uncertainty-db-tests-final.log` and `api-session-regression.log`.
- `provider-abort-before.log`, `provider-abort-after.log`, `provider-abort-runtime-regression.log`,
  `resume-persistence-before.log`, `resume-persistence-regression.log` and
  `resume-persistence-boundaries-initial.log` / `resume-persistence-boundaries-final.log`.
- `run-control-process-test.log` and `process-restart/run-control-process-restart.json` / child log.
- `api-diagnostics-regression.log`, `api-full-initial.log`, `api-full-repaired.log`,
  `api-full-current-nonperformance.log`, `git-predispatch-file-final49.log`,
  `resume-isolation-diagnosis-before.log` / `resume-isolation-diagnosis-after.log`,
  `browser-stop-final.log`, `browser-stop-pinned.log`, `browser-adjacent-context.log`,
  `browser-adjacent-reply.log`, `electron-full-final.log`, `docker-qualified-build-source.json`,
  `diagnostic-benchmark-isolated.log` / `.json` / `-assessment.json`, `git-remote-isolated-after.log`.
- `build-full-initial.log`, `typecheck-full.log`, `lint-full-initial.log`, `cycles-full.log`,
  `web-full-navigation-refresh.log`, `electron-stop-initial.log`, `electron-stop-repaired.log`,
  `electron-stop-third.log` and their owned artifact directories.
- `vm-stop-real-initial.log`, `vm-stop-real-qualified.log`, their retained evidence/artifacts,
  `vm-signature-report.json`,
  `packaged-stop-artifact-provenance-collection.log` and targeted typecheck log. Collection is 20
  cases. The required actual signed real-VM Stop representative is one case; the 20-case
  controlled-helper collection belongs to the separate full Electron regression, not 20 real-VM runs.

Runtime boundary logs under `/tmp/stop-runtime-*` and
`/tmp/stop-api-control-diagnostics-qualified.log` supplement these records. Before sign-off, retain
final source hashes, commands, terminal results, safe export/artifact hashes and independent critic
dispositions for the exact delivered revision. Do not replace a failed run with its green retry.
