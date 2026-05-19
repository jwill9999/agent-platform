# agent-platform-0ra — Add push completion and PR creation flow

## Problem

After committing, the current UI has limited push/publish flow and no clear handoff to creating a pull request.

## Requirements

- Show Push only when there are ahead commits and a valid upstream.
- Show Publish when the branch needs an upstream.
- After push/publish succeeds, show a completion state.
- For non-primary branches with a GitHub remote and no current PR, offer `Create pull request`.
- Provide a GitHub fallback link when local PR creation is unavailable.

## Acceptance

- Users can move from commit to push/publish to PR without guessing where to go.
- Primary branches do not push users toward PR creation unless a PR exists.
- Success and error states are visible in the workflow surface.
