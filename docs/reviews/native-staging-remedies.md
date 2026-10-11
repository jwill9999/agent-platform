# Native staging remedies — reviews and actual results

## Independent plan critique

Distinct source-aware `staging_integration_review` approved archive-policy plan version 1 and
the scoped CI concurrency change without actionable findings. Verified the original selection
digest and default-main registered workflow path; confirmed current staging protections retain
security-scan/app15368 and resolved-thread requirements. Mandatory independent protected dispatch
provenance adds a gate; the ruleset's context alone does not enforce it. Implementation and independent source review are complete; actual hosted scanner, dispatch and
packaged VM qualification remain pending.

## Runner diagnosis and setup

Independent timeline review found old PR288 download/extraction succeeded19:32:20–21UTC10October,
then cancellation arrived20:32:18; PR286 download/extraction succeeded20:37:22–23, cancellation
arrived21:37:20. Exact cancellation origin is unconfirmed. Both were already stalled in setup.
ExFAT/local unlink observation is a plausible contributor, not a proven sole filesystem cause.

Owner-authorized fresh APFS dev 23, official same runner 2.337.0, actual package checksum and
idle/no-worker identity guard succeeded. Old Listener stopped gracefully; original installation
remains intact. No service or credential copy. PR286 unchanged head542e082e, CI 38081623129 attempt 2,
job 114337873032: setup4 seconds and checkout3 seconds, Node/pnpm/install/native rebuild/Electron/
host preflight/pinned assets/Swift compilation succeeded. Signing then failed because scripts
expected `.build/arm64-apple-macosx/debug/macos-vm-runner` but the actual Swift output was
`.build/out/Products/Debug/macos-vm-runner`. No packaged VM journey ran. A bounded output-path
repair is required; this is a new concrete failure after the preparation stall was cleared.

