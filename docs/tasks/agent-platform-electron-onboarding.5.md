# Task: Refresh And Rescan Onboarding

**Beads issue:** `agent-platform-electron-onboarding.5`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.5.md`  
**Parent epic:** `agent-platform-electron-onboarding` — Desktop Project onboarding and `/init`

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-onboarding.5.md`

## Summary

Preserve refresh, rescan, and instruction update flows where they still fit the native Project model.

## Requirements

- Users can refresh Project onboarding state after file changes.
- Rescan should detect whether `AGENTS.md` exists and whether updates are available.
- Refresh/rescan must use the active Project binding, not stale browser handles or manual paths.
- Existing approved setup should not be reset unless the user explicitly chooses an update flow.

## Implementation Plan

1. Inventory current refresh/rescan behavior.
2. Map valid behavior onto native Project metadata.
3. Remove or disable stale legacy paths.
4. Add tests for refresh after file change and update-candidate behavior.

## Tests And Verification

- API tests for refresh/rescan Project state.
- Tests for preserving approved setup.
- Tests for update candidates after Project file changes.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Definition Of Done

- [ ] Refresh/rescan uses active Project binding.
- [ ] Existing approved setup is preserved by default.
- [ ] Update candidates are visible when relevant.
- [ ] Legacy folder-handle paths do not affect desktop onboarding.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
