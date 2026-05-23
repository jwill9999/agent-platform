# agent-platform-5zg — Add focused PR review view

## Problem

The PR tab currently lists pull requests but does not yet provide a focused in-app review surface.

## Requirements

- Clicking/selecting a PR opens an in-panel PR detail view.
- Show title, state, base/head branches, author, review state, mergeability if available, changed files, checks summary, and comments summary.
- Keep the first version read-only.
- Provide `Open on GitHub` as a fallback.
- Do not add merge/comment/code-edit actions until permissions and policy are explicit.

## Acceptance

- Users can understand a PR’s status without leaving AI Studio.
- The PR detail view is compact enough for the right panel and does not obscure the main chat workflow.
- Empty/unavailable states are safe and user-facing.
