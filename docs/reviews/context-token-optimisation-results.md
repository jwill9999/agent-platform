# Context/token MVP — implementation and verification results

**Task:** `agent-platform-context-optimisation`.
**Status:** Connected MVP journeys and the approved default passed local and hosted verification at `38244723`; final test-only coverage additions pass locally and await their own exact-head hosted qualification.
**Source:** Runtime checkpoint `b4559f7c037558b89f5833890006b5a4a866963a`, based on approved plan
`294a52c8d877038164f636e06208625871888214` and staging `d199ad01`.

See the [plan](../planning/context-token-optimisation-mvp.md),
[specification](../tasks/agent-platform-context-optimisation.md) and
[verification map](../testing/context-token-optimisation-mvp.md). Beads owns task status.

## Implemented boundary

Conversational reasoning admits the complete mapped messages and tool schemas before each provider
operation, including tool iterations and approval continuation. Its provider projection preserves
required current-turn groups and scoped working memory while the persistence state retains original
history. Retries reuse the admitted payload and separate output cap. Local rejection occurs before
a provider attempt; length-limited responses retain partial text but cannot dispatch partial tools.

V1 diagnostics carry bounded context decisions and distinguish estimates from provider usage and
local admission from actual model attempts. The implementation introduces no summary-model calls,
new storage backend, dashboard, account, paid-call requirement or automatic diagnostic sharing.
Auxiliary model callers listed in the plan remain outside this boundary.

## Approved default adjustment

The owner approved16,000 estimated input tokens for absent/new settings on13October. The previous
8,000 default admitted only7,200 after the framing margin; required seeded Personal/Coding payloads
measured at least8,353/8,374 including all56 tool schemas. Output2048 and10%margin remain unchanged.
The change preserves all explicit saved limits, including8000, and adds no migration or tool removal.
Users must still configure input plus output within the selected provider/model capacity. Existing
saved limits that cannot fit instructions/tools require an explicit configuration change.

Saved-value tests pass across contract parsing, raw SQLite reopen/reseed and API create/update/copy.
A test exposed the API validator's separate8,000 partial-settings default; its OpenAPI schema is aligned
with16,000 and explicitly describes the existing output allowance. An explicit saved8,000 request
still fails admission before provider/effects and remains8,000 after reopen. Fresh Personal/Coding profiles now pass real desktop read-and-reply journeys without agent budget
overrides. Both retain all56 mapped schemas and show input16,000/effective14,400/output2,048 in V1
reports. Independent wire estimates are9,036/9,208 for Personal and9,057/9,229 for Coding. Their reports
are durable and verified, untruncated, with zero loss counters. Earlier14,000 adversarial fixtures
remain evidence for long-history and overflow behavior, separately from these default journeys.
`default-profile-footprint.json` retains the original measurement and failures. The final focused
set passes33 tests (contracts9, DB2, API22), with source/log hashes in
`default16000-source-receipt.json`. Actual native reports and per-run source are bound in
`electron-default-final-receipt.json`; its OpenAPI hash is explicitly observed after execution, not
misrepresented as a run-start capture. No live-model capacity or performance SLO is inferred.
The unchanged19-case desktop permission/effect regression also passes in1.8minutes, including
approval, rejection, reload, transient retry, Ask/Auto/Block and revocation. Its local VM bridge and
node doubles are disclosed; this is not an actual packaged macOS VM qualification.

## Source review

Independent critic `runner_plan_critic` approved the 13 runtime files at the checkpoint, with no
outstanding source findings. The sorted path/hash manifest has SHA-256
`96db83c6b7a7585c76632891f8c1f3d64ce737d5c937fc50c6f8e6067078bc4f`.
Earlier CP01/CP02 findings were fixed: only exact same-session durable approval provenance can
justify omitting an older pending group or pairing a delayed actual result in the provider view.
Missing siblings, foreign proofs, duplicate identities and malformed current groups fail closed.
Raw history, approved arguments and completed effects are preserved.

