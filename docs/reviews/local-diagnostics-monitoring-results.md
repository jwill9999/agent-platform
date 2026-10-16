# Durable local monitoring — implementation results

**Task:** [agent-platform-local-diagnostics-monitoring](../tasks/agent-platform-local-diagnostics-monitoring.md), IN_PROGRESS.
**Contract:** [M01–M06](../testing/project-chat-stop-mvp.md). **State:** local implementation qualification
checkpoint; publication/hosted delivery receipts are tracked separately. No monitoring completion,
staging qualification or owner stress-ready claim.

## Source and authority

The owner authorized Stop followed by this bounded monitoring task. After fresh exact-head checks
and comments cleared, PR334 merged by guarded merge commit into `feature/project-chat-stop` at
`a5d17683961236f9cf089030be51b813845d85da`, tree `4d33908a24dbd170d1226b85e350b9d375325ad7`,
exactly matching reviewed `e1713628`. Canonical Stop is CLOSED/read back and Dolt push52357 completed.
Monitoring uses `task/local-diagnostics-monitoring` from its dedicated feature, which starts with the
qualified Stop dependency. No protected staging promotion or paused-work integration occurred.

Independent source-aware critique approved the implementation design and branch sequence. Review
assignments are procedurally read-only; no inherited-tool isolation is claimed. The implementation
must leave existing V1 capture and permission/control semantics unchanged. Evidence lives outside
source inputs at `/Users/letuscode/.codex/local-diagnostics-monitoring-20261016`.

## First hosted qualification and repair history

PR339 is open into `feature/local-diagnostics-monitoring` at first pushed checkpoint
`11927e4fb984a9b333d699509382d5b3ddbde101`, tree `5b8896851c0856df5febbba032d358aea331c91f`.
Normal hooks passed five affected builds/types/cycles and 1,526tests: contracts 146/desktop 219/web 431/
DB 187/API 543; all 55committed hashes matched the reviewed candidate. That local push is successful,
while the earlier877push failure remains retained. It does not qualify subsequent repair source.

Actual hosted Sonar rejected119:18open findings and 6.8%new duplicated lines above3%; reliabilityD,
security/maintainability/hotspot conditions otherwise pass. Raw API/issue/duplication blocks are
retained as `pr339-sonar-opening.json` and the related four-file block receipts. No issue dismissal,
rule/profile change, exclusion or threshold alteration is used. Other hosted jobs and review threads
are inspected independently; a green check alone never resolves an actionable finding.

Repairs are bounded: preserve nonblocking API startup with a readiness observer, extract
unchanged route-error translation and CLI parsers/renderers, native sequential bounded streaming,
standalone UI/summary labels and spacing, exact cursor field sets, explicit safe page projections,
and two concrete internal DB helpers for identical queue/RPC/cursor/metadata mechanics. Each store
retains its own strict schemas, health/preference/configuration, HMAC/epoch/snapshot/prune fences,
queue256including in-flight/batch32/read 200 ms and existing one-/two-second shutdown policies.
DB helper source review and fresh queue/storage/cursor/process,900-measurement benchmark, coupled
recording journey and signed-VM Stop qualification are required before those changes can inherit a
new delivery claim. Prior119results below remain the original local checkpoint.

Documentation publication is explicitly partial: four new branch-specific119mirrors (API reference,
diagnostics guide, plan and Stop results) have full body/revision/hash/destination readbacks. Five
other documents and all 20historical session parts remain unpublished/on hold until final repair
source is pushed. Preserve/reuse those four exact page IDs; historical mirrors/notes are untouched.
Receipt: `publication-preparation/partial-publication-11927e4f-hold.json`.

## Repaired-source local qualification checkpoint

All repair groups passed independent source review: API startup/error helpers; native sequential
transport/UI; CLI helpers; contracts and the two internal store/worker helpers. Scoped controls pass:
contracts 35, DB 42 including real physical limits/queue/deadlines/cursors, desktop 53, web 14, CLI13,
and API 9 plus held-HTTP shutdown1. Counts overlap, and normal full package gates remain separate.
All 49 application/test/workflow source hashes are frozen in `pr339-sonar-application-candidate.json`.

A fresh supported rebuild and connected journey passed once:41.107-second test/41.553-second suite/
42.555-second supervisor, no retry/skip/failure. Actual sample interval30000.471 ms; enabled seven-day
preference, exact prior 2 samples/36 events after restart and fixed 3 samples after Off while events grow
to53. All four safe reports are ready, zero loss/pending/conflict/prune, explicit independent
snapshots. Private browser403, native SaveAs/cancel, three deterministic model replies and owned
cleanup pass. Independent review rehashed49 source/158 compiled bindings and three ZIPs/487 CRC members.

