# Task: Rebase Slash Infrastructure

**Beads issue:** `agent-platform-electron-onboarding.1`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.1.md`  
**Parent epic:** `agent-platform-electron-onboarding` — Desktop Project onboarding and `/init`

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-onboarding.1.md`

## Summary

Restore the extracted slash command parser, registry, runner, and help contract on top of the
current desktop branch without coupling it to `/init` implementation details.

## Requirements

- Keep slash command parsing interface-agnostic so chat, CLI, and future API callers can share it.
- Preserve `/help` as a command-discovery surface.
- Keep registry selection explicit at call sites.
- Avoid implicit coupling between custom registries and built-in commands.
- Preserve existing ordinary chat behavior for non-slash messages.

## Implementation Plan

1. Inventory current slash command modules and tests.
2. Reconcile any branch drift from the extracted implementation.
3. Ensure parser, registry, and runner boundaries are independent of Project onboarding.
4. Keep API route wiring explicit and session-consistent.
5. Add or update focused tests for parser, registry selection, `/help`, and normal chat fallback.

## Tests And Verification

- Focused slash command unit/API tests.
- Relevant chat route integration tests.
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Implementation Notes

- Confirmed the slash parser, registry, runner, built-in `/help`, and safe `/init` shell are already
  present on the current desktop branch.
- Confirmed `runSlashCommand` requires an explicit registry at the call site and does not implicitly
  merge custom registries with built-ins.
- Confirmed the chat route passes the already-loaded session into slash handling and non-slash
  messages continue through the normal chat path.

## Definition Of Done

- [x] Slash parser, registry, and runner are present and interface-agnostic.
- [x] `/help` lists available slash commands without requiring a Project.
- [x] Registry selection is explicit at call sites.
- [x] Non-slash chat messages continue through the normal chat path.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
