# Task: Restore Project Chat submission and slash commands

**Beads issue:** `agent-platform-electron-stabilisation.8`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.8.md`

## Summary

Restore message submission in Project Chat and ensure slash commands work with selected Project
context as the first message. This covers normal messages, `/help`, `/help init`, and `/init`.

## Requirements

- Project Chat input can submit normal messages once a Project is active.
- `/help` lists available slash commands without requiring a prior normal message.
- `/help init` explains `/init` usage, scope, and state changes.
- `/init` uses the active Project context and starts the Project instruction flow.
- Chat remains usable after command execution, errors, and retries.

## Implementation Plan

1. Trace the message submit path for Personal Chat, Project Chat, and optional IDE chat.
2. Identify why the UI accepts text but does not submit in the broken Project state.
3. Ensure slash-command execution receives the active Project/session context from the same source as
   normal Project chat messages.
4. Add user-facing guards when no Project is active instead of silently blocking submit.
5. Add regression coverage for normal Project messages and slash commands as first Project messages.

## Tests And Verification

- Unit tests for slash command routing/context construction.
- Integration tests for Project Chat message submission.
- Electron/Playwright E2E for `/help`, `/help init`, and `/init` as first Project messages.

## Definition Of Done

- Normal Project Chat messages submit and produce a response or clear user-facing error.
- `/help` and `/help init` submit and respond.
- `/init` submits with active Project context.
- The input never gets stuck in a typed-but-unsendable state.
