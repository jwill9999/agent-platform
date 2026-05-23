# Task: Breadcrumbs And Return Navigation

**Beads issue:** `agent-platform-electron-experience.5`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.5.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.5.md`

## Summary

Add quiet location affordances so users can understand where they are and return from IDE or Project
chat to the main Project/session navigation.

## Requirements

- Show Project and surface location without oversized or decorative UI.
- Allow returning from IDE to Project chat or Project selection.
- Keep labels user-facing and avoid runtime implementation details.
- Preserve Project/session context on navigation.

## Implementation Plan

1. Define breadcrumb/location copy for Project chat and IDE.
2. Add compact navigation controls aligned with existing sidebar/header patterns.
3. Wire return navigation without clearing active Project/session unless explicitly requested.
4. Add tests for breadcrumb text and return behavior.
5. Validate responsive layout at desktop and narrow widths.

## Tests And Verification

- Renderer tests for breadcrumb states.
- Electron E2E for IDE return navigation.
- UI assertions that text fits and no implementation paths are exposed.

## Definition Of Done

- [ ] Project chat and IDE show clear location affordances.
- [ ] Users can return from IDE without losing Project/session context.
- [ ] Project selection remains reachable.
- [ ] Breadcrumb/return UI uses user-facing labels only.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
