# Task: Git Workflow Overview State

## Problem

The Git & GitHub Overview tab exposed repository details and a placeholder "GitHub Sensors" card, but it did not tell the user what action should happen next.

## Requirements

- Replace the placeholder GitHub Sensors card with a user-facing workflow state.
- Derive the next action from local Git and available GitHub PR/check state.
- Surface changed files, staged changes, missing upstreams, ahead commits, open PR checks, and pushed branches without PRs.
- Keep this slice read-only/navigation-only; publish/create-PR mutation actions are handled in later tasks.

## Done

- Overview shows a "Next step" card with state-specific copy and a primary navigation CTA.
- GitHub Sensors placeholder is removed.
- Overview loads PR and check summaries so PR/check state can influence the next step.
- Unit coverage verifies the workflow state derivation.
