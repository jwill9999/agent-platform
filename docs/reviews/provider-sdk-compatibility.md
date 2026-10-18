# Provider SDK compatibility review and results

Status: 18 October 2026. The initial normal push passed. The hosted-finding repair push stopped on an active Git fixture ledger read; its reviewed test-only framing repair is being qualified before a new normal push and fresh hosted checks.
No hosted qualification, integration, owner-app rebuild or stress readiness is claimed.
[Plan](../planning/provider-sdk-compatibility.md),
[verification](../testing/provider-sdk-compatibility.md).

Evidence root: `/Users/letuscode/.codex/provider-sdk-20261018`; source base staging `ece78d8a`.
Qualified provider protocol/generation checks below use researched owned HTTP fixtures and the actual pinned SDKs.
It does not establish live model availability, account permissions or generation quality. The owner
app/profile remains unchanged; paused orchestration, main and the disabled Docker gateway are preserved.

## Current qualification

Full ordinary-suite counts bind5d157be9. Later repairs have the explicitly named affected slices
and connected evidence below; earlier browser/native artifacts retain their own source bindings.

| Area                                      | Actual evidence                                                                                                                                                                                                                         | Remaining gate                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Native providers                          | Router135, including83 HTTP protocol/privacy controls across eight adapters and five representative model IDs; browser43 passed                                                                                                         | Exact-head hosted qualification                                  |
| Private persistence/configuration         | Initial DB236/contracts166 plus20 focused/configAPI8; latest DB16 and API96 repair controls passed                                                                                                                                      | New normal hook and hosted qualification                         |
| Harness/private continuation              | Initial harness819/fullAPI574; latest harness67/API96 plus SDK browser/native repairs passed                                                                                                                                            | New normal hook and hosted regressions                           |
| Existing chat API fixture migration       | Original40 retained as39 mocked plus one actual SDK HTTP case; full574 passed initially, latest mixed96 passed                                                                                                                          | New normal hook and hosted API regression                        |
| Web public message/configuration contract | Prior web431/browser43; fresh SDK browser1 across all8 adapters passed after helper repair                                                                                                                                              | Hosted regressions                                               |
| Durable probe diagnostics                 | Actual SDK/API/SQLite/export/restart cases passed; diagnostic source and artifact review approved                                                                                                                                       | Hosted gates and later owner-app preflight                       |
| Native desktop journeys                   | Prior68pass/4fail plus focused repairs give72 unique passing scenarios across runs. Latest two SDK cases passed on repaired source                                                                                                      | Fresh full hosted suite; no clean single-run72 claim             |
| Build/static quality and hooks            | Initial5d157be9:3,868 ordinary tests/77 existing optional skips and900/990 benchmark passed. Latest hosted-finding repairs:314 affected tests,97 CI Node controls and3 connected cases passed; affected builds/types/lint/format passed | Normal push and fresh exact-head hosted gates on repaired source |

The native journeys exercise saved configurations, honest failed probes, OpenRouter recovery, durable
exports and native Save As. The tool journey verifies a valid pre-restart approval and exactly one
file effect, encrypted replay, a new request from completed history after a real restart, denied work
without effects, and pending-process restart rejection409 with no new provider/audit/file effects.
Both shutdowns fulfilled and private/synthetic markers were absent from public outputs and reports.
The subsequent test-only refinements require the final evidence to bind each source accurately. The final follow-up runs below supersede these earlier pending states.

## Independent review and finding dispositions

Read-only review is a procedural responsibility, not technical inherited-tool isolation. The critic
inspected source/evidence and recomputed hashes; a review does not imply an independent rerun.

- SDK-P01–P03: baseline private-continuation loss, unsupported max_tokens serialization/false-success
  probes and incomplete provider/configuration coverage informed the approved contract. The new
  implementation uses actual SDK Responses, encrypted bound history and the backend catalogue.
  Original owner-app failures remain retained; an unchanged older app build is not repaired by tests.
- SDK-P04/P05: independent plan critique required a stable internal ID/required-format marker and
  awaited atomic pre-effect persistence, plus safe errors across stream/retry/plugin/public sinks.
  The corrected plan was approved before production edits; `plan-review.json` binds that review.
