# Task: Separate Personal Chat chrome from Project workspace UI

**Beads issue:** `agent-platform-electron-stabilisation.16`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.16.md`  
**Parent epic:** `agent-platform-electron-stabilisation` - Electron stabilisation and manual QA triage

The Beads issue **description** must begin with:
`Spec: docs/tasks/agent-platform-electron-stabilisation.16.md`

## Summary

Fix the manual QA finding where Personal Chat still shows Project-only UI: Recent Projects in the
left sidebar, repository/Sensor status on the right, and stale context from previous chats. Personal
Chat should feel like a clean general assistant surface unless the user explicitly opens a previous
chat session.

## Manual QA Findings

- **Finding:** Opening Chat can show previous chat/documentation context instead of a fresh empty
  chat.
- **Finding:** Personal Chat shows Recent Projects in the left sidebar.
- **Finding:** Personal Chat shows the Sensors/repository feedback panel even though no Project is
  active.
- **Finding:** Composer state can carry over from Project Chat or a previous Chat.
- **Severity:** high.
- **Classification:** stabilisation regression/follow-up.

## Product Rule

Personal Chat and Project Chat are separate experiences:

- Personal Chat starts a new general assistant chat by default.
- Previous Personal Chat sessions are visible only through the Sessions menu or another explicit
  session-history affordance.
- Recent Projects belong to Workspaces/Project surfaces, not the Personal Chat surface.
- Sensors, repository checks, changed files, branch state, CI, and review feedback belong to active
  Project surfaces only.

## Requirements

- Clicking **Chat** starts or shows a fresh Personal Chat unless the user explicitly selects an
  existing session.
- Personal Chat must not automatically inherit Project context, attached files, previous
  documentation, Project sessions, or repository state.
- The left sidebar in Personal Chat must hide Recent Projects or replace that area with
  Personal-Chat-relevant session history.
- The right-side Sensors/Project activity panel must be hidden in Personal Chat.
- The Project sidebar and Project activity panel remain visible on Workspaces/Project Chat where
  they are relevant.
- Route changes between Workspaces, Personal Chat, and Project Chat must reset or scope composer
  drafts correctly.
- Tests must cover Personal Chat and Project Chat as separate state domains.

## Implementation Plan

1. Audit the route/layout state that decides when Recent Projects and Sensors render.
2. Split Personal Chat layout chrome from Project/Workspace layout chrome.
3. Ensure the Chat navigation action creates or selects a fresh Personal Chat session by default.
4. Scope composer drafts by mode/session so attachments and text do not leak across surfaces.
5. Add tests for Chat navigation, explicit session restore, sidebar visibility, right-panel
   visibility, and route-switch draft isolation.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused unit/component tests for chat/project layout state.
- Playwright/Electron: click Chat from Workspaces and Project Chat, verify fresh Personal Chat
  state, no Recent Projects list, no Sensors panel, and no leaked attachments or Project context.
- Playwright/Electron: explicitly select a previous Personal Chat session and verify that history is
  restored only through that action.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Playwright E2E Strategy

```gherkin
Feature: Personal Chat and Project Chat stay separate

  Scenario: Opening Personal Chat starts a clean general assistant surface
    Given the desktop app has recent Projects available
    When the user opens Personal Chat from the sidebar
    Then the chat composer is enabled for a general assistant message
    And the sidebar does not show Recent Projects
    And the right side does not show Sensors or Project activity
    And no previous Project attachments or warnings are visible

  Scenario: Personal Chat accepts common image attachments without text parsing errors
    Given the user is in Personal Chat
    When the user attaches a PNG image and a Markdown file
    Then both files appear as attachments
    And no "not an allowed text format" warning is shown

  Scenario: Project Chat keeps Project-specific chrome
    Given the user opens a local Project with the native folder picker
    When Project Chat opens
    Then the Project name is shown in the header
    And Recent Projects are visible in the sidebar
    And the Project Sensors panel is available
    And the Personal Chat composer state is not shown

  Scenario: Switching back to Personal Chat clears Project-only context
    Given the user has opened Project Chat and attached Project files
    When the user opens Personal Chat from the sidebar
    Then a new Personal Chat session is active
    And Project attachments are cleared
    And Project Sensors are hidden
```

## Definition Of Done

- [ ] Chat navigation opens a fresh Personal Chat by default.
- [ ] Previous chat history appears only when explicitly selected.
- [ ] Personal Chat does not show Recent Projects.
- [ ] Personal Chat does not show Sensors/Project activity.
- [ ] Personal Chat and Project Chat composer/context state are isolated.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
