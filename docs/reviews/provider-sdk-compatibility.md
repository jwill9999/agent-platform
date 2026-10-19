# Provider SDK compatibility review and results

Status: 19 October 2026. PR362, PR364 and PR365 merged into the feature at `95d1cdbf`. Protected PR363 remains blocked by measured 22.982728 ms benchmark overhead against the 20 ms limit. PR366's ca2 follow-up passed ordinary and browser checks; its retained helper proof identifies an unavailable auxiliary Linux cgroup memory counter despite a successful child and complete core observations. Neither full benchmark has run. Independent critique approved explicit partial coverage with separate process/core eligibility and one narrowly guarded continuation. Fresh checks and review remain required; no staging, owner-app or live/stress readiness is claimed.
Earlier pending states below retain their named source/time bindings and do not override this checkpoint.
[Plan](../planning/provider-sdk-compatibility.md),
[verification](../testing/provider-sdk-compatibility.md).

Evidence root: `/Users/letuscode/.codex/provider-sdk-20261018`; source base staging `ece78d8a`.
Qualified provider protocol/generation checks below use researched owned HTTP fixtures and the actual pinned SDKs.
It does not establish live model availability, account permissions or generation quality. The owner
app/profile remains unchanged; paused orchestration, main and the disabled Docker gateway are preserved.

## Protected initial-screen failure and distinct-port fixture plan

Actual a9e protected results are frozen in pr363-a9e-hosted-connected-verification.json. Electron is
71pass+1flaky despite its successful job. The failed attempt never enters Git: Open folder is absent
and the screenshot instead reads “WebSockets request was expected” at the selected renderer origin.
Backend/document startup succeeded, model configuration POST succeeded and safe Git receipts are
empty. Its retry passes; that is not the agreed clean72 qualification. Exact debugger endpoint and
first HTTP response were not retained, so the historical port collision is not proven.

Source exposes a concrete mechanism: this Git file reserves only two app ports, then Playwright
allocates two ephemeral debug listeners before renderer startup. Existing getDesktopLaunchPorts
reserves all four ports together and is already used by migration and packaged VM fixtures. The
independently approved repair reuses it for this file's three launches with explicit debugger flags,
adds safe startup port/HTTP observations and retains all assertions,5s UI expectation, product/test
deadlines and retries. No runtime/shared helper changes or reload/retry workaround. New actual three
native journeys with workers1/retries0, combined source/results review, normal hooks and complete
fresh feature and protected qualification remain required. The linked existing startup P1 separately
retains rendererServer readiness accepting any status below500, including an inspector400; this
fixture patch does not fix that product predicate or claim all external port races are eliminated.

Final source028ff6ab passes lint/format/strict E2E types/diff. AST comparison retains all71 original
assertion/test-budget calls and20 explicit timeout properties unchanged. The controlled owned Node24
inspector returns400 and the matching fixed WebSockets category; its response passes the current
product status<500 predicate. That proves a present mechanism, not historical port ownership.
All three actual native Git journeys pass first attempt with workers1/retries0, no flaky/skipped
cases:8.298/9.847/11.622seconds,30.2seconds total. Frozen seven code files and production/dist hashes
stay unchanged. Every allocated four-port set is distinct; actual Node inspector port matches,
Chromium configured switch matches but its actual endpoint is explicitly unknown, and initial
renderer is owned loopback/root/HTTP200 HTML. All12ports release, all three app closes fulfill and
owned processes exit. Safe Git evidence retains78 terminal invocations, maxwait26ms, zero claims/
evidence errors/truncation, one create/lost-response reconciliation and cancel/no-effect checks.
git-startup-native-first-qualification.json binds the actual results. A synthetic fixture-only master
avoids Keychain setup; no owner key/profile/provider or native secure-storage qualification is used.
Final combined source/doc/evidence review, normal hooks and new exact-head complete feature/protected
gates remain required; the successful local slice is not a rerun or waiver of a9e's flaky full suite.

Current a9e's other slices are independently qualified: API604/DB236/new63, browser42+knownskip,
900 measured/990 calls with max addedp954.119057ms<20 and enqueue.041562ms<2, actual packaged macOS
VM20 with development signing/virtualization entitlement and tested no host/secret exposure. Both
full scans complete five genuine provider batches, CLI0.124.1/no findings; dependency45changes and
zero introduced advisories. All three actual CodeQL languages return0 findings and alert12 is fixed,
not dismissed; Sonar0open/allconditionsOK. SDK native2 pass with private encrypted continuation,
durable failures across restart and no-effects fences. Those slices do not waive the flaky case or
qualify a future head. Remaining existing high audit debt, upstream scan omissions, older benchmark/
flake causes unproven, owner-profile preservation, no paid calls and paused boundaries remain.