- SDK-RV01–04: system-message handling, representative signed/encrypted replay, unsafe default stream
  logging and OpenRouter402 quota classification were repaired and independently approved against
  the135-test router source. See `router-review-repairs-source-and-qualification.json`.
- SDK-HV01–04: public reasoning exclusion, locked configuration/binding freshness, Google signature
  semantics and OpenRouter signed/encrypted detail validation were repaired and reviewed.
- SDK-I01: the original native test incorrectly expected a pending approval to resume after a real
  process restart. Existing Stop correctly interrupts those runs. The reviewed S06/S09/Gherkin
  correction tests valid approval before restart, completed-history replay afterward and stale denial.
  Same-process database reopening is explicitly distinguished from process restart.
- SDK-I02/I03/I04: committed-prefix checkpoints preserve later partial replies without duplication;
  completed tool outcomes persist before another model request; legacy Project messages receive
  stable IDs before sanitizer cloning; required opaque or bound-tool output requires awaited
  persistence, while plain keyless local text works without a master key. All are independently
  approved in manifest `fa4fa298b8747c5ffdcb391d2f8425b1abfb642398048db4317367b02ee4bd37`.
  The critic recomputed all owned source and raw-log digests; see `expanded-harness-independent-review.json`.
- SDK-QA01/02: fixture setup cleanup ownership and evidence naming before final cleanup/privacy
  validation were tightened. Final Playwright success, cleanup and privacy facts are required;
  an earlier scenario-only boolean alone is not qualification. Final broad and focused QA results are recorded below.

## Retained failures and detection gaps

The original SDK4 path sent unsupported max_tokens for the owner's selected model and classified
that rejection as connection success. Existing mostly compatible/custom-node tests did not exercise
the native serializer, and handled probe failures lacked durable diagnostics and accessible details.
The new actual-SDK protocol tests, safe probe events and connected visible-error/report checks address
those detection gaps without claiming that authentication or startup proves live generation readiness.

Initial new API-test escape: the built external SDK bypassed a source-level vi.mock and a dummy-key
request produced public MODEL_AUTH_FAILED. Upstream401 was inferred, not separately captured on the
wire. No owner credential or successful generation was involved. The replacement selects an owned
loopback Ollama configuration, asserts exactly one request and preserves existing assertions.
`api-session-generation-boundary-readonly.json` records the subsequent source audit; inherited provider
credentials and default endpoint/provider overrides are unset for broader qualification.

Original native-first/third/fourth/fifth traces remain retained: initialization admission, logical
versus execution run IDs, restored-history reply counts and expected interrupted state were test
fixture errors. The fourth trace shows Send disabled before Enter and the draft retained afterward;
no admitted-send loss was confirmed. The helper now waits for enabled Send, an actual chat POST and
independent request counts. This fixes false-positive completion risk without weakening product guards.
Native-second retains the invalid old pending-restart expectation. Old harness38 failures from mocks
missing canonical SDK7 responseMessages are also retained; producers were migrated to the actual
contract, without production fallbacks, waived assertions, retries or increased deadlines.

## Outstanding delivery and readiness

The initial full affected suites, unchanged900-measurement/990-call benchmark and normal hooks
passed at5d157be9. Subsequent reviewed hosted-finding repairs have the affected and connected
qualification below; their normal push and fresh exact-head hosted quality/security/reviews remain
outstanding. Earlier broad connected results retain their explicit source bindings.
Protected staging still needs actual authority, full ordinary analysis and packaged macOS VM gates.
Owner stress readiness additionally needs a tested rebuilt app with preserved profile/DB/key and an
owner-run or separately authorized real usable model request. No new paid calls are authorized.

Draft audit is7distinctGHSAs (2high/5moderate; metadata8instances), versus staged11. Four SDK-owned
IDs are absent from this draft; delivery and security-task reconciliation remain separate. No zero-debt
claim or unrelated LangChain/paused-runtime repair is implied. Beads tasks remain in_progress.

## Broader regression findings and current repaired runtime