The fresh signed VM case passed once:44.816-second test/46.174-second suite/47.853-second supervisor,
no retry/skip/failure. Stop acknowledged in6.538 ms, final outcome_unknown with two in-flight attempts,
one genuine started and late guest effect, one provider request/no errors and no post-ack admission
or replay. Native history50,389 bytes/SHA599572851d1ba8dfd9519ff309877110fa91edd47f5886e5ad9b348483d91277
contains one baseline sample/48 events/25correlated controls with the same V1/resource process UUID;
original session V1 report43 events/42,341 bytes is an exact subset, durable/zero loss. Both stores are
ready; independent snapshots and baseline/guest-CPU limits remain explicit. Two unique trace ZIPs/
488 CRC members, source/runtime/served bindings, signed helper and owned VM cleanup were independently
approved. No fresh 4 GiB image hash or load/capacity claim. Source/results from119below remain historical.

Normal source1c2 push passed1,532 tests (contracts146/desktop223/web431/DB189/API543), five
builds/types and cycles. The fresh unchanged benchmark passed900 measurements/990 requests, all nine
raw vectors independently verified: worst relative p95 8.262 ms against20 ms, enqueue p95
0.014416 ms against2 ms and zero healthy V1 loss. Initial resource probes do not establish periodic
load capacity. The actual process/restart report was independently assessed without source, ground
truth or live observation: model31,059.694 ms of request31,093.081 ms, active/unresolved/lock1 and
waiters0, with a subsequent process boundary and explicit incomplete independent snapshots.
Comparison only after assessment confirms the deliberately held31,029 ms fixture was localized;
no real performance defect or causal resource/provider claim follows. Current receipts include
`pr339-1c2-normal-push-proof.json`, `pr339-1c2-benchmark-independent-review.json`,
`stored-window-review-03-assessment.json` and `monitoring-stored-review-v3-disposition.json`.

Actual1c2 hosted Sonar passes all quality conditions, duplication1.0%/ratings1/hotspots100%, but one
S7785 startup-style issue remains. The independently approved index-only follow-up changes the
readiness observer from async to synchronous and attaches the same fixed failure warning to the
owned start Promise, preserving nonblocking startup. Fresh normal API and new-head hosted checks
remain required; prior source1c2 connected/VM/benchmark evidence remains applicable regression
coverage with the explicit observer-only delta, not exact-byte retesting of the follow-up.
Full nine-document mirrors, all hosted tests/security/reviews and actual authorized delivery remain
separate. No stress-ready claim follows.
Receipts: `pr339-db-contract-sonar-repair-freeze-v1.json`, API/CLI/desktop repair receipts,
`connected-sonar.*` and `vm-monitoring-sonar.*` with their actual artifacts.

## First local qualification checkpoint

These are source-bound working-tree results, not a committed revision or hosted qualification.
Original receipts are retained: monitoring/API/benchmark receipts under
`/Users/letuscode/.codex/project-chat-stop-implementation-20261016`, and monitoring store,
desktop, connected and stored-review receipts under the monitoring evidence directory above.

| Contract                           | Actual local evidence                                                                                                                                                                                                            | Remaining delivery evidence                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| M01 retained recording/restart     | Actual managed desktop and separate Chromium client, real SQLite preference, production 30-second sampling, clean restart with identical prior history; separate process SIGKILL/restart retains data and marks unclean coverage | Final committed-source binding and hosted gates                               |
| M02 resource/control evidence      | Actual API CPU/RSS/event-loop/disk samples; held model interval correlated with active run/unresolved admission/lock-key sample; unknown attempts retained until known settlement                                                | Final delivery binding                                                        |
| M03 retention/physical bounds      | Actual 25,000 rows, age pruning, 32 MiB SQLITE_FULL, near-capacity rollback journal above 30 MiB/below 34 MiB and recovery; queue cap 256; failed/unwritable storage does not grant permissions                                  | Final source/hosted regression                                                |
| M04 privacy/access                 | Private loopback/capability routes, actual browser 403, exact main-frame/origin IPC controls, projected reports without fixture prompt/key/path/capability probes, bounded 5 MiB output                                          | Final source/security review and hosted scans                                 |
| M05 shutdown/history               | Two independent signed cursors, expiry/restart/prune/scope controls, 200 ms total window and two-second store close, held accepted HTTP body while store closes before server exit                                               | Final delivery binding                                                        |
| M06 stored-only diagnosis/overhead | Fresh agent located the roughly 31-second model interval using only saved neutral report after unclean restart; unchanged 900-measurement benchmark passed                                                                       | Final documentation/evidence review, hosted qualification and actual delivery |