## Asynchronous fixture quality follow-up

Actual576 analysis is source-bound in pr364-576-sonar-opening.json: commit576ca2dc, gateOK but
four open minor S9382 findings. They concern lock-poll delay and sequential receipt open/read/close.
The independently reviewed correction uses an asynchronous polling function with one original start
and deadline, plus a strict sequential Promise chain calling an extracted single-receipt reader.
One-second lock budget, abort checks, owned cleanup, sorted512-file bound, one descriptor at a time,
2049-byte probe/2048-byte limit, safe enum/numeric projection, catch/error count and final close
remain unchanged. No product behavior, retry/assertion/deadline or test-budget changes, exclusions
or rule suppressions are introduced.

The unchanged27 controls pass6.133seconds, zero failures/skips/cancellations; actual compiled-API
four-queued-read proof passes with four outputs/ledger rows and zero remaining claims/errors.
gh-fixture-awaitloop-source-and-qualification.json binds exact source and evidence; test bodies are
unchanged from576. The focused native journey passes first attempt in14.156seconds, retry/flaky/skip0.
Both safe snapshots retain71 terminal records:65 successes, five expected pre-PR-check failures and
one intentional lost-create-response failure. All panel PR lists succeed, maximum wait17ms,
claims/evidence errors/truncation0, exactly one create/PR and successful reconciliation without replay.
All four code/runtime bindings remain unchanged; Electron and both owned ports close.
git-fixture-native-second-qualification.json retains the actual result. Combined documentation review,
normal hooks and fresh actual Sonar0/full hosted qualification remain required at this checkpoint. Historical
576 native and8e full-suite/benchmark results keep their named source bindings below.

## Git fixture concurrency and retained failures

Actual8e hosted evidence is in pr364-8e99-hosted-connected-verification.json. Its complete benchmark
passes900 measured requests/990 fixture calls across nine vectors, maximum added p95 3.823261ms
under unchanged20ms. API604, DB236 and the correct focused63 cases pass; both SDK native journeys
pass first attempt. Electron's full72-case report contains71 expected passes and one flaky Git-panel
publishing case, so overall qualification remains false despite green CI checks.

Retry0 received safe unavailable PR data from the owned gh read after successful startup; the PRs
view correctly lacked its Title field. Eleven PR-list responses were HTTP200, with no pending reads.
The old failure path omitted CLI stage/ledger evidence. Exact historical cause remains unproven.
Source inspection found that the fixture rejects every overlapping exclusive ledger lock while
production permits bounded concurrent reads. A controlled old-source reproduction through four
actual API read operations confirms process_failed and zero ledger calls while an owned child holds
the lock; gh-fixture-old-lock-reproduction.json/log retain that independent fixture defect.

Critique approved at most one second of monotonic lock serialization inside the same CLI invocation,
unique active claims so queued children prevent reconfiguration/cleanup, and strict owned lock/claim
release. Safe bounded stage/outcome receipts plus unconditional before/after cleanup evidence avoid
raw arguments, environment or errors. Existing invalid/foreign-command denial, busy timeout, atomic
ledger and one-effect/lost-response checks remain; no product/API/UI retries, test-budget, assertion
or deadline changes. Review caught final-receipt ownership and invalid pre-claim writes; both are
corrected. A controlled queued SIGTERM/SIGINT probe reproduced stranded claims; cooperative
cancellation now prevents dispatch, persists a safe cancelled receipt and releases only its own
claim. Forced SIGKILL remains fail-closed, with no speculative filesystem recovery.

Final local27 fixture controls pass in6.172seconds and all33 Git Node controls pass in6.016seconds,
zero failures/skips/cancellations. Original16 cases and five-second invocation helper remain verbatim.
The actual compiled API four-read proof succeeds after all four queued claims are observed and the
held lock is released: four outputs/ledger rows, zero remaining claims/errors. Frozen evidence is
gh-fixture-cancel-source-and-qualification.json; earlier controlled failures remain retained.
The focused native publishing/lost-response case passes first attempt in12.931seconds, no retry/skip/
flake. Before/after snapshots have78 terminal calls,71 successes, six expected pre-PR check errors
and one intentional lost-create-response error. Every PR list succeeds; maximum lock wait13ms,
claims/evidence errors/truncation all zero. Exactly one PR is created and reconciled, fresh push and
remote identity retained, all owned processes/ports closed. git-fixture-native-first-qualification.json
binds the four code sources and existing unchanged production/dist bytes; no owner profile or paid
model call is involved. Final combined review, normal hooks and fresh clean full hosted qualification
remain required at this dated local checkpoint. Current workflow outcomes belong in Beads/PRs.