The new browser SDK journey passed all eight adapters through saved configuration, probes and real
selected Project chat streams without retries. Broader browser coverage reached40/43 passing cases
on the preceding runtime. The remaining three Git chat cases exposed SDK-I05: the factory combines
builtin system definitions with identical assigned registry copies, and the new name map rejected
those canonical duplicates before provider traffic. This was a product regression, not a fixture error.

The source-approved repair coalesces only an identical original ID, description and deep-equal
effective strict schema. Distinct IDs colliding after sanitization and conflicting same-ID definitions
remain rejected before provider traffic in either order. Real SQLite/factory controls reproduce the
Git registry boundary and verify one provider/schema/reverse identity. Frozen runtime
`1d291edd8790a9795034069515bcb1fda734a0e2d4850a4cfddb97f31e410a5a` passed819 harness
tests and90 API cases. The latter include all49 Git assertions with a fixture-owned random master
key and exact finally-protected restoration; no-master text/denial controls remain intact. The native
Make/desktop already supplies this durable-binding key. No suite-global test key or product default
was introduced. Manifest `1788e738e73d9cbb3d120555f6f1b0d6bf7a1d129c272d34f848e749baf09baa`
binds the latest source and evidence. Earlier819 source proofs do not imply rebuilt connected success.

The existing browser/native context-budget helpers reconstructed SDK4 args/result fields and tried
to parse the intentionally wrapped tool text as JSON. They now independently reconstruct SDK7 input
and text output, counting the complete untrusted wrapper. Both helpers agree on five retained wire
requests:9652/9785/9901/10173/9688 estimated tokens under the unchanged12600 limit. Eight negative
controls preserve pairing, shape, cap and overflow rejection. The repaired browser case passed retry0
in10seconds; all output2048/outside-root deny/recovery assertions remain. Fresh current-runtime browser43/43 passed without retries or skips after the Git repair.
The broad native attempt finished 68 passed/four failed; the reviewed, source-bound focused qualifications below address all four. Original failures are retained.

Browser test setup also needed its existing required agent limits and exact model option names.
An existing seeded E2E rate max1000 had been written after API startup, leaving the running default100
in force; real429 traces identified that mismatch. Restarting only the owned API loaded the existing
seeded1000/60s value, verified by live headers. No production policy or test deadline changed. One
fourth-attempt output was overwritten by a runner continuation after failed preflight; that raw
artifact gap is disclosed, with the retained third429 trace and transcript-derived facts distinguished.
The runner now rejects existing output paths and dependent steps stop on failed preflight.

Docker Git diagnostic export correctly returned403 under its unsupported split-network topology.
Those cleaned failed sessions have no later native report: UI traces, empty provider ledgers and API
logs establish the pre-provider failure. This coverage gap is explicit; separate native SDK failure
and waiting reports provide the diagnostic checkpoint, rather than inventing an export.

## Final connected qualification checkpoint

Browser43/43 passed with zero retries/skips on the rebuilt SDK-I05 runtime: phase1 covered33 cases,
including all eight provider configurations/probes/selected chat streams and the context budget; phase2
covered10 Git and Stop cases. The image proof compares eleven actual image source/dist/lock hashes
with the host, including runtime llmReason1d291edd.
`connected-final-browser-qualification.json` binds the two raw runs, source and images. These are
researched emulated providers, not live paid model calls.

The broad native run completed in 12.4 minutes: 68 passed/four failed, with retries disabled. Both new
SDK cases passed (10.8 and 14.8 seconds). The two command-based MCP cases passed in 18.8 seconds
when invoked from the standard `apps/desktop` directory; the original root-directory invocation
resolved their relative fixture path incorrectly. No MCP source, deadline or assertion changed.
The remaining two failures were existing test assumptions: the intentional additive continuation
column changed a retained-row snapshot, and a partial Model label also matched the new accessible
Back to models button. The reviewed corrections retain all historical fields and exact migration
prefix, verify the new default-zero column/table plus SQL hashes/timestamps, and select the exact
Model input. The inconsistent-history negative test is byte-identical.

