# Task: Enforce production resource and network defaults

**Beads issue:** `agent-platform-macos-production-sandbox.6.1`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.6.1.md`  
**Parent task:** `agent-platform-macos-production-sandbox.6`

## Summary

Lock down the production VM runner defaults for CPU, memory, command duration, output size, process
user, filesystem, and network behavior.

## Requirements

- Define production CPU and memory limits for the VM.
- Enforce command timeout and output limits inside the guest command service.
- Run commands as a non-root guest user.
- Define and enforce the production network policy.
- Define whether the initial macOS release allows guest network access. If network access is
  allowed, document the exact boundary and why it is acceptable; if disabled, prove commands cannot
  reach the network.
- Define filesystem policy for writable locations inside the guest, including whether writes persist
  across sessions and how project writes are limited to `/workspace`.
- Expose effective resource and network policy through runner health/diagnostics.

## Tests And Verification

- Unit tests for limit mapping and default policy.
- Native helper tests for configured CPU and memory.
- VM command tests proving timeout and output truncation.
- Network policy smoke test matching the selected production policy.
- VM command tests proving the process user is non-root.
- VM command tests proving writes outside `/workspace` are blocked or confined to guest-owned
  scratch storage according to the documented filesystem policy.
- Runner health/diagnostics snapshot proving effective CPU, memory, timeout, output, user,
  filesystem, and network policy are visible.

## Definition Of Done

- Production defaults are documented, enforced, and visible in diagnostics.
- Commands cannot bypass timeout, output, user, or network policy.
- Filesystem persistence and network behavior are explicit production decisions, not implicit VM
  defaults.
