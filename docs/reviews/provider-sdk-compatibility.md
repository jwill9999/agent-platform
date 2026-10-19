# Provider SDK compatibility review and results

Status: 19 October 2026. PR362 merged at7b816c61 after qualifiedeca47820; protected PR363 remains blocked by CodeQL12 pending actual repaired-source delivery. Repair PR364 atb8cfddc1 passed normal API593 and fresh900/990 benchmark (maximum overhead2.534041ms), but its green Sonar check concealed nine actual open API findings. A semantics-preserving lazy-secret extraction and privacy-safe dedicated matcher follow-up is being qualified. No protected staging delivery, owner-app rebuild or stress readiness is claimed.
Earlier pending states below retain their named source/time bindings and do not override this checkpoint.
[Plan](../planning/provider-sdk-compatibility.md),
[verification](../testing/provider-sdk-compatibility.md).

Evidence root: `/Users/letuscode/.codex/provider-sdk-20261018`; source base staging `ece78d8a`.
Qualified provider protocol/generation checks below use researched owned HTTP fixtures and the actual pinned SDKs.
It does not establish live model availability, account permissions or generation quality. The owner
app/profile remains unchanged; paused orchestration, main and the disabled Docker gateway are preserved.

## Hosted review boundaries and follow-up

PR364 review found a real format-validation gap: Node's base64 decoder can ignore invalid characters
and still yield32bytes. The new fallback path must require canonical base64 before decoding; focused
adversarial controls include ignored characters, whitespace, padding aliases and invalid pad bits.
Review also found incomplete test log capture. The privacy fixture must cover all used console
channels, the configured structured-logger sink and owned-child output, with positive controls that
prove simulated leaks are detected. No key/revision value may be printed when those assertions fail.
Final local qualification passed63/63 across three files in16.48seconds, with no retries, skips or
unhandled failures; API build/types/lint/format pass. This includes20 binding controls,42 prior/context
cases and one actual fallback-approval process-restart case. The process case uses the real maintained
SDK against an owned loopback provider, zero saved configurations and the same valid master/model/
provider endpoint. It confirms an approved encrypted continuation, one pending/null-completion audit
and no file effect before the crash; a new API process marks the run interrupted/process_interrupted.
Resume returns409 RUN_NOT_RUNNING, with provider requests still exactly1 and encrypted history,
approval/resumedAt/claim/execution/audit rows unchanged. No new generation runtime was needed.

Retain initial fixture failures: expecting zero audit rows was incorrect because pending approval is
itself audited; the corrected assertion requires exactly one pending row and unchanged postrestart
state. A same-API-origin restart also hit ECONNRESET; each child now owns a fresh API port while the
provider endpoint/master/model remain identical. Its historical socket cause is unproven; no retry,
assertion or deadline was relaxed. Logs/compiled-source hashes bind the final63 case receipt
pr364-review-repair-source-and-qualification.json. A final notation-only0-9 to\d character-class
change retains that63-case receipt's original source binding;65,536 BMP memberships,262,144 pattern
substitutions and1,285 canonical cases prove equivalence. No underscore or non-ASCII digit is added.
Final normal hooks will compile and test the actual shorthand source. Actual hosted reviews/security
and all protected gates remain future at this dated checkpoint; later status belongs in Beads/PRs.

The restart warning is distinct from credential identity. The existing shared run-control service
creates a process identity and marks older active executions interrupted/outcome_unknown on startup;
resume checks that persisted authority before private-binding validation or approval claim. Stable
credential identity cannot bypass that fence. The actual fallback-specific SDK/API child-process
restart regression above proves409 with no new provider/audit/file or approval-claim effect.
Same-process SQLite reopen tests are not represented as process-restart evidence. No new orchestration
or execution-generation runtime is introduced unless a concrete regression requires it.

