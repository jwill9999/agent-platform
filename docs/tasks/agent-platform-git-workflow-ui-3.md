# agent-platform-4hm — Improve commit step and generated commit messages

## Problem

Committing works, but the workflow state is not yet clear enough: users need a visible completion state and a path to the next step. They also asked whether the agent should help create commit messages.

## Requirements

- Show Commit only when staged files exist or a recent commit result needs to be shown.
- After a commit succeeds, show an inline success state and advance the next action to Publish/Push.
- Keep a way to return to Changes after committing.
- Add a disabled or implemented `Generate commit message` CTA depending on available safe context.
- Generated commit messages must be based only on current changed files/diff summary.

## Acceptance

- Users do not need to visit the Commits tab just to discover whether a commit succeeded.
- Commit completion naturally leads to the next workflow step.
- Commit-message generation is either functional and tested or clearly deferred without a dead control.
