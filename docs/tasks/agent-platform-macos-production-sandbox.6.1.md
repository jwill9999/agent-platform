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
- Expose effective resource and network policy through runner health/diagnostics.

## Tests And Verification

- Unit tests for limit mapping and default policy.
- Native helper tests for configured CPU and memory.
- VM command tests proving timeout and output truncation.
- Network policy smoke test matching the selected production policy.

## Definition Of Done

- Production defaults are documented, enforced, and visible in diagnostics.
- Commands cannot bypass timeout, output, user, or network policy.
