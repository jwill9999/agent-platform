# Task: Slash Command Context Parity In Project Chat

**Beads issue:** `agent-platform-electron-experience.7`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.7.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.7.md`

## Summary

Ensure slash commands and ordinary messages use the same active Project context in Project chat and
after IDE handoff.

## Requirements

- `/help` and `/init` must resolve the selected Project from the Project-bound session.
- Ordinary chat and slash commands must share one Project context resolver.
- First message after Project open must work without a prior ordinary chat message.
- Behavior must be consistent in Project chat and IDE assistant.

## Implementation Plan

1. Audit Project context resolution in Project chat, IDE chat, and slash command execution.
2. Remove any remaining UI-only assumptions that bypass session-bound Project context.
3. Add API/session tests for first-message slash commands from Project chat.
4. Add Electron E2E coverage for `/help` and `/init` from Project chat and IDE.
5. Verify no duplicate onboarding drafts or stale Project bindings are introduced.

## Tests And Verification

- API tests for slash command context resolution.
- Renderer tests for Project chat command state if needed.
- Electron E2E for `/help` and `/init` in Project chat and IDE.

## Definition Of Done

- [ ] Slash commands and ordinary chat resolve the same Project context.
- [ ] `/init` works as the first Project chat message after opening a Project.
- [ ] `/help` reports Project-aware command help in Project chat.
- [ ] Electron E2E covers context parity across Project chat and IDE.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
