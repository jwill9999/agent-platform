# Task: Integrate `/init` With Desktop Project Context

**Beads issue:** `agent-platform-electron-onboarding.2`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.2.md`  
**Parent epic:** `agent-platform-electron-onboarding` — Desktop Project onboarding and `/init`

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-onboarding.2.md`

## Summary

Make `/init` start or resume Project onboarding only when the active session is bound to a desktop
Project registered by the Electron Project open flow.

## Requirements

- `/init` must reject sessions without a backend-bound Project.
- `/init` must resolve Project context from the same persisted session binding used by the backend.
- The error copy should tell the user to open a Project through the desktop Open Project flow.
- No manual host path typing, browser File System Access handle, or Docker `/workspace` fallback
  should satisfy desktop onboarding.

## Implementation Plan

1. Trace session and Project lookup in the chat route.
2. Route `/init` through the persisted Project/session binding.
3. Add deterministic missing-Project and valid-Project API tests.
4. Keep user-facing output implementation-neutral.

## Tests And Verification

- API tests for `/init` without Project binding.
- API tests for `/init` after desktop Project registration.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Definition Of Done

- [x] `/init` does not run without a backend-bound Project.
- [x] `/init` sees a Project opened through Electron Project registration.
- [x] Missing-Project output is clear and user-facing.
- [x] No legacy folder-opening path can satisfy desktop `/init`.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
