# Task: Triage manual QA findings into Beads

**Beads issue:** `agent-platform-electron-stabilisation.3`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.3.md`

## Summary

Review owner manual QA findings and classify each one into tracked Beads work or an explicit
deferred limitation.

## Requirements

- Review each manual QA finding with reproduction steps.
- Classify each finding as one of:
  - already covered by an existing Beads task/spec,
  - merge-blocking regression,
  - new follow-up task,
  - acceptable known limitation,
  - product/design decision.
- Create or update Beads tasks for missing work.
- Update relevant specs/definitions of done where gaps caused false passes.
- Do not close this task while any finding is unclassified.

## Implementation Plan

1. Collect the manual QA findings from the owner.
2. Build a triage table in the relevant docs or task spec.
3. Inspect existing Beads tasks/specs for matching coverage.
4. Create missing Beads tasks where needed.
5. Mark merge blockers clearly.

## Dependencies

| Upstream                                  | Downstream                                |
| ----------------------------------------- | ----------------------------------------- |
| `agent-platform-electron-stabilisation.2` | `agent-platform-electron-stabilisation.4` |

## Tests And Verification

- `bd show <issue-id>` for every created/updated task.
- `pnpm docs:lint` if documentation/spec files change.
- `git diff --check` if files change.

## Definition Of Done

- Every known manual QA finding has a classification.
- Merge blockers have Beads tasks.
- Deferred items are explicitly documented.
- Existing task/spec coverage is confirmed where applicable.
- Beads dependency/order state matches the triage decision.
