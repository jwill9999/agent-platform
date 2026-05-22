# Add divergent pull and merge conflict resolver

## Summary

Implement guided divergent pull handling and a full-screen merge conflict resolver for the Git/GitHub workflow. Publish must prioritize pulling remote commits before pushing when a branch is behind or divergent, and merge conflicts must be resolved inside AI Studio through a dedicated full-screen interface.

## Requirements

- Detect connected branches that are behind or divergent and guide users to pull before pushing.
- Add a Project Git pull endpoint that rejects dirty working trees, succeeds cleanly when possible, and returns conflict state when pull creates conflicts.
- Add conflict endpoints to list conflicted files, inspect conflict hunks, apply current/incoming/both choices, and commit the merge after all conflicts are resolved.
- Launch a full-screen conflict resolver from the Git & GitHub side panel.
- Keep local Git actions provider-neutral; GitHub-specific behavior remains limited to remote/auth/repo operations.

## Implementation Plan

1. Extend contracts with pull/conflict request and response schemas.
2. Add API helpers/routes for pull, conflict listing, conflict detail, conflict resolution, and merge commit.
3. Update the Git panel workflow helpers so divergent/behind states prioritize pull before push.
4. Add a full-screen merge conflict resolver UI with file list, current/incoming/result columns, conflict actions, and resolved summary.
5. Add unit, API, and Electron E2E coverage.

## Tests and Verification

- Web unit tests for divergent state and conflict workflow rendering.
- API tests for pull success, dirty-tree rejection, conflict detection, conflict resolution, and merge commit blocking.
- Electron E2E for divergent conflict flow through the full-screen resolver.

## Gherkin E2E Strategy

```gherkin
Feature: Divergent pull and merge conflict resolution

  Background:
    Given the desktop app is running with isolated app data
    And the Project is backed by an isolated local Git repository

  Scenario: A clean behind branch pulls remote changes before publishing
    Given the current branch has remote commits that are not local
    And the working tree is clean
    When the user opens Git & GitHub
    Then the only forward publishing action is Pull remote changes
    And normal push is not offered before the pull completes

  Scenario: A divergent conflict opens the full-screen resolver
    Given the current branch has one local commit and one remote commit touching the same file
    When the user clicks Pull remote changes
    Then AI Studio opens Resolve Merge Conflicts full-screen
    And the user can see Current, Incoming, and Result
    And the user can choose Accept current, Accept incoming, or Accept both

  Scenario: Resolved conflicts return the user to publishing
    Given all merge conflicts have been resolved
    When the user commits the merge resolution
    Then the resolver closes
    And Git & GitHub shows the Push step as the next action

  Scenario: A dirty working tree blocks pull safely
    Given remote commits are waiting
    And the user has local unstaged files
    When the user tries to pull remote changes
    Then the app explains that local changes must be committed, stashed, or discarded first
    And the user stays inside AI Studio with a clear recovery path
```

## Definition of Done

- Users can pull remote changes before pushing.
- Pull conflicts open a full-screen resolver.
- Users can accept current, incoming, or both for conflicted files.
- Merge commit is blocked until conflicts are resolved.
- Relevant automated tests pass.
