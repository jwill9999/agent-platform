# Context/token MVP — implementation and verification results

**Task:** `agent-platform-context-optimisation`.
**Status:** Configured-budget connected MVP journeys passed; default-budget decision and hosted qualification remain pending.
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

## Required default decision

The source still defaults to 8,000 estimated input tokens and 2,048 output tokens. Complete counting
exposes a feasibility conflict: migrated, seeded Personal assistant and Coding profiles require at
least 8,353 and 8,374 estimated input tokens respectively, including all 56 mapped system tools. The
8,000 setting permits only 7,200 after the agreed margin. These measurements exclude additional
Project instructions and working memory, so they are lower bounds.

The owner has been asked whether absent/new input defaults should become 16,000. Explicit stored
budgets would remain unchanged; input plus output must fit the selected model. No response or
approval is assumed. CT-T13 cannot be called complete while this decision remains unresolved.
Connected fixtures explicitly configure their budgets and do not prove the unmodified default is
usable. `default-profile-footprint.json` records the measurements.

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

Runtime b4559f7c and verification checkpoints through808dc301 are pushed. Normal pre-push affected
build, typecheck, cycles and tests passed, including API247 and workflow-control1141 with77 optional
skips. Configured-budget connected MVP tests and independent diagnostic evidence review now pass.
The default-input decision, CT-T13 default usability, final documentation publication/readbacks,
exact-head hosted checks and owner acceptance remain outstanding. Beads remains `in_progress`.
No feature merge, staging promotion, distribution or paused-orchestration integration has occurred.
