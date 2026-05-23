# agent-platform-cem — Local Git Commit Flow

## Requirements

- Add a local-only Git commit action after the existing changes review/staging flow.
- Require a non-empty commit message.
- Commit only staged changes.
- Return refreshed Git status, including the new recent commit.
- Keep destructive actions, push, PR creation, and GitHub API calls out of scope.

## Implementation Plan

- Add shared contract schema for the commit request body.
- Add `POST /v1/projects/:id/git/commit`.
- Validate that staged changes exist before committing.
- Add a commit message input and commit action to the Changes tab.
- Refresh Git status and changed-file state after commit.

## Dependency Order

| Upstream             | Status | Notes                                           |
| -------------------- | ------ | ----------------------------------------------- |
| `agent-platform-xlg` | Done   | Provides local changes/diff/stage/unstage flow. |

| Downstream              | Notes                                  |
| ----------------------- | -------------------------------------- |
| Push and remote sync UI | Should build on committed local state. |
| Pull request creation   | Requires remote/auth handling.         |

## Tests

- API router test covers staging local changes, committing them, and verifying the recent commit.
- Contracts build/typecheck validates the shared schema.
- Web typecheck/lint validates the commit UI.

## Definition of Done

- Local commit endpoint is covered by a failing-then-passing API test.
- Commit UI is visible only as a local Git action in the Changes tab.
- Relevant package checks pass.
- Manual Electron testing can verify edit → stage → commit.

## Sign-off

- Owner manual test required in Electron after implementation.