The supersededb8 run39182710133 failed its benchmark: actual artifact12156329045 contains only three
vectors/300 measurements/330 calls, completedfalse. Healthy43.318715ms and locked46.076602ms exceed
the20ms limit. pr364-b8-benchmark-failure-independent-review.json binds raw ZIP/member/log evidence.
Timing, event-loop and GC observations do not establish cause; retain SDK-PERF01 without claiming
unrelated key/fixture repairs fix performance. Current8e's full fresh pass is a separate qualification.

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

## Git startup ports and strict Electron CI outcome

The three Git native journeys passed once without retry in30.204seconds, with all four ports
allocated distinctly per launch, actual Node inspector equality, configured Chromium debugger
port equality (actual endpoint unknown), renderer HTTP200 HTML and all12ports released.
`git-startup-native-first-qualification.json` binds the unchanged source and runtime. A real owned
Node inspector control reproduces HTTP400 and the literal WebSockets response; it does not identify
the historical failed service. The broader fixture inventory and product readiness accepting400
remain recorded in the existing startup P1, outside this bounded repair.

The initial repair is pushed as d3160c6e. Its normal full-workspace hook passed3,898 ordinary
cases plus77 existing optional skips and all builds/types. The separate fresh benchmark retained
nine complete vectors,900 measured requests/990 fixture calls, max positive overhead2.739666ms
under the unchanged20ms limit, enqueue p95 below2ms, queue at most256 and healthy zero loss.
Raw windows were independently recomputed; benchmark source remains byte-identical to staging.
These are local source-bound results, not protected-head qualification or owner stress evidence.

A one-line follow-up sets `failOnFlakyTests: !!process.env.CI` in the real Electron config.
CI retains one retry for diagnostics, workers1 and the60-second default; every existing test,
assertion and explicit budget remains unchanged. External controls import this actual config without
overriding its failure policy, retries, workers or timeout: the first-fail/second-pass case is flaky
with two attempts and exit1; a clean first attempt exits0; CI unset retains false/retries0.
No browser, app or provider is launched by these policy controls. ESLint/format/diff pass.
The external control harness initially needed module-loading/report-field corrections; those
failures are retained separately and did not expose a product defect. Final combined review and
normal follow-up hooks are still required. Fresh hosted CI must pass all72 Electron cases without
flakiness, plus every actual security/review/full-scan/packaged-VM/protected gate before merge.

PR363's prior a9e71+1flaky result remains unqualified despite successful job badges. Prior scan,
VM, SDK, API, browser and benchmark slices remain bound to their actual source. This change enforces
the existing clean-run requirement rather than accepting retry success. No live-provider success,
owner-profile upgrade, stress readiness, main promotion or paused orchestration delivery is claimed.

## Protected95d1 performance failure and bounded evidence plan

PR365 merged normally at95d1cdbf; its tree equals reviewed5c48. The new protected PR363 run
39195037818 preserves a genuine verify failure: first-repetition locked request p9560.943431ms
minus disabled37.960703ms equals22.982728ms, above the unchanged20ms limit. Healthy overhead is
0.887964ms. The retained raw report is completed=false, three vectors/300 measurements/330 fixture
calls only. API604/DB236/new63 controls and Git fixture33 passed before the separate benchmark.
No benchmark pass, complete900/990 qualification or staging readiness is inferred from those results.

Artifact12162027412 has verified API digest248dc0e54faf2e385de194b02931b98613975eac1e4fe7c1e687ef2c1e3608e9,
CRC and every member. Raw SHA2563319a202bb6839f4441b368085f77ea72ebfbfa5b061c314479815634b31a91f is
retained alongside the job log. The failing percentile window overlaps one observed19.437716ms GC
pause; observed GC can be incomplete. CPU/ELU and MessagePort counts establish neither external
contention nor an active prior worker. No durations are excluded, adjusted or subtracted.

