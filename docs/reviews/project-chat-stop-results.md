# Shared harness Stop implementation and qualification

**Date:** 16 October 2026. **Beads:** `agent-platform-harness-r3.cancel`, IN_PROGRESS.

## Current local and hosted qualification — 16 October 2026

Application 4f4ecaf5 passed all nine executed feature checks; hosted desktop 67 and browser31 plus
one existing optional context skip, Git 5 and Stop 5 passed. Sonar is OK/zero open issues; no unresolved
review threads were present. Sourcery budget and feature VM skips do not supply review/staging proof.

Fresh Docker browser 16 passed first attempt with source/image/served-byte, actual SQLite/effect and
owned-cleanup review. Current local Electron qualification is65 retained passes plus two focused
requalifications,67 unique cases, not a new green full 67 batch. The original full 65/67 failure and
pre-child launcher-path failure remain preserved. Exact model-card scoping fixes badge ambiguity;
passive request timing fills an evidence gap without changing export behavior. Original MCP export503
is genuine and its cause remains unknown; later200 and focused200 at 13.164/7.030ms are not a runtime
fix. No pre-export readiness requests, retries, changed deadlines or relaxed assertions were added.
The two revised test hashes and base4f4 identify dirty test provenance; immutable publication/Beads
receipts must bind the later pushed source by byte equality after commit and push.

The actual signed-helper VM Stop representative passed once in 45.170seconds, acknowledgement 8.173ms.
Guest started/late effects remain honestly unknown with two unresolved attempts and one provider request. Its 43-event
safe report is durable/verified/ready/zero loss. Independent review checked 3 ZIPs and 681 members, signature,
entitlement and 49 selected source/runtime bindings. Development signing is not hardened; the 4 GiB
image was not freshly rehashed. Composite desktop review checked 409 artifacts and 113 ZIPs and 50 unique
reports: 49 ready local, one intentional disabled partial, plus three disclosed prior-process flags.
Raw synthetic traces/DB/provider artifacts are not shareable diagnostic reports.

The application 4f4 affected-package hooks passed 1,718 with unchanged benchmark. Hosted benchmark 900/990
passed independently: max relative p95 2.735 ms <= 20 ms, enqueue p95 0.0488 ms < 2 ms, healthy 1,540 events per mode and
zero loss. Prior local 42.482 ms and hosted 135.637 ms failures remain valid evidence without a proven
cause. Individual SQLite/S4822 false-positive dispositions have independent source-backed exact
comment/status readbacks; no rule/profile/exclusion/security or test-policy weakening occurred.

Evidence: `qualification-4f4ecaf5/browser-approved-proof.json`,
`electron-composite-approved-proof.json`, `vm-after-focused-independent-approval.json`,
`pr334-sonar-4f4-qualification.json` and `pr334-benchmark-4f4-independent-qualification.json` in the
existing local evidence root. Final current-head CI, full mirrors/readbacks, owner acceptance and
actual reserved merges remain delivery gates. Monitoring remains OPEN/unstarted; stress is not ready.
The dated checkpoints below retain their original statuses and failures as history.

## Current repair checkpoint — 16 October 2026, 04:43 UTC

Application repair 9867a61b is independently reviewed but not yet pushed. The normal hook passed
four package suites (desktop 187, web 417, DB 172 and harness 773) and failed API 527/528: locked-writer request p95 overhead 42.482 ms
exceeded 20 ms. Healthy capture retained 1540 events with zero loss, and locked enqueue p95 was 0.035 ms.
No cause is established. The original failed log is `pr334-normal-push-9867a61b.log`.

The subsequent fresh-process unchanged benchmark completed 900 measurements/990 fixture calls.
One instrumented full API run then passed 528/528 in 190.25 seconds. Raw per-request timings and
passive VM/process/disk observations are retained in `pr334-performance-full9867-measurements.json`
and `pr334-api-full9867-observation.json`. These results permit the reviewed one normal-push attempt;
they do not replace it, erase the first failure or prove a CPU/disk/GC/Docker cause. Existing 20 ms/
2 ms limits, healthy zero-loss assertion, workload and all deadlines remain unchanged.

Initial hosted cc9c4a20 verify, Docker and browser E2E passed. Electron 66/67 failed both attempts at
sensor entry. Digest-verified reports contain ready/durable/verified diagnostics with no losses;
the tool returned `QUALITY_GATE_DENIED: No fixed pnpm binary found`, no sensor was admitted and
no Stop operation began. The action installed pnpm 9.15.4 under `/home/runner/setup-pnpm`, outside
all three accepted fixed command paths. This is a confirmed CI provisioning gap, not evidence of
a slow connection or failed cancellation. `pr334-desktop-diagnosis.json` binds both actual receipts.

