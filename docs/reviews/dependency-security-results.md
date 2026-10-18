# Dependency security results

Plan/spec/verification are linked in the [plan](../planning/dependency-security.md).
PR350 merged normally at`e95afc40` after all11 executed exact`d785bbf4` checks passed, no unresolved
threads or scoped code-scanning alerts remained, fresh Sonar was clear and independent source/artifact
review qualified the feature. The merged tree equals reviewed source and the staging`5c2f6553` rehearsal.
Local3667 ordinary tests/77 existing optional skips,15 builds/types, fresh900/990 benchmark and connected
browser32/Git5/Stop5/Electron70 passed. Hosted Electron70 was retry-free; browser31 had one existing
context-fixture skip that passed locally. These are actual feature results, not protected delivery.

Protected PR351 is open. Original`e95` full Promptfoo39150944305 and DependencySecurity39150944316
attempt1 passed; independent review verified genuine provider analysis/batch2/CLI0.124.1, exact
refs/run/attempt/action/guard/SARIF and all440 official-vendor inventory changes. Sonar is clear.
CodeQL alert11 then identified constructed source in the dependency-output test fixture. The bounded
repair on`task/dependency-codeql-transport` requires affected regression/source review, a normal
feature repair PR and fresh protected checks. No dismissal, staging merge or security task closure
has occurred. Earlier dated checkpoints below retain their original failures and pending states.

## Protected CodeQL transport-fixture repair

PR351 CodeQL alert11 (`js/bad-code-sanitization`, security medium/error) identified the generated
fetch-preload function containing a JSON-serialized fixture path. This follow-up makes that preload
fixed source and passes only its small marker path through an explicit child environment. The large
adversarial output test still executes its standalone evaluated JSON string literal; only module and
destination paths move to small fixture environment values. No bulk environment/argv transport,
production source, workflow, timeout, assertion or vulnerability policy changes are included.

A positive preload probe now verifies the mock actually records a call and produces the expected
failure before the original missing-file tests prove zero API calls. This prevents a broken preload
from producing an empty-marker false pass. All30 affected Node controls and scoped ESLint pass;
three changed Markdown files, explicit formatting and preserved-history equality also pass.
Independent final source/document review and actual fresh hosted CodeQL/Sonar/CI remain required.
The original alert, full analysis and CI evidence remain retained; no dismissal or unchanged rerun
is used to qualify this changed source.

## Baseline and setup gaps

Read-only audit of migration head `4124faab` reported165 advisory entries:7critical,67high,
77moderate,14low. Instance metadata differs (9critical/77high/92moderate/14low); these are not unique
vulnerability counts or proof of exposure. That head carries a newer Electron than staging. The
actual staged baseline has166 advisory entries:7critical,68high,77moderate,14low. Deduplicating
those entries by GitHub advisory ID gives158 distinct GHSAs:7critical,63high,75moderate,13low.
Its reported instance counts
are9critical/78high/92moderate/14low. Raw evidence is in
`/Users/letuscode/.codex/dependency-security-20261017/`, including `baseline-audit.json` and
`staging-baseline-audit.json`. Review package paths and advisory preconditions before disposition.

At the initial public-repository audit, security updates were disabled and alerts/comparison APIs
returned403. The owner subsequently enabled the security settings, then explicitly selected staging
as default. PATCH and independent GET confirm default staging; main0dc0d475 and stagingd55f20ed
SHAs were unchanged by that settings operation. Security updates are enabled, comparison returns200,
and the alerts API has188 open alert instances across two pages (22critical,59high,90moderate,17low).
These are GitHub alert instances, not the pnpm unique-advisory count. PR346 now targets staging.
The new configuration/workflow exists only in this task draft, not protected staging.

Weekly Codex dependency review is active; protected-staging configuration/check enforcement is not yet active.
No security repair, new CI gate, zero-vulnerability result or release readiness is claimed.

## Review and execution

Independent plan critique passed after DS-C01–06 corrections. Package version qualification,
full runtime regressions and actual hosted controls remain pending. SDK upgrades and paused orchestration remain outside this delivery.

First independent critique requested corrections DS-C01–05: safe negative-test route, explicit
development/unknown scopes, separate default-main security/version coverage and activation task,
actual required-check enforcement, and current baseline/frozen SDK ownership. The revised plan passed independent re-review with those boundaries. No vulnerable fixture PR will be opened
where existing install/build workflows could execute its payload.

