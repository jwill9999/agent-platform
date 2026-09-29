# Single-task permission pilot verification plan

Owner: `agent-platform-pilot-zero.13` planning; scoped P4.1 execution slice.
See [plan and readiness gaps](../planning/single-task-permission-pilot/plan.md) and
[scope](../tasks/agent-platform-harness-baseline-p4.1.md). All results below are **planned**, not run.

| Scenario | Requirements / layer                | Inputs and assertions                                                                                                                                                                                                                                              | Evidence / completion rule                                                                                                                                                 |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PP-U1    | PP1–PP3, backend regression         | Real dispatcher/policy/PathJail; allowed in-project write approved, then fresh escape call in same session; deny outside operation and assert executor not called for it                                                                                           | Named Vitest assertion, request identities and no-effect assertion; fixture executor is not connected E2E                                                                  |
| PP-E1    | PP1–PP3, Electron connected journey | Save Ask in real Settings; approve in-project direct write; verify file bytes; scripted local provider then requests sibling outside path with fresh call ID; UI settles denied, outside sentinel unchanged, no successful outside audit, approval cannot transfer | Playwright trace, screenshot, sanitized persisted settings/approvals/audits, provider tool results and independent before/after bytes; no page-only or mocked backend pass |
| PP-O1    | PP4–PP5, managed progression        | Approved exact task run imports worker patch and proceeds verification → review → integrated evaluation/delivery without human nudge                                                                                                                               | Journal/receipts, revision and artifact hashes, latency timestamps, attempts, intervention log; no fixture result substituted for actual run                               |
| PP-G1    | PP3–PP5, final integrated gate      | Rerun affected package tests, lint/typecheck/build, affected Electron journey and required hosted checks at delivered head; compare imports and evidence                                                                                                           | Every required result passed and independent review complete; missing or failed checks block acceptance                                                                    |

Reuse `packages/harness/test/toolDispatch.test.ts` (existing pre-approval shell escape assertion) and
`apps/desktop/e2e/packaged-vm-command.e2e.ts` (existing direct-write approval/denial fixtures). The new
journey must use a two-request provider sequence, not silently rewrite an already-approved call.
The API, SQLite, dispatcher, approval processing and direct-file executor are real. Only external
model behavior is scripted locally; no live-model reasoning or packaged macOS VM isolation claim.

Candidate commands after current builds:

```sh
pnpm --filter @agent-platform/harness exec vitest run test/toolDispatch.test.ts
pnpm exec playwright test -c apps/desktop/e2e/playwright.electron.config.ts \
  packaged-vm-command.e2e.ts --grep 'pilot hard-path restriction'
```

The proposed test name does not exist yet. Linux requires Xvfb and qualified Electron dependencies;
macOS requires the supported Electron runner. Set the supported Git override if Apple Git is blocked.
No dependency install or network expansion is implied. Qualify the managed runner first; its source
mount stays read-only and builds/reports use approved scratch/evidence locations.

Retain failures before reruns, separate expected denial from infrastructure failure, redact credentials,
clean all disposable roots/services, and retain hashes plus sanitized evidence. Report passed, failed,
skipped, blocked and not-run independently. Final feature integration belongs to the same pilot result,
while broader P4, staging and the later two-task pilot remain outside acceptance.

## Exact denial oracle and fixture control

Seed different bytes in the in-project target and outside sentinel. Before starting the app, prove both
files are writable by the disposable fixture owner, then restore their seeded bytes. Record the first
approval's session, tool, immutable argument identity, approved terminal state and successful audit.
For the second distinct provider call, retain evidence that it reached the real dispatcher and returned
`PATH_ACCESS_DENIED` (or the current documented hard-path error, verified before implementation).
Assert the denied audit's call/session identity and lack of authorization linkage to the first approval.
A missing request, timeout, disconnected backend or generic infrastructure error does not pass denial.
Do not assert a specific new error contract without first checking existing application behavior.