Source review confirms bounded logical capture-store close requests termination without awaiting
native exit. Cooperative close acknowledges after DB closure; monitoring stop invalidates future
records but does not join a pending filesystem probe. Neither behavior proves the historical timing
cause. Product shutdown deadlines, initial probe placement and all assertions remain unchanged.
Independent critique requires actual identity/timestamp evidence before choosing a repair.

The approved next step is one predeclared hosted diagnostic on a frozen reviewed task head, with
bounded in-memory Worker/close-ack/exit, filesystem-probe and GC observations plus external one-hertz
Linux numeric resource sampling. Tiny owned controls validate observation and cleanup before the
sampler-only baseline. No payloads, credentials, paths, argv or environment values may be retained.
Raw partial measurements and explicit observation gaps/truncation must survive failure under distinct
filenames. No automatic retry or continue-on-error is permitted. The existing fresh uninstrumented
benchmark remains a separate required gate with all three orders,900/990 calls,20ms overhead,2ms
enqueue, queue256 and original deadlines unchanged. A diagnostic pass is not a cause finding or a
replacement qualification. The implemented four-file observer/workflow refinement passes14 tiny controls, including an actual
pnpm-to-Vitest default fork, real owned Worker close/ACK/exit, filesystem probe and exact raw-writer
identity. Promise/result/error identity, active SIGTERM/SIGINT outcomes, failure7, existing/later
regular/once/prependOnce handlers, no resurrection after consumption/removal and fail-closed missing
evidence are covered. Static lint passes. No local complete benchmark has been run for this refinement.
Final source review and normal hooks precede the one predeclared hosted diagnostic.

The controls first exposed two observer defects, retained in their original logs: exit-only hooks
miss Vitest’s SIGTERM teardown, and synchronous removal inside Node’s newListener registration can
close the native signal handle before a foreign listener is installed. The corrected observer is
permanently disowned immediately, with only its own listener removed in a microtask after registration.
Foreign handlers remain untouched. Active-command signal identity is verified; an arbitrary bare Node
self-signal with no live handles is explicitly unsupported and cannot qualify missing diagnostics.
There is no process.kill/native patch, GC setting change, measurement adjustment or phase fence.

Records remain bounded in memory until the owning process exit/termination boundary; diagnostic
Worker exit alone does not flush during a measured phase. Per-PID exclusive0600 exit ledgers use a
wrapper-owned0700 directory and are collected after child close, avoiding Vitest IPC descriptors.
Observed raw data, observer records and host samples have distinct diagnostics-benchmark.json\*
filenames from the later original gate. The conditional step is limited to the repair PR opening
on attempt1, with no continue-on-error/retry; protected promotion skips it by source condition.
The unchanged fresh uninstrumented gate remains mandatory even if the diagnostic passes.

### Opening helper failure and bounded evidence recovery

PR366 opening head `bf374458` ran CI39197870734, attempt 1. Ordinary tests passed, but the diagnostic
step's first real pnpm/Vitest-fork control received wrapper exit 1; 13 other tiny controls passed.
The shell stopped before the full instrumented benchmark command. The separate original benchmark
correctly skipped, so no new performance measurement or gate pass exists. Artifact 12163356483 is
592 bytes, API SHA256 475b617915a4e7bb6ff98ae52bf4d470988b898d0d10e1f20cce96ba061a8c68;
its only member contains 13 successful control proofs. The failed control appended its receipt
after the success assertion, so its child/observer/host evidence was lost from the upload. This is
an instrumentation evidence gap, not a diagnosed application or Linux resource failure.

Independent critique identified delimiter-joined schema-key validation as insufficient. Hosted
review also found that missing expected host counters could appear complete, and the fork control
did not establish a successful close acknowledgement from the actual fixture worker. The bounded
correction requires exact key counts/membership, complete finite declared counters and ten CPU
fields, a complete pressure some row and any present full row, and correlated worker identity,
successful acknowledgement and exit status. It preserves numeric-only observations, resource paths,
sampling bounds and every benchmark workload/assertion/deadline. These independently justified
corrections do not establish the opening control's missing cause.

The failed-control evidence is saved before success assertions, with fixed missing/invalid
indicators and safe statuses rather than raw errors, output, paths or environment. The reviewed
ca2 continuation selected only PR366's exact task branch, synchronize event from `bf374458` and
attempt 1. Its records remain bound to that source; no full benchmark is inferred from the attempt.

