# Task: Review PR stack and staging branch plan

**Beads issue:** `agent-platform-electron-stabilisation.4`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.4.md`

## Summary

Review the stacked PR and feature branch state, then decide whether to create a staging branch where
stacked Electron/Project work can be integrated and fixed forward before merging into `main`.

## Requirements

- Identify which branch contains the latest code.
- Identify open PRs and their base branches.
- Identify stale, blocked, or regression-prone PRs.
- Decide whether to create a staging branch, for example
  `feature/agent-platform-electron-stabilisation`.
- If staging is chosen, document:
  - what merges into staging,
  - what fixes forward from staging,
  - what checks must pass before staging can merge to `main`.
- Keep `main` clean until this decision is made.

## Implementation Plan

1. Inspect local and remote branch state.
2. Inspect open PRs and CI status.
3. Compare branch stack against Beads dependencies.
4. Record latest-code branch and recommended merge order.
5. Record staging branch decision.
6. Create follow-up tasks for fix-forward regressions if needed.

## Dependencies

| Upstream                                  | Downstream                                |
| ----------------------------------------- | ----------------------------------------- |
| `agent-platform-electron-stabilisation.3` | `agent-platform-electron-stabilisation.5` |

## Tests And Verification

- `git status --short --branch`
- `git branch --show-current`
- `gh pr list` / `gh pr view` when available
- `bd ready` and `bd show` for related epics/tasks

## Definition Of Done

- Current PR stack is documented.
- Latest-code branch is identified.
- Staging branch decision is recorded.
- Merge blockers are listed.
- Next merge/refresh order is recorded.
- No new feature epic starts until the decision is complete.
