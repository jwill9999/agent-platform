# Task: Desktop Project Navigation Model

**Beads issue:** `agent-platform-electron-experience.1`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.1.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.1.md`

## Summary

Define and implement the desktop navigation model that treats Projects as first-class workspaces and
keeps Chat and IDE as surfaces inside the selected Project rather than unrelated destinations.

## Requirements

- Keep the desktop experience Project-first once a Project is selected.
- Separate global chat/session navigation from Project-bound chat/session navigation.
- Establish a single source of truth for the active Project, active session, and active surface.
- Avoid implementation labels such as backend, `/workspace`, container, or raw status enums in normal UI.
- Preserve existing IDE behavior while preparing for chat-first Project entry.

## Implementation Plan

1. Inspect current route/state ownership for Chat, IDE, active Project, and active session.
2. Add or refine a small navigation model for active surface and Project context.
3. Update left navigation labels/states only where needed for the new model.
4. Keep behavior backwards-compatible until later tasks move Project entry to chat by default.
5. Add focused renderer tests for model transitions and visible labels.

## Tests And Verification

- Focused renderer/unit tests for navigation state transitions.
- Existing IDE/chat tests remain green.
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/web run typecheck`
- Relevant Electron E2E smoke if UI routing changes.

## Definition Of Done

- [x] Navigation model represents active Project, active session, and active surface explicitly.
- [x] UI copy distinguishes Projects from Chat/IDE surfaces without exposing runtime internals.
- [x] Existing IDE Project open behavior remains functional.
- [x] Focused tests cover state transitions and user-facing labels.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