The corrected local suite passes all 29 tiny controls in 26.502 seconds, with zero failures,
skips or cancellations. The real pnpm/Vitest-fork proof is persisted before assertions and records
the actual worker's successful close and exit. Missing/invalid receipt and failed-wrapper controls
verify safe failure evidence without child output, raw errors or paths. Pure parser controls reject
joined, missing and extra keys, incomplete/nonfinite counters and incomplete pressure rows. Syntax,
ESLint, formatting and diff checks pass. These macOS controls do not establish Linux counter
availability. The original benchmark file and every pre-existing workflow object remain unchanged;
12 trigger cases verify that only the opening and exact-prior-head continuation select the helper.
Final combined source/evidence review, normal hooks and new hosted checks remained required at
that local checkpoint.

### Auxiliary cgroup capability correction

The ca2 continuation CI39199762479 retained the missing evidence: 28 of 29 tiny controls passed,
and the actual pnpm/Vitest child succeeded. Its wrapper exited1 solely because all seven Linux
host samples lacked cgroupMemoryEvents. The three ledgers, matching raw owner/clock and successful
worker close/exit are valid; CPU10, memory5, cgroupCPU6 and all three pressure counter sets are
complete. Artifact12163534321 contains only the control report, so again no full observed benchmark
ran and the original normal gate correctly skipped. The unavailable metric's precise read-error
category was not retained; no historical ENOENT assertion is made.

The sampler requests memory.events at the cgroup root, while the
[Linux cgroup documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files)
specifies that interface for non-root cgroups. Requiring this auxiliary counter universally is an
incorrect capability assumption. Independent critique approved a bounded correction without a new
cgroup-discovery collector: retain host.complete=false and explicit partial coverage for any gap,
separately require complete process Worker/probe/raw and core-host observations for diagnostic
eligibility, and preserve fixed absent/unreadable/invalid/other reasons. Missing or malformed core
data cannot become eligible; no zeros or complete-coverage claims are substituted for unavailable
data. Non-Linux local controls remain explicitly scoped rather than qualifying Linux coverage.

One further continuation is restricted to PR366's task branch, synchronize from `ca2c319f` and
attempt1. It follows this specific source-backed correction, not an unchanged rerun. Controls still
block both benchmark commands on failure; the separate original fresh uninstrumented gate remains
unchanged and mandatory. New focused controls, frozen independent review and normal hooks precede
that continuation. No local full benchmark, product change or performance threshold/deadline waiver.

The capability-aware implementation passes all 36 tiny controls in 26.504 seconds, with zero
failures, skips or cancellations. Optional-only gaps remain eligible but partial/incomplete; missing
or malformed core fields, stale error flags, empty samples and malformed ledgers cannot qualify.
The actual Mac pnpm/Vitest fork succeeds with explicit non-linux-control-only scope and host/core/
complete=false, so it makes no Linux coverage claim. Safe read-failure reason projections pass
privacy controls. Syntax, lint, formatting, direct Markdown and diff checks pass. All original
workflow objects and benchmark bytes remain unchanged; 13 trigger cases include rejection of the
former bf37 continuation. Frozen combined review, normal hooks and actual hosted execution remain
required before any merge qualification.

### Hosted capability evidence and final membership correction

At58a5bd9f, CI39201949314 attempt1 completed successfully. The declared diagnostic actually ran
all9 vectors/900 measured requests/990 fixture calls, with process/core observations eligible and
host coverage explicitly partial. All49 host samples report the unavailable auxiliary
cgroupMemoryEvents field; this does not become full host coverage. The separate unchanged normal
benchmark also completed9/900/990; independent raw-window recomputation gives maximum positive
overhead2.269351ms below20ms and maximum enqueue0.053901ms below2ms. Actual artifact12165235559
contains the distinct observed data and exact normal filename; API digest, CRC and every member
are verified. These measurements do not establish the cause of the retained95d1 failure.

Fresh58a Sonar has an OK gate but two open minor S7776 findings in the wrapper. The correction
changes only two fixed membership collections to Set and their membership predicates to has,
preserving rejection of unknown names/reasons and every coverage guard. All36 tiny controls pass
with zero failures/skips/cancellations in26.563 seconds; syntax, lint, formatting and diff pass.
No local full benchmark is repeated. The workflow remains identical: its next synchronize event
has before58a rather than the declared ca2 predecessor, so the observed step is not selected again.
Final source/evidence review, normal hooks and fresh exact-head checks remain required, including
the original uninstrumented benchmark and actual Sonar issue clearance. Nothing here qualifies a
future feature/staging head or the owner app without its own required evidence.

