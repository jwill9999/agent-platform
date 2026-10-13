# GitHub read responsiveness — planning review and result record

Status: owner-approved implementation; local verification complete, final review and hosted delivery in progress. Date: 14 October 2026.
Source: staging1e4bd7af30b092cc9a2d795e9c022ebfd5212176; task `agent-platform-d185`.
[Plan](../planning/github-read-responsiveness.md), [spec](../tasks/agent-platform-d185.md),
[verification contract](../testing/github-read-responsiveness.md).

## Source-review observations incorporated before formal critique

The distinct d185 critic inspected actual source and existing tests. These are planning observations,
not an implementation approval or completed test result.

- Both synchronous value and success/auth helpers block. Separate async read helpers preserve write
  callers instead of changing every helper signature; GR-R1/R6 and T02/T06 cover this.
- Async PR lookup needs explicit captured branch and final identity recheck; GR-R4/T05 cover it.
- Successful PR creation must not be replayed or reported as failed because enrichment failed;
  GR-R6/T06 isolate that boundary.
- BFF currently lacks abort forwarding. GR-T07 requires actual direct/proxy abort evidence, while
  navigation cancellation and all-route forwarding remain excluded.
- Read failures use unavailable while malformed successful JSON uses502; preserve/test both.

## Formal findings and dispositions

V1 verdict: correction_required from distinct `d185_critic`.

| Finding | Severity | Evidence                                                                                                                                                             | Disposition                                                                                                                                                                                                               |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GR-C01  | High     | Standard Docker proxy uses api:3000; local-diagnostics-server requires loopback/capability. Existing browser tests expect403 or defer V1 export to managed fixtures. | Corrected GR-T08 and environment map: Docker proves UI/chat/tool concurrency plus403; existing managed-loopback Chromium and Electron must prove successful V1 export. No diagnostics policy change. V2 recheck approved. |

Distinct `d185_critic` re-reviewed the saved v2 against actual source and returned **approved** with
zero actionable findings. GR-C01 is resolved. No new owner product question was identified; the
owner approved that plan and requested implementation with conditional task PR merge on 14 October.
Review is procedural independence,
not technical isolation of inherited tools.

Frozen substantive source hashes approved by the critic:

- Plan: `93fe116cf791feefe853419296e6c4225fa568318e025572400ff9d1298b75dc`.
- Task spec: `5da55eabd6948cf6841ca084a442e7948159995308978e774d70b7a09f782b77`.
- Verification: `4f5838db00abc6b5ce959ac62cdad4d24213021b501e8895bcb6c1547715a4bb`.
- Session handoff: `ce82115d0429727662e9fa008e8c0f61775f4d6e44ff4911a82b34bf01623b87`.

This record adds the actual review disposition after the reviewed draft; it does not alter the plan.

## Actual planning validation

Current code and Beads reviewed; Docker reachable and runner online/idle at inspection. Direct Markdown on all five files, explicit Prettier, relative source links and exact historical
session suffix validation pass. The first Markdown command used a nonexistent config filename;
corrected invocation read the actual repository JSONC config and passed without changing lint rules.
Primary original changes remain exact apart from authorized task-status journal appends; paused
snapshot is exact. Publication is completed only after committed source and full Notion readback;
that external receipt records actual revision and page destinations. No runtime change, product test, feature merge or staging promotion is claimed.

## Implementation results

The owner approved implementation through testing, independent critique, documentation and task PR
merge when all actual current-head pipelines pass and review comments resolve. Integration destination
is `feature/github-read-responsiveness`; protected staging promotion and paused work remain separate.

Implemented a dedicated asynchronous read operation shared by checks and PR listing, with the approved
10-second total deadline, 1 MiB combined child output cap and four-operation capacity. All Git identity,
version/auth/query/fallback/recheck calls in these GET chains are asynchronous. Identity is captured and
rechecked; successful PR creation is retained when optional enrichment fails. The BFF forwards abort only
for the two read routes. Existing synchronous write helpers and validation remain unchanged.

