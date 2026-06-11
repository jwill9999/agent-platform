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

Current verification, 2026-06-11:

- Fixed the VM asset builder so the generated Alpine container build script emits POSIX shell line
  continuations instead of literal `\\` continuations.
- Fixed the generated Ubuntu guest command service to run commands as `agentplatform` via
  `runuser -u agentplatform -- /bin/sh -c ...`; the prior `su` invocation failed with
  `Authentication failure` for the locked service account.
- `pnpm --filter @agent-platform/desktop native:vm:host-check -- --json` passed on Apple Silicon
  macOS 26.5.1 with Virtualization.framework, hypervisor support, Xcode, Swift, and codesign.
- `pnpm --filter @agent-platform/desktop native:vm:test` passed: 21 Swift tests.
- `pnpm --filter @agent-platform/desktop test -- test/macosVmHostCheck.test.ts
test/macosVmPackaging.test.ts test/packageScripts.test.ts` passed.
- `node --check apps/desktop/scripts/build-macos-vm-linux-assets.mjs` passed.
- Built fresh VM assets with
  `pnpm --filter @agent-platform/desktop native:vm:assets:build-linux -- --out-dir
/private/tmp/agent-platform-linux-assets-6-1`.
- Prepared runtime assets with
  `pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- --source-image
/private/tmp/agent-platform-linux-assets-6-1/source.raw --kernel
/private/tmp/agent-platform-linux-assets-6-1/vmlinuz --initrd
/private/tmp/agent-platform-linux-assets-6-1/initrd.img --bootstrap
/private/tmp/agent-platform-linux-assets-6-1/guest-bootstrap.sh --out-dir
/private/tmp/agent-platform-linux-runtime-6-1/images`.
- `macos-vm-runner start --runtime-dir /private/tmp/agent-platform-linux-runtime-6-1 --workspace
/private/tmp/agent-platform-vm-workspace-6-1` returned ready.
- Runtime diagnostics in `/private/tmp/agent-platform-linux-runtime-6-1/logs/vm-config.json`
  recorded `cpus: 2`, `memoryMB: 2048`, `networkDevices: 0`, `networkPolicy: disabled`,
  `guestUser: agentplatform`, `guestUid: 1000`, `guestGid: 1000`, `workspaceMount: /workspace`,
  timeout defaults/maxima, output defaults/maxima, and `virtualizationEntitlementPresent: true`.
- Live VM command probe returned `whoami=agentplatform`, `uid=1000`, `gid=1000`, only `lo` under
  `/sys/class/net`, no routes in `/proc/net/route`, `/workspace` as cwd, `/root` not writable, and
  guest-owned scratch writable under `$HOME/.agent-platform`.
- `/workspace/policy-write.txt` written from the guest appeared at
  `/private/tmp/agent-platform-vm-workspace-6-1/policy-write.txt` on the host.
- Timeout probe with `--timeout-ms 1000` returned exit code `124` in about 1.1 seconds and did not
  print the post-timeout command output.
- Output probe with `--max-output-bytes 32` returned exactly the first 32 bytes of stdout.
- Cwd escape probe with `--cwd /private/tmp` failed closed before guest dispatch with
  `Command cwd is outside the selected Project workspace.`

## Definition Of Done

- Production defaults are documented, enforced, and visible in diagnostics.
- Commands cannot bypass timeout, output, user, or network policy.
- Filesystem persistence and network behavior are explicit production decisions, not implicit VM
  defaults.