After applying those test corrections and SDK-UX01 below, both MIG-R06 cases and the complete
settings/Project/restart scenario passed: three tests, zero retries/skips, 21.7 seconds. Therefore all
72 unique desktop scenarios have passing evidence across the broad and focused runs. This is not
a claim that the original single broad run was clean or that its 43 browser/72 desktop cases ran on
post-UX bytes. `connected-qa-pre-ux-final.json` binds that earlier runtime and both native SDK cases;
`parent-final-terminal-results.json` binds the final focused follow-up.

SDK-UX01 corrects misleading same-chat recovery guidance and projects only typed storage errors or
an exact local guard allowlist to fixed `PROVIDER_CONTINUATION_UNAVAILABLE` NDJSON with new-chat
and existing-private-settings guidance. Authentication, changed configuration and Stop keep their
existing semantics. No persistence, provider parameter, dispatch or limit changed. Exact parsed
NDJSON objects, privacy and no-effect assertions passed in all 41 context API cases; the 67 affected
harness cases, rebuilt harness/API, lint and types also passed. Independent review approved both the
proposal and its strengthened exact-object assertions. Fresh full hosted checks remain required.

Independent evidence review recomputed all seven pre-UX artifact digests and fourteen source/dist
bindings in each native SDK evaluation, and fully read 1,219 members across five trace ZIPs without
corruption. Failed-probe events retain the same identities after restart with verified durable
coverage and zero pending/drop/conflict. Exactly one approved effect, denied no-effect, encrypted
one-to-three-row continuation growth, completed-history replay and interrupted-approval rejection409
were verified. `unfinishedPriorProcess=true` honestly records the interrupted run. This confirms
emulated application behavior, not live account access, model quality or owner-app readiness.

## Normal hook finding: shared metadata cycle

The first SDK commit is `b533f0f4`. Its normal push stopped before package tests because Madge found
source and generated-declaration cycles between `types` and `providerContinuation`; nothing was
pushed. The retained `first-sdk-push.log` is the actual failure evidence. A reviewed leaf module now
owns the same single continuation Symbol and metadata type. Both consumers import that leaf, and
the helper re-exports its previous type without exporting the Symbol from the package index.
Guards, encrypted persistence, serialization, limits and public behavior are unchanged.

Rebuilt declarations, harness/API typechecks, lint and all 67 affected private/node cases pass.
The actual cycle check now passes with no circular dependencies (93 unresolved-module warnings
remain disclosed in its log). Earlier broad connected evidence remains bound to its earlier source;
this mechanical module move does not establish a new broad run. Normal hooks must still execute
fully on the follow-up commit, with a fresh benchmark and hosted qualification.

## Supported Vitest 4 worker configuration

The second normal push at `700ca012` reached all affected builds/types and package tests, then stopped
on six unchanged workflow-control timing/reservation cases: 1,135 passed, six failed and 77 existing
optional skips. It did not reach the ordinary API suite or benchmark. The full raw log is retained;
these failures are not waived and do not establish a product root cause.

Installed Vitest 4.1.12 reads `VITEST_MAX_WORKERS`, while the former MAX_FORKS/MIN_FORKS variables
are absent from its installed JavaScript. A config-only probe using the real package configuration
resolved maxWorkers as unset with the old variables and exactly1 with `VITEST_MAX_WORKERS=1`;
no tests or prototype runs were executed by that probe. See `vitest4-single-worker-config-proof.json`.
The next normal push uses this supported command-scoped setting, preserving all hooks, test bodies,
assertions, deadlines and filters. CI already specifies one worker explicitly. No global setting,
paused test/runtime or hook source changed. Independent review approved the bounded requalification;
parallel execution is a supported cause to investigate, not proof it alone explains every failure.

## Full normal-hook API boundary follow-up

The third normal push at `4dfba18f`, using supported `VITEST_MAX_WORKERS=1`, passed every
non-API package: workflow1,141 with77 existing optional skips, harness819, DB236, web431,
desktop229, router135 and contracts166. Its ordinary API suite finished566passed/8failed
across55files; the fresh benchmark was not reached. The original full log and terminal receipt
are retained. No SDK refs were uploaded and no PR or final qualification is implied.