### Local evidence

Evidence root: `/Users/letuscode/.codex/github-read-plan-20261014`. These are actual local results;
current-head hosted qualification, publication and merge are still pending at this checkpoint.

| Cases             | Actual result and evidence                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GR-T01            | Exact staging router baseline blocked health until controlled release: 1517.231 ms for checks and 1534.375 ms for PR list; release at about 1502 ms. Fixed real API concurrent reads allowed health/session probes in 2.170 ms before release. `baseline-responsiveness.json`, `api-focused.log`. Baseline transpiled the unchanged router and reused compiled dependencies; it is not a full chat baseline.  |
| GR-T02/04/05/06   | Existing 51 and new 22 route tests passed: schemas/failures/fallback, identity changes/detached/two-project cases, four slots/disconnect recovery, successful creation with failed enrichment and no replay. `api-focused.log`.                                                                                                                                                                               |
| GR-T03            | Ten helper tests passed on macOS, including combined-output boundary, cumulative budget and descendant/peer cleanup. Four additional real deadline stage tests passed: version 10045.98 ms, auth 10017.35 ms, initial metadata 10015.88 ms, final metadata 10015.26 ms. The metadata tests substitute a held child only through a test spy and retain the real deadline/cleanup. `api-stage-deadline.log`.    |
| GR-T03 Linux      | Four isolated Linux controls passed with Node24.21.0: TERM-resistant descendants and unrelated peer, exited leader/inherited pipes, exact/overflow combined bytes, shared deadline and slot reclamation. Frozen helper and fixture hashes match. Evidence `../github-read-implementation-20261014/linux-process/`; network-disabled container removed. No full Linux application claim from these controls.   |
| GR-T07            | Five BFF regressions pass; actual Electron fetch through the real BFF is aborted and the owned child terminates within the 1500 ms observation window, without safety expiry. Direct API disconnect and POST mutation-retention tests also pass. `bff-final.log`, `managed-safe-final.log`.                                                                                                                   |
| GR-T08/09 managed | Three final safe-environment journeys passed in 39.9 seconds: Chromium and Electron approve/deny real file actions while both GitHub reads remain held; V1 export, independent SQLite/audit/file checks, Electron restart persistence, timeout/unavailable/recovery UI. `managed-safe-final/` and `managed-safe-diagnostics-review.json`.                                                                     |
| GR-T08 Docker     | Passed in 3.8 seconds after fixture readiness repair: actual approved tool effect and reply precede child release, health 2.396 ms/session 2.845 ms, expected export403. `docker-final/` and `docker-e2e-repaired.log`.                                                                                                                                                                                       |
| GR-T10            | Root build/typecheck/lint/cycles and focused BFF checks pass. Full API312tests/37files pass in115.21seconds with tracing disabled. Diagnostics benchmark all9samples pass (healthy p95 8.87–9.48ms, enqueue p95 below0.015ms; locked-writer drops remain honestly reported). Runtime normal commit/push hooks pass (API312 and web275); verification hooks, complete mirrors and hosted gates remain pending. |

### Independent implementation review and retained first failures

Distinct `d185_critic` approved frozen implementation source with no remaining actionable source findings.
This is source approval, not completion of remaining runtime/hosted gates.

- **GR-I01:** the first managed run had two passes and one recovery assertion failure. The fixture
  expected the remote name as `repositoryName`; the API correctly returns the local repository basename.
  The assertion now derives the actual basename, retaining branch/PR identity checks. Final safe three pass;
  original complete artifacts remain in `managed-initial/`.
- **GR-I02:** added explicit version/auth/initial/final metadata stalls to cover the promised stage
  deadline tests. All four pass without product timeout changes or production test seams.
- Docker first attempt timed out in initial Project setup before any held read: trace shows `/init`
  entered during restoration but no init POST reached the API. Added actual restored-state/agent
  readiness and enabled form submit; retry passed without changing product deadlines.