### Normal0852 failure and fresh-runner isolation control

The final Set correction at0852 cleared current Sonar to zero open issues, and CI39204045842 passed
all ordinary/connected slices including72 Electron cases on retry0. Its required normal benchmark
failed: healthy p95241.153030ms minus disabled115.119354ms =126.033676ms above20ms. The raw file
is incomplete with3vectors/300measured/330calls. Artifact12165930061, API SHA256
7f3ae31f7d58ae85d7501c3df8e2566679b0be4d228050965af9401414f3def2, and all connected artifacts were
independently verified. Passing slices do not waive that failure.

Phase CPU stays around3.1–3.2seconds while wall times are5.66/10.40/3.62seconds. Largest healthy and
disabled stalls have no recorded GC overlap. Blocking I/O and descheduling are possibilities, not
established causes. Source uses32-event DELETE/FULL transactions but no write-service evidence
establishes fsync as the cause; no durability or batch change is made. The passing58a normal run
followed76seconds of controls/observed execution;0852 did not. This sequencing confound motivates
one independent fresh-runner control rather than an unchanged rerun or cooldown.

The isolated Linux job keeps the exact original benchmark bytes, physical storage, three orders,
900 measured/990 fixture calls and all20ms/2ms/256/90-second limits. Its preparation uses the same
pinned actions/install/native/build. No ordinary application suite, preload, artificial baseline or
warmup workload runs before measurement. Both jobs have30-minute bounds. The required verify job
depends on benchmark success, uses always() and starts with a static environment-data guard before
checkout; failure, skip, cancellation, missing or unknown result cannot become successful verify.
All original ordinary steps and every other job remain unchanged. The old optional one-shot
preload execution is retired; its source and historical evidence remain. Its36 controls run only
after measurement in dependent verify.

A separate host-only wrapper preserves the fixed original child argv/environment/cwd and failures,
retaining bounded exclusive0600 numeric CPU/memory/cgroup/PSI evidence before/during/after the command.
There is no preload, raw measurement read, delay or subtraction. Missing core counters block
qualification; unavailable auxiliary memory events stay partial. Sampler CPU/wall overhead is
recorded, never deducted. Global counters and phase clocks provide context, not per-request causality.
The actual shell guard runs successfully only for exactsuccess from an empty checkout; all other
statuses and malicious shell text fail without effects. All29 new tiny host/guard/YAML controls
pass without failure/skip/cancellation, plus36 retained observer controls. No local full benchmark
is repeated. Final combined source/control/docs critique, normal hooks and actual fresh hosted
qualification remain required; a pass would qualify this environment, not diagnose earlier failures.

At protected95d1, both full scans39195037863/39195062021 completed genuine five-batch analysis without findings;
new CodeQL Actions/JavaScript/Swift analyses have zero results, alert12 is fixed without dismissal,
and direct current-head Sonar is OK with zero open issues. Dependency comparison45 changes has
zero introduced advisories, separate from existing audit debt. The protected Sourcery skip is due
to exceeding150,000 diff characters, not a completed review; independent source review is retained.
Actual VM20 and browser42 plus known skip passed; the full Electron report confirms72 each passed
once on retry0 with no flakes/skips. All API artifact digests and every member are verified;
`pr363-95d1-hosted-connected-verification.json` remains explicitly blocked by the benchmark.
No source-independent result substitutes for the failed current benchmark. No owner-app upgrade,
live-provider success, stress readiness, main promotion or paused orchestration delivery is claimed.

### Protected CodeQL observer-fixture repair

PR366 merged at687ec379 after all12 executed checks and independent artifact review cleared.
The source-bound fresh benchmark completed900/990, maximum overhead1.897371ms below20ms and
enqueue0.060132ms below2ms. All72 Electron cases passed on retry0; API604/DB236, browser42 plus
one known skip and3898 ordinary cases passed. Host core counters are complete; auxiliary
memory.events absence remains partial coverage. Retained earlier failures have no established cause.

Actual protected687e CodeQL13 identifies JSON-serialized path data inserted into generated child
JavaScript. Its open finding blocks staging despite genuine full scans and passing other slices.
The bounded test-only correction uses static child source and separate argv data for the direct
child handler family, validates fixed cases and preserves signal outcomes, assertions and budgets.
Hostile-path/no-effect controls, source-independent critique and normal hooks are required, followed
by new exact-head hosted feature and protected qualification. No custom sanitizer, suppression,
product/benchmark/dependency/durability change or old-result substitution is introduced.

