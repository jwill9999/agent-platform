# Current-runtime permission baseline

September 23, 2026. Initial assessment was tests-only; the owner subsequently authorized the two
application repairs described below. Dependencies are unchanged. Base: `6b4d03e91ac0d2b1f6d765c5b4c5b108fb5bad59` on the harness feature branch.

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
