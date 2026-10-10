# Task: Remove quadratic whitespace scanning from BashGuard separators

**Beads issue:** `agent-platform-native-staging-redos`  
**Spec file:** `docs/tasks/agent-platform-native-staging-redos.md`  
**Integration owner:** `agent-platform-native-staging-integration` —
[native staging consolidation](agent-platform-native-staging-integration.md)

## Scope and source

Version 1, 10 October 2026. Existing owner consolidation authority covers this bounded security
repair, its tests/review/documentation and conditional merge to the existing feature destination.
No scanner-policy change or paused orchestration resumption is included.

Base/source: `feature/harness-backlog-review` at `732806dc28754bc9176d507516d85e612eaaef5f`.
Task branch: `task/staging-bash-guard-repair`; segment-tip PR into that same feature.
[CodeQL alert 5](https://github.com/jwill9999/agent-platform/security/code-scanning/5),
`js/polynomial-redos`, high security severity, already exists on main and staging as well as
the refreshed PR286 head. It was not introduced by PR290.

`SHELL_SEPARATORS` in `packages/harness/src/security/bashGuard.ts` places ambiguous whitespace
quantifiers before/after fixed shell operators. An explicit compatibility-allowlist call with a long
whitespace run and no separator can take quadratic time. The ordinary product system-tools call
passes no explicit allowlist and returns before this splitter; preserve that behavior.

## Task requirements

- R1: Match only the existing fixed operators: `||`, `|&`, `|`, `&&`, `;`. Remove whitespace
  quantifiers from separator matching; retain existing per-segment trim/tokenization and empty-command
  handling so no permission rule, default behavior or strict allowlist decision changes.
- R2: Preserve every existing deny pattern, prefix/assignment/path handling and custom allowlist.
  Verify all operators with ordinary/Unicode whitespace, empty segments, permitted and unknown commands.
- R3: Prove the public compiled validator completes an embedded whitespace permit/deny case in a real
  bounded Node subprocess. Use static executable test code, structured argv/module URL, empty child
  environment and an explicit process timeout; never execute the input bash command itself.
- R4: Change only the separator definition/comment, affected tests and scoped task/session/closeout
  documentation. Preserve all original artifact bytes, dirty/paused worktrees, separate prototype
  refs, dependencies, model settings, policies and workflow protections.
- R5: Independent source-aware critique/review, local affected gates, full changed-doc Notion
  readbacks, exact-head feature CI/reviews/merge, then actual PR286 source and fresh CodeQL evidence.
  Verify this PR's instance fixed without dismissing the still-unpromoted main/staging instances.

## Dependency order

| Direction  | Beads issue                                 | Gate                                                                    |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Upstream   | `agent-platform-native-staging-codeql`      | Closed: PR290 merged, current PR286 test finding fixed/thread resolved. |
| Downstream | `agent-platform-native-staging-integration` | Blocks on this security repair before final promotion.                  |

Read back both blocking edges in Beads. Deferred prototype qualifications are not dependencies.

## Implementation plan

1. Independently critique this source-backed plan against the actual guard and callers.
2. Replace the separator regex with fixed-operator matching, retaining tokenization logic. Existing
   trimmed segments and caller empty-command skipping make surrounding whitespace matching unnecessary.
3. Add public allow/deny regressions and the bounded actual-compiled-module subprocess test. A build
   is required before that test; ordinary repository CI/push gates already build first.
4. Run Node 24 harness build/typecheck/lint/all unit tests, formatting/direct Markdown checks and
   normal push hooks. Inspect existing system-tool permission/security regressions; no live model call.
5. Obtain independent code review, update actual results/session and the completed CodeQL task's
   closeout, mirror full changed documents and read back. Commit/push, open/attach the feature PR.
6. Inspect current-head CI, all reviews and security findings; merge only after all executed feature
   gates pass with the owner's head-guarded authority. Verify source/CodeQL on PR286 before closure.

## Tests and verification

| Scenario                                 | Requirements | Expected result                                                                                                                                                        |
| ---------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 strict allowlist separator parity     | R1–R2        | Allowed commands remain allowed; unknown commands remain denied across every operator/whitespace/empty segment case.                                                   |
| V2 bounded real-process whitespace input | R1–R3        | Static Node program imports built validator and validates 200,000 spaces with explicit allowlist, with allowed/denied outputs within a 5-second SIGKILL child timeout. |
| V3 affected package regressions          | R2–R4        | Harness build/typecheck/lint/all unit tests and existing tool/security tests pass; no paid provider invocation.                                                        |
| V4 source delivery                       | R4–R5        | Independent review, pushed exact-head executed CI and reviews clear; feature merge tree/source and current PR286 CodeQL instance verified.                             |

No new browser/API/DB journey is introduced: the change is a splitter performance repair in the
public optional strict-allowlist path; ordinary system-tools calls omit that argument. Existing
connected browser/desktop E2E checks still run in hosted feature CI; disclose mocks/optional skips.
V2 must keep the 200,000 spaces BETWEEN non-whitespace tokens: `echo` + spaces + `value`
for permission and `unlisted` + spaces + `value` for denial, using an explicit `echo` allowlist.
Leading/trailing padding would be removed by the public trim and is not a valid regression.
The subprocess validates real compiled code and JSON outcomes; it does not run a shell or arbitrary
input command. Give the test a 10-second harness deadline around its 5-second child deadline so a
regression is terminated rather than hanging the entire test host.

Use `pnpm --filter @agent-platform/harness run build`, `run typecheck`, `run lint`, `run test` on Node24.
The normal pre-push build/typecheck/test/cycles hook remains required. SonarQube MCP/IDE Problems are
unavailable; use compiler/linter/tests and fresh hosted SonarCloud/CodeQL, disclosing that limitation.
The parent still needs its actual full scan, packaged VM and protected staging gates. Green feature
checks, optional test skips or a feature VM skip do not qualify staging.

## Definition of done and sign-off

- R1–R5 and V1–V4 evidenced; old failures/skips/unavailable diagnostics disclosed.
- Upstream closed/dependencies read back; independent critique and code findings resolved.
- Correct task branch, normal commit/push, changed-document full Notion readbacks.
- Segment-tip PR merged to feature after all executed exact-head checks/reviews clear; actual PR286
  source and fresh current-ref CodeQL instance fixed, with global main/staging state distinguished.
- Close/read back/sync Beads only then; parent/evidence tasks remain in progress for staging gates.

**Plan critique:** initial REDOS-PLAN-01/P2 required explicit embedded whitespace because the public
validator trims first. V2 now pins both surrounding tokens, explicit allowlist and SIGKILL bound;
focused independent re-review approved the correction with no remaining actionable plan findings.  
**Implementation review:** independently approved with no actionable findings: fixed operator order,
unchanged public decisions/default behavior, all five strict separator regressions, empty-segment
handling and static real compiled-module subprocess. No technical tool-isolation claim.

**Local evidence:** Node 24.14.0 harness build/typecheck/lint passed; all 686 tests in 49 files passed,
including 65 BashGuard tests and actual local-browser tools integration (9.13 seconds total). The old
compiled separator took longer than the isolated 1-second deadline and was killed with SIGKILL;
the repaired compiled validator returned both expected allow/deny JSON results in 29.62 milliseconds
in a separate diagnostic. This is a bounded regression, not a universal performance guarantee.
Changed-file Prettier and direct Markdown lint of all three documents pass. An attempted standalone
`markdownlint` CLI was unavailable; the installed Markdownlint library with repository rules checked
the full files directly, including task files omitted by the general docs glob. SonarQube MCP/IDE
Problems unavailable as above; fresh hosted results remain required.

**Normal push hooks / hosted / publication / feature merge / current PR286 finding:** pending.
Beads remains in progress; default/runtime security and scanner policy unchanged.  
**Owner authority:** existing end-to-end consolidation repairs and conditional feature/staging merges.
