# Task: Add Project Chat branch selector

**Beads issue:** `agent-platform-project-experience.9`  
**Spec file:** `docs/tasks/agent-platform-project-experience.9.md`  
**Parent epic:** `agent-platform-project-experience` - Project experience and navigation

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.9.md`

## Summary

Expose branch context directly in Project Chat and let users choose the active branch for Git-backed
Projects without opening the built-in IDE. Branch selection is part of the Project work context, not
an IDE feature.

## Requirements

- Project Chat shows the current branch for Git-backed Projects in a compact, user-facing control.
- Users can choose from local branches and, where safely available, remote-tracking branches.
- Branch switching is blocked or asks for confirmation when the working tree has uncommitted
  changes that would make checkout unsafe.
- Non-Git Projects, detached HEAD, missing Git executable, and permission/unavailable states show
  clear user-facing fallback copy.
- Branch selection updates the active Project context used by chat, slash commands, terminal
  sessions, activity/status panels, and generated previews.
- The UI must not expose host absolute paths, backend roots, raw command output, or internal state
  enums as normal copy.
- The implementation should leave room for later PR/check/Sonar/GitHub status integration from
  `agent-platform-branch-feedback-status`.

## Implementation Plan

1. Review current Project Git/branch discovery and branch feedback contracts.
2. Add or reuse a backend Project branch service that can list branches, report current branch, and
   perform safe checkout from the active Project root.
3. Add a Project Chat branch selector component with loading, unavailable, dirty tree, and switch
   states.
4. Wire branch changes into Project Chat context and refresh dependent Project activity state.
5. Add unit/contract tests for branch discovery and checkout guard behavior.
6. Add Electron/Playwright coverage for branch display and safe branch switching from Project Chat.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.3` | `agent-platform-project-experience.6` |

Keep Beads dependencies aligned with this table.

## Parallel Worktree Notes

This task can run in parallel with preview/activity work if it owns only branch services, branch
selector UI, and Project Chat context wiring. It should avoid editing generated-output preview
components and terminal dock implementation.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused API/service tests for branch listing, current branch detection, dirty tree guard,
  non-Git state, and checkout failures.
- Focused UI tests for selector states and user-facing labels.
- Electron/Playwright: open a Git Project, verify current branch is shown, switch to a safe branch,
  verify Project Chat remains usable and context follows the selected branch.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Project Chat shows current branch for Git-backed Projects.
- [ ] Users can switch branches safely from Project Chat.
- [ ] Dirty working trees, non-Git Projects, detached HEAD, and unavailable Git states are handled
      with clear user-facing copy.
- [ ] Branch context is available to Project Chat, slash commands, terminal sessions, activity
      panels, and preview state.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