This MVP has one local API instance. Shut down/drain the old owner app before opening the upgraded
build. Prepatch weak fallback pending identities fail closed with new-request recovery; there is no
rolling mixed-version approval compatibility promise. Cross-worker resumable continuation requires
a valid configured master; masterless identity is process-local and supports the existing keyless
plaintext route. Multi-worker/rolling deployment support belongs to later distribution architecture,
not this repair. Existing Stop, secret/private persistence and tool-admission requirements still apply.

## Actual Sonar follow-up

Atb8cfddc1, Sonar reported gateOK/checkSUCCESS while its direct API returned nine open issues:
S1121 on a lazy assignment expression and S5906 on eight assertions. These are not waived by green
check status. The repair extracts purpose-secret selection into equivalent explicit statements,
retaining the exact domain/HMAC bytes and strict undefined versus invalid-present master handling.
Length matchers receive null projections of private bindings so failure output remains safe;
private-revision comparison stays boolean, while nonsecret PID comparison uses a direct matcher.
Focused tests, frozen source/document critique, normal hooks and new actual hosted zero-issue
qualification remain required. No assertion, timeout, scan, product deadline or benchmark limit is
weakened. Current outcomes belong in Beads/PRs rather than rewriting prior frozen evidence claims.

## Protected credential-binding correction

CodeQL alert12 on protected PR363 at7b816c61 found an unkeyed SHA256 over the fallback resolved
configuration, including a header/environment API credential. Saved-model configuration revisions
already use their encrypted envelope and remain separate. The actual finding is on the pull-request
head ref; an empty merge-ref alert query did not clear the failing check or unresolved thread.

The independently approved bounded design uses the credential as an HMAC key, with a fixed domain,
a private purpose secret and an explicit public provider/model/endpoint projection as message input.
It never serializes the credential-containing configuration into a hash message. The purpose secret
comes from a separately domain-separated existing validated master key, or a module-private random
secret when no master key is configured. Keyless identity uses a distinct domain/presence marker.
This is private credential identity, not password verification or a new credential store. A configured
invalid master fails closed. With a valid configured master, the same patched source/configuration
remains stable across restart; masterless identities are process-local and are not cross-process
continuation credentials. Changing any binding material changes its identity. Existing prepatch pending fallback identities
must fail closed with the normal new-request recovery; no weak backwards fallback is added.

Focused resolver tests passed52/52 in18.58seconds:42 context-admission cases, including denial of
legacy unkeyed private-binding replay, plus10 new fallback-identity controls. Three separate clean Node
processes with reopened disposable SQLite prove same-master identity stability and changed-master
separation through private IPC; this does not resume a pending approval after restart. The existing
restart interruption rule remains unchanged. Header/environment credential changes, public binding
fields, keyless undefined-master text and empty/malformed-present-master denial are covered. No
external model service is called by this focused boundary test. API build, types and scoped lint pass.
Logs are fallback-binding-api-build.log, fallback-binding-focused-first.log, fallback-binding-types.log
and fallback-binding-lint.log in the evidence root. A final test-only strengthening requires readable
success for every expected200 stream, exact private capture counts and all synthetic credential
privacy checks. Its10 cases passed7.31seconds on testSHA59acda32, with independent critique; the
prior combined52 receipt retains its earlier test bytes. This strengthening overlapped the first
bd04 push-hook checkpoint, so that mixed-worktree run is retained historically and does not establish
exact committed-test qualification. The final follow-up commit requires fresh normal full hooks and
benchmark, with no published amendment. The frozen source/test/doc review, normal hooks
and fresh exact-head hosted qualification remain pending at this local checkpoint. New actual
unsuppressed CodeQL checks, both head/merge alerts and all protected gates are mandatory. No old7b
scan or CI result qualifies the changed repair source; later status belongs in current Beads and PRs.

## Current qualification

Full ordinary-suite counts bind5d157be9. Later repairs have the explicitly named affected slices
and connected evidence below; earlier browser/native artifacts retain their own source bindings.

