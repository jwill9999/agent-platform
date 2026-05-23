# Add GitHub repository create/connect flow

## Summary

Implement the missing no-remote GitHub workflow. Local Git Projects with commits but no
`origin` remote should be able to create a new GitHub repository or connect an existing one
from AI Studio without falling back to terminal instructions as the primary path.

## Requirements

- Show create/connect repository actions in the Git & GitHub Overview and Publish states when a
  local Git repository has no `origin` remote.
- Add GitHub CLI-backed API routes to create a repository and connect an existing repository.
- Keep GitHub repository creation MVP-scoped and GitHub-specific; keep local Git status/publish
  behavior provider-neutral.
- After create/connect, refresh Git status and keep the user in the publish workflow.
- If the connected remote has history that must be pulled first, route into the existing pull /
  divergent workflow.

## Implementation Plan

1. Add contracts for GitHub repository create/connect request and result payloads.
2. Add API helpers/routes for GitHub CLI availability/auth, repository creation, repository
   validation, remote setup, fetch, and optional push.
3. Add create/connect UI in the Git & GitHub panel with a compact modal and clear error states.
4. Add API, web unit, and Electron E2E coverage for the no-remote workflow.

## Tests and Verification

- API tests for missing GitHub CLI, unauthenticated CLI, create repository, connect repository,
  invalid repository input, and existing origin handling.
- Web unit tests for no-remote CTA visibility and publish-state copy.
- Electron E2E for no-remote publish UI exposing create/connect actions.

## Definition of Done

- No-remote Projects no longer dead-end at terminal instructions.
- Users can create a GitHub repository and push current work through the app.
- Users can connect an existing GitHub repository through the app.
- Missing auth/tooling failures are clear and recoverable.
- Relevant tests pass.
