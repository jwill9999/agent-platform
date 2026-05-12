# Task: Electron E2E For Navigation And Reopen

**Beads issue:** `agent-platform-electron-experience.8`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.8.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.8.md`

## Summary

Add production-like Electron E2E coverage for the complete Project experience: recent Project reopen,
Project chat, slash command context, IDE handoff, and return navigation.

## Requirements

- Run against the built Electron desktop runtime.
- Use deterministic temporary Project roots.
- Cover recent Project reopen.
- Cover Project chat as the default Project entry.
- Cover IDE handoff and return navigation with preserved Project/session context.
- Assert implementation paths/states are not exposed in normal UI.

## Implementation Plan

1. Extend the Electron E2E suite with a full Project navigation scenario.
2. Seed or create two temporary Projects to test recent/reopen behavior.
3. Drive the user flow from open Project to Project chat, `/help`, IDE handoff, return, and reopen.
4. Assert visible state, session continuity, and absence of internal implementation details.
5. Keep artifacts bounded and CI-friendly.

## Tests And Verification

- Built-runtime Electron E2E for the full Project experience path.
- Existing browser E2E, unit, lint, typecheck, and docs gates remain green.
- `pnpm --filter @agent-platform/desktop test:e2e`
- CI `desktop-e2e` must include this coverage.

## Definition Of Done

- [x] Electron E2E covers recent Project reopen.
- [x] Electron E2E covers Project chat default entry.
- [x] Electron E2E covers slash command context in Project chat.
- [x] Electron E2E covers IDE handoff and return navigation.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