Six implementation documents also passed independent checkpoint critique. A separate fixture-only
IPv4 listener repair in `projectsRouter.test.ts` was approved at SHA-256
`fffa8ac3094396254e5a42b0502c3015299b8c37b8e4488450a7d7eef34dee56`.
Review assignments were read-only responsibilities; they do not attest technical tool isolation.
Source review is not connected or hosted acceptance.

Verification critique VQ01 identified missing independent budget and tool-pair assertions on captured
browser requests. The repaired test reconstructs the installed SDK wire representation without
importing the production estimator. All five requests passed the strengthened journey; negative
controls reject missing, unmatched or duplicate results and oversized input. The estimates were
9,038, 9,165, 9,281, 9,540 and 9,074 against an effective 12,600 limit, with output cap2,048.
`browser-context-vq01-source-receipt.json` binds the reviewed source and fresh run. These remain
approximate input estimates, not provider-reported token usage.

## Final acceptance coverage and hosted checkpoint

The approved default checkpoint `38244723e9cbd9d401b52f2277f22a39bfeaf7a0` passed all nine
executed hosted checks. CI run38346783169 includes34 desktop end-to-end tests in5.6minutes,
plus build/verification, Docker and browser end-to-end success. Documentation, cycles, secret
scanning and Sonar succeeded; direct Sonar inspection returned zero open issues. There were no
unresolved review threads or blocking reviews. Sourcery skipped this cumulative diff because it
exceeded150,000characters; independent source and evidence reviews supply the recorded review.
The feature-targeted packaged staging VM job was skipped and supplies no staging qualification.
No open CodeQL records were returned for this PR ref; that does not claim a feature CodeQL run.

The final acceptance-map audit added two test-only controls:

- CT-T04 composes the actual graph, critic and reasoning nodes. Oversized revision feedback stays
  in history but fails the second admission before another provider attempt or tool effect.
- CT-T08 persists and reloads a stale working-memory permission claim, verifies it reaches model
  context, then proves the actual Ask/Block policy still controls execution. Both cases have zero
  effects and persisted pending/denied audit records.

The focused suites passed14 harness and24 API tests, with scoped lint/format checks.
`ct-coverage-cq01-cq02-receipt.json` binds frozen sources and passing logs; earlier fixture failures
remain retained. Deterministic evaluator/SDK boundaries are disclosed. These tests add acceptance
coverage without production changes, and require a fresh hosted run after publication. Current-head
check and publication receipts are tracked in Beads and PR309 rather than treating the earlier green
checkpoint as qualification for later commits.

## Executed checks

Evidence is retained under `/Users/letuscode/.codex/context-token-plan-20261013` on the test host.
Logs and receipts bind the actual source and distinguish partial attempts from qualifying results.

