# Task: Clean up user-facing Project copy and diagnostics

**Beads issue:** `agent-platform-electron-stabilisation.10`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.10.md`

## Summary

Remove backend/internal terminology from normal Project UI and keep raw diagnostics behind explicit
debug/observability surfaces.

## Requirements

- Normal UI avoids backend roots, hashes, raw state names, and implementation status copy.
- Error messages explain what the user can do next.
- Project status copy is consistent across Home, Project Chat, Recent Projects, and optional IDE
  surfaces.
- Diagnostics remain available through logging/observability rather than primary UI text.

## Implementation Plan

1. Scan Project UI copy for backend/internal terms.
2. Replace technical error copy with user-facing messages and recovery actions.
3. Collapse or move raw diagnostics behind explicit disclosure controls if still needed.
4. Add assertions to E2E/manual checklist for no internal status leakage.

## Tests And Verification

- Snapshot/component tests for key empty/error states where appropriate.
- Electron/Playwright assertions for visible copy in Project open failure and unavailable Project
  states.
- Manual QA scan against the copy checklist.

## Definition Of Done

- "Backend cannot inspect that project path" and similar internal copy are gone from normal UI.
- Users see a clear next action for Project failures.
- Raw diagnostics do not appear in primary Project UI.
