# Add GitHub Checks View

## Summary

Add a Checks tab to the Git & GitHub panel that reports local availability, GitHub remote detection, GitHub CLI/auth readiness, and recent check-run state for the currently opened project branch or HEAD.

## Requirements

- Show clear empty states for:
  - project is not a Git repository
  - no GitHub remote is configured
  - GitHub CLI is not installed or not authenticated
  - no check runs are available
- When check data is available, show each run with name, status, conclusion, workflow, relative time, and optional GitHub URL.
- Keep the UI local-first: no agent shell access and no inferred check data.
- Refresh checks with the existing Git panel refresh affordance and when the Checks tab opens.
- Preserve the current local Git status and changes flows.

## Implementation Plan

1. Add shared contract schemas for project Git check runs and check results.
2. Add an API endpoint at `GET /v1/projects/:id/git/checks`.
3. Resolve the project repository, GitHub remote, branch, and HEAD SHA from local Git.
4. Query GitHub through `gh run list --json ...` when `gh` is available and authenticated.
5. Render check states in the Git & GitHub Checks tab.
6. Add focused tests for unavailable and successful check-list states.

## Tests And Verification

- Contract schema test for checks result parsing.
- API test for no-GitHub remote unavailable state.
- API test with a fake `gh` binary returning check data.
- Web typecheck and lint.

## Definition Of Done

- Checks tab no longer contains placeholder copy.
- API returns structured check state without throwing for common unavailable states.
- Focused API/contract tests pass.
- Completion gate passes and branch is pushed.
