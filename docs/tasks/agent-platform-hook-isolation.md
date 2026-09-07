# Bug: Isolate Git hook environment from temporary-repository tests

**Beads issue:** `agent-platform-hook-isolation`  
**Priority:** P2; follow-up, implementation not started.

## Requirements

Prevent inherited Git-local environment from directing temporary-repository tests at the real
repository. Preserve normal local checks and their failure propagation; do not permanently bypass
hooks. The observed failure changed the parent repository's core.bare setting and caused false
test failures. That setting was corrected; existing work and hooks were preserved.

## Implementation plan

Review the proposed patch at `/private/tmp/repair4-hook-env.DrIB2a/pre-push-isolation.patch` against
current code. Reproduce the environment leak in isolated fixtures, implement narrowly scoped
environment sanitation before tests, and obtain independent review. No fix is applied by this spec.

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

Backlog capture only; implementation and verification remain pending.
