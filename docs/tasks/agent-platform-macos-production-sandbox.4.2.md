# Task: Implement Virtualization.framework VM boot lifecycle

**Beads issue:** `agent-platform-macos-production-sandbox.4.2`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.2.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4`

## Summary

Implement the native helper lifecycle that starts, tracks, reports, and stops the managed Linux VM using Apple Virtualization.framework.

## Requirements

- Build a valid `VZVirtualMachineConfiguration` from the packaged VM image and app-owned runtime directory.
- Configure bounded CPU and memory.
- Configure virtio filesystem sharing for the selected Project mount path.
- Keep VM state, logs, sockets, and machine identity under the app-owned runtime directory.
- Implement `start`, `status`, and `stop` against real VM state rather than skeleton responses.
- Fail closed when the VM cannot start; never fall back to host execution.

## Remaining Child Tasks

`.4.2` is not complete until these child tasks are complete:

1. `agent-platform-macos-production-sandbox.4.2.1` — add a reproducible bootable arm64 Linux guest
   image provisioning path.
2. `agent-platform-macos-production-sandbox.4.2.2` — prove the helper can boot that image and reach
   ready status.
3. `agent-platform-macos-production-sandbox.4.2.3` — prove daemon lifecycle reliability: status is
   ready only while the VM is genuinely alive, and stop clears running/stale state.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- Local helper smoke proving:
  - missing image fails closed,
  - valid image starts,
  - `status` reports ready only after VM startup,
  - `stop` stops the VM or clears stale ready state.

## Definition Of Done

- The VM starts locally through the helper.
- `status` reports ready only when the VM is actually available.
- The helper can stop or recover from stale VM state.
- Beads children `.4.2.1` through `.4.2.3` are closed with evidence.