Focused/regression qualification: contracts 35 passed; DB 38 passed; API 67 passed across seven
files, followed by one changed process fixture case passed (32.957 seconds); desktop 49 controls;
web 14 controls; CLI 13 initial controls plus six subsequent health/coverage controls. These counts
are scoped runs, not a single disjoint suite total. API/DB/contracts builds, desktop/web typecheck,
touched-file lint/format and CLI syntax checks passed. Final integrated normal push gates remain pending at this checkpoint. SonarQube MCP/IDE Problems are unavailable with the gateway disabled; terminal
fallback is used locally and actual hosted Sonar/CodeQL remain required.

### Connected browser and Electron

One coupled acceptance case passed with no retry, skip or failure (45.524 seconds). It uses the
actual managed desktop/API, SQLite, production sampler and a separate Chromium client. Only the
external model wire (three replies, no errors) and OS SaveAs destination are deterministic fixtures.
This is not a Docker browser-only run or a full Electron batch. Actual Settings enables recording,
SaveAs cancellation writes no file, positive reports retain history across clean backend/desktop
restart, and disabling resource recording leaves existing V1 chat events recording normally.

Independent artifact review approved the actual UI traces, backend effects, ten artifact hashes,
44 application source hashes and 156 compiled JavaScript hashes. Three CRC-valid trace archives
contain 549 members. Before/browser/restart/off reports contain respectively 19/36/36/53 V1 events;
restart preserves the exact two previous samples, and off stops new samples while V1 events grow.
The third sample is the restart baseline. All four projected reports are ready with no pending,
dropped or conflicting writes and disclose independent store snapshots. Raw traces/screenshots
contain synthetic UI content and fixture paths and remain private; only projected reports are safe
metadata exports. Receipt: `monitoring-connected-candidate-v1.json`; final review is a separate
source-aware verdict, not the receipt's earlier pending-review label.

### Stored-only diagnosis and performance

The first saved report did not contain a representative delayed incident: it had three idle samples
and a short nested tool failure. Its original report and insufficient-evidence assessment remain
retained. The revised process test holds one actual SDK/provider-fixture reply for 31 seconds,
records an active-run sample at the unchanged 30-second cadence, then kills/restarts only its owned
API process. No paid provider is called. A fresh reviewer receives only a byte-identical neutral
`stored-window-review-02.json`, without source, fixture ground truth or live observation.

The reviewer located request ingress 31,115.95 ms, request operation 31,099.11 ms and its model
interval 31,061.29 ms, correlated with one active run/unresolved admission/lock key and zero waiters.
They correctly retained the prior unclean process boundary, independent snapshots, short window
and missing provider/host detail as limits. The report localizes elapsed time without proving a
provider or resource cause. Comparison with the separately retained ground truth confirms the
controlled seed was located; a deliberately delayed fixture is not a new performance bug.

The unchanged benchmark passed 900 measurements/990 total requests/three rotations: worst relative
request p95 delta 4.915041 ms (20 ms ceiling), enqueue p95 0.019958 ms (2 ms ceiling), zero healthy
V1 loss with 1,540 events per variant. Healthy and V1-locked enabled variants durably record their
initial resource probe with no pending/drop/conflict. Short benchmark phases do not include a
30-second periodic tick; the separate real process/connected tests cover that functional interval.
This is observer overhead evidence, not sustained load, host-capacity or throughput qualification.
Receipt: `monitoring-benchmark-initial-measurements.json`; all nine raw vectors were independently
recomputed and approved. Read-only clock-coverage projection and UI/test-only later edits do not
change the measured request path; no unnecessary benchmark rerun is claimed.

## Findings and disposition

- MON-COUNTS: retain uncertain external admission counts after transport promise settlement; fixed,
  real durable unknown/known/failure controls passed and source review approved.
- MON-PROCESS-ID: use the same process UUID for V1 events and resource samples; fixed, actual
  restart test proves equality within a process and change after restart.
- MON-CLOCK-COVERAGE: sample sequence does not imply monotonic UTC. Fixed independent min/max and
  conservative non-increasing/cadence-gap coverage; V1 asynchronous events keep their own semantics.
- MON-UTC-INPUT: reject impossible normalized calendar dates before IPC; fixed, valid leap-date
  contrast and invalid-date tests passed.
