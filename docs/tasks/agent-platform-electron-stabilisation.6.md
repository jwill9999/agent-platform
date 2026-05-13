# Task: Define chat-first Project navigation

**Beads issue:** `agent-platform-electron-stabilisation.6`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.6.md`

## Summary

Replace the ambiguous Chat/chooser/IDE navigation model with a chat-first Project flow. Users should
always have a clear route to Home/Workspaces, Personal Chat, Project Chat, and Settings. Opening a
Project should land in Project Chat, not the built-in IDE.

## Requirements

- Add or refine a stable Home/Workspaces route for choosing Personal Chat or Open Project.
- Make Personal Chat and Project Chat distinct states in one chat system.
- Remove the built-in IDE from primary navigation or clearly mark it as optional/experimental.
- Provide visible return navigation from Project Chat, Settings, and any optional IDE surface.
- Preserve selected Project/session context when moving between Project Chat and optional file views.

## Implementation Plan

1. Inspect current routes, navigation state, and workspace chooser behavior.
2. Define the target route/state model for Home, Personal Chat, Project Chat, Settings, and optional
   IDE handoff.
3. Update navigation labels and destinations so each menu item has one meaning.
4. Route Project opening and Recent Project reopening to Project Chat.
5. Add regression tests for navigation consistency and return paths.

## Tests And Verification

- Unit/component tests for route/state selection where available.
- Electron/Playwright coverage for Home -> Personal Chat -> Home and Home -> Open Project -> Project
  Chat.
- Manual QA verifies no user gets trapped in Chat or Settings.

## Definition Of Done

- Chat menu no longer shows two different pages for the same action.
- Home/Workspaces is always reachable.
- Open Project routes to Project Chat.
- Project Chat has a visible way to return to Home/Workspaces.
- Built-in IDE is not the primary Project destination.
