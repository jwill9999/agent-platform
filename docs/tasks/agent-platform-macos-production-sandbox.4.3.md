# Task: Implement guest command execution and workspace mount

**Beads issue:** `agent-platform-macos-production-sandbox.4.3`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.3.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4`

## Summary

Execute commands inside the running Linux guest and expose only the selected Project folder as `/workspace`.

## Requirements

- Add the guest command service/transport.
- Map host Project root to guest `/workspace`.
- Map command cwd to a path under guest `/workspace`.
- Enforce timeout and output limits from `CommandRunnerRequest`.
- Return stdout, stderr, exit code, and duration to the harness.
- Run commands as a non-root guest user.
- Do not expose host home directories, app data, credentials, or arbitrary host paths.

## Tests And Verification

- `pnpm --filter @agent-platform/harness test -- test/macosVmCommandRunner.test.ts`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- Local helper smoke proving `pwd` returns `/workspace`.
- Local helper smoke proving `/Users`, `~/Library`, `~/.ssh`, and host app data are unavailable inside the guest.

## Definition Of Done

- `sys_bash` through `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm` executes inside `/workspace`.
- Host-only paths are unavailable from the guest.
- Unavailable VM or command-service failures return denied results without host fallback.
