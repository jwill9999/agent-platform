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

1. Reused the existing recent desktop Projects API and desktop metadata records.
2. Added compact Recent Projects UI to the left explorer under the main navigation.
3. Added shared Project navigation helpers for safe labels, availability, and IDE reopen hrefs.
4. Wired `/ide?projectId=...` to reopen trusted stored Project metadata without exposing host paths.
5. Added unavailable state copy for moved folders.
6. Added renderer and Electron E2E coverage for recent Project reopen.

## Tests And Verification

- Renderer tests for recent Project list states passed.
- API/bridge tests remain green through the desktop E2E suite.
- Electron E2E covers opening a Project, rendering it as recent, and reopening via Project id.
- Assertions confirm absolute paths and implementation labels are not rendered by default.

## Definition Of Done

- [x] Recent Projects are visible in the left explorer.
- [x] A recent Project can be reopened without manual path entry.
- [x] Moved/unavailable Projects show user-facing unavailable state.
- [x] Absolute host paths are hidden in normal UI.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