| Check                                     | Observed result and limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full build and ESLint                     | Passed on the reviewed runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Harness                                   | 707 tests passed; focused approval/projection/serializer repair set passed 38 tests.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Contracts and diagnostic projection       | Contract suite107 passed; focused strict contracts, SQLite observation and CLI tests passed42.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| API context and existing chat regressions | 56 tests passed, including new17 context-admission cases and existing39 session-chat cases.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Other workspace suites                    | DB122, desktop153, MCP adapter41, agent validation8, web209, plugin SDK5, planner11, plugin observability14 and plugin session8 passed. Logger10 and model router47 also passed.                                                                                                                                                                                                                                                                                                                                  |
| Initial root regression                   | Two unchanged workflow-control tests failed under concurrent test load; original failures retained. A focused98-test recheck passed without source or timeout changes. The normal pre-push full affected regression then passed: 1,141 workflow-control tests, with 77 existing optional skips and no test/timeout changes.                                                                                                                                                                                       |
| Initial full API                          | Retry fixture rejected before provider because its seeded tool inventory exceeded the default; fixture now explicitly configures100,000 through the real agent API and verifies admission before its three-attempt assertion. Production defaults unchanged.                                                                                                                                                                                                                                                      |
| Diagnostic performance                    | Original thresholds passed in an isolated run: largest differential7.13ms against20ms; maximum enqueue0.0202ms against2ms. Three mode-order repetitions,100 measured requests per mode, intact healthy events and disclosed locked-writer losses. This measures existing diagnostics overhead, not estimator latency or live-provider performance.                                                                                                                                                                |
| Subsequent full API                       | 244 passed, two unrelated Project setup requests returned unexpected404/401. Retry and performance passed. Explicit IPv4 test-listener repair passed three focused cases, then the full API suite passed 247 tests across 32 files. That full run also passed the original performance limits (maximum differential 0.898 ms, enqueue p95 0.0072 ms). Exact original 404/401 cause remains unproven.                                                                                                              |
| Markdown and documentation formatting     | All seven changed documents passed direct Markdown and explicit formatting at7526cd3a. Full repository formatting passed after VQ01 formatting repair. Seven full Notion bodies/revisions/hashes/destinations were read back at that pushed checkpoint; later substantive changes require refresh.                                                                                                                                                                                                                |
| Connected browser                         | Passed the strengthened combined Docker UI/BFF/API/SQLite journey in 12.4 seconds; the subsequent provider-fixture quality refactor also passed a fresh11.0-second journey. All five captured requests retained 56 tool schemas, complete tool groups and estimates below 12,600. Long history, actual read, two path denials, overflow without a provider call and recovery passed on the disclosed mount.                                                                                                       |
| Connected Electron                        | All three configured-budget journeys passed across retained runs: long history8.0s, overflow/recovery8.5s and Ask/restart/replay9.7s. Five real native diagnostic exports passed. Per-run helper hashes differ only by the reviewed renderer readiness repair; runtime hashes agree.                                                                                                                                                                                                                              |
| Hosted/Sonar/CodeQL                       | Draft PR309 at808dc301 passed docs/cycles/secrets and the Sonar gate; direct API inspection still found one redundant String.raw issue, repaired with byte-equivalence proof. Source3cdf hosted desktop failed17/32; all15 existing failures were default-budget rejection, with two new fixture readiness failures. Exact final-head CI remains required. No open CodeQL records were returned on the PR ref; this does not establish that CodeQL analysis executed. Local IDE Problems integration unavailable. |

## Connected findings and diagnostic checkpoint

The provider double is a deterministic loopback OpenAI-compatible protocol endpoint using synthetic
credentials. API, BFF, SQLite, session locks, permissions and selected file operations are real.
It proves request construction and app behavior, not model answer quality, exact tokenization,
billing or provider TPM guarantees. No external model call is required or claimed.

Initial connected attempts exposed fixture setup mistakes involving session restoration, virtual
Project paths, model selection and a pending-approval composer assertion. Tests retain expected
visible results and independent DB/audit/effect assertions while correcting those prerequisites.
Independently inspected pre-existing product findings are recorded for separate follow-up:

- `agent-platform-est0`: keyless Ollama configurations can be saved and displayed but explicit
  per-request selection is rejected before provider invocation. Current test configurations use an
  encrypted synthetic key; no production credential policy changed.
- `agent-platform-sizx`: session-history restoration can replace an active streaming placeholder,
  hiding a response that is stored successfully. The relevant web hook and BFF are unchanged from
  staging. Tests select the intended saved session and wait for restored history before submission;
  this does not fix or dismiss the separate restoration race.

- `agent-platform-lnbn`: repeated path translation maps a host Project root nested beneath the
  virtual `/workspace` namespace twice. The original Docker reproduction fails its real read.
  The critic approved a nonoverlapping `/context-projects` test mount with real canary reads,
  audit/effect checks and outside-Project denial. That layout does not repair or qualify the
  overlapping-namespace behavior; no PathJail or permission implementation changed.