| Area                                      | Actual evidence                                                                                                                                                                                                                         | Remaining gate                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Native providers                          | Router135, including83 HTTP protocol/privacy controls across eight adapters and five representative model IDs; browser43 passed                                                                                                         | Exact-head hosted qualification                      |
| Private persistence/configuration         | Initial DB236/contracts166 plus20 focused/configAPI8; latest DB16 and API96 repair controls passed                                                                                                                                      | Fresh exact-head hosted qualification                |
| Harness/private continuation              | Initial harness819/fullAPI574; latest harness67/API96 plus SDK browser/native repairs passed                                                                                                                                            | Fresh exact-head hosted regressions                  |
| Existing chat API fixture migration       | Original40 retained as39 mocked plus one actual SDK HTTP case; full574 passed initially, latest mixed96 passed                                                                                                                          | Fresh exact-head hosted API regression               |
| Web public message/configuration contract | Prior web431/browser43; fresh SDK browser1 across all8 adapters passed after helper repair                                                                                                                                              | Hosted regressions                                   |
| Durable probe diagnostics                 | Actual SDK/API/SQLite/export/restart cases passed; diagnostic source and artifact review approved                                                                                                                                       | Hosted gates and later owner-app preflight           |
| Native desktop journeys                   | Prior68pass/4fail plus focused repairs give72 unique passing scenarios across runs. Latest two SDK cases passed on repaired source                                                                                                      | Fresh full hosted suite; no clean single-run72 claim |
| Build/static quality and hooks            | Initial5d157be9:3,868 ordinary tests/77 existing optional skips and900/990 benchmark passed. Latest hosted-finding repairs:314 affected tests,97 CI Node controls and3 connected cases passed; affected builds/types/lint/format passed | Fresh exact-head hosted gates on repaired source     |

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
qualification below; normal hooks subsequently passed at2a62817b. Fresh exact-head hosted
quality/security/reviews remain outstanding. Earlier broad connected results retain their explicit source bindings.
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
Its report/trace review is complete; the pre-handle startup cause remains unknown. That result is not a clean72-case qualification and
cannot qualify the later repair head. The original failure remains retained; no test deadline,
retry policy or application behavior is changed on that evidence alone.

## Final normal-hook qualification, 19 October

Commit `2a62817bb59afca4dd7c30dc07af326ec247fbb7` is pushed and clean. Its normal hook passed
all affected builds/types and1,771 ordinary cases: router135, DB236, harness819 and the full API581
across56 files. The33-case Git ledger file passed within that full suite. The earlier all-package
3,868 result remains bound to its earlier source; unchanged packages were not redundantly rerun by
this affected-package hook. Fresh hosted CI still runs the required complete qualification.

SDK-PERF01 retains the preceding genuine hook failure: the third locked vector's p9539.087250ms
minus disabled18.354500ms was20.732750ms, above the unchanged20ms limit. All900 measurements and
990 provider calls were retained; enqueue/queue/healthy loss controls passed. Event-loop and observed
GC data did not establish a cause. A post-failure host snapshot was not contemporaneous, and a bounded
power-log query timed out; neither proves resource contention or sleep caused the result.

Independent critique approved one predeclared diagnostic run of the unchanged full benchmark with
an external one-hertz resource sampler and a five-second sampler-only baseline. It passed900/990
with maximum overhead3.7655ms. Sampling commands consumed41to126.5ms wall time; incremental CPU
overhead was not quantified. Coarse phase correlation is explicit, with no per-request absolute-clock
inference. This diagnostic run did not replace the failed hook or justify a threshold change.

The subsequent complete normal push, without that sampler, independently passed its fresh full
nine-vector benchmark:900 measured requests/990 fixture calls, maximum positive overhead3.491375ms
under20ms, enqueue p95 below2ms, queue at most256 and healthy zero loss. All raw windows were
recomputed against the byte-identical staged benchmark. `requalified-sdk-push.log`, its terminal
receipt and `requalified-sdk-push-benchmark.json` retain the actual source-bound result; the original
failed hook and observed diagnostic artifacts remain retained. This qualifies the current local
revision without claiming that the historical timing cause was identified or fixed.