- Existing mutex timeout ownership: bounded reproduction shows tail waiter timeout can release its
  gate before an earlier owner. Real API exposure remains unverified. Recorded P2 OPEN
  [follow-up](../tasks/agent-platform-session-lock-timeout-ownership.md), discovered-from monitoring,
  without a hard dependency or unapproved repair. Metrics honestly distinguish lock keys/waiters/
  active owned runs; the owner trial remains one active request per session.

### Integrated VM attempt and bounded fixture repair

The first actual signed-VM attempt failed before monitoring enablement or the Project command:
initial Settings navigation returned ERR_CONNECTION_RESET. Its trace places the navigation about
2.4 ms after the first window appeared, while the initial root page was still loading. Bootstrap
awaits that initial load and quits on rejection; an interrupted initial navigation is a source-backed
inference, not a proven sole network/OS cause. Cleanup confirmed the owned group absent and all
application/compiled/global bytes unchanged. The original failure, raw reporter plus pnpm trailer,
trace and startup/cleanup evidence remain retained as `vm-monitoring.*` and its artifacts.

The test-only correction waits for the exact owned initial root URL to finish loading before
navigating to Settings. It retains the original navigation/test/Stop deadlines and every VM/effect/
privacy assertion; there is no retry loop or product change. The critic approved exact corrected test `bdc5b0a8`; a new actual signed-VM attempt passed
one case in46.417 seconds (47.491-second suite/48.447 seconds supervised), zero retries/skips/failures, no signals and owned
group absent. The same real guest produced one started effect and one late effect; Stop acknowledged
in8.849 ms and final state remained `outcome_unknown` with two in-flight attempts. Provider fixture
was called once with no errors; no replay/new post-ack admissions were permitted. Native Settings
saved an enabled seven-day preference and native history export retained one actual initial resource
sample,48 V1events/25correlated controls and shared V1/resource process identity for the actual session
and logical run. Independent snapshots are explicit and combined coverage was not incomplete; this
short window makes no periodic/guest-CPU claim. Existing V1 export retained43safe events. Exact
source/compiled/global bytes were unchanged through the attempt. Retained helper signature verified;
large pinned image bytes were not freshly rehashed, and actual guest/effect assertions remain required.
The initial failure is not relabeled as a passing attempt or proven network fix. Receipts:
`vm-monitoring-navigation-repair.json`, `vm-monitoring-v2.json` and its source/postconditions/artifacts.
Independent artifact/source review APPROVED the actual run: all source/runtime/report bindings and
cleanup verified, two unique ZIPs/574 CRC-valid members (a duplicate browser attachment is disclosed),
zero post-ack admissions and actual native export effects. No actionable VM finding remains.

## Retained failures and delivery limits

The first ref-only push entered baseline pre-push gates because the task lacked an upstream.
Its verified owned process group was interrupted (exit 130), with no remote ref created; no pass
or bypass is claimed. After setting the legitimate local feature integration base, the qualified
Stop-only feature ref pushed normally. The monitoring candidate was tested before commit; its normal publication must run affected package
gates and bind actual pushed bytes to the reviewed candidate. Two process-fixture module-resolution failures and the first
storage-setup race are retained in their original logs; fixture repairs did not weaken product gates.
Existing Stop failed attempts and an unexplained diagnostic export 503 remain in its own results.

The first monitoring source commit `8772382a` exactly matched all 54reviewed candidate files, but its
normal push was rejected: cycles, five affected builds/types and contracts 146 passed; desktop 218/219
failed before the remaining package suites qualified. The normal-shutdown test's ready-window double
lacked `webContents.getURL()`, required to capture the trusted monitoring renderer origin. Bootstrap
therefore threw/quit before the simulated shutdown. Focused reproduction retained the same failure.
A test-only correction returns the same fixture renderer URL and asserts legitimate startup before
all unchanged pending-child/repeated-quit checks. Six focused and all 219desktop unit tests pass,
along with strict touched-test typecheck/lint/format. No application/runtime change or E2E rerun is
needed for that mock-contract repair. The failed push/log and reproduction remain retained;
`main-lifecycle-monitoring-mock-repair-v2.json` binds exact source and results. A new unmodified
normal push must still pass; neither this scoped pass nor the earlier source commit implies remote
delivery or hosted qualification.

Initial host free space was 58.44 GiB; Docker responded. Global configuration remains unchanged,
with `MCP_DOCKER.enabled=false`. No Docker restart/prune, global registration change, paid model
call, external diagnostic upload, scheduled agent or owner stress session occurred. Local source/results documentation reviews approved; normal quality/push, full branch-specific mirrors, hosted checks,
reviews and actual authorized delivery remain required. Monitoring integration/staging merges
retain their reserved owner-authority gates; stress readiness is not established by these tests.
