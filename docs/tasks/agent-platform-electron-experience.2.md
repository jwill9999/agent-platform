# Task: Recent Projects In Left Explorer

**Beads issue:** `agent-platform-electron-experience.2`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.2.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.2.md`

## Summary

Show recent desktop Projects in the left explorer and allow users to reopen a Project from stored
metadata without typing host paths or using duplicate folder controls.

## Requirements

- Display recent Projects in the left explorer under the main navigation.
- Use safe Project labels and relative information only.
- Reopen Projects through trusted desktop Project metadata.
- Handle moved/unavailable Projects with clear user-facing copy.
- Do not expose absolute host paths by default.

## Implementation Plan

1. Reuse the existing recent desktop Projects API/bridge where possible.
2. Add left explorer UI for recent Projects with compact 14px-scale text.
3. Wire reopen action to the same Project registration/session path as native Project open.
4. Add unavailable state copy for moved folders.
5. Add renderer and Electron E2E coverage for recent Project reopen.

## Tests And Verification

- Renderer tests for recent Project list states.
- API/bridge tests remain green.
- Electron E2E for opening a recent Project from the explorer.
- Assertions that absolute paths and implementation labels are not rendered by default.

## Definition Of Done

- [ ] Recent Projects are visible in the left explorer.
- [ ] A recent Project can be reopened without manual path entry.
- [ ] Moved/unavailable Projects show user-facing unavailable state.
- [ ] Absolute host paths are hidden in normal UI.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