Five Stop/resume cases reached exactly one owned provider request and then failed before approval
because their real bound-tool fixture omitted the now-required private-storage master key. An
independently approved per-test synthetic random key preserves every behavioral assertion and the
existing cleanup. All five cases plus41 separate missing-master/private-storage context controls
passed (46total/9.51seconds), with no inherited credentials or master key. Production guards,
exactly-once effects, Stop fences and the no-master denial controls remain unchanged.

The saved-config unit fixture also exposed a shared-module-cache boundary: API tests use
`isolate:false`, so a production router cached before its mock retains a different SDK binding.
A preload reproduction retained both failures; the reviewed hoisted reset/shared mock fixes that
boundary. Teardown unmocks and resets the cached router for later real-SDK tests. Each unit case
now rejects any attempted fetch and restores the exact original fetch/master setting before DB
cleanup. Standalone8, preloaded8 and forced unit-to-real-SDK10 passed; the final restoration-order
change is a separately reviewed cleanup-only delta qualified by the mixed run below.

The actual chat HTTP case also passed alone but failed after the context fixtures before any
provider transport (zero owned or foreign calls). Its real-SDK case now lives in a dedicated clean
integration module, with explicit saved loopback configuration and one-owned/zero-foreign fetch
assertions. Semantic AST review confirms the other39 mocked chat test bodies are unchanged and the
moved case retains its original SSE, pending approval, persisted assistant history and zero-effect
assertions. A forced mixed sequence of context41, mocked chat39, real HTTP1, saved-config8,
actual diagnostic2 and Stop/resume5 passed all96 cases in13.31seconds, without retries or skips.
The source, exact module-cache direction reproductions and original failures remain retained.
No production, paused-work, deadline or behavioral assertion changed in these repairs. At this
prior checkpoint the full hook and fresh benchmark remained pending; the final qualification below
supersedes that pending state. Isolated passing slices alone do not establish final delivery or a
usable owner app.

SDK-CONTRACT01 reconciles Beads acceptance with approved planR4/R6: accessible safe errors are
visible in the app; response headers and durable exportable reports carry request/operation
correlation. A visible UUID field was not an approved requirement and is not claimed as delivered.
The critic approved this wording clarification, with no runtime change. The owner stress-review
record remains open and now explicitly depends on provider interoperability; older startup-ready
notes do not establish usable model generation or stress readiness for the unchanged owner build.

## Full local hook qualification before hosted findings

Commit `5d157be969bfff01fb2cc5c205a719f0844b1ca5` passed the normal commit and push hooks.
All affected builds/types and3,868 ordinary tests passed, including the complete574-case/56-file
API suite, harness819, DB236 and all1,141 workflow cases;77 existing optional workflow skips remain.
The four reviewed API fixture files were frozen throughout, and exact remote task/feature refs read
back successfully. `fourth-sdk-normal-hook-qualification.json` binds the source, log and counts.

The unchanged fresh-process performance suite passed all nine vectors:900 measured requests,
990 deterministic fixture calls including warmups. Independent raw-window p95 recomputation found
maximum positive request overhead10.692751ms, below the unchanged20ms limit; enqueue p95 stayed
below2ms and the queue ceiling remained256. Healthy mode lost no events; locked-store drops are
intentional coverage, not healthy success. Source bytes match protected staging's original benchmark.
See `fourth-push-benchmark.json` and `fourth-push-benchmark-verified.json`. This measures that workload;
it does not claim owner stress testing or live-provider compatibility.

At that checkpoint only results and current handoff changed after the passing source. The hosted
findings below subsequently required reviewed source repairs. Fresh exact-head hosted checks,
security findings and comments remain mandatory. Protected full analysis and packaged macOS VM
qualification belong to any later staging promotion. The owner's running older app/profile remains
untouched, so owner-app rebuild/preflight and stress readiness are not claimed.

## Hosted Sonar and Git fixture follow-up

