# Task: Prove macOS VM runner locally and close task 4

**Beads issue:** `agent-platform-macos-production-sandbox.4.4`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.4.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4`

## Summary

Run the local proof suite required to close `agent-platform-macos-production-sandbox.4`.

## Requirements

- Add or document the local VM runner proof command set.
- Prove helper `status`, `prepare`, `start`, `exec`, and `stop` work with the real VM.
- Prove harness `CommandRunner` maps VM execution to tool output correctly.
- Prove runner health reports `macos-vm` and not host or Docker.
- Record the evidence needed before `.5` packaging and staging work can start.
- Record the exact image manifest/checksum, macOS version/architecture, helper version, command
  runner mode, and proof commands used.
- Close `.4` only after the acceptance criteria are met.

## Tests And Verification

- Full repository gate:
  `pnpm lint && pnpm typecheck && pnpm format:check && pnpm docs:lint && pnpm test && pnpm build && pnpm --filter @agent-platform/desktop native:vm:build && pnpm --filter @agent-platform/desktop native:vm:test && git diff --check`
- Manual/local VM proof:
  - `macos-vm-runner prepare --runtime-dir <dir>`
  - `macos-vm-runner start --runtime-dir <dir>`
  - `macos-vm-runner status --runtime-dir <dir>`
  - `macos-vm-runner exec --runtime-dir <dir> --workspace <project> --cwd <project> -- pwd`
  - host-path isolation command proving no host home/credential paths are visible.
- Harness proof with `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm` showing a project command result is
  surfaced to the chat/tool layer without host fallback.
- Beads note or task-spec evidence block with command summaries and relevant artifact paths.

## Definition Of Done

- `.4` acceptance criteria are demonstrably satisfied.
- Beads task `.4` is closed with verification evidence.
- `.5` can start packaging/staging work from a real, locally proven VM runner.

## Verification Evidence

Environment:

- macOS `26.5` build `25F71`, host architecture `arm64`.
- Xcode `26.3` build `17C529`.
- Branch `jwill9999/macos-production-sandbox-vm-lifecycle-exec`.
- Helper path:
  `/Users/letuscode/projects/agent-platform/apps/desktop/native/macos-vm-runner/.build/arm64-apple-macosx/debug/macos-vm-runner`.
- Runtime directory: `/private/tmp/agent-platform-linux-proof-4-4a`.
- Proof workspace: `/private/tmp/agent-platform-proof-workspace-4-4`.

Asset manifest:

- `schemaVersion`: `2`
- `architecture`: `arm64`
- `imageFormat`: `raw`
- `imageSha256`: `bf64b28515e634ad3fdc1dfb5d379a31fa4cf13e73dca3d41b3ff503b7f1374c`
- `kernelSha256`: `9ffae683f615230c53ced0c1f4d9aa13554fb5377d26a5fabb002a22bb078a19`
- `initrdSha256`: `8cb79fdcbf90313d7a5a315a2dc90bca7435976c3603a28929bce5feefab2b1c`
- `bootstrapSha256`: `246d8bece2e1c7927399cd4a7a9ef6a11bfcd49f684a83ad8d789f65d2972e14`
- Boot loader: `VZLinuxBootLoader`
- Boot command line: `console=hvc0 root=/dev/vda rw systemd.unit=multi-user.target`

Proof commands and results:

- `native:vm:assets:build-linux -- --out-dir /private/tmp/agent-platform-linux-assets-ubuntu-4-4a`
  built a fresh Ubuntu ARM64 raw-kernel asset set.
- `native:vm:assets:prepare -- ... --out-dir /private/tmp/agent-platform-linux-proof-4-4a/images`
  prepared the runtime manifest and image files.
- `native:vm:sign-dev` signed the helper with development virtualization entitlements.
- `macos-vm-runner start --runtime-dir /private/tmp/agent-platform-linux-proof-4-4a --workspace /private/tmp/agent-platform-proof-workspace-4-4`
  returned `ok: true`, `state: ready`.
- `macos-vm-runner status --runtime-dir /private/tmp/agent-platform-linux-proof-4-4a`
  returned `mode: macos-vm`, `state: ready` when run outside the shell sandbox.
- `macos-vm-runner exec ... -- pwd` returned stdout `/workspace`.
- `macos-vm-runner exec ... --cwd .../src -- 'pwd; cat file.txt'`
  returned stdout `/workspace/src` and `proof-file`.
- Host-path isolation command over `/Users`, `/Applications`, `/root/.ssh`, and `$HOME/Library`
  returned only `isolated`.
- Harness proof using `createConfiguredCommandRunner` with
  `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm` returned health `mode: macos-vm`,
  `status: ready`, `production: true`, and mapped the project command to a `sys_bash`
  `tool_result` with stdout `/workspace\nproof-file\n` and exit code `0`.
- `macos-vm-runner stop --runtime-dir /private/tmp/agent-platform-linux-proof-4-4a`
  returned `state: disabled`.
- Restart after graceful stop returned `state: ready`, and a post-restart `pwd` command again
  returned `/workspace`.

Implementation correction made during proof:

- `start` now accepts an optional `--workspace` so helper lifecycle proof can boot with the same
  workspace share used by `exec`.
- `exec` fails closed when a running VM has no workspace binding, rather than dispatching to a guest
  without the `/workspace` share.
- `stop` now requests a guest shutdown through `VZVirtualMachine.requestStop()` and waits for the
  daemon to exit before clearing state. This avoids dirtying the VM disk during normal lifecycle
  proof and was validated by restart-after-stop.

Quality gate:

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm format:check` passed.
- `pnpm docs:lint` passed.
- `pnpm build` passed.
- `pnpm test` passed when rerun outside the shell sandbox. The first sandboxed run failed because
  desktop tests could not bind `127.0.0.1` (`listen EPERM`), not because of a test assertion.
- `pnpm --filter @agent-platform/desktop native:vm:build` passed.
- `pnpm --filter @agent-platform/desktop native:vm:test` passed with 20 Swift tests.
- `git diff --check` passed.
