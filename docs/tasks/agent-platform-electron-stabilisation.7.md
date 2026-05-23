# Task: Fix native Project folder binding

**Beads issue:** `agent-platform-electron-stabilisation.7`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.7.md`

## Summary

Fix the Electron native folder picker path so a selected local folder becomes the active Project.
The folder must be registered with the backend/runtime, shown with a friendly Project name, and made
available to Project Chat without requiring path entry or copying the folder into app data.

## Requirements

- Native folder picker returns a directory selection only.
- The selected directory is registered as the active Project.
- Backend/runtime can inspect the selected Project using host access provided by Electron.
- UI shows user-facing Project names, not full host paths.
- Failure states use plain language and do not mention backend internals.

## Implementation Plan

1. Trace Open Project from renderer click through Electron preload/main process and API/runtime
   registration.
2. Fix any file-vs-directory confusion in the picker result handling.
3. Ensure Project registration updates the same source of truth used by Project Chat, Recent
   Projects, file/context panels, and activity status.
4. Replace backend-facing errors with user-facing recovery copy.
5. Add Electron E2E coverage for selecting a real local folder and seeing Project Chat context.

## Tests And Verification

- Unit tests for folder selection/result normalization.
- Electron E2E verifies native picker test hook or fixture opens a Project folder.
- Manual QA verifies no absolute path entry is required.

## Definition Of Done

- Selecting a local folder opens Project Chat for that folder.
- The Project tree/context source can inspect the selected folder.
- UI does not show "Backend cannot inspect that project path".
- No folder is copied into app data as the normal open behavior.
