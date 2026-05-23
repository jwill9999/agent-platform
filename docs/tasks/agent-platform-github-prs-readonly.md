# Add Read-Only GitHub PRs View

## Summary

Add a Pull Requests tab to the Git & GitHub panel that reads GitHub pull request state for the currently opened Project repository without performing any mutation.

## Requirements

- Show clear states for:
  - project is not a Git repository
  - no GitHub remote is configured
  - GitHub CLI is not installed or unavailable
  - GitHub CLI is not authenticated
  - no pull requests are available
- When PR data is available, show:
  - PR number, title, state, draft state, author, updated time, URL
  - source and target branch refs
  - current-branch highlighting
  - review decision when available
  - aggregate check summary when available
- Keep this task read-only. PR comments, merges, pushes, checkout actions, and agent-assisted PR edits are follow-up work.
- Hide app-owned `.agent-platform/**` runtime/browser artifacts from Git panel counts, file lists, commit validation, and stage-all actions. User-owned terminal Git remains untouched.

## Implementation Plan

1. Add shared contract schemas for read-only pull request summaries and result state.
2. Add an API endpoint at `GET /v1/projects/:id/github/pull-requests`.
3. Resolve the repository through local Git and use GitHub CLI when available.
4. Parse `gh pr list --json ...` into normalized contract data.
5. Render the PRs tab with unavailable, empty, and loaded states.
6. Add focused contract and API tests, including a fake `gh` binary.
7. Exclude `.agent-platform/**` from Project Git panel operations so new local repos do not show generated runtime artifacts as user changes.

## Tests And Verification

- Contract schema test for PR result parsing.
- API test for no-GitHub remote unavailable state.
- API test with fake `gh` returning PR data.
- Web typecheck/lint and focused unit coverage through existing panel compilation.
- API regression test that `.agent-platform/**` files are omitted from status/changes and not staged by Stage all.

## Definition Of Done

- PRs tab no longer contains placeholder copy.
- API returns structured PR state without throwing for common unavailable states.
- Current branch PRs are highlighted.
- Focused tests pass and completion gate is run.
