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
- Require runtime-path ownership/shape validation before any deletion occurs.
- Handle reset while the VM is running by stopping the VM first or refusing with a clear action.
- Rebuild or revalidate packaged/pinned assets after reset so the next start has a deterministic
  recovery path.

## Current Implementation Notes

- Desktop exposes a maintenance IPC action, `repairMacosVmRuntime`, for the packaged VM repair path.
- Repair validates that the VM runtime directory is app-owned under the desktop data directory before
  deleting anything.
- Repair refuses arbitrary runtime paths, Project folder paths, runtime root deletion, and symlinked
  runtime/child paths.
- Repair stops a running VM daemon through the packaged helper before deleting runtime state.
- Repair deletes only VM `state` and `images` by default, preserves `logs`, then recopies packaged
  pinned assets into the runtime image directory.
- Full local unit coverage exists for stopped, running, corrupt, arbitrary path, symlink, and Project
  folder preservation cases.
- A signed/packaged live smoke can be recorded later with the same self-hosted Apple Silicon runner
  used for `.5.4`; do not treat that infrastructure proof as missing implementation code.

## Tests And Verification

- Unit tests for runtime path validation and deletion scope.
- Desktop tests proving reset targets only app-owned directories.
- Packaged app smoke proving repair can recover from a broken VM runtime.
- Test proving reset refuses arbitrary paths, symlink escapes, and Project folder paths.
- Test proving reset handles running, stopped, and partially corrupted runtime states.

## Definition Of Done

- Users can recover a broken VM runtime without manual file-system setup.
- Reset/repair is path-safe and cannot remove project data.
- Reset/repair leaves the app in a known next state: ready to start, clearly unavailable, or
  accompanied by actionable diagnostics.
