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
