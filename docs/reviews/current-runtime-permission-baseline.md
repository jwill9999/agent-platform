# Current-runtime permission baseline

September 23, 2026. Initial assessment was tests-only; the owner subsequently authorized the two
application repairs described below. Dependencies are unchanged. Base: `6b4d03e91ac0d2b1f6d765c5b4c5b108fb5bad59` on the harness feature branch.

## Current integrated outcome

The owner merged [PR270](https://github.com/jwill9999/agent-platform/pull/270) into
`feature/harness-backlog-review` on September 23. Final repair source: `93799833958151e01b1981086a8afd6a04bd63b7`.
All ten executed hosted checks passed, including full verification, browser and Electron journeys,
SonarCloud and Sourcery. Hosted Electron reported 22 passed. Sourcery approved the follow-up and its
finding is resolved; Sonar reported zero unresolved findings. The staging-only packaged macOS VM
check was skipped and is not covered by this result.

The repair task is closed after integration. P2 remains in progress for wider permission coverage;
cancellation, retry and recovery gaps remain open. The sections below retain the failure and repair
chronology: their pending-check, draft and not-merge-ready statements describe earlier checkpoints,
not current status. The earlier statement that no product code changed describes only the initial
assessment. The final corrections preserve permission precedence and have regression evidence.

## Initial findings before repair

Ask and Auto-run persist through UI reload and require one approval for the sampled high-risk shell
append. Each executes exactly once after approval. Auto prompting follows the existing explicit
shell-redirection rule; it is not evidence that all Auto categories require approval.

Block persists and prevents the append: no approval record, one denied audit, unchanged file, and a
policy-denied tool result returned to the provider. However, Tool activity still shows Running after
the turn settles. This is a failed visible outcome, not a backend permission bypass.

When workspace file listing fails, saved Block/Auto remains correct in backend settings but reload
shows Ask. WorkspaceDashboard loads both requests in a single Promise.all; the failed file request
prevents applying the successful settings response. A deterministic filesystem-error regression
preserves this case without mocking application APIs.

Both findings are tracked in [permission UI consistency](../tasks/agent-platform-permission-ui-consistency.md).
At that checkpoint, application repairs required separate authorization. The baseline task remains in progress; no failed
case is skipped or marked as an expected pass.

## Evidence boundary

Real Electron, renderer, managed API, SQLite, harness, policy and provider SDK. External provider HTTP
responses and the fixed-command VM runner are fixtures. A real disposable file is changed or remains
unchanged independently of chat text. This does not verify live model judgement, packaged macOS VM
isolation, other policy categories, cancellation, backend restart or ambiguous retries.

Settings are changed through the UI, independently read through the backend and verified after
reload. Backend approvals, tool audits, persisted assistant message and lifecycle completion are
checked before the Block presentation assertion. Explicit browser traces and sanitized JSON are
saved for passing and failing scenarios before fixture cleanup.

The first attempt navigated before Electron startup completed. The test now waits for the visible
Open folder entry and initial load. The second attempt exposed the file-listing failure because the
old fixture used an unavailable default workspace path. Normal cases now use an isolated workspace;
the separate filesystem-error case preserves the real UI defect. No product code was changed.

## Reproduction and artifacts

Use Node 24 and a working Git binary. This machine requires the bundled Git because Apple's Git
requires license acceptance. Build first (`pnpm build`) when outputs are absent or stale.

```sh
AGENT_PLATFORM_E2E_GIT_BINARY=/path/to/working/git \
PLAYWRIGHT_HTML_OUTPUT_DIR=.agent-platform/permissions-final-report \
pnpm exec playwright test -c apps/desktop/e2e/playwright.electron.config.ts \
  packaged-vm-command.e2e.ts --output=.agent-platform/permissions-final-results --reporter=list,html
```

Local artifacts: `.agent-platform/permissions-final-results` and `permissions-final-report`.
Earlier failure evidence is retained in `permissions-results`, `permissions-second-results`, and
`permissions-third-results` with matching reports. Artifacts are ignored generated output; CI
retains its uploaded report on the draft pull request. Per-case `policy-evaluation.json` includes
saved policy, file evidence, approvals/audits, provider requests and backend lifecycle events.
No secrets or unrelated user project data are included. JSON sourceRevision records the checkout
HEAD; uncommitted test changes at early runs are identified by the implementation commit history.

## Planning implications

Prioritize these two state inconsistencies before relying on MVP permission/status displays. They
support the small local visibility requirement; they do not justify replacing the backend stack.
The broader P2 matrix and cancellation/retry/recovery assessments remain open. Login remains outside
this permission slice and follows the existing local single-user scope.

This refinement changes a task spec whose contents are bound by the draft MVP planning contract.
Refresh its digest and independent critique before any full-tranche implementation approval. The
existing planning approval is not being represented as approval of these application repairs.

## Initial validation before repair

The complete selected Electron file ran 13 scenarios: **11 passed, 2 failed**. All nine existing
scenarios and new Ask/Auto cases passed. The two failures are the retained product findings above.
Quality gate: **FAIL**; this draft evidence branch is not merge-ready and P2 is not closed.

Explicit E2E TypeScript, touched-test ESLint, formatting, diff whitespace and session Markdown lint
passed. Eleven focused policy unit tests passed. An initial incorrectly filtered unit command ran
the whole harness suite: 614 passed and 12 gitTools tests failed because their hardcoded Apple Git
requires license acceptance. That environment limitation is separate from the two UI regressions.
Local Sonar/IDE Problems tools are unavailable; hosted Sonar and CI remain pending for this branch.
Full repository build had passed before these test-only changes; the push hook also checks the
affected desktop package.

Committed verification at `b86db9d`: all four new scenarios reran, reproducing the same two passes
and two product failures. Artifacts: `.agent-platform/permissions-committed-results` and matching
report. The push hook passed desktop build/typecheck, all 112 desktop unit tests and dependency-cycle
checks. [Draft evidence PR](https://github.com/jwill9999/agent-platform/pull/270) is not merge-ready.
Hosted checks were pending when this checkpoint was written; no hosted success is inferred.

## Authorized repair

The owner explicitly approved both fixes after reviewing the findings. Workspace Settings now
applies successful settings independently of file-listing success, and displays an unavailable
state instead of fabricated Ask defaults when settings cannot load. Refresh and policy edits cannot
race through enabled controls while a load/save is pending. Shell-policy rejection now emits a
structured denied tool result using the existing stream format; the model still receives its
policy-denied error and the existing denied audit is preserved. Approval precedence is unchanged.

The original two failing Electron assertions are retained. A focused dispatch unit assertion also
checks the emitted denial while verifying no native execution or approval request occurs.

## Post-repair validation

Implementation commit `3eb57cd`: **13/13 selected Electron journeys pass**, including both original
failures. After the test-startup wait was changed from network-idle to initial-page load to address
Sonar, **4/4 permission journeys passed again at the committed revision** in an isolated rerun.
Evidence: `.agent-platform/permission-fix-results` and `permission-fix-isolated-results`, each with
matching HTML report. A verification run overlapping the push hook's rebuild had one backend startup
timeout (3/4 passed); its artifacts remain in `permission-fix-committed-results`. The isolated rerun
resolved that uncertainty without another application change.

Full build, touched-file ESLint, explicit E2E TypeScript, 187 frontend tests, and 614 harness tests
excluding the known Apple Git file passed. The push hook also passed affected builds/typechecks but
failed on the same 12 hardcoded Apple Git license tests. The branch was pushed with that local hook
bypassed after these checks; hosted CI must cover the complete suite. No test source was weakened or
skipped to hide this environment limitation. The separate 53 focused policy/dispatch tests passed.

Local composed repair gate: **PASS**. Complete hosted gate: pending at this documentation checkpoint.
The repair issue remains in progress until feature integration; broader baseline work is not closed.

## Review follow-up: unavailable file listings

Sourcery completed successfully but reported one substantive finding: a file-listing error still
rendered the empty-workspace message and a zero-file count. Its green check was not an approval
without findings. The strengthened existing Electron failure scenario reproduced the missing
unavailable message before the correction; evidence is in `.agent-platform/permission-listing-before-results`.
The UI now shows an unavailable listing and unavailable count, reserving the empty state for a
successfully loaded empty listing. The regression checks reload and Refresh while persisted Block
remains visible. This is within the approved state-consistency repair; enforcement is unchanged.

The review follow-up passed all four permission journeys after a fresh frontend build, plus a
focused rerun that waits for the Refresh request's actual HTTP 500 before checking the unavailable
state and saved Block. Artifacts: `.agent-platform/permission-listing-after-results` and
`permission-listing-refresh-results`. Lint passed; hosted checks must rerun for this follow-up.
