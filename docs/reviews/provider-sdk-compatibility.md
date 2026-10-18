# Provider SDK compatibility review and results

Status: 18 October 2026. Local connected qualification and independent review are recorded below; normal push hooks and hosted qualification remain outstanding.
No hosted qualification, integration, owner-app rebuild or stress readiness is claimed.
[Plan](../planning/provider-sdk-compatibility.md),
[verification](../testing/provider-sdk-compatibility.md).

Evidence root: `/Users/letuscode/.codex/provider-sdk-20261018`; source base staging `ece78d8a`.
Qualified provider protocol/generation checks below use researched owned HTTP fixtures and the actual pinned SDKs.
It does not establish live model availability, account permissions or generation quality. The owner
app/profile remains unchanged; paused orchestration, main and the disabled Docker gateway are preserved.

## Current qualification

| Area                                      | Actual evidence                                                                                                                                                                                               | Remaining gate                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Native providers                          | Router135 tests, including83 HTTP protocol/privacy controls across eight adapters and five researched representative model IDs; independent source review approved                                            | Browser coverage passed; hosted qualification remains                     |
| Private persistence/configuration         | DB236, contracts165 plus final20 focused controls, saved-configAPI8; independent fourteen-file source review approved                                                                                         | Final affected-suite/hosted qualification                                 |
| Harness/private continuation              | Current harness819/57files and API90 (Git49/context41) passed; source and evidence independently approved                                                                                                     | Broader API and connected regressions                                     |
| Existing chat API fixture migration       | 40/40 passed in5.57seconds, including a real owned loopback SDK request and pending approval                                                                                                                  | Full API ordinary suite                                                   |
| Web public message/configuration contract | Web431 tests passed; app-owned renderer type replaces unused SDK UI imports; accessible visible failure and backend catalogue                                                                                 | Browser43 passed; hosted regressions remain                               |
| Durable probe diagnostics                 | Two real SDK/API/SQLite/report/restart cases passed; safe categories, stable event identities and best-effort sink failure covered                                                                            | Independent connected diagnostic review passed; hosted gates remain       |
| Native desktop journeys                   | Initial broad run: 68 passed, four failed; corrected-cwd MCP pair passed, then reviewed MIG/label focused trio passed. Both new SDK journeys passed on I05. All 72 unique scenarios now have passing evidence | Fresh full hosted suite on the final source; no clean single-run 72 claim |
| Build/static quality                      | Full production workspace build passed before the final harness/API repair; both affected packages rebuilt afterward. Full types and formatting passed                                                        | Final lint, normal hooks, fresh benchmark and current-head hosted gates   |

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

Local browser/desktop scenarios and independent diagnostic review have passed as recorded below. Finish full affected suites, the unchanged
900-measurement/990-call benchmark, normal hooks and exact-head hosted quality/security/reviews.
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
