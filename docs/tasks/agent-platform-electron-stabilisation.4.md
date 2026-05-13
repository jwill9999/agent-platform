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

## Decision Record

### Latest code branch

The latest stabilisation code is on:

```text
feature/agent-platform-electron-stabilisation
```

As of this review, that branch includes the completed stabilisation task PRs through:

- `agent-platform-electron-stabilisation.1` — Electron development workflow documentation.
- `agent-platform-electron-stabilisation.2` — manual QA checklist.
- `agent-platform-electron-stabilisation.3` — manual QA findings triage.
- `agent-platform-electron-stabilisation.6` — chat-first Project navigation.
- `agent-platform-electron-stabilisation.7` — native Project folder binding.
- `agent-platform-electron-stabilisation.8` — Project Chat submission and slash commands.
- `agent-platform-electron-stabilisation.9` — Recent Projects cleanup.
- `agent-platform-electron-stabilisation.10` — user-facing Project copy cleanup.
- `agent-platform-electron-stabilisation.11` — IDE handoff, generated previews, and activity-panel
  planning.

`main` should remain unchanged until the stabilisation closeout gate recommends merging this feature
branch.

### Open PR stack

Current GitHub state: there are no open PRs in the repository.

Previously stacked task PRs have been merged into `feature/agent-platform-electron-stabilisation`
and their task branches were deleted remotely. Any remaining local `task/...` branches are historical
working copies and should not be treated as active PRs.

### Staging branch decision

Use `feature/agent-platform-electron-stabilisation` as the staging/integration branch.

Do not create a second staging branch unless a future task introduces conflicting work that cannot
be fixed forward on the existing feature branch. The current feature branch already serves the
intended purpose:

- it accumulates completed Electron stabilisation task PRs,
- it gives owner/manual QA a single branch to test,
- it keeps `main` clean until the closeout gate is complete,
- it allows remaining documentation/test-plan tasks to land before the final main PR.

### Merge blockers

The feature branch must not be proposed for `main` until:

- `agent-platform-electron-stabilisation.5` records the E2E regression coverage plan,
- `agent-platform-electron-stabilisation.12` records the stabilisation closeout decision,
- owner/manual QA is rerun or explicitly signed off/deferred,
- GitHub checks are green for the feature branch/main PR,
- review comments are resolved.

### Next merge and refresh order

1. Finish `agent-platform-electron-stabilisation.5`.
2. Run `agent-platform-electron-stabilisation.12` as the closeout gate.
3. If `.12` recommends proceeding, open one PR from
   `feature/agent-platform-electron-stabilisation` into `main`.
4. If `.12` identifies release-blocking bugs, create fix-forward tasks on the same feature branch
   before opening the main PR.
5. After the feature branch is merged to `main`, start the follow-on Project Experience tasks from
   updated `main`/the agreed next feature branch.

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