The earlier native export failure is retained, not relabelled as a pass. Long9 observed native
HTTP503 and only two persisted ingress events, with no session events. Source-backed investigation
found that the disposable Project inherited this checkout's Git root and real GitHub remote.
Synchronous GitHub check retrieval took1.47–5.35seconds in captured requests; local Git status/diff
alone took62–73ms. Delayed worker acknowledgements were plausible, not a proven sole cause.
`agent-platform-d185` tracks investigation of API responsiveness during GitHub check retrieval.

The corrected disposable Project has its own local Git repository and no remote. Canonical Git,
minimal environment, disabled hooks/signing and exact root/branch/remotes assertions are fixture-only.
Long10 then passed all original acceptance assertions and exported22 session events through the real
native Save As flow. The overflow/recovery journey passed with zero provider calls before rejection,
then a successful short request. Ask first performed one actual approved write and preserved the
expected downstream context halt, but encountered a restart navigation race. Waiting for the actual
initial renderer load repaired that fixture lifecycle; Ask2 passed restart and cached replay200,
with no repeated provider calls, tool effects, message rows or audit rows.

`electron-context-final-receipt.json` binds three passing evaluations, five actual native report
artifacts and every per-run source hash. Independent critique verified those hashes and report bodies.
Reports contain22/4/10/19/19 events: all durable and verified, untruncated, with zero dropped,
conflict, pruned and pending counts. The restart report preserves the same19 events and honestly
reports `unfinishedPriorProcess: true`, with `previousShutdownUnclean: false`. It does not claim that
the earlier run finished successfully. Success/failure context decisions explain admission,
windowing, recovery and the post-effect halt; model-attempt counts agree with captured provider calls.
Canary content and secrets are excluded from the exports.

Native fixtures use explicit input14,000; long/recovery output128 and a deliberate Ask output24,000
to carry complete synthetic tool arguments. Browser fixtures also explicitly configure budgets.
These results do not qualify the unchanged8,000 default. The first hosted desktop run38338322697
at3cdf tested GitHub mergea39be5f2: all15 existing test failures across both attempts show provider0,
audits0 and unchanged target files. Captured Coding configuration is8,000 input/2,048 output.
Five edit streams explicitly report `CONTEXT_BUDGET_EXCEEDED`; ten permission cases have failed
context admission and the corresponding budget banner. Those permission scenarios never reached
their intended effect boundary and therefore failed. The new long test timed out selecting its
model; Ask failed restart navigation after its approved write. Their local fixture corrections and
passing evidence do not substitute for a fresh full hosted run.
`pr309-first-desktop-classification.json` retains the full source/artifact classification.

The Docker API fixture lacks the private local-diagnostics capability; native exports provide the
required diagnostic evidence. A temporary stderr preload did not load and was removed. Blanket
Electron-main network isolation was not proven; the actual model fixture uses an explicit loopback
endpoint and synthetic key, with no paid calls. Selected source-built desktop journeys do not
establish release/distribution qualification.

The browser provider's Sonar complexity and nested-ternary findings were repaired through helpers;
twelve HTTP controls preserve old/new response and capture bytes and a fresh browser journey passes.
Native SQL uses `String.raw` only where escapes require it. The subsequent redundant raw tag on a
separate backslash-free probe was removed with exact792-byte generated-script equivalence. Scoped
lint, strict TypeScript and formatting pass. Independent final fixture review and actual new-head
hosted issue clearance are separate from the earlier green Sonar gate.

## Remaining delivery boundary

The implementation and approved16,000 default are pushed through `38244723`; all nine executed
hosted checks on that checkpoint passed. Configured-budget and fresh-default connected journeys,
actual diagnostic exports and independent source/evidence reviews pass. Final test-only acceptance
coverage passes locally; its publication/readbacks and exact-head hosted checks must finish before
owner acceptance. PR309 is open for review and unmerged; Beads remains `in_progress` through the
specified authorized feature integration. No feature/staging merge, distribution or paused
orchestration integration is authorized or claimed for this delivery.