The provider task retains S12 actual owner-profile recording/export/restart; model diagnostics has
its separate protected-delivery acceptance, and owner stress remains open. Native access still
requires manual Mac unlock. No paid call, credential/profile change or paused integration is claimed.

All39 focused observer controls pass with zero failures/skips/cancellations in27.05seconds. The
original36 remain, with AST evidence preserving all original parent assertions and timeout options.
Three new controls cover10 real normal/hostile child executions with identical generated source
and no marker effect, three invalid-enum denials, and owned-child abort/SIGKILL plus spawn-failure
cleanup. The new controls execute sequentially, honor their unchanged10-second budgets and await
child closure before removing owned fixtures. Syntax, ESLint, formatting and diff checks pass.
Final combined source/results/session critique, normal hooks and all fresh hosted gates remain
required. No local full application suite or benchmark is repeated for this test-only correction.

Sourcery then identified that the new hostile filesystem component is invalid on Windows. The
follow-up keeps the exact hostile Unix path, chooses a fixed Windows-safe component and carries
the full payload through URL.searchParams in the copied trusted preload URL on both platforms.
Static child source and argv contracts stay unchanged. The added policy control validates Windows
filename rules, exact Unix payload preservation, full query round-trip and unchanged imported file
path. All40 controls pass0fail/skip/cancel in26.95seconds, including10 real queried imports with
source-byte/no-effect/signal/receipt checks; previous assertions and budgets remain. Actual local
execution is Darwin; policy simulation does not claim native Windows qualification. Fresh hosted
source review/checks and protected CodeQL clearance remain required. No runtime or gate waiver.

## 19 October — staged delivery and owner migration preflight blocker

PR363 merged by protected exact-head guarded squash at `be153c50019b0dd28b6105cf2f48a961ac16ed8f`.
Tree18a9bbe4 equals reviewed feature938a and task9c. Independent final critique verified all five
artifact digests/CRCs and13,765 members:72 Electron cases each retry0, actual signed packagedVM20,
3,898 ordinary cases plus77 existing optional skips, API604/DB236/focused63/Git33/40 observer controls.
Fresh900 measured/990 calls maxoverhead3.578690ms/enqueue0.046122ms satisfy unchanged20/2 limits.
Both genuine full analyses completed6 batches/SARIF0, all3 CodeQL languages0, alert13 fixed without
dismissal and Sonar current-head0/all5OK. All18 executed rollup checks/eight workflows succeeded,
13 same-app required contexts passed; five source-conditional skips include Sourcery diff>150000.
Host auxiliary coverage remains partial. Source/history and paused/main preservation were verified.
Model diagnostics closed/read back/synced after its own delivery; provider S12 remains in progress.

The actual staged production build passed backend/renderer/desktop on Node24.14. Owner unlocked the
Mac; the idle retained app was quit normally, all owned ports and database handles released. Whole
stopped profile/logs were copied privately and byte-verified; original key copy verified internally
without logging its value/hash. Free space after backup27.38GiB. Official openDatabase on the private
copy failed safely before SDK SQL:22 existing journal entries include a later opaque watermark.
Original three owner databases remained byte-identical to the stopped backup. The previous runtime
was reopened with the same profile/key and returned API/renderer200; it still has the old SDK.
No upgraded owner launch, live model test or stress readiness is claimed.

Evidence: `/Users/letuscode/.codex/provider-sdk-20261018/` receipts
pr363-qualified-staging-delivery.json, pr363-938a-final-independent-approval.json,
owner-sdk-staged-production-build.json, owner-sdk-stopped-profile-backup.json,
owner-sdk-private-copy-preflight-blocker.json and owner-sdk-retained-runtime-restored-readiness.json.
Private backups must not be published.

