# Bug: Isolate Git hook environment from temporary-repository tests

**Beads issue:** `agent-platform-hook-isolation`  
**Spec file:** `docs/tasks/agent-platform-hook-isolation.md`

**Priority:** P2; repair implemented locally, independent review and publication pending.

The Beads description must begin with `Spec: docs/tasks/agent-platform-hook-isolation.md`.

## Requirements

Prevent inherited Git-local environment from directing temporary-repository tests at the real
repository. Preserve normal local checks and their failure propagation; do not permanently bypass
hooks. The observed failure changed the parent repository's core.bare setting and caused false
test failures. That setting was corrected; existing work and hooks were preserved.

## Implementation plan

Review the proposed patch at `/private/tmp/repair4-hook-env.DrIB2a/pre-push-isolation.patch` against
current code. Reproduce the environment leak in isolated fixtures, implement narrowly scoped
environment sanitation before tests, and obtain independent review.

The hook now queries `git rev-parse --local-env-vars` after its upstream/package discovery and
unsets those variables before invoking any checks. The current worktree directory still selects
the correct repository; the hook and all build, typecheck, test, and dependency checks remain enabled.

## Dependency order

No blocking issue dependency currently recorded. Coordinate with other repository mutations and
follow the task-to-feature-to-staging Git workflow. Keep new dependencies in Beads.

## Tests

Exercise linked-worktree hooks with inherited Git variables and temporary bare/non-bare repos.
Verify parent configuration, refs and index are unchanged on both success and failure. Verify
checks still run and failing checks fail the hook. Run relevant package/static tests and hosted CI.

## Definition of done

The regression is reproduced and fixed, parent repository state stays unchanged, local checks and
failure propagation are preserved, independent review passes and required hosted gates pass.

## Sign-off

Local regression evidence: the original hook failed both success/failure scenarios when inherited
Git-local variables redirected temporary initialization. The corrected hook passes four scenarios:
`GIT_DIR` alone or the full worktree/index/common-directory environment, each with successful checks
or a deliberately failing test command. Real disposable linked worktrees and bare/non-bare child
repositories are used; parent config, index, refs, and HEAD remain byte-for-byte unchanged. Each child
check also verifies that no Git-local variables were inherited, and all four expected checks run.

Node 24 verification: four focused regression tests, workflow-control typecheck, touched-file ESLint,
shell syntax check, Prettier, and `git diff --check` pass. Sonar/Problems tools were unavailable to
this worker; independent review and hosted quality gates remain required. No production repository
configuration, refs, or Beads state was changed by these tests. This is not full task closeout.
