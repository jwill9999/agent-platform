# Task: Prove VM boot and ready status

**Beads issue:** `agent-platform-macos-production-sandbox.4.2.2`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.2.2.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4.2`

## Summary

Prove `macos-vm-runner start` can boot the real guest image and that `status` reports ready only
after the VM is actually running.

## Requirements

- Start the VM with the real `.4.2.1` image.
- Ensure `start` blocks until ready or fails closed with a clear error.
- Ensure `status` reports `ready` only after the VM reaches the running state.
- Persist runtime state under the app-owned runtime directory.
- Capture logs sufficient to diagnose boot failures.
- Use a `VZLinuxBootLoader`-compatible raw ARM64 Linux kernel `Image`. EFI-stub kernels such as
  Fedora or Alpine `PE32+ executable` `vmlinuz` files are explicitly incompatible with this boot
  contract and must fail during asset preparation rather than at VM startup.
- Sign the local helper with the development `com.apple.security.virtualization` entitlement before
  boot smoke tests. Release signing remains owned by `.6.3`, but `.4.2.2` must not fail local boot
  proof due to an unsigned helper.
- Record the selected boot contract, kernel format, image manifest checksum, runtime directory, and
  helper version in the smoke-test evidence.
- Verify negative boot cases: missing image asset, invalid image asset, incompatible boot contract,
  and insufficient runtime directory permissions.
- Ensure failed boot attempts do not leave stale PID, socket, ready marker, or misleading health
  state behind.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:sign-dev`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- Asset build/prepare checks:
  - generated kernel reports `Linux kernel ARM64 boot executable Image`,
  - EFI-stub `PE32+ executable` kernels are rejected before `macos-vm-runner start`.
- Local smoke:
  - `macos-vm-runner prepare --runtime-dir <dir>`
  - `macos-vm-runner start --runtime-dir <dir>`
  - `macos-vm-runner status --runtime-dir <dir>`
- Local negative smoke:
  - start with missing/invalid boot assets fails closed,
  - status remains unavailable after a failed start,
  - diagnostic log points to the missing or invalid requirement.

## Definition Of Done

- A real VM boots locally through the helper.
- `status` reports `ready` after successful boot.
- The packaged `VZLinuxBootLoader` assets contain a verified raw ARM64 kernel `Image`.
- Failed boot attempts fail closed and leave diagnostics.
- Failed boot attempts leave no stale running state.
- `.4.2.3` can focus on long-running daemon reliability without rediscovering boot readiness
  requirements.
