# Task: Stabilise Recent Projects

**Beads issue:** `agent-platform-electron-stabilisation.9`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.9.md`

## Summary

Clean up Recent Projects so it is a reliable Project switching surface rather than a noisy list of
stale unavailable test entries. Recent Projects should be shown once, deduped, safe, and reopen into
Project Chat.

## Requirements

- Recent Projects appears in one predictable location.
- Stale/unavailable entries are deduped and handled safely.
- Test/E2E data does not leak into normal app data.
- Reopening a recent Project switches the active Project and routes to Project Chat.
- Unavailable Projects do not expose full host paths or crash the UI.

## Implementation Plan

1. Inspect how Recent Projects are persisted, loaded, and rendered in the global nav and IDE panel.
2. Remove duplicate Recent Projects surfaces or make one authoritative.
3. Add dedupe and availability checks.
4. Add a user-facing recovery path for unavailable Projects.
5. Confirm E2E runtime data isolation and add cleanup safeguards if needed.

## Tests And Verification

- Unit tests for Recent Project dedupe/availability logic.
- Electron E2E for opening two Projects and reopening the first from Recent Projects.
- Manual QA verifies stale unavailable test Projects do not dominate the UI.

## Definition Of Done

- Recent Projects is not duplicated in the UI.
- Unavailable entries are safe and not noisy.
- Reopening a recent Project opens Project Chat with the correct context.
- E2E/manual data does not pollute normal app state.
