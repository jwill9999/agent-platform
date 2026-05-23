# agent-platform-8ib - Explain blocked Project branch switching

## Goal

The Project chat branch selector should make it clear when branch switching is blocked because the worktree has local changes. Users can still resolve or override that manually in the terminal.

## Requirements

- Keep the branch selector visible for Git-backed Projects with local changes.
- Disable branch switching while the Project worktree is dirty.
- Show a clear tooltip explaining why the selector is disabled and what the user can do next.
- Preserve hidden Git UI behavior for Projects without Git metadata.

## Validation

- API tests cover clean switching and dirty-worktree blocking.
- Desktop E2E verifies the dirty-worktree tooltip is present.