DS-C06 found that the vendor can continue after snapshot warnings. The plan now requires a narrow
read-only exact-ref comparison guard with warning/pagination/auth/malformed-response controls,
without reimplementing advisory matching. Implementation and independent setup-source review now pass; actual hosted proof remains pending.

## Setup-source review and controls

Independent draft implementation review found DS-I01–03: malformed warning base64 `A` decoded
empty, unquoted `rel=next` was ignored, and the vendor/guard snapshots were not inventory-bound.
Four new red controls retained14 prior passes and4 failures before repair (`setup-guard-red.log`).
The repaired controls pass18/18 with0 failures/skips, including schema-default/full-metadata and
multiplicity mismatches (`setup-guard-final-green.log`). Scoped ESLint and formatting pass.

The guard now requires canonical base64 and fatal UTF-8 decoding, consumes quoted/unquoted Link
relations and parameters, and rejects duplicate/ambiguous/malformed pagination or query targets.
After official action analysis, the mandatory guard compares the entire `dependency-changes`
inventory against the complete warning-free exact-ref API inventory. It normalizes the pinned
ChangeSchema/defaults only, preserving omitted scopes, all advisory fields and duplicate counts.
It records a normalized inventory digest and pinned vendor/schema identities. Missing, truncated,
malformed or oversized output cannot qualify. The negative control additionally requires the known
critical Vitest-development/Next-runtime findings in the official filtered output; no vulnerable
revision is installed or executed. No custom advisory policy or scan exclusion was added.

Official action source is pinned at `a1d282b36b6f3519aa1f3fc636f609c47dddb294`; downloaded schema
SHA256 is `357af1da7161524295c6656ee57f9157eedf629f83e5ee1256339f25bc641c66`.
Independent reviewer rechecked all4 setup-file hashes and ran18 controls; verdict APPROVED with no
remaining setup-source findings. Receipts: `setup-implementation-review.json` (original findings),
`setup-guard-repaired-source.json`, and `vendor-dependency-review-v5/` under the evidence root.
This approval does not qualify dependency upgrades, hosted controls or required-check activation.

## Package draft checkpoint

A compatible draft resolves Vitest4.1.12 plus explicit Vite7.3.7, Next15.5.28,
Electron42.11.15 and MCP SDK1.32.1, with lifecycle scripts disabled during resolution/install.
After resolving the reviewed overrides and Drizzle0.45.4/Kit0.31.11, the audit has20 unique
advisories:0critical,3high,14moderate,3low (`overrides-drizzle-audit.json`). This is a partial result,
not security clearance. Compatible remaining patches still need qualification; SDK-owned findings
and unpatched Braces remain visible. No advisory is ignored to make the audit pass.

The actual Drizzle identifier regression fails twice on0.38.4, including disclosure of a synthetic
private row through a crafted identifier, and passes twice on0.45.4. This proves the vendor fixture,
not exposure of the application's static identifiers. Full DB191tests/34files and the full workspace
production build pass. PR345's unmerged migration production code is not imported here.

All8 `ai`/`@ai-sdk/*` package identities and integrity entries, and all8 snapshot keys, remain
unchanged. Snapshot contents have exactly one compatible security delta: provider-utils2.2.8's
Nanoid3.3.11 becomes3.3.20 within its declared range; all other fields match. The whole SDK graph is
therefore not identical. `sdk-graph-preservation-correction.json` records this distinction; no SDK
version or provider-protocol upgrade is included.

The final parent-range matrix verifies43 edges, including optional dependencies, against actual
parent metadata hashes and lockfile integrity. It identifies4 explicit pin exceptions: Next's
PostCSS, markdownlint's js-yaml and markdown-it, and express-rate-limit's ip-address. Same-major overrides alone do
not establish compatibility. Vitest4 configuration preserves fork isolation/concurrency settings;
the unsupported minWorkers CLI option is removed without changing maxWorkers1 or benchmark limits.

The first full recursive unit run failed8 bootstrap tests at their unchanged5000ms deadlines;
1133 other workflow-control tests passed and77 existing optional cases were skipped. Earlier
contracts146/logger10/model-router47 tests passed; recursive execution stopped before later
packages. An isolated idle-source control reproduced the same8 failures/29 passes in92.96s, so
concurrent full-suite load alone did not explain them. Source-level diagnosis was still open at this
initial checkpoint; the later diagnosis and explicit owner test-only exceptions are recorded below.
Those exceptions do not authorize broader deadline or paused-runtime changes.

