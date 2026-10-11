# Audit and clean Git branches

Beads: `agent-platform-branch-cleanup`. Parent integration: `feature/harness-backlog-review`.

## Requirements

Audit every local and remote branch, distinguish squash delivery from ancestry, preserve unique work,
and remove delivered inactive branch names. Preserve protected refs, stashes, dirty files and unrelated
worktree ownership. No staging promotion or managed pilot is included.

## Implementation and dependency order

No upstream dependencies. Save and verify all-ref recovery bundle and exact ref manifest; inspect PR
head/base/merge provenance. Record each original ref, SHA and disposition in the linked audit.
Retain uncertain tips and attached worktrees. Import the missing deferred Notion task specification
from its exact retained source. Delete only delivered inactive refs with remote compare-and-swap.

## Verification and definition of done

Recovery bundle verifies; every original ref has a disposition and recoverable SHA; protected and
retained refs survive; deleted refs are absent; original dirty files/stashes remain. Markdown and
relative links pass. Publish report/spec/handoff and Notion mirrors; integrate documentation PR
before closing the Beads task.

## Evidence

See [branch audit](../reviews/branch-cleanup-2026-10-08.md).
