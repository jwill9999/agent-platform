# Task: Share Project Context For Slash And Chat

**Beads issue:** `agent-platform-electron-onboarding.3`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.3.md`  
**Parent epic:** `agent-platform-electron-onboarding` — Desktop Project onboarding and `/init`

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-onboarding.3.md`

## Summary

Ensure slash commands and ordinary Project chat resolve the same Project id, Project root, and
session context.

## Requirements

- Ordinary Project chat and slash commands must use one shared Project context resolver.
- The resolver should avoid repeated session database lookups where the session is already loaded.
- Project context must include enough metadata for onboarding, chat prompt context, and command
  policy without leaking host paths in user-facing output.
- Regression coverage must prove `/init` and ordinary chat agree on the active Project.

## Implementation Plan

1. Extract or reuse a single Project context resolver.
2. Pass loaded session objects into helpers where available.
3. Update slash command and normal chat call sites.
4. Add integration tests proving both paths use the same Project binding.

## Tests And Verification

- API integration tests for ordinary Project chat context.
- API integration tests for slash command context.
- Regression test for session-consistency without duplicate lookup drift.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Definition Of Done

- [x] Slash commands and normal chat use the same Project context source.
- [x] Session-consistency is covered by tests.
- [x] User-facing output does not expose host paths.
- [x] Existing Project chat behavior remains intact.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