- **GR-I03 (high, source repair approved; regenerated artifacts verified):** shared Electron test fixture inherited `process.env`, and
  raw Playwright traces serialized nonempty ambient credential variables. Diagnostic report exports
  passed their redaction assertions, but that did not make the raw traces safe. Original traces are
  restricted locally and were not uploaded. The critic approved replacing inheritance with a narrow fixture environment,
  three sentinel tests prove exclusion of secret/proxy/Git/SSH variables. The final regenerated run passes all three scenarios and contains no inherited credential matches across all raw files and 792 decompressed ZIP members. Four existing context/default and reply-restoration regression journeys also pass (32.3s), with no matches in 1538 ZIP members. Three sentinel unit tests pass. Receipts `managed-safe-final-privacy.json` and `fixture-regression-privacy.json` bind every artifact hash. This checks the five actual inherited credentials from the prior restricted traces; the explicitly synthetic fixture key is excluded. It does not claim universal secret detection or child-tool isolation.
- **GR-I04:** the fresh trace-safe run had two passes and an Electron fixture failure: the denied-phase Refresh click waited 8582ms on a disabled control while automatically started held reads reached their 8s safety expiry. The fixture now uses real Git/Activity tab navigation to initiate the hold; product deadlines and before-release proof stay unchanged. Fresh qualification passes all three scenarios without retries; critic approved the exact sequencing repair.
- **GR-I05:** final documentation critique found an unmarked planning-only authority footer in the
  plan. Corrected it to current implementation and conditional feature-merge authority, linked actual
  local results and retained the separate protected staging gate.
- Initial new API fixture incorrectly used session mode `personal`; corrected to contract `chat` and
  safe teardown. First broad run had 286 existing/helper passes and 17 fixture failures before routes.
  The corrected focused 73 and four added stage controls pass; original failure log is retained.
- One full API invocation inherited external tracing settings and was stopped after rejected403
  telemetry attempts. Its log is retained; the full suite passed with tracing explicitly disabled.
  No product configuration changed and the fixture model calls remain deterministic/local.
- Initial full lint found two unused parameters in a new BFF test mock. Typed the mock without unused
  implementation parameters; final full lint passes. No runtime behavior changed.

### Diagnostic review checkpoints and disposition

Five actual managed V1 reports were parsed and reviewed after connected testing: success21events,
denial40events in each browser/native mode, and restart40events. Reports include request, ingress,
context, model, tool and approval phases, linked run/attempt identities, durable/verified coverage,
zero pending/dropped/conflicts/pruned, and no truncation. Selected reports exclude the synthetic
prompt/effect/secret canaries and fixture root; provider payloads are deterministic boundary doubles.
Denial failure observations reflect the intentionally rejected action and are independently checked
against no file effect and rejected approval state. No paid provider/GitHub calls were made.

**GR-D01 / `agent-platform-9wqs`:** the restarted report honestly retains
`unfinishedPriorProcess:true`. Earlier approval waiting/started operation IDs are not terminally
reconciled with the new run/operation used by resume (`linkedRunId`). The critic verified these
unchanged producer/report semantics. Saved messages, final decisions, successful/denied audit rows and file effects prove actual effect
settlement and no replay. Two earlier approval-stage audit rows remain pending too; not every
historical audit or diagnostic operation is terminal.
A separate discovered-from Beads bug records the bounded follow-up. Preserve the warning; this is
not evidence of d185 event loss or a reason to expand this fix into an observability redesign.

Final local diagnostic review at runtime `b0b05939` plus the reviewed verification tree repeats these
observations in `managed-safe-diagnostics-review.json`; all five fresh reports have the same event
counts and health flags, and the restart warning remains visible. The exact verification commit and
source hashes are bound in the publication and delivery receipts. Hosted checks, owner-authorized feature merge, complete mirrors and task closure remain
pending; no staging readiness or distribution qualification is claimed.
