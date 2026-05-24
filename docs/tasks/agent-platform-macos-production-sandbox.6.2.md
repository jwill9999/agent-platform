# Task: Add safe VM reset and repair flow

**Beads issue:** `agent-platform-macos-production-sandbox.6.2`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.6.2.md`  
**Parent task:** `agent-platform-macos-production-sandbox.6`

## Summary

Add a user-safe reset and repair path for app-owned VM runtime state.

## Requirements

- Provide a desktop action or command for VM reset/repair.
- Delete or rebuild only app-owned VM runtime files.
- Never delete user Project folders or arbitrary paths.
- Surface repair progress and failure states clearly.
- Preserve diagnostics needed for support unless the user explicitly clears them.

## Tests And Verification

- Unit tests for runtime path validation and deletion scope.
- Desktop tests proving reset targets only app-owned directories.
- Packaged app smoke proving repair can recover from a broken VM runtime.

## Definition Of Done

- Users can recover a broken VM runtime without manual file-system setup.
- Reset/repair is path-safe and cannot remove project data.
