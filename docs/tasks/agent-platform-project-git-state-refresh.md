# agent-platform-5fo - Refresh Project Git state in chat

## Summary

Keep Project Chat Git controls aligned with the real repository state when users change Git from the native terminal or outside the app.

## Requirements

- Refresh active Project Git metadata from the backend-accessible Project folder.
- Hide branch controls for folders that are not Git worktrees.
- Update current branch and dirty/clean state after terminal activity and window focus changes.
- Keep the terminal as the manual path for resolving dirty worktrees or advanced Git operations.
- Provide the local Git substrate that future GitHub/CI sensors can use before querying PR,
  check-run, runner, Sonar, or commit status state.

## Implementation Plan

- Add a Project refresh endpoint that re-detects backend project root and Git metadata.
- Teach the branch selector to hide on `PROJECT_GIT_UNAVAILABLE` and reload on refresh signals.
- Trigger Project/branch refresh from Project Chat on focus, visibility changes, and debounced terminal activity.
- Cover refresh behavior with API and Electron E2E tests.

## Definition of Done

- Git controls are absent for non-Git Projects.
- Git controls appear when a terminal-side `git init` makes the Project a Git worktree.
- Current branch and dirty state refresh without reopening the Project.
