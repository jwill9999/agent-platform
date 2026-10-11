# Task: Repair coordinator descendant test generated-code finding

**Beads issue:** `agent-platform-native-staging-codeql`  
**Spec file:** `docs/tasks/agent-platform-native-staging-codeql.md`  
**Integration owner:** `agent-platform-native-staging-integration` —
[native staging consolidation](agent-platform-native-staging-integration.md)

## Scope and source

Version 1, 10 October 2026. The owner authorized routine consolidation repairs and merging into
the existing feature/staging destinations only after actual checks and actionable reviews clear.
This repair concerns an already delivered test, not the unfinished paused orchestration work.

Source: `feature/harness-backlog-review` at `6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec`.
Task branch: `task/staging-codeql-repair`; segment-tip destination: `feature/harness-backlog-review`.
The protected staging promotion remains [PR286](https://github.com/jwill9999/agent-platform/pull/286).
The finding is [CodeQL js/bad-code-sanitization](https://github.com/jwill9999/agent-platform/pull/286#discussion_r4238069048)
in `packages/workflow-control/test/coordinatorTransport.test.ts`, originally line 74.
The fixture serializes paths into JavaScript and embeds that source in `node -e`.
This record does not assert a demonstrated production injection or dismiss the scanner finding.

## Task requirements

- R1: No ready/marker path data is inserted into executable JavaScript. Use static child source;
  transport paths as JSON stdin to the pinned adapter, then as child argv.
- R2: Retain the real descendant readiness handshake, abort rejection and absence of the delayed
  filesystem effect. Verify that subsequent transport calls are rejected after abort.
- R3: Exercise paths containing quotation marks and a newline as data. Preserve cleanup and the
  existing credential, executable-pin and authority-denial coverage.
- R4: No runtime source, policy, dependencies, scan configuration, historical artifact bytes,
  paused branch or dirty unrelated checkout changes.
- R5: Independently critique the source-backed plan and review the implementation; retain results.
  Deliver through exact-head feature checks and actual source verification before resolving PR286's
  thread. Parent consolidation still requires full protected scan, real VM and integration gates.

## Dependency order

| Direction  | Beads issue                                 | Gate                                                 |
| ---------- | ------------------------------------------- | ---------------------------------------------------- |
| Upstream   | `agent-platform-native-development-handoff` | Delivered/closed; original feature source available. |
| Downstream | `agent-platform-native-staging-integration` | Depends on this repair before full promotion.        |

Add both blocking edges to Beads and read them back. Do not add dependencies on deferred prototype
qualification tasks or resume their scheduling.

## Implementation plan

1. Obtain independent source-aware critique of this specification and the existing transport/process test.
2. Write a static child fixture inside the test's owned temporary directory. It reads paths from argv,
   writes the ready handshake, schedules the delayed marker and remains alive until process-group abort.
3. Use a static pinned adapter body: read JSON stdin and spawn the fixture with argv, without a shell,
   generated JavaScript or path interpolation. Pass child/ready/marker paths through `port.call`.
4. Keep readiness, abort and late-effect assertions; add post-abort denial to the descendant case.
5. Run affected package gates on Node 24, independently review the actual diff and repair findings.
6. Save actual evidence in this spec/session; mirror full documents to branch-specific Notion pages
   and read back. Commit/push through normal hooks and open the segment-tip feature PR.
7. Inspect all latest exact-head checks, security findings and review threads even while CI is red.
   Merge only after the owner's conditions pass; verify PR286 contains the fix before resolving its
   finding. Close/read back and sync this task only after all declared delivery gates pass.

## Tests and verification

| Scenario                           | Requirements | Expected result                                                                                                           |
| ---------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| V1 real descendant cancellation    | R1–R3        | Static script receives literal unusual paths, ready file exists, abort rejects, delayed marker absent, next call denied.  |
| V2 transport regressions           | R2–R4        | All existing pin, credentials and authority tests pass.                                                                   |
| V3 package quality                 | R4           | Package build/typecheck/lint/all unit tests and changed-file formatting pass on Node 24.                                  |
| V4 source review / hosted delivery | R1–R5        | Independent review and all executed current-head checks clear; no unresolved/blocking review, source merged into feature. |

Use `pnpm --filter @agent-platform/workflow-control exec vitest run test/coordinatorTransport.test.ts`
for focused V1/V2, then the package's build/typecheck/lint/test scripts for V3 and normal push hooks.
SonarQube MCP is unavailable on this host; compiler/linter/tests plus hosted SonarCloud and CodeQL
are the available fallback. IDE Problems diagnostics are not exposed; do not invent their result.
Browser/API/DB/UI and live model journeys are not applicable: only a subprocess test fixture changes.
The test uses real local Node processes and filesystem effects, not a model gateway or production run.
Protected staging's actual VM and full security scan remain mandatory parent gates; a feature-targeted
VM skip is not staging qualification. No paid call, scan waiver or unchanged failed-input rerun.

## Definition of done and sign-off

- R1–R5 and V1–V4 are evidenced, with failed/skipped/unavailable coverage disclosed.
- Upstream is closed and dependency readbacks match this specification.
- Correct task branch, normal commit/push, independent review, full spec/session Notion readbacks.
- Segment-tip PR merged to the feature after exact-head checks/reviews pass; actual PR286 source
  verified and CodeQL thread resolved on evidence. This is not a staging-ready claim.
- Beads close/readback/Dolt sync occurs only after those gates; parent remains in progress.

**Plan critique:** independent source-aware reviewer approved version 1 on 10 October; no actionable
findings. Review inspected the transport and POSIX process-group settlement implementation. Use a
static `.cjs` fixture, non-detached child and no shell; no inherited-tool isolation is claimed.  
**Implementation review:** independent source-aware reviewer approved the static `.cjs` fixture,
structured argv data, process-group membership, readiness/abort/late-effect/post-abort assertions and
failure cleanup; no actionable findings. No runtime source or historical evidence changed.

**Local evidence:** Node 24.14.0 build/typecheck/lint passed; five focused transport tests passed.
First full package attempt: 1,139 passed, one failed, 77 skipped; 137.52 seconds. The unchanged
`orchestrator.test.ts` credential-revocation test exceeded its specialist reservation deadline during
parallel execution. This is retained as a failure, not waived or called green. Focused diagnosis passed
all 23 orchestrator tests. First normal push then passed 1,139 tests but
failed the unchanged standalone coordinator executable-pin test; its focused rerun passed. The hook
prepends Xcode's Git exec directory: `which git` selects a noncanonical symlink while the fixture pin
requires an exact real path. The normal-hook retry supplied supported `WORKFLOW_GIT_BINARY=/usr/bin/git`
and Vitest 2.1.9 `VITEST_MAX_FORKS=4`, `VITEST_MIN_FORKS=1`; all timeouts/tests remained unchanged.
All 1,140 tests passed, 77 optional integration tests skipped, 62 files passed/9 skipped, 147.70 seconds.
Normal circular-dependency/build/typecheck/test hooks and push passed at `72411e80be45e9c29e98bc4d66b826c8b071613d`.
The test source is unchanged in subsequent documentation-only updates. IDE Problems/SonarQube MCP
unavailable as disclosed above. Hosted SonarCloud/CodeQL results remain separate delivery gates.

**Hosted delivery / PR286 thread / mirrors / Beads closure:** completed for this bounded scope.
[PR290](https://github.com/jwill9999/agent-platform/pull/290) merged on 10 October at
`732806dc28754bc9176d507516d85e612eaaef5f`, after all ten executed exact-head checks passed
on independently reviewed `7c28c838a8f81bad78b76592dd6403977462a2f3`; review approved, no unresolved
threads. Merge tree `03dd9594fb22a929fb4f03968c8629b74a7f9a14` equals reviewed source.
The feature-targeted VM skip does not qualify staging. Both full task/session mirrors at `7c28c838`
were read back with revision/body/hash, preserving earlier snapshots. Fresh actual PR286 source
contains the static fixture; its new CodeQL analysis reports alert 10 fixed on `refs/pull/286/head`,
and the original thread is resolved. Beads task closed/read back; latest closeout synchronization is
recorded separately from earlier successful sync. Existing high-severity BashGuard alert 5 predates
PR290 and is tracked by `agent-platform-native-staging-redos`; this closure does not resolve that
alert, the scanner size/context failures, or staging's actual VM gate.  
**Owner authority:** existing end-to-end consolidation and conditional merge grant; no new pilot grant.