The new Kit's read-only metadata check also rejects an existing snapshot-parent collision and
nonmonotonic0004/0005 journal ordering. Preserve the finding and original metadata; the separate
migration repair and combined-tree qualification must be assessed before any delivery claim.
Connected browser/Electron, fresh benchmark, hosted controls and required-check activation remain
pending. Source/build successes do not qualify this package draft.

## Compatible follow-up and count reconciliation

The next compatible batch resolves brace-expansion1.1.21, qs6.16.1, body-parser1.20.8,
@humanfs/node0.16.8 and markdown-it14.3.3. Express4.22.3 supports the selected qs/body-parser
versions within its declared ranges. No SDK version or paused runtime/test source was changed.
The current audit has11 entries/11 distinct GHSAs:0critical,3high,6moderate,2low. Its pnpm
metadata counts12 affected advisory instances (7moderate); those are not12 distinct advisories.
`audit-counts-reconciled.json` retains the original baseline/checkpoint count distinctions.

Four compatibility controls pass through the actual Markdown CLI/YAML configuration and the actual
IP key generator, including malformed/duplicate-key rejection and IPv4/IPv6 grouping. Five existing
real HTTP rate-limit/reset tests pass. The four explicit parent-pin exceptions remain disclosed;
prior production Next/CSS build passed on the same PostCSS version, while final connected coverage
remains pending. Independent bounded follow-up review verified all43 parent edges, metadata hashes
and integrity values, and approved the package/config/test correction without findings.

Vitest4 also rejects constructor stubs implemented by nonconstructable return-value callbacks. Two
desktop lifecycle tests failed; replacing only those stubs with ordinary constructable functions
returning the identical objects retains every assertion. All6 lifecycle cases and the full229
desktop tests now pass. No product lifecycle or timeout change was used. Other package suites are
being checked separately while the full batch remains blocked by the bootstrap findings below.

The first partial non-paused recursive run also exposed10 harness factory failures: Vitest4 rejects
the arrow-function constructor mock. Changing only that callback to a constructable ordinary function
preserves the returned object and every assertion. Independent review approved hash
`eed5a7706de821fbc6dae042f4f17a58fd6a70cbd32267f334e507c0cf6162c2`; focused12 and
full773 harness tests across56files pass. No harness runtime or paused source changed.

The first ordinary API run passed464 tests but failed4files before collecting their cases because
Vitest4 resolved variable relative fixture imports from the runner root (`/e2e/...`). The correction
uses module-relative `new URL(..., import.meta.url).href` for the same loopback fixtures and keeps all
assertions. Independent source review approved the seven imports; affected78cases/4files pass in75.93seconds.
A subsequent full ordinary run still failed6of542tests (536pass,3failed/50passedfiles) in2068.70seconds: Git chat/remote and monitoring restart deadlines failed, including a later
remote-origin collision after a timed-out fixture hook. The long delays and collision require
diagnosis; the earlier78-case pass does not waive them. Original logs are retained, with no
retry/deadline increase or full API qualification claimed.

A same-host comparison verified all163 workflow-control source/test files identical: the selected
bootstrap case passed in7.351s under Vitest2 but failed in6.695s under Vitest4's unchanged5s default.
Independent installed-runner source review shows Vitest2 started timing after invoking the function
and omitted elapsed-on-resolve enforcement; Vitest4 starts timing first and checks elapsed time.
This is stricter deadline accounting, not demonstrated slower execution. Eight failures remain
real and retained. The diagnosis itself did not authorize a downgrade, timeout increase, assertion
change or paused-source edit. The narrow owner decisions and behavioral qualification below
supersede that initial decision-pending state; the complete security batch is not yet qualified.

## Bounded bootstrap investigation and host-sleep evidence

The owner explicitly allowed a test-only fixture investigation while preserving all assertions and
five-second limits. One representative real-adapter journey used a fresh bounded beforeEach:
fixture458.627ms, unchanged operational body7494.257ms. Vitest correctly failed the5000ms body
limit;1failed/36name-filtered skips,8.43seconds. Investigation stopped without expanding to the
other seven cases or raising limits. The exact original bootstrap test was restored
(SHA256383f6bd8a7f7dde56796705ff6bb866b5b4d9a105f2de2d644b6ce458f217575); paused
runtime and test diffs were empty at that restoration checkpoint, before the separately approved
test-only changes below. Candidate/log/receipt survive in
`bootstrap-fixture-probe/representative-result.json` under the evidence root. Fixture separation is
not a passing repair; any timing-contract change needs independent review and a specific owner decision.

