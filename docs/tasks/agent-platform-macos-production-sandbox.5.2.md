# Task: Validate packaged runner startup and health

**Beads issue:** `agent-platform-macos-production-sandbox.5.2`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.5.2.md`  
**Parent task:** `agent-platform-macos-production-sandbox.5`

## Summary

Make the packaged Electron app start with the production `macos-vm` runner configuration and expose
accurate runner health.

## Requirements

- Configure packaged macOS builds to use `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm`.
- Derive helper path, runtime path, and asset path from packaged app locations.
- Report runner health from the same contract used by the web UI and API.
- Show unavailable runner states without falling back to host or Docker.
- Add diagnostics that identify missing helper, missing image, unavailable VM, and command-service
  failures.

## Tests And Verification

- Desktop tests proving packaged-path environment construction.
- Runner health tests proving packaged `macos-vm` reports ready only when the VM is ready.
- Packaged app smoke proving the UI can surface runner health.
- `pnpm --filter @agent-platform/desktop test`

## Definition Of Done

- Packaged app startup config points at app-owned runner assets.
- Runner health clearly distinguishes ready and unavailable VM states.
- No packaged path can silently select host or Docker command execution.
