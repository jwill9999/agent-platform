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
- Prove repeated `start`, `status`, and `stop` calls are idempotent and do not create duplicate
  daemon processes for the same runtime directory.
- Prove daemon PID reuse or stale PID files cannot make `status` report a false ready state.
- Define and test the cleanup behavior for ready marker, PID file, socket, lock file, and diagnostic
  logs.
- Record evidence before closing `.4.2`.

## Tests And Verification

- Local smoke proving `status` remains ready while daemon is alive.
- Local smoke proving killing the daemon makes `status` unavailable.
- Local smoke proving `stop` clears ready state.
- Local smoke proving repeated `start` and `stop` calls are safe.
- Local smoke proving stale PID/socket/ready marker combinations fail closed.
- Beads note with exact commands and result summaries.

## Definition Of Done

- Runtime state cannot falsely report ready after daemon death.
- `stop` is reliable and idempotent.
- Runtime state cleanup is deterministic and documented.
- Parent `.4.2` can be closed with real boot and lifecycle evidence.

## Evidence

Completed on 2026-05-25 using the signed development helper and the validated raw ARM64 kernel
runtime at `/private/tmp/agent-platform-linux-runtime-raw-image`.

- Added a daemon heartbeat file at `state/daemon.heartbeat`; `status` now requires the ready marker,
  live daemon PID, matching helper executable path, and a fresh heartbeat before reporting ready.
- `stop` clears `state/runner.sock`, `state/daemon.pid`, `state/daemon.heartbeat`, and
  `logs/last-error.log`; diagnostic logs such as `daemon.out.log`, `daemon.err.log`,
  `guest-console.log`, and `vm-config.json` are preserved.
- Native unit tests cover stale socket without live daemon, stale PID reuse without heartbeat, stale
  heartbeat, and stop cleanup.
- Local lifecycle smoke:
  - baseline `stop` returned `{"ok":true,"state":"disabled"}`;
  - `start` returned `{"ok":true,"state":"ready"}`;
  - `status` returned `{"ok":true,"state":"ready"}`;
  - repeated `start` returned `VM runner is already running`;
  - after `SIGTERM` to the daemon PID, `status` returned `{"ok":false,"state":"unavailable"}`;
  - stale state with live unrelated PID `1`, fresh heartbeat, and ready marker returned unavailable;
  - repeated `stop` returned disabled both times;
  - final `status` returned unavailable and only `state/machine-id` remained in the state directory.
