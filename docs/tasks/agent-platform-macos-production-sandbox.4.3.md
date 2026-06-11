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

## Implementation Notes

- Transport: host writes command jobs into an app-owned `virtiofs` share at
  `state/commands/jobs`; the guest service polls that share and writes result files back for the
  helper to collect. This keeps the control plane file-based and compatible with the existing
  signed helper/asset model.
- Workspace: the selected host Project root is shared as a separate `virtiofs` device mounted at
  `/workspace`. No host home, app data, or arbitrary host path is shared.
- Command serialization:
  - command body: `command.sh`,
  - cwd: mapped to `/workspace` or nested paths below it,
  - environment: approved runner environment serialized as JSON by the harness, converted by the
    helper into a quoted `env.sh`, and sourced by the guest command shell,
  - shell: `/bin/sh`,
  - stdin: empty for this task; interactive stdin remains out of scope for `.4.3`.
- Guest user: commands run through `su agentplatform -s /bin/sh -c ...`; the service itself runs as
  root only to mount `virtiofs`.
- Timeout/output behavior: the guest wraps commands in `timeout`, writes stdout/stderr to temp
  files, truncates to `max-output-bytes`, and returns the command exit code. Timeout is represented
  by command exit code `124`.

## Verification Evidence

- Unit/focused checks:
  - `node --check apps/desktop/scripts/build-macos-vm-linux-assets.mjs`
  - `pnpm --filter @agent-platform/harness test -- test/macosVmCommandRunner.test.ts`
  - `pnpm --filter @agent-platform/desktop native:vm:test`
  - `pnpm --filter @agent-platform/harness typecheck`
  - `pnpm --filter @agent-platform/desktop typecheck`
- Asset build proof:
  - `pnpm --filter @agent-platform/desktop native:vm:assets:build-linux -- --out-dir /private/tmp/agent-platform-linux-assets-ubuntu-4-3q`
  - `pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- --source-image /private/tmp/agent-platform-linux-assets-ubuntu-4-3q/base-linux.img --kernel /private/tmp/agent-platform-linux-assets-ubuntu-4-3q/vmlinuz --initrd /private/tmp/agent-platform-linux-assets-ubuntu-4-3q/initrd.img --bootstrap /private/tmp/agent-platform-linux-assets-ubuntu-4-3q/guest-bootstrap.sh --out-dir /private/tmp/agent-platform-linux-runtime-ubuntu-4-3q/images`
- Real helper smoke evidence:
  - `pwd` returned `/workspace`.
  - Nested cwd returned `/workspace/src`.
  - Outside cwd returned `Command cwd is outside the selected Project workspace.`
  - stdout/stderr/non-zero command returned stdout `out`, stderr `err`, exit code `7`.
  - Timeout command returned exit code `124`.
  - Output limit `8` returned `12345678`.
  - `id -u; whoami` returned `1000` and `agentplatform`.
  - Workspace file `/workspace/src/file.txt` returned `sample`.
  - Host path isolation check returned `isolated` for `/Users`, `/Applications`, and `/root/.ssh`.
  - Env serialization smoke returned `guest-env` from `$AGENT_TEST` inside the guest.