The independently reviewed workflow-only repair resolves the pinned action's actual pnpm package,
validates its version/location/executable, exposes its JS payload at `/usr/local/bin/pnpm` only if
absent or already identical, and checks 9.15.4 with current Node/fresh HOME before Electron tests.
Eleven synthetic controls pass, including relative-loader behavior and collision refusals. No
product command policy, sensor assertions, time limits or tests were weakened. Actual new-head
hosted desktop qualification remains required.

The specific SQLite issue `AaFC7_WxAKgrwE5N3nAL` was independently approved and individually marked
False Positive through the supported Sonar API. The exact source-backed comment and final status
were read back; migration SHA256 8f593894 remains unchanged. Oracle PL/SQL constant guidance does
not apply to SQLite CHECK/default/partial-index DDL. No rule/profile/exclusion or other issue was
changed. The pending statement in the older 04:27 checkpoint below is historical.

Fresh browser 16/Electron 67/actual-VM 1 qualification, normal push, current-head Sonar/security/reviews,
changed full document mirrors and actual delivery remain outstanding. Existing 904 results below do
not qualify repaired application bytes. Monitoring remains unstarted and owner stress is not ready.

## PR334 hosted quality repair — 16 October 2026, 04:27 UTC

The subsequent task-to-feature [PR334](https://github.com/jwill9999/agent-platform/pull/334)
opened at `cc9c4a204914e70f8af41716f88167f7a279e8d7`, tree
`d4b4814919aecf290905562dc95944ce5f0f1faa`. Its seven complete branch-specific Notion
mirrors passed all 27 body/metadata/destination readbacks, including the full session in twenty
ordered parts (`publication-cc9c4a20.json`). That publication does not establish hosted qualification.

Initial Sonar analysis reported 60 issues: 13 Critical, 30 Major and 17 Minor. Reliability rating C
failed; security A, maintainability A, 1.2% duplication and reviewed hotspots passed. Scanner categories
are not proof that an unhandled production failure occurred. The original issue/gate responses remain
in `pr334-sonar-cc9c4a20-issues.json` and `pr334-sonar-cc9c4a20-gate.json`. No review threads were
unresolved at opening; Sourcery skipped its review, so its check is not independent source approval.

The bounded source repair extracts decision/projection helpers, preserves synchronous admission
followed immediately by action invocation, retains serial abortable retries and exact approval/history/
Git cleanup order, and fixes equivalent typing/style findings. Independent source review found no
remaining semantic regression in the repaired set. Three real-SQLite finish-reason cases, three
synchronous/async admission controls and four retry controls were added. Fixture runner/sensor and
regex-replacement bytes are unchanged. Original-versus-repaired diagnostic modules produce identical
schema-accepted projections in 960 control and 32 node comparisons under a mock collector/fixed clock;
that comparison is not application E2E, authentication, persistence or performance qualification.

The SQLite migration `0020_run_control.sql` remains byte-identical. Its `plsql:S1192` finding suggests
an Oracle-style shared constant for four `running` literals in SQLite CHECK/default/partial-index
DDL. The source-aware critic agrees that changing this migration to satisfy an incompatible dialect
would be wrong. A narrow evidence-backed finding disposition is still pending; no rule, exclusion,
policy, suppression or schema redesign has been applied.

**Current boundary:** repaired application bytes need new meaningful tests, connected browser/Electron/
signed-VM evidence, diagnostic review and actual current-head hosted analysis. All `9044859d` results
below remain valid historical qualification of that application, not proof of these changed bytes.
This repair is not merged/delivered, monitoring remains unstarted behind Stop, and owner stress testing
is not ready. Paused orchestration stays separate.

**Status:** Required local execution evidence recorded; delivery qualification remains in progress. Not merged, delivered or ready for owner stress testing.
**Source:** `task/project-chat-stop` into `feature/project-chat-stop`. Early local test provenance
was documentation ancestry `1b574dbc5fc9e0151d1ed8beac5a2ddc0f02c06e` with dirty implementation
source; that historical commit alone does not contain or identify the tested implementation.
The final reviewed file-hash receipt binds implementation bytes; Beads and publication metadata
record the immutable pushed revision and actual PR/mirror state without a self-referential commit
in this document. Product baseline is staging `cf5f04524c25c29635b0d84bda4e76282f28ddcb`.
**Local results checkpoint:** 2026-10-16T04:14:45.364802+00:00. Reviewed application checkpoint is `9044859d6499753f7d3b4ca0d328f50fdb423ec7`, including the bounded diagnostic scheduling repair. Earlier `f9cfc0e0` browser 14/Electron 67/signed-VM 1 results remain prior-source evidence, not qualification of this changed application. Required fresh connected and unchanged normal push-hook proofs are bound below; hosted checks, mirrors, final delivery review and actual merge authority remain separate.
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

| Layer                          | Actual evidence and result                                                                                                                                                                                                                                                       | Qualification boundary                                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts and DB               | 11 contract cases; 15 focused real SQLite control cases passed, including migration, bounded write contention, retention/fences, restart identity and uncertainty reason preservation.                                                                                           | Focused local controls; final combined integration still required.                                                                                                                                                                                                                                            |
| Application/API                | 30 service/HTTP cases passed; later service suite has 26 passed with six actual Git-tool/strict-receipt controls. Actual API tests cover preflight mutex, stale/cross-session targets, failed mandatory writes, pending/claimed approval and fresh-run isolation.                | Deterministic barriers and declared effect boundaries; not browser qualification.                                                                                                                                                                                                                             |
| Real SDK and history           | 28 cases passed in provider-abort/service regression. All five resumed-history boundary cases passed after repairs, preserving real append effects and exactly-once history before Stop or hook failure.                                                                         | Actual local HTTP SDK, real SQLite and owned files, no paid model.                                                                                                                                                                                                                                            |
| Process restart                | One process integration passed: owned compiled API child killed/restarted on the same DB; unfinished active/waiting identity retained, stopped approval still fenced, no provider replay, explicit fresh run works.                                                              | Real API process/SQLite/SDK with loopback provider. Does not prove recovery of arbitrary remote effects.                                                                                                                                                                                                      |
| Harness                        | Retained full regression 768 passed, then 76 affected boundary controls passed. Real descendants and server-applied network effects remain honestly uncertain.                                                                                                                   | Selected source snapshots; final combined review remains.                                                                                                                                                                                                                                                     |
| Web                            | Current reviewed passive-control/BFF source passed 417 tests across 55 files, including 18 control cases; typecheck, scoped lint/format and expanded E2E typecheck passed. Earlier counts remain historical snapshots.                                                           | Component/fake-timer/API/BFF proof; connected executions are separate.                                                                                                                                                                                                                                        |
| Diagnostics                    | Six real API/SQLite export cases passed; MCP/diagnostic regression passed 22. Checks include safe correlation, waiting, known Stop, uncertain late effects, timeout/disconnect/failure categories and coverage/privacy canaries.                                                 | Safe V1 run reports; periodic resource/history monitoring remains absent.                                                                                                                                                                                                                                     |
| Build and quality              | Full workspace build, typecheck, lint and cycles completed successfully; scoped formatting passed.                                                                                                                                                                               | Captured before subsequent focused repairs. No hosted Sonar/CodeQL or exact committed-head gate yet.                                                                                                                                                                                                          |
| API broad regression           | Historical510/3,514/6 and normal-push524/1 attempts remain failed. Final904 normal push-hook/API result: Normal unchanged hooks passed cycles, six-package build/typecheck and 2206 tests, including full API525; exact atomic feature/task remote refs verified without bypass. | normal-push-hook-9044859d-proof.json binds actual terminal log, source and remote tip. No deadline/threshold/loss normalization.                                                                                                                                                                              |
| Isolated diagnostics benchmark | Unchanged benchmark passed 900 measured requests, three rotated repetitions. Maximum relative p95 overhead 4.756792 ms (limit 20 ms); enqueue p95 0.024833 ms (limit 2 ms). Healthy captures retained 1,100 events each, zero drops; deliberately locked captures report drops.  | No threshold normalization or proven CPU/GC/disk root cause; concurrent scheduling is a hypothesis.                                                                                                                                                                                                           |
| Isolated Git regression        | All 22 real-bare-Git/inert-GitHub boundary tests passed with existing deadlines.                                                                                                                                                                                                 | Does not erase broad-suite timeout failures or prove a connection-speed cause.                                                                                                                                                                                                                                |
| Connected Electron             | Fresh current904 Electron67 passed first attempt in655.337seconds with no skipped/flaky/retried cases; Stop effects, diagnostics,503retry and Project restoration independently reviewed;20controlled-helper cases are included, signed realVM is separate.                      | Current-source terminal proof `electron-9044859d-proof.json` requires 67 passed, zero failed/skipped/flaky/retries and source bindings. The earlier f9cfc0e0 clean 67 pass is prior-source only;20 helper cases are not 20 actual VM cases.                                                                   |
| Docker browser                 | Current904 Docker browser16 passed Stop5/reply1/Git5/MCP5 with reviewed source/effect/artifact and recovered owned-cleanup evidence; no stress/load claim.                                                                                                                       | Current-source terminal proof `browser-9044859d-proof.json` requires all 16: Stop 5/reply 1/Git 5/MCP 5 with source/image/artifact bindings. Prior f9 application browser 14 and two handled Git429s remain source-scoped; no stress/load or mutation replay claim. Private diagnostic403 proves denial only. |
| Packaged VM                    | Fresh current904 signed realmacOSVM Stop representative passed1/1 in48.556seconds;5.047msack, actual guest start/lateeffect and honest unknown, safe43-event report, selected49runtime bindings, signature and trace integrity independently reviewed.                           | Current-source actual signed-VM representative requires one passed case plus reviewed report/source/artifact evidence. Earlier f9 VM 1 and controlled helpers do not qualify changed 904 application source.                                                                                                  |

The earlier independently inspected signed-VM Stop capture contains 43 durable verified events, ready coverage, zero
drops/pending/conflicts, no truncation and no privacy canaries. Its standalone safe report is
42,353 bytes, SHA-256 `7ce278daa704fed0382d4df56701880e9ba6be1b6d3c02995426598145c535dd`,
matching both attachment and receipt. Independent review verified all 350 ZIP members/CRC and 49
selected prelaunch source/runtime hashes against the bytes of that captured snapshot. This selected-file binding is not
a complete-tree or reproducible-build attestation. The earlier 88 ms exploratory capture remains
separate. The required actual-VM Stop representative is one case; the 20 helper cases belong to the
67-case Electron regression and must not be described as 20 real-VM executions.

## Scenario status against S01–S15

This matrix renders only after all four genuine reviewed 904 terminal proofs succeed. Its combined
local checkpoint is browser 16, Electron 67, signed actual VM 1 and six-package normal hooks 2206;
retained focused/source-specific evidence supplements that checkpoint and is not silently promoted
to a new capture. Local scenario proof is passed at this checkpoint; exact-head hosted quality/
security/reviews, complete immutable mirrors/readbacks, final delivery critique and authorized
integration remain pending. Prior f9 captures are historical only. No task/epic closure follows.

Local proof below is separate from hosted qualification, complete publication/readbacks, final
source/results review, authorized feature integration and Beads delivery closure. “Local evidence
recorded” does not close a scenario's delivery gates or qualify monitoring/owner stress testing.

| ID  | Current local evidence                                                                                                                                                                            | Remaining delivery boundary                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 | Headless identity/read/Stop and blocked preflight; committed acknowledgement independent of mutex; Docker/Electron acknowledgement/status evidence passed.                                        | Shared final hosted/review/publication/integration gates.                                                                                          |
| S02 | Atomic pre-admission fence, no later model/tool/retry dispatch; exact ledgers and zero post-ack admissions in connected captures.                                                                 | Same shared final gates; admitted work remains separately uncertain until proved settled.                                                          |
| S03 | Real SDK signal/settlement and MCP/native boundaries; fresh 904 connected suites plus required actual signed-VM proof: vm-stop-real-9044859d-proof.json.                                          | Final critique and exact-head feature checks/reviews remain; protected staging separately requires its fresh full analysis and actual packaged VM. |
| S04 | Descendant/network late effects, strict Git unknown receipts, native late marker and no replay; two nested unknown admissions are not two physical commands.                                      | Same shared final gates; no universal hard termination or rollback claim.                                                                          |
| S05 | Pending/claimed approval races, legacy denial, same-ID continuation and preserved receipts/effects; Git49, combined19 and browser/Electron journeys passed.                                       | Same shared final gates; old failing broad runs remain retained.                                                                                   |
| S06 | Controlled retries/backoff/async hooks fence starts; genuine failure distinct; observable real 503 retry positive and Stop-during-backoff negative retained.                                      | Same shared final gates; no invented failed V1 model event.                                                                                        |
| S07 | Duplicate/stale/cross-session/completed target and fresh-run isolation; fresh 904 full Electron and Docker regression passed.                                                                     | Same shared final gates; no caller-selected privilege.                                                                                             |
| S08 | Web 417/control 18 include inventory, readiness, polling/backoff and stale selection; browser reload/selection plus full Electron 67 passed.                                                      | Same shared final gates; selection changes alone are not Stop.                                                                                     |
| S09 | Actual compiled API child killed/restarted on same DB, identity retained, no replay, old approval fenced and explicit new run healthy; Electron regression passed.                                | Same shared final gates; arbitrary remote effect recovery is not proved.                                                                           |
| S10 | Real SQLite contention, mandatory-write failure, migration/retention/fences and diagnostics-independent authority controls; normal hook/API proof bound.                                          | Same shared final gates; failed mandatory commit never counts as ack.                                                                              |
| S11 | V1 exports retain safe correlation, waiting/Stop/failure/timeout/disconnect/unknown categories and coverage; native Stop 5/six exports independently inspected.                                   | Final report/source critique and hosted gates; raw artifacts remain distinct from safe exports.                                                    |
| S12 | Fresh904 Docker16, full Electron 67 and required signed-VM representative completed; normal full API/push-hook proof: normal-push-hook-9044859d-proof.json.                                       | Hosted, mirror, final combined review and actual integration authority remain required.                                                            |
| S13 | Exact pinned pnpm9.15.4 sensor fixture; Electron and Docker sensor start/late-effect/no false-pass journeys passed.                                                                               | Same shared final gates; no permission or deadline relaxation.                                                                                     |
| S14 | Actual loopback SDK503/backoff Stop-negative proves one HTTP request; Electron retry positive retains [503,200,200], one effect, exact model attempts/identities.                                 | Same shared final gates; Electron503-plus-Stop was not claimed.                                                                                    |
| S15 | Five-second passive read cadence, finite actual-header429 recovery, idle stop, immediate explicit control and stale-selection isolation; 18 controls/417 web and current connected suites passed. | Same shared final gates; not a whole-application stress/load qualification.                                                                        |

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
  the historical395-case web suite; later f9 web417/browser14/Electron 67 snapshots provided
  prior-source connected evidence. The current904 qualification remains separately guarded.
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
Those subset passes did not qualify a final combined run and never erase the original failure;
the subsequent normal push-hook/full API terminal result is bound separately above.

Historical Docker Stop 5/5 passed in 32.3 seconds, with CRC/attachment/control/effect/privacy
inspection and explicit pnpm9.15.4 in the owned project cwd. An older warm sensor used an unpinned
Corepack fallback and does not qualify that gate. The earlier context journey remains separately
source-scoped. The reply bootstrap's real default-limit429 and subsequent RPC stalls remain retained;
current final-image reply/Git recovery uses actual safe GET reset headers, with no mutation retry.

The exploratory mixed-source Electron run retained 33 passed/3 failed/1 interrupted/30 unrun. A later
frozen67 retained 64 passed/3 failed: native unknown was displayed as completed, an obsolete assertion
expected no observable retry, and the Project selector needed readiness. Typed COMMAND/HTTP/DOWNLOAD
unknown results now show attention/no retry. The actual [503,200,200] sequence has one physical effect,
exact failed/succeeded model admission rows and one correlated outer retry, then a distinct resumed
execution under the same logical run. There is no invented failed V1 model event.

A focused unhealthy helper assertion originally expected inFlight 1, but actual evidence proves
exactly two distinct nested unknown tool admissions on the same resumed execution and logical run.
The repaired test preserves those exact IDs/rows across reload, one fixed exec-request journal marker,
no replay, attention UI and existing host/secret denials. That journal excludes health checks/raw
commands/secrets and proves a helper protocol request only, not guest/shell execution or termination.

The next clean-application `c0a8b7d6` full-suite attempt was interrupted with owned SIGINT after four
passes and one failure. Its first successful diagnostic download was 200; the later export returned 503
after 355 ms. The old observer waited on response.json and then mislabelled the failure as a10013 ms
download deadline. The503 body was not retained; the upstream 503 cause remains unknown. All partial
logs/trace/evaluation evidence and the owned interruption record are retained, never counted as 67.

Read-only observations found 92 Docker stats rows and 412.51% aggregate sampled container CPU; one
selected high-CPU image was identified as Sonar MCP while other IDs disappeared. These observations
do not attribute unrelated workload growth, establish a sole resource/connection cause, or prove a
permanent fix. A supported normal Docker Desktop stop created a finite isolated native-test window;
no unrelated per-container kill, force, reset, prune, setting or data mutation occurred. Normal Docker
restoration later completed through supported start; desktop/engine/inventory probes succeeded, with
owned mount/data-size checks retained. No permanent environment repair is implied.

Independent bounded replanning approved test-only observer `087774e8` at clean `f9cfc0e0`: non-success
HTTP status is recorded immediately without reading its body or issuing another request; the error
code is explicitly unavailable. Successful status still requires the actual original download. Eleven
pure observer controls passed, including stalled/malformed/oversized failed bodies, event ordering,
original ten-second deadline and timer/listener cleanup. No product200 ms diagnostic read budget,
retry, limiter, timeout or pass condition changed. A representative passed with both exports 200,
then the fresh full suite passed 67/67 first attempt in 10.9 minutes. This result does not prove the cause
of the old 503 or make the earlier failed captures disappear.

The first normal push on f9 retained 524 API passes/one failure: healthy capture reached pending256
and dropped10 despite request overhead3.539542 ms and enqueue p95 0.016667ms remaining within the
unchanged budgets. A fresh-worker repetition also failed with 24 healthy drops, including while
Docker was stopped. The prior unchanged benchmark captured10 events/request (1100/mode); current
Stop emits four additional required state/admission/settlement observations,14/request (1540/mode).
The old 1100-event healthy pass does not qualify the denser workload. No events were removed to pass.

Source-aware review found only an idle250 ms drain timer regardless of a ready 32-event batch. The
approved bounded repair promotes that timer once to 0 when queue.length>=32, skips timer/waiter
creation during the owned recursive in-flight drain, and handles pre-ready backlog through ready.
The 256 total pending bound,32-event batch, synchronous non-I/O record, serial worker append,
200 ms read/1000 ms RPC/actual1000 ms close, FULL durability and zero-drop healthy gate are unchanged.

The focused gate first retained22 passes/one failed assertion: close returned at its unchanged
1000 ms deadline before the owned 32-event rejected RPC catch accounted loss (268 then300 total).
This is an explicit known-versus-unsettled boundary, not proof those32 events persisted. The test
now observes that existing settlement and requires exact eventual 300 losses, no double count or
post-close acceptance. No close/loss production relabel was made. All23 final focused controls,
product/test no-emit TypeScript, scoped lint and format passed; mock timer controls isolate scheduling,
while real SQLite covers1540 accepted identities, writer/overflow/close and persistence boundaries.

After rebuilding reviewed DB source, the unchanged 900-request rotated benchmark passed all three
healthy modes with 1540 retained/zero dropped each and maxPending 56. Maximum relative p95 overhead
was18.114417 ms<=20; maximum enqueue p95 was0.019042 ms<=2. Deliberately locked modes still disclose
loss. No production-capacity, root-cause-of503 or Docker-causality claim follows. Source904 changes
the application: all prior f9 browser 14/Electron 67/VM 1 captures remain prior-source only; fresh 904
connected and full normal-hook evidence are separately mandatory before this document can apply.

## Historical03:37 containment and qualification checkpoint

At the 16 October 2026,03:37 UTC preparation snapshot, current 904 Docker tests completed 16/16:
Stop 5, reply 1, Git 5 and MCP 5. The original MCP file already iterates approve/reject/block/stale/unknown;
the prior 14 estimate omitted two existing scenarios and was corrected without changing selectors,
tests or success gates. Source/image bindings and actual owned cleanup are recorded; the independent
artifact verdict was still pending. Normal full hooks, fresh Electron 67 and signed real VM 1 had not
yet obtained fresh PASS receipts. Final result sections above are guarded by all four actual proofs,
not by this partial snapshot or an earlier f9 result. No mirror/publication/merge claim is made here.

The first 904 full-hook attempt failed the unchanged diagnostic latency bound: repetition 3 healthy
p95 69.902750 ms minus disabled 31.316000 ms = 38.586750 ms, above 20 ms. Healthy events had no drops after
the scheduling repair. Its API file retained 524 passes/one failure; the other five package suites
passed 1681 tests. This is separate from earlier 10/24-drop failures and the isolated 900-measurement
pass. Neither isolated success nor completed browser cases turns that full-hook failure green.

The earlier original 904 API Docker build stalled for 996.619 seconds during pnpm installation and
was stopped with the exact owned SIGINT. It never reached app startup or browser tests. Data/run
readback was preserved but live owned-container inventory was null because daemon RPC stalled;
that attempt did not establish cleanup. The recovered build/run now has actual ownedContainersRemaining
[], three retained bind directories, nondecreased table counts and all 53 states equal to its
post-start baseline. One prior waiting run made the expected reviewed process-interruption recovery;
original 52 states plus that recovery are preserved. Original DB bytes are not claimed unchanged.

Owner-authorized developer-tool containment first set MCP_DOCKER=false and Terraform=false. After
owner reload, the scoped observation found zero old launchers, one Sonar container and zero Terraform;
the user subsequently removed the Terraform plugin externally. The gateway remains explicitly
disabled; absent Terraform is accepted as removed, not silently re-enabled. Four further registration
repairs were authorized: correct malformed standalone Playwright args and disable that standalone
while keeping its plugin enabled; disable stale standalone computer-use; disable Claude's bundled
GitHub server while keeping the curated GitHub plugin enabled. These are developer-tool registration
changes, not product permission changes or approval for broader migration.

The owner's screenshot identified the existing Sonar Toolkit profile, rather than a Codex plugin.
An official Sonar 2.6 plugin was briefly added during investigation, then only that addition was
fully removed. Semantic configuration returned to the four-field repair baseline and the existing
profile's 10 entries remained unchanged. Old gateway-labeled Sonar container 90c97003 used stdio, with
no live host client, ports or mounts. It was gracefully stopped only after owned browser cleanup;
actual Sonar count then became zero. No broad foreign-container cleanup or profile rewrite is implied.

The first existing-profile Sonar verification was blocked before server launch because its guard
required incorrect CLI-prefixed environment names. Existing MCP credential names are the correction;
CLI auth status was checked read-only, without recording secret values. At that 03:37 blocked
prelaunch snapshot, Sonar verification was not complete; the later approved saved-profile result
is recorded separately and never substitutes for new-head quality analysis. Keep actual hosted/current-source Sonar checks mandatory.
No sole Docker/connection/resource root cause is established by these observations or successful runs.

The current recommendation is to prefer Codex built-ins and selected direct developer-tool plugins,
with the MCP gateway kept disabled. Broader tool migration is a recommendation for owner review;
no additional global changes are authorized by this draft. Docker lifecycle ownership remains a
separate evidence-linked OPEN task, not a newly imposed Stop dependency. Monitoring is still
unstarted/hard-dependent on actual Stop delivery; owner stress testing remains blocked accordingly.

## Latest qualified local checkpoint after contained hooks

The contained 904 normal push completed through unchanged cycles, all six package builds/typechecks
and 2206 tests: contracts 139, desktop 187, web 417, DB 169, harness 769 and API 525. Actual terminal 0,
clean 904 source, exact feature baseline/task 904 atomic remote refs and the log digest are recorded in
`normal-push-hook-9044859d-proof.json`, with independent review. The earlier dropped-event and
38.586750 ms full-hook failures remain failed historical attempts, not reclassified as successful.
This is a changed approved developer-tool condition, not proof of the old latency/root cause.

Current 904 browser 16 is now independently approved: Stop 5, reply 1, Git 5 and MCP 5, source/image/effect/
artifact bindings, actual ownedContainersRemaining [] and retained bind data/table/state proof. The
one expected waiting->interrupted startup recovery is disclosed; unchanged original DB bytes are
not claimed. The old planned 14 count remains historical and cannot satisfy the current 16 guard.

Fresh 904 Electron completed 67/67 with exit 0/clean supervisor and the signed real VM completed 1/1
in 48.6 seconds (supervisor 50.792 seconds). Their earlier review-pending states are dated interim
snapshots. Final current-source qualification binds `electron-9044859d-proof.json` and
`vm-stop-real-9044859d-proof.json`; preview/application can render only after both genuine reviewed PASS receipts
join the approved browser and normal-hook proofs. The summaries above use those actual inputs.

The broad raw diagnostic set has 50 reports: 49 healthy and one intentional unavailable/partial
control. Do not describe all 50 as healthy or complete; preserve that deliberate failure/coverage
boundary. Final signed VM acknowledgement is 5.047 ms with 43 safe zero-loss events, one provider
request, two nested unknown admissions and actual helper/signature/entitlement evidence. The
unchanged 4 GiB image was not freshly rehashed, so selected source/runtime bindings do not become
a fresh whole-image attestation.

The existing Docker Toolkit saved-profile Sonar route is now genuinely exercised and independently
reviewed: one pinned `mcp/sonarqube` container, one client, three actual
`get_project_quality_gate_status` calls returning OK, same owned container and normal close with
none remaining. Its profile identity/hash is retained in
`sonar-profile-single-client-verification-v2.json`; gateway stays disabled and no extra Codex Sonar
plugin is required. The earlier wrong environment-name guard stopped before launch and remains a
recorded failed attempt. This successful one-client check is neither an automated global singleton
policy nor proof of simultaneous-client cardinality, permanent stability or the original Docker
root cause. Reading the saved project's current quality status is not fresh analysis of the new
pull-request head; exact-head hosted Sonar/CodeQL/security requirements remain mandatory.

The owner's clarification was the existing Toolkit profile, not a new Codex plugin. The temporary
official Sonar 2.6 addition was fully removed without disturbing the authorized four-field repair or
10-entry profile. The old stdio/no-client/no-port/no-mount gateway orphan was gracefully stopped only
after browser-owned cleanup. No wider global tool migration, gateway reenable, merge grant or
monitoring implementation follows. Built-ins/direct-plugin preference remains a recommendation;
paused orchestration remains separate. No mirrors or publication have been claimed.

## Environment and delivery checkpoint

Application checkpoint 9044859d6499753f7d3b4ca0d328f50fdb423ec7/tree 178a103c9d61f1ae66ad9515daf2ade07a0284ff
contains the reviewed three-file DB scheduling repair. Required fresh current-source qualifications:
browser: Current904 Docker browser16 passed Stop5/reply1/Git5/MCP5 with reviewed source/effect/artifact and recovered owned-cleanup evidence; no stress/load claim.; Electron: Fresh current904 Electron67 passed first attempt in655.337seconds with no skipped/flaky/retried cases; Stop effects, diagnostics,503retry and Project restoration independently reviewed;20controlled-helper cases are included, signed realVM is separate.; actual signed VM: Fresh current904 signed realmacOSVM Stop representative passed1/1 in48.556seconds;5.047msack, actual guest start/lateeffect and honest unknown, safe43-event report, selected49runtime bindings, signature and trace integrity independently reviewed.;
normal unchanged push/full API gates: Normal unchanged hooks passed cycles, six-package build/typecheck and 2206 tests, including full API525; exact atomic feature/task remote refs verified without bypass.. This source update renders only after all four
terminal, successful, source/artifact-bound proof receipts exist. Earlier f9 captures remain historical.
Web 417/control 18 and unchanged benchmark source/requirements retain their explicitly recorded scope.
The new compiled-DB benchmark records 900 measurements, healthy 1540 events/mode and zero drops,
maxPending 56; maximum relative p95 overhead18.114417 ms and enqueue p95 0.019042 ms meet unchanged
20 ms/2 ms bounds. It does not erase failed full-hook or fresh-worker attempts.

The initial11–13 GiB reserve failure and supported earlier restart remain historical. The subsequent
normal stop created a finite native-test window, not another Docker crash. Supported normal restore
completed: desktop status0, engine info0 in 4.373746 seconds and inventory0 in 102.083 ms, with owned
mounts/data sizes retained. During that original stop/restoration window, no force/reset/prune,
volume removal, global setting or foreign-container mutation was performed; later owner-authorized
partial remediation is recorded separately below. Recheck 20GiB reserve before heavy runs; successful recovery is not a
permanent repair or proof of the upstream 503 cause.

The dated containment/qualification checkpoint above records the current16-case browser pass
and the then-pending artifact verdict, unchanged full-hook latency failure, recovered owned
cleanup and authorized developer-tool repairs. The subsequent qualified checkpoint records
independent browser approval, normal2206 hook pass and original-profile Sonar one-client/three-read
verification. Fresh Electron 67 artifact review and actual VM 1 remain separately proof-guarded.

A separate P1 operational task, [Docker MCP lifecycle](../tasks/agent-platform-docker-mcp-lifecycle.md),
records one configured gateway and nine Codex-child container-run clients. Two snapshots 34 seconds
apart contained 28 running Sonar and nine Terraform containers; labels do not establish owner/session
binding or expected cardinality. Returned 153 lifecycle events cover only 02:22:52–02:23:36UTC and
include healthy transient teardown; they do not cover the full requested window. Historical Java OOM
victims are not all bound to image/owner. Duplicate-count observations are not proof of leaks or
sole causality. This linked IN_PROGRESS investigation is not a new hard Stop dependency; global changes
and interruptions of unrelated owners require applicable authority. No complete root-cause repair is claimed delivered.

Safe V1 exports are projected metadata; raw local trace/provider/request artifacts may contain
scripted prompts/paths. Selected prelaunch source/runtime hashes, served assets, report/attachment
bytes and ZIP CRCs bind captured boundaries, not a complete-tree/reproducible-build attestation.
Missing coverage does not establish absent effects. Two actual handled Git429s used safe read
recovery without mutation replay/limiter weakening. Browser diagnostic403 is denial only; native
exports are separately required. Controlled-helper captures do not substitute for actual VM proof.

Local proof is not delivery. Exact-head feature pipelines/reviews and tree verification, complete
seven-document immutable mirrors/readbacks, final source/results critique and Beads readback/sync
remain required for feature delivery. Protected staging separately needs current-head full scans,
actual VM/security/quality/protection checks and resolved comments, plus the actual reserved merge
grant. Hosted/publication/integration status is pending at this source checkpoint; later immutable
receipts establish actual state. Local IDE Problems is unavailable; actual hosted Sonar/CodeQL and
the supported fallback are mandatory. No all-green/merged/delivered/stress-ready claim is made.

The earlier preservation receipt's original-diff reconstruction after two status appends is
historical. The latest read-only `preservation-after-native904-observation.json` records 11 of 12
unrelated checkouts exactly matching their original snapshots. The primary checkout changed
concurrently: an untracked documentation skill was removed and a UI-evaluation status appended.
Its original journal prefix remains exact with three appended status observations in total. Main,
staging and all four paused remote refs remain exact. Whole-primary diff/status/untracked equality
or all-12-checkout equality is not claimed. Preserve outside work as observed; no restoration,
reversal or overwrite was performed. Monitoring stays OPEN, authorized but unstarted/hard-dependent
on actual Stop delivery. M01–M06 and owner trial Q01 remain blocked by their own actual deliveries.

## Evidence and publication handoff

Evidence root: `/Users/letuscode/.codex/project-chat-stop-implementation-20261016`. These are local
files; do not infer remote availability from their presence. Publication must bind an immutable pushed
implementation revision, every full source body/readback and the actual destination. Preserve
historical notes/pages. Beads/publication receipts establish whether that work has completed; an
early dirty-tree HEAD is not the final implementation identity.

Key current904 canonical proofs: `browser-9044859d-proof.json`, `electron-9044859d-proof.json`,
`vm-stop-real-9044859d-proof.json` and `normal-push-hook-9044859d-proof.json`. The update preparation
receipt hashes these actual inputs; they do not replace immutable-source hosted/publication evidence.
Historical source-scoped evidence is retained in `browser-final-qualification-summary.json`,
`electron-quiet-f9cfc0e0.json`, `native-diagnostics-bounded-replan.json`, `export-observer-controls.json`
and `native-completed-subsets-independent-review.json`; it does not qualify the current904 gates.

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