The full ordinary API run began10:17:37BST and took2068.70seconds. macOS power records confirm
clamshell sleep10:18:45BST and intervening maintenance sleeps until wake10:50:10BST, overlapping
its timeout failures. A fresh awake run is justified by this environmental evidence, with unchanged
source/assertions/deadlines and a command-scoped idle-sleep assertion. This does not prevent lid
sleep, establish that sleep explains every assertion, or qualify the API suite before its result.
Original failure and power records are retained separately.

The awake repeat completed542/542 ordinary API tests across53files in224.17seconds, with
unchanged source/assertions/deadlines and no retries. This qualifies that corrected test source
locally; it does not prove sleep was the sole cause of every earlier failure or replace hosted checks.
The owner separately approved exactly eight aggregate bootstrap test budgets5→30seconds;
all29 other cases, including four passing recovery siblings, retain five-second defaults.
Independent source review verified all18test-definition bodies by TypeScript AST and the exact
eight-case mapping. The focused suite passed all37cases without skips or configured retries in
102.61seconds. A passive reporter confirmed exactly8actual30000ms budgets and29actual5000ms
budgets; sourceSHA2562dfd395fa1b05fca0b8966ed1de23325dab2f64cbc3c5b5ff73d71fd6993299d
was unchanged before/after. Product deadlines, runtime and PR283 remain unchanged. This is a
disclosed aggregate integration-test budget change, not a five-second operational guarantee.
Full workspace ordinary suites and a fresh benchmark remain required.

## 18 October awake follow-up and bounded test repairs

The later recursive attempt ran26614.79seconds and failed56 workflow cases; it is retained in
`security-full-ordinary-qualified-source.log`. Host interruption is a plausible contaminant, but
the later power-log capture was unavailable and does not establish a sole cause. The fresh awake
workflow run then reported7failed/1134passed/77existing optional skips across71files in527.56seconds
(`workflow-full-awake-qualified-source.log`, SHA256
`7c0b45c0df03b44e0e092842509823b7e530189ab12768088337cbb1ab7d12bf`).

Five additional composite bootstrap cases exceeded the five-second default: final-push lease expiry
and recovery after task observation, candidate adoption, commit and push. Two storage failures are
source-backed `document_lease_stale` errors: the real approval recheck includes monotonic elapsed
time, while these unrelated composite fixtures had only100ms leases. A pending rejection could also
win the observation race and skip cleanup; that is a secondary evidence/cleanup defect, not an
excuse to remove the rejection assertion or expiry checks.

The owner explicitly approved both follow-ups in these two test files only. Bootstrap now has
13 aggregate cases at30seconds and24 at5seconds. Storage changes exactly nine collected cases
(30 fixtures) to60second leases, explicitly shortens them before the original logical1100 takeover
and checks preserved epochs. The other20 storage cases and all explicit short-lease expiry checks
retain their original behavior. Guard cleanup releases and settles pending work and closes storage
on failure without swallowing its direct rejection assertion or masking a primary failure.
All original assertion ASTs and bootstrap bodies are preserved; runtime source and PR283 are unchanged.
Independent source review approved bootstrap`874c1d45` and storage`da224d33` with no findings;
`workflow-second-bounded-repair/source-review.json` records exact hashes/mappings. All37+29
focused cases passed without skips/retries in115.58seconds, with unchanged before/after source hashes
and actual collected budgets verified in `workflow-second-bounded-repair/qualified-result.json`.
The normal full workflow package then passed its build and1141cases, with77 existing optional skips,
zero failures and62passed/9skippedfiles (71total), in454.02seconds. It ran once while awake from
15:39:09.755 to15:46:45.247UTC on18October, with unchanged874c/da224d source hashes before/after
and no runtime source diff. Full JSON/console/run-window evidence is retained in the same directory.
This qualifies the corrected package locally; full workspace and combined-source/hosted gates remain required.

