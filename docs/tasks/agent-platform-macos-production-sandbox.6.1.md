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

## Production Policy

- VM resources: `2` vCPUs and `2048` MiB memory, capped again by
  `Virtualization.framework` host maximums.
- Command limits: default timeout `30000` ms, maximum timeout `120000` ms, default output
  `65536` bytes, maximum output `1048576` bytes.
- Guest process user: commands run as non-root user `agentplatform` (`uid=1000`, `gid=1000`).
- Network policy: disabled for the initial macOS release. The VM configuration intentionally
  creates no `VZNetworkDeviceConfiguration`, so guest commands do not receive a virtual NIC.
- Filesystem policy: the selected Project is the only host-backed writable mount and is exposed at
  `/workspace`. Guest-owned scratch such as `/home/agentplatform/.agent-platform` is app-owned VM
  state, not user Project data.
- Persistence policy: Project writes persist because they target `/workspace`; guest scratch/root
  disk changes are app-owned VM runtime state and may be reset by the future `.6.2` repair flow.
- Diagnostics: runner health and native VM config diagnostics must expose the effective CPU,
  memory, command, output, guest user, filesystem, and network policy.

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