SDK-OBS01, the earlier946 pre-handle Electron launch evidence gap, is recorded in the existing
`agent-platform-desktop-secure-storage-startup` Beads record. The next current-head hosted Electron
suite must pass all72 cases on retry zero with no flaky cases. If launch fails again, collect safe
pre-handle process/startup evidence before another attempt; do not infer a provider or policy failure,
raise a deadline or treat a successful retry as clean. Earlier hosted browser evidence is42passed
plus one context-fixture skip, whose scenario has separate local passing evidence. Successful first
phase detailed artifacts were not uploaded by the existing CI rule; the actual job log is retained.

These final result/handoff updates do not alter runtime. Every latest exact-head workflow, Sonar
finding, security alert and review thread still needs inspection before acceptance. No merge,
protected staging, owner-app rebuild, live-provider compatibility or owner stress readiness is claimed.

The subsequent Sonar analysis of2a cleared the earlier16 findings but reported one new minor
S6353 notation issue in the anchored visible latency test selector. The final helper uses the
concise digit class with the same start/end anchors, exact locator and visibility assertion.
Independent review found no behavior difference in65,551 character/edge comparisons. Static
formatting/lint checks passed; this test-helper notation change does not alter application runtime
or invalidate the earlier connected outcomes. The final hosted run still must bind the pushed
helper bytes; no earlier green gate or minor severity substitutes for that qualification.

## Hosted6ea result and Git test-order repair

CI39175948211 attempt1 tested merge485da84f, whose tree equals source6ea. Its Electron report
is genuinely clean:72 expected/passed, every case exactly one attempt/retry0, no flaky/skipped/
unexpected cases. The earlier direct-write launch case passed in9914ms; that does not explain the
historical946 launch timeout. Both SDK native cases passed with durable correlated diagnostics,
encrypted one-to-three-row history, privacy checks, exactly one effect, completed-history replay
and interrupted409/no new effects. Artifact digests and every outer/nested ZIP member were verified.
Browser42 passed with one existing context-fixture skip; its separate local passing evidence and
successful-phase detailed-artifact gap remain disclosed. See `pr362-6ea-hosted-connected-verification.json`.

Actual Sonar on6ea was OK with zero open issues/all conditions OK. Dependency Review bound45 changes
and zero introduced advisories, with pinned controls and live comparison independently verified.
Those security/results bind6ea; a later changed test head still requires fresh automatic qualification.

The required verify job failed its ordinary API suite:533 passed and48 Git-chat cases failed before
expected approvals/receipts, reporting safe provider-reachability errors. No benchmark ran afterward.
The same49-case file had passed in local full suites. This is not evidence of a slow connection.
Controlled standalone first cases made two actual owned requests each and passed; forcing a context
mocking case before them reproduced the safe failure with zero fetch/wire calls. A safe counter then
proved the retained context SDK mock closure ran three times inside each failing Git case, returning
undefined after its scripted responses were exhausted. The resulting TypeError was classified as
transport failure. This proves the order-dependent fixture defect; hosted logs lacked that marker,
so exact hosted attribution remains an inference from matching source/order/failure evidence.

The independently reviewed repair changes only the Git API test. Hoisted cache reset/unmocking
loads a fresh actual SDK graph and leaves a clean cache afterward. A saved fixture endpoint and
explicit configuration selection remove ambient model routing. A fail-closed exact provider/API
origin guard preserves the direct Stop path, rejects other transport before dispatch and checks
real provider counts. All49 original assertions, permission/receipt/effect checks and deadlines remain;
one negative egress control is added. Forced Session→Context→Git and reverse-order slices both
passed5/5 under CI=true with a deliberately wrong ambient Ollama endpoint. Each actual Git case
made two owned requests with zero foreign dispatch; the exhausted marker appeared only in its
intended context case. Static lint/format/diff passed. The full50-case file passed without skip, retry or unhandled
error in28.98seconds. Normal hooks and fresh exact-head hosted gates remain pending at this
checkpoint. No product or paused source changed,
and no unchanged rerun, retry increase or deadline waiver is used.
