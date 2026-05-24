# Task: Implement guest command execution and workspace mount

**Beads issue:** `agent-platform-macos-production-sandbox.4.3`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.3.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4`

## Summary

Execute commands inside the running Linux guest and expose only the selected Project folder as `/workspace`.

## Requirements

- Add the guest command service/transport, with the transport choice documented before
  implementation continues. The choice must be compatible with the `.4.2.1` bootstrap model and
  the `.6.3` signing/notarization requirements.
- Map host Project root to guest `/workspace`.
- Map command cwd to a path under guest `/workspace`.
- Reject cwd values outside the selected Project root before they reach the guest.
- Define how command arguments, environment variables, stdin, shell selection, and working directory
  are serialized across the guest boundary.
- Enforce timeout and output limits from `CommandRunnerRequest`.
- Kill or clean up guest processes that exceed timeout.
- Return stdout, stderr, exit code, and duration to the harness.
- Run commands as a non-root guest user.
- Prevent concurrent commands from corrupting shared runtime state; either serialize commands per VM
  or document and test the concurrency model.
- Do not expose host home directories, app data, credentials, or arbitrary host paths.

## Tests And Verification

- `pnpm --filter @agent-platform/harness test -- test/macosVmCommandRunner.test.ts`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- Local helper smoke proving `pwd` returns `/workspace`.
- Local helper smoke proving cwd mapping works for nested project directories and rejects paths
  outside the Project root.
- Local helper smoke proving stdout, stderr, non-zero exit code, timeout, and output truncation map
  back to the `CommandRunnerResult` contract.
- Local helper smoke proving commands run as the configured non-root guest user.
- Local helper smoke proving `/Users`, `~/Library`, `~/.ssh`, and host app data are unavailable inside the guest.

## Definition Of Done

- `sys_bash` through `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm` executes inside `/workspace`.
- Host-only paths are unavailable from the guest.
- Unavailable VM or command-service failures return denied results without host fallback.
- Command execution behavior matches the existing `CommandRunner` contract for success, failure,
  timeout, truncation, cwd, and diagnostics.