PR362 at `946e4735` reported16 actual open Sonar issues, including three critical complexity
findings, and failed its security-rating condition. These were not waived even though other rating,
duplication and hotspot conditions passed. Seven bounded repairs extract equivalent DB credential,
endpoint and private-continuation branches, keep safe probe error classifications, and replace two
unnecessarily async callbacks with synchronous Promise executors. Their SQLite work still runs
synchronously, thrown failures still reject, and the caller still awaits persistence before effects.
The test helpers now use fixed absolute Docker/node executables and fixed child PATHs, typed safe
error fallback, a byte-identical String.raw runner, anchored numeric latency and equivalent native
credential branches. No rules, suppressions, limits, validation, paused code or product deadlines changed.

The reviewed source passed314 affected tests: DB16, router135, harness67 and API96, plus affected
builds/types/lint/format. Fresh connected checks passed the browser SDK journey across all eight
adapters (one case/10.5seconds) and both native SDK cases (40.1seconds), retry0/skip0. The native
reports retain the same four failed-probe IDs after restart, verified durable coverage with no
pending/drop/conflict, encrypted private rows1to3 without plaintext/invalid rows, one approved effect,
and no new effects for denial or interrupted409. The deliberately interrupted prior process remains
visible as unfinished coverage. Both shutdowns fulfilled; only owned disposable services stopped.
`sonar-helper-qualification.json` binds seven source hashes,13 image bindings,14 native source/dist
bindings per case and28 artifact digests. Independent critique read the ZIP members and verified these
facts; the later Git fixture test-only delta does not change that runtime evidence.

The separate hosted verify failure occurred before the ordinary suite/benchmark in an existing
Git Node fixture still using SDK4 parameters/args/result fields. Its SDK7 inputSchema/input/typed
JSON output adaptation retains fragmented quoted/newline arguments, explicit absence of provider
execution, both finish reasons, two requests and no errors. Canonical SDK response messages carry
continuation; an added wire assertion checks the exact tool-result value. The failure is retained in
`pr362-946-verify-job.log`. Detection scope matters: the ordinary Vitest push hook does not include
these separately required CI Node commands. All relevant CI-only controls now pass locally:
Git22, Stop3, diagnostic/monitoring/hook67, and the already-qualified provider protocol5, total97,
without failure/cancellation/skip. `ci-node-followup-terminal.json` and raw logs retain the commands.

All eight changed source files received independent review. These passing local controls do not clear
the old hosted failure: the next normal push, fresh benchmark and new exact-head hosted Sonar/checks
remain required. The45-row Dependency Review gate on946 was independently qualified, with no introduced
advisories, but must bind the later head normally. Sourcery declined that diff because it exceeds
150,000 characters; that is a review limitation, not a weekly-budget skip or an independent approval.
No live model/account, owner-app rebuild, stress readiness, integration or merge authority is inferred.

## Active-ledger fixture follow-up

The normal push at local `0e518068` stopped before upload and the fresh benchmark. Router135,
DB236 and harness819 passed; the ordinary API suite passed573 cases and failed one Git read-origin
case. Its active ledger reader used trim/split/JSON.parse while a child could be appending, so an
empty file or unterminated record could throw. The historical ledger bytes were not retained;
which transient state occurred and its operating-system cause remain unproven. The original log
also records a pending fetch rejection during teardown; neither failure is hidden by a retry.

The independently approved test-only repair parses complete newline-terminated records and leaves
an incomplete tail for the next existing poll. Complete malformed JSON, blank records and wrong
record shapes still fail. Held requests receive immediate rejection observation while the original
Promise identity and awaited rejection remain unchanged. All original integration assertions,
origin-change checks and deadlines are preserved. Seven deterministic controls cover framing
transitions and rejection identity. All33 focused cases passed without unhandled rejection, skip
or retry in52.43seconds; lint, formatting and diff checks passed. The original26 integration cases
and their deadlines remain intact. Normal hooks and fresh hosted qualification remain outstanding. No application or paused source changed. The earlier connected source evidence
remains bound to its runtime; fresh hosted qualification must still use the final pushed head.

The earlier946 hosted Electron job reports71 passed and one flaky case, despite its successful job
conclusion: the direct-write permission-policy journey timed out at60seconds before passing on retry.
Its report/trace review is still in progress. That result is not a clean72-case qualification and
cannot qualify the later repair head. The original failure remains retained; no test deadline,
retry policy or application behavior is changed on that evidence alone.