The fresh18October audit is unchanged at11entries/11distinct GHSAs,0critical/3high/6moderate/2low,
with12 metadata instances and no new GHSA since the previous draft audit
(`current-audit-20261018.json`, `audit-refresh-20261018-summary.json`). Remaining SDK-owned and
unpatched findings remain visible. The live protected default still has the older dependency tree;
its192 GitHub alert instances are a different population from this draft's11 distinct advisories.

Remaining findings have explicit remediation boundaries; none is suppressed or accepted as clean:

| Resolved dependency path                                                | Remaining advisories and disposition                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai4.3.19 → jsondiffpatch0.6.0`; `ai` and `@ai-sdk/provider-utils2.2.8` | Four GHSAs, including one high. Frozen SDK-family upgrade/continuation feasibility is owned by the separate provider-interoperability task; no transitive major override here.                          |
| LangChain/LangGraph → LangSmith0.3.87 and UUID9/10                      | Five GHSAs, including one high. A coordinated supported parent upgrade still needs a bounded plan and tool/continuation/tracing regressions; disabling tracing in tests does not remove installed debt. |
| Drizzle Kit → esm-loader/core-utils → esbuild0.18.20                    | One moderate development-server advisory. No unsafe major override of this internal loader; the updated Kit still retains this tooling dependency.                                                      |
| Markdownlint CLI → globby/fast-glob/micromatch → braces3.0.3            | One high advisory with no patched version reported by the audit. Retain upstream/parent-replacement investigation; do not invent a fixed version or hide it.                                            |

Exact advisory IDs, affected versions and paths are retained in the raw audit. These paths are not
proof that the vulnerable behavior is exposed by the application. The complete scheduled audit
continues to fail on unresolved high findings; the differential gate addresses newly introduced debt.

Migration repair is now separately delivered by protected PR347 at staging`5c2f6553`, all14executed
checks successful and independently qualified, including genuine full analysis and actual native VM.
The security checkpoint was saved by a normal-hook local commit`6f622ac6`, then reconciled with
actual protected staging`5c2f6553`. The merge retains reviewed Electron42.11.15/Vitest4/Vite7 and the
entire security lockfile, while adding staging's native secure-storage script/check and unchanged
migration/diagnostics source. The earlier statements about unmerged PR345 describe their historical
checkpoints. No owner profile or SDK implementation changes are included.

Both earlier complete sessions reconstruct exactly from their separately preserved unique prefixes
and the common465732byte historical body stored once. Post-format verification proves both original
hashes and the unchanged suffix (`security-staging-history-reconstruction.json`); neither full source
is falsely claimed to occur contiguously twice. The imported push hook drops only Vitest4's unsupported
`--minWorkers=1` option. A proposed permanent workspace-serialization flag passed55 hook controls
but failed four isolation controls solely on their exact expected argument lists. Those controls
live in a third paused test file, outside the owner's two-file exception, so the scheduling proposal
was reverted and that file stayed unchanged. Normal-hook qualification instead uses supported
command-scoped `npm_config_workspace_concurrency=1`, matching CI without a global configuration edit.
Ordinary API followed by a fresh complete benchmark, Git/PATH defenses, assertions and failure
propagation remain intact. Final54 hook controls passed without failures/skips in34.51seconds,
and all four unchanged isolation cases passed in2.66seconds. The original55-pass/four-failure
evidence is retained separately. A first isolation command targeted the wrong package and collected
no tests; its log is retained and does not qualify anything. The corrected package command ran the
real four cases. Combined workspace and connected/hosted checks remain pending.

## Combined-source push and web mock typing

The normal-hook staging reconciliation committed locally at`b6e3b614`, with both reviewed parent
histories retained. The first normal atomic push passed builds for all15 packages but stopped during
web typechecking: fourTS2769 errors in `apps/web/test/git-approval-card.test.ts`. Vitest4's untyped
`ReturnType<typeof vi.fn>` includes constructor signatures and no longer satisfies the callable
`ApprovalDecisionHandler`. Neither remote ref changed; the failed push log is retained as
`security-combined-normal-push.log`. No benchmark or complete test pass is claimed from that attempt.

The test-only correction declares `Mock<ApprovalDecisionHandler>` and supplies that same actual
handler type to `vi.fn`, with no casts or production type widening. Independently transpiled test
JavaScript is byte-identical before/after: assertions, mock behavior and deadlines are unchanged.
All36 affected cases pass without retries/skips in978ms; web typecheck/lint/format pass. The full
combined workspace typecheck also passes (`security-combined-typecheck.log`). Exact source hash
`d33e175e2d2ef87c20de7337ceaca1bbcbde579624616ed09da102c9da9f35db` and actual focused JSON/logs
are bound in `web-approval-mock-typing/source-review.json` and `checks.json`. The corrected normal
push and full test/benchmark/connected/hosted qualification remain required.

## PR350 local qualification and first hosted failures

Exact12a09516 was pushed normally with the reviewed staging baseline5c2. All3667 ordinary tests
passed with77 existing optional workflow skips; all15 builds/typechecks passed. Independent review
recomputed all900 measured/990 fixture-call benchmark values: maximum positive request-p95 overhead
1.138959ms remains below20ms, maximum enqueue-p95 0.008708ms below2ms. This is not owner stress testing.
Lint and formatting passed. Evidence: `security-12a-local-push-qualification.json`, corrected normal
push log and benchmark receipts under the existing external evidence root.

Actual hosted Dependency Security39144548686 did not qualify: the official action's171440-character
complete inventory exceeded Linux's environment-string limit before the guard could start. The
reverse-ancestor comparison correctly returned an empty merge-base diff, so it did not establish
known-vulnerability rejection. Neither job qualifies the security gate; the forward vendor completed analysis, but output binding failed.
The bounded private-file output transport and actual unmodified vendor deterministic-API fallback
are being requalified. Hosted negative graph coverage remains an explicit gap.

The first disposable browser phase recorded19passes/4failures/9blocked dependencies. Four real422
responses showed fixture roots outside the mounted private workspace; two nonpaused specs now honor
the existing workspace-root environment convention, preserving defaults/assertions/deadlines. The
repeat improved to22passes/1failure/9blocked: the remaining slash-init action pressed Enter while Send
was disabled, and the trace confirms no chat POST. Its test must wait for actual Send readiness.
All first-attempt traces remain retained; no product root-cause or timeout change is inferred.

The initial native secure-storage check timed out awaiting macOS Keychain access; a process sample
retains that wait. After the owner handled the local dialog, Electron42.11.15 passed real asynchronous
secure-storage availability and encryption/decryption without an environment key or app credentials.
At that checkpoint full connected qualification was pending; the later results below supersede it.

## Native and connected qualification after reviewed CI repair

All70 local Electron cases passed without retries, failures, skips or flakes in798947.881ms.
Source-bound receipt `connected-12a09516/electron-70-qualified-local.json` records every test and
380 artifact file hashes. Application/package trees remain identical to12a09516 through these
CI/test-only repairs. This covers real managed startup, retained migration history, diagnostics
recording/export/restart, Git, MCP and Stop; the packaged VM journeys here use fixtures and do not
substitute for actual protected macOS VM qualification. Providers are deterministic, without paid
requests or owner-profile access. The independent evidence review is still required.

Five Docker Git browser journeys passed in53.2s and five Stop journeys in44.3s, without retries.
The instrumented MCP block attempt passed with two successful binding responses and independent
persisted target-agent identity, `MCP_POLICY_DENIED`, zero approvals and zero effects. Its earlier
agent-selection failure remains unexplained; instrumentation can alter timing. This is a current
revision result, not a historical cause fix.

A later full browser phase recorded24passes/1GitHub-read failure/7blocked. The trace proves chat
started44.321ms before onboarding approval returned200; the actual provider tool inventory lacked
the requested write tool and the stream reported an unavailable-tool error. The test now awaits
registered approval response, approved backend metadata and visible confirmation before continuing.
Original actions/assertions/deadlines remain unchanged; Electron already awaited that state.
The subsequent full browser phase passes32cases without skips or retries in61.814924seconds; all original failures remain retained.

Actual Dependency Security39146651566 attempt1 at a9e7e19f passed forward comparison and official
fixture controls. Downloaded API artifact digests and every ZIP member were checked; the forward
receipt binds all440 changes to the complete vendor inventory and exact base/head. This proves the
large-output transport in the hosted runner; the negative controls remain deterministic API fixtures.
New harness Sonar findings require another revision: arbitrary CLI paths are removed in favor of
fixed temporary-directory names, Git blob identity uses canonical fixed Git instead of a weak-hash
call, and strict parsing/sequential execution are refactored. Nine safety controls plus all six
actual official-bundle cases pass independently reviewed source. Fresh hosted/Sonar qualification
of this changed source remains required; previous green jobs cannot qualify it.
