# agent-platform-5nv — Guide Git panel by workflow state

## Problem

The Git & GitHub panel currently exposes Overview, Changes, Commits, PRs, and Checks at all times. This behaves like a diagnostics dashboard and can overwhelm users with actions that are not relevant yet.

## Requirements

- Keep Overview visible at all times.
- Derive a visible workflow step list from current Git state.
- Show Changes when there are local changes or conflicts.
- Show Commit when staged files exist or a just-completed commit needs confirmation.
- Show Publish/Push when the branch is clean and has no upstream, missing upstream, or ahead commits.
- Show PRs when the branch is pushed or an open PR exists.
- Show Checks when the branch has a PR/head check context.
- Preserve access to previous/completed steps where going back is useful.

## Acceptance

- Users see only currently useful workflow steps.
- The Overview card CTA routes to a tab or action that exists and is useful.
- Existing loaded Git data is not hidden when it is needed for context.
- Unit coverage proves the tab/step derivation across clean, dirty, staged, missing-upstream, ahead, PR, and checks states.
