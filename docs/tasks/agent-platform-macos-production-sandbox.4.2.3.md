# Task: Prove VM daemon lifecycle reliability

**Beads issue:** `agent-platform-macos-production-sandbox.4.2.3`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.2.3.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4.2`

## Summary

Prove the helper daemon keeps the VM alive, reports status accurately, and clears running or stale
state safely.

## Requirements

- Keep the VM alive after `start` returns.
- Make `status` fail closed when the daemon exits or state is stale.
- Make `stop` terminate the daemon/VM and clear ready state.
- Preserve logs for startup and stop failures.
- Record evidence before closing `.4.2`.

## Tests And Verification

- Local smoke proving `status` remains ready while daemon is alive.
- Local smoke proving killing the daemon makes `status` unavailable.
- Local smoke proving `stop` clears ready state.
- Beads note with exact commands and result summaries.

## Definition Of Done

- Runtime state cannot falsely report ready after daemon death.
- `stop` is reliable and idempotent.
- Parent `.4.2` can be closed with real boot and lifecycle evidence.