[Actual VM job](https://github.com/jwill9999/agent-platform/actions/runs/38081623129/job/114337873032).
Sanitized host/setup/source evidence is retained outside Git under
`/Users/letuscode/.codex/staging-integration-20261010`.

## Independent archive data review

Distinct `runner_plan_critic` verified all 220 original blobs, mode 100644,3,958,506 bytes and all 139
JSON files. No confirmed credential exposure found by known token/private-key/auth/credential/JWT/
URI patterns. Retained low-severity metadata: local paths in 58 files; owner/application email
metadata in four reports; historical command/tool instructions in 10 files. These remain inert data,
never execution/configuration/authority. Literal reference inspection found docs/session references,
no executable consumer; dynamic discovery is not excluded.

PR288 exact2ad1a88a GitGuardian succeeded; internal rules and archive-byte coverage are unavailable.
This is not exhaustive secret detection, adversarial model testing or Promptfoo analysis.
Independent full sanitized evidence SHA256:
`599524f8120be052d77a46299ed8cc0daa0fa88adaa4b077b6567134eec1575e`.
Preserve archive bytes and disclose metadata rather than silently redacting/deleting original source.

## Packaging repair review and local connected qualification

Independent code review found PACK-01: the original package build selected `swift` from PATH,
while discovery/package builds selected `/usr/bin/swift`. Repaired the package build command and
its contract test to use canonical `/usr/bin/swift` with the same package arguments. CI now resolves
once before signing, signs that structured explicit helper path and packages that exact path.
The remaining resolver/signing/packaging validation had no actionable initial findings; focused
re-review approved the correction and closed PACK-01.

Actual local checks: 12 resolver Node tests and 8 desktop packaging/script tests pass; full build,
typecheck, formatting and final lint pass. The earlier lint failure (unused process declaration)
is retained in the original log and corrected by the actual signer CLI argument handling.
Real Swift compilation, development-entitlement signing, pinned-asset packaging and packaged
signature verification pass: signature verified, virtualization entitlement true, quarantine absent.

The existing packaged Electron journey ran locally with the real signed helper and checksum-pinned
guest assets: 2 tests pass. Healthy command path uses the real VM and checks its workspace output,
runner ready status and absence of host path/secret canaries; unhealthy-runtime denial uses the
existing failure fixture. Model provider remains a deterministic external double. Evidence is
`apfs-vm-local-e2e.log`, `apfs-vm-e2e-evidence/success.json`, signing report and package/asset hashes
under the external evidence root. This establishes local connected behavior, not final-head hosted
qualification. Required actual staging packaged VM must still execute on the eventual PR head.

## Archive implementation review findings

The packaging correction is now independently approved: PACK-01 closed, no remaining signing/
packaging/resolver/concurrency finding. Archive classifier, original-object identity, JSON/data
boundary and protected independent-review receipt have no identified source-review defects.
The first frozen archive suite passed 19 tests, zero failures/skips; formatting, syntax and
targeted lint passed. Synthetic real-original-blob qualification is not hosted adoption proof.

Independent reviewers requested these corrections before archive implementation approval:

| Finding           | Defect                                                                                                                             | Required disposition                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-REVIEW-01 / P1 | Vendor action emits valid SARIF for the client's successful-looking `No files to scan` response and drops raw skipReason metadata. | Source-bound fail-closed raw-response guard before conversion; reject skips/mock/no-files; test actual pinned shapes and record original/guarded bundle hashes. Do not broaden or hide ordinary built-in omission limits. |
| AP-REVIEW-02 / P1 | Isolated action cwd prevents its base fetch; detached data checkout lacks local staging ref, so literal staging diff fails.        | Create/check the exact local base ref before action and verify it afterward; test detached checkout with only remote base refs.                                                                                           |
| V01 / high        | Static local helpers execute before the verifier's self-only protected-source check.                                               | Builtin-only bootstrap verifies the complete local dependency bundle before dynamic import; substituted-helper execution sentinel test.                                                                                   |
| V02 / medium      | Latest successful attempts can change while artifacts and objects are recomputed.                                                  | Final reread of both run identities/attempts/status and latest automatic current-head run; mid-verification rerun/race negative tests.                                                                                    |

The four corrections are implemented. The frozen corrected suite passed 22 tests, zero failures
or skips, in 97.852 seconds. Six scripts passed targeted ESLint; nine owned files passed explicit
formatting; all three embedded workflow scripts passed syntax checks. Negative-control Git/ZIP
errors in the log are expected test effects.

Independent verifier re-review approved V01 and V02 with no findings. It inspected all source and
race controls and independently ran the malicious-adjacent-helper sentinel test successfully.
A final verifier check cannot atomically prevent later GitHub changes; repeat it immediately before
an exact-head protected merge. Hosted qualification remains necessary.

Independent scanner re-review closed AP-REVIEW-01 and AP-REVIEW-02, then found AP-REVIEW-03:
`git show` of the pinned 1,856,068-byte vendor bundle used Node's default 1 MiB subprocess output
buffer and would fail before analysis. The repaired read uses a bounded 4 MiB buffer. A regression control with the actual pinned vendor
bundle reproduces the old `ENOBUFS`, then reads all exact bytes with the production expression and
accepts the guard. Three targeted tests pass, plus an offline same-size large-blob control;
focused final critic re-review independently ran all three controls and approved source delivery
with no remaining findings. No model call was made during this verification. The verifier's adopted-policy
SHA proves ancestry/control-byte binding; coordinator-recorded actual full scan, VM and review
evidence is still necessary to establish that adoption was qualified. No ruleset/context alone
or verified receipt substitutes for all actual merge gates.

The final frozen complete archive suite, including the large-blob regression, passed 23 tests,
zero failures, cancellations or skips, in 101.548 seconds. The independent scanner critic approved
all nine owned source files; the verifier critic approved its full corrected scope. Reviews establish
source delivery readiness only. Final actual hosted analysis/VM and protected provenance remain gates.

## Push-hook discovery correction

The first normal push hook passed affected build/typecheck and all 113 desktop Vitest assertions,
then failed because Vitest also discovered the standalone Node test file and found no Vitest suite.
Rename that file to `resolve-macos-vm-helper.node-test.mjs`, outside Vitest's default discovery
pattern, while retaining its explicit `node --test` invocation in CI. No assertions, test runner,
hooks or timeouts are disabled. Fresh affected Vitest passes 113 assertions in 17 files; the explicit Node invocation passes all
12 resolver tests. Both test runners now select their intended suites.

## Initial hosted feature findings

At exact `2dd99c6f`, lychee failed only the old Agent Zero GitHub usage-document URL with HTTP503
in the retained historical gap analysis. Carry the identical official raw Markdown URL repair
already reviewed on the full consolidation/primer branches; preserve the rest of that document.
Fresh head link checks are required. Sourcery skipped because its weekly review budget is exhausted;
its generated summary is not a code review. The distinct independent source reviews remain recorded.

## Hosted Sonar findings at the reviewed delivery tip

At exact `e3c8523f`, hosted SonarCloud returned 41 open issues and failed new reliability/security
ratings (both 4; required 1). Direct public API readback is retained as `pr292-sonar-issues.json`.
Prior source-review approval does not clear this actual hosted gate. No issue is suppressed or
silently accepted, and staging remains unchanged.

Four resolver-test warnings concern literal public temporary paths. Replace these with unique
`mkdtemp` fixtures while retaining malformed multiline/NUL output, environment injection,
quote/space and cleanup assertions. All 12 Node tests pass; independent focused critic approves
that exact test change, with the production helper unchanged.

Independent archive security triage requires three bounded corrections: fixed trusted Git/Python
executables and child environments (S01); explicit Git helper command/arity/options/SHA/path
contracts, including fetch-ref validation (S02); exact repository API route/query contracts,
rejecting traversal/encoded separators/backslashes/unknown queries (S03). Existing callers already
validate IDs and revisions and no shell injection or off-host credential forwarding was shown;
helper-level contracts still need strengthening. Remaining reported sorting/type/complexity/style
issues must be addressed without changing trust boundaries. The bounded implementation is complete and both critics approve source delivery. Git/Python use
fixed `/usr/bin` paths with minimal child PATH. Supported Git commands/arguments/revisions/tree
paths and normalized absolute repository roots are validated; fetch refs reject before side
effects. Exact GitHub endpoint/query contracts retain fixed origin and redirect denial. Reported
sorting, typing, complexity and independent-read awaits are corrected without suppressions.

The frozen affected suite passes 26 tests, zero failures/cancellations/skips, in 97.544 seconds.
After fixture-only temporary-path changes, three malicious boundary controls pass; five connected
pinned-bundle/API/fetch controls pass. Critics independently ran six and three focused controls
and approved final source/test hashes. Six scripts pass focused lint, nine owned files formatting,
three workflow blocks syntax and diff checks. The parent resolver test still passes all 12 cases.
No VM/model call is repeated for these script/test changes. Fresh actual hosted Sonar and all
current-head pipelines remain required; no closure of the e3 hosted result is manufactured.

## Second hosted Sonar result and bounded repair

Actual `bdcb34b3` analysis reduces open issues from 41 to 12. Reliability/security ratings improve
to 3 but still fail the required 1; duplicated new lines are 5.5% against the 3% limit. Remaining
reports include two argument-tampering traces, two type/constant-check bugs and minor regex/string
style findings. Preserve this failed result and its direct API evidence as
`pr292-sonar-bdcb-issues.json`; no merge readiness is implied.

Independent trace review found no accepted option/ref injection through the strict lowercase
40-hex SHA guards, but the actual hosted findings still require disposition. Critics approve a
bounded implementation plan: validated SHA data through fixed-argument Git batch/fetch stdin;
minimal builtin-only protected-source bootstrap rather than duplicated full dispatchers; reuse
complete Git/API helpers only after all six protected controls are bound and privately copied.
Preserve exact blob framing, missing-object failure, all authenticated route/identity boundaries,
run/job/receipt/current-head fences and source immutability. Do not normalize unsafe input into
acceptance, suppress reports, pad code to reduce density or weaken scan/protection rules.
The second-pass implementation is source-reviewed by both distinct critics with no remaining
actionable findings. The minimal bootstrap binds all six protected control blobs before private
helper imports; Git batch/fetch input uses fixed arguments and strictly validated SHA stdin.
Binary bytes, object framing/type/size, missing-object failures and existing provenance fences
are preserved. One critic requested malformed scalar bootstrap-ref coverage; those direct option,
branch and newline-SHA tests now assert rejection before directory creation or network access.
The critics independently passed seven and four focused controls. The complete affected suite
passes 28 tests, zero failures/cancellations/skips, in 92.435 seconds. After the final test-only
scalar-input amendment, two relevant API/fetch controls pass. Fresh actual hosted Sonar remains
required; source approval and local tests do not clear the failed hosted gate.

## Third hosted Sonar result

Actual `a86f4d72` analysis reduces open issues to two. New reliability rating is 1, maintainability
rating is 1 and duplicated new lines are 0.0%; those conditions now pass. Security remains 3
against required 1, so the gate still fails. Remaining S6350 traces remote PR data through the
strictly SHA-validated ancestry check to the generic Git invocation; a minor Set-membership
finding remains in the bootstrap. Evidence: `pr292-sonar-a86-issues.json`.

The failed result remains authoritative. Both plan critics approve a dedicated ancestry operation
with literal Git arguments, an explicit `--` operand boundary and unchanged strict SHA/repository
guards. It is implemented for both archive classification and adoption ancestry; the generic
dispatcher no longer accepts ancestry operations. Only status 1 returns non-ancestor; missing
objects and process failures propagate. Bootstrap control membership uses a Set with unchanged
six-control iteration. Both distinct independent critics approve final frozen source with no
findings; they independently pass two and one focused controls. Complete affected suite: 29
passed, zero failed/cancelled/skipped, 94.365 seconds. Six scripts pass lint, nine owned files
formatting, six modules and three workflow blocks syntax, and diff validation. Captured actual
output: `pr292-ancestry-suite-20261011.log`, SHA256
`21cab092181c01c12e6a24c3a62fc16fd527a66401304402330fdc013d480097`, in the external evidence root.
No issue suppression or false-positive disposition is manufactured. Fresh actual hosted
analysis remains required; the previous failed gate is not relabeled.

## Fourth hosted Sonar result and commit-identity boundary

Actual `2d10d8b2` remains failed with two S6350 reports: the dedicated ancestry invocation and a
Git tree read in automatic-workflow provenance. Reliability, maintainability and duplication
conditions pass. Explicit operand boundaries and strict SHA guards remain defense in depth;
the analyzer still reports the remote-response flow. Evidence: `pr292-sonar-2d-issues.json`.
No accepted argument-injection path is established by the independent reviews, and no issue is
suppressed or falsely declared resolved.

Both independent plan critics approve a bounded content-integrity refinement: after exact batch
framing/type checks, recompute the object identity from untouched raw payload via canonical Git
`hash-object --stdin -t TYPE --no-filters`, with fixed type enum and no `-w`. Require computed ID,
parsed header ID and original requested strict SHA to match exactly; then use that verified ID
for subsequent object operations. This adds payload verification rather than echoing a header.
Original API/receipt IDs and approval bindings remain equal; mismatch fails, never normalizes
into another revision. The [Git object format](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects),
[batch framing](https://git-scm.com/docs/git-cat-file) and
[raw read-only object hashing](https://git-scm.com/docs/git-hash-object) are the source contracts.
The implementation is frozen and both distinct critics approve all affected source with no
findings. Independent focused controls pass three and two tests, covering unchanged binary bytes,
forged headers, same-length body tampering, malformed computed output and ancestry denials.
The complete affected suite passes 30 tests, zero failures/cancellations/skips, in 172.225 seconds.
Revalidating raw commit content at every exported tree lookup increases fixture runtime; no
unreviewed cache or bypass flag is introduced. Six scripts pass lint, nine owned files formatting,
six modules and three workflow blocks syntax, and diff checks. Actual output is retained in
`pr292-content-identity-suite-20261011.log`, SHA256
`a25b9db974c6684ff17f484a491531609451cbb30f43d385c56a837192609636`, in the external evidence root.
Fresh actual hosted analysis remains required; this does not establish a prior accepted
injection exploit or relabel the previous failed gate.

## Pending delivery gates

Actual policy-adoption full scan and VM, protected archive
dispatch/merge verification, PR288 intermediate delivery, PR286 final full scan/VM/consolidation
and cleanup remain incomplete. Earlier provider/volume scan failures remain failed. No staging
merge, task closure or development readiness is implied by these reviewed plans and local results.

## Preservation checkpoint

Paused checkout retains exactly the previous head, status, tracked diff hash and all untracked
file hashes (13 paths). Primary retains its head, status and untracked hashes; its prior dirty
diff is reconstructed exactly after removing only the two authorized new child-task status
journal appends. The real primary Git index is unchanged. Current whole primary diff hash
appropriately differs; no blanket unchanged claim. Evidence: `resumed-preservation-current.json`
and `resumed-primary-journal-proof.json` outside Git. Original separate branch tips and all
archive source/recovery objects remain retained.