SDK-MIG01/02 independent preliminary critique confirms the guard intentionally rejects0021 below
the watermark; unknown hash existed before17October repair and has no proven retained SQL origin.
The approved bounded direction keeps0021 immutable and proves complete predecessor history/exact
touched pre-schema before its atomic compatibility bridge. Generic high-water guards and all other
rejections remain. See [repair task](../tasks/agent-platform-sdk-legacy-migration.md) and
[verification mapping](../testing/provider-sdk-compatibility.md#legacy-watermark-upgrade-regressions).
This paragraph records the initial diagnosis; later local results below supersede its planned state.

Final contract critique found SDK-MIG-P01 journal-trigger preservation and SDK-MIG-P02 missing child
Gherkin mapping. The contract now explicitly rejects journal triggers on the bridge, proves the full
original ordered journal plus one canonical0021 append, includes legacy backfill tables in pre-schema
proof and maps eligible/restart, denied and existing-adopter journeys to UI and independent DB state.
The refined contract passed independent review; actual local results follow below.

Further feasibility evidence found messages.workspace_events_json present in the owner schema. Exact
64-byte legacy ALTER reconstruction hashes to the retained43b2b451 entry; the independent critic
confirmed that identity. Original commit/execution provenance remains unproven. Canonical0000–0020
plus the proven statement in an in-memory reference matches all34 owner touched/legacy definitions
exactly; no journal triggers exist. Receipts owner-sdk-workspace-column-hash-reconstruction.json and
owner-sdk-proven-variant-eligibility.json retain proof without owner records. The contract now includes
this one strict hash/time-bound pre/post variant, opaque-value preservation and adopter/reopen/negative
controls. The refined contract and DB/native source passed independent review; owner databases remain untouched
by upgrade code, and normal recording continues on the retained old app.

## 19 October — bounded migration repair, local qualification

Frozen runtime migrationHistory e188346d, final DB tests e4f0f638, sdk-watermark fixture5a119aaf,
fixture typeba078302 and native testb9e2ee4f passed independent source review. The canonical0021
bridge proves predecessor SQL/hash/time, trusted canonical or proven historical pre/post DDL,
legacy-backfill prerequisites, journal-trigger denial and the exact original ordered journal plus
one canonical append. Published0021 and the original31 DB tests remain exact. Maintenance limit:
this variant recognizes exactly22 migrations; future migrations require a reviewed extension.

Final81 migration controls pass, including50 new cases. An earlier full36-file DB suite passed284
cases in37.23s on identical runtime before two added adopter controls; no final286 full-suite claim.
Build/types/lint/format/syntax pass. Initial missing contracts and compiled diagnostics/monitoring
workers were build-prerequisite failures, retained and resolved without product/assertion changes.
SDK-MIG-SRC01 requested negative historical-adopter coverage; missing legacy prerequisites and
journal triggers now deny without incidental backfill/schema/record/journal effects. Critic approved.

Coherent backend/renderer/desktop builds pass Node24.14/pnpm9.15.4 without installs/dotenv. Full
Playwright73 cases/16 files were collected, not executed locally. Original2 MIG-R06 cases pass
retry0 with byte-exact callback bodies and unchanged fixture modes. Final new SDK-MIG05 passes
retry0 in6.627s: real managed Electron/backend/SQLite retains all28 original tables/seven records,
non-null opaque legacy value and22 original journal rows, appends exactly0021 once, then restarts
idempotently. Retained Project/model/key indicator are visible both phases. No generation/probe;
both closes fulfilled and all4 application ports released.

Three failed new-case attempts remain retained: invalid synthetic agent limits caused agents400;
missing desktop Project metadata plus personal-Chat navigation hid recents; duplicated text made
a generic locator ambiguous. Reviewed SDK-only fixture corrections satisfy existing Agent/Project
contracts; the test stays on Home and uses the exact accessible Project-card label. No old mode/body,
runtime source, assertion or five-second expectation was weakened. SQL evidence now precedes UI;
the first failed attempt explicitly lacks independent postmigration SQL proof.

Both unchanged SDK native cases pass retry0 in16.056s/21.082s. Error diagnostics4events survive real
restart with durable/verified/ready storage and zero pending/drop/conflict. Private continuation
rows1→3 remain encrypted; completed history survives restart, interrupted approvals return409 with
no new provider/audit/file effects, exactly one approved file effect occurs, private log markers
are absent. Providers are emulated and profiles disposable; no owner data/Keychain/live model claim.

Evidence root `/Users/letuscode/.codex/provider-sdk-20261018/`: sdk-legacy-bridge-adopter-qualified.json,
sdk-legacy-fixture-project-qualified.json and sdk-legacy-native-final-local-qualification.json
SHAb101b908bee74e8e8ab805f07b135afa8c9a27e3d617dccf50998bec22ab8267 bind actual source/dist/logs,
complete reports/trace members and retained failures. Combined final documentation/evidence review,
normal hooks, fresh feature/protected full analysis/VM/all checks and original-profile private-copy
then recording/export/restart remain open. No live-model/stress readiness is declared.
