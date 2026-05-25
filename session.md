# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise, and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive: [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-05-25
- **Session:** Completed `.4.3`; started and locally proved `.4.4`.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commit:** `6f5982a` (`.4.3` guest command execution); `.4.4` proof changes pending commit.

## Current State

- Production sandbox work remains on `jwill9999/macos-production-sandbox-vm-lifecycle-exec`; do not push directly to `main`.
- The macOS VM production path is Apple `Virtualization.framework` with `VZLinuxBootLoader` and a raw ARM64 Linux `Image`.
- Docker and host command runners remain development-only paths; production/staging must prove `macos-vm` or stay fail-closed.
- `.4.2`, `.4.2.1`, `.4.2.2`, and `.4.2.3` are complete.
- `.4.3` is implemented, verified, closed in Beads, committed, and pushed.
- `.4.4` proof is implemented locally and ready to close after the final commit/push.

## Recent Work

- Implemented the native guest command transport:
  - host Project root is shared into the guest as `/workspace`,
  - command jobs are exchanged through a second `virtiofs` share,
  - cwd is mapped into `/workspace` and rejected before guest dispatch if outside the Project root,
  - stdout, stderr, exit code, duration, timeout, and output limit flow back through the helper JSON response,
  - commands run as the non-root `agentplatform` guest user,
  - approved environment variables are serialized through an env JSON file and sourced inside the guest command shell.
- Reworked `native:vm:assets:build-linux` so the Ubuntu guest image contains matching kernel modules for the raw Ubuntu ARM64 kernel:
  - downloads Ubuntu rootfs, raw kernel source, initrd, and matching module `.deb` files,
  - extracts modules directly with `dpkg-deb`,
  - runs `depmod`,
  - preserves `/lib` compatibility links needed by Ubuntu init and shell binaries,
  - rejects non-raw ARM64 kernels before boot.
- Real VM smoke evidence passed against `/private/tmp/agent-platform-linux-runtime-ubuntu-4-3q`:
  - `pwd` returned `/workspace`,
  - nested cwd returned `/workspace/src`,
  - outside cwd was rejected before guest dispatch,
  - stdout/stderr/non-zero exit mapped correctly,
  - timeout returned exit code `124`,
  - output was truncated to the requested limit,
  - `id -u; whoami` returned `1000` and `agentplatform`,
  - `/Users`, `/Applications`, and `/root/.ssh` were unavailable,
  - serialized `AGENT_TEST=guest-env` reached the guest command.
- Started `.4.4` and proved the real runner against fresh runtime
  `/private/tmp/agent-platform-linux-proof-4-4a`:
  - fresh Ubuntu ARM64 raw-kernel asset build and prepare passed,
  - helper `start --workspace`, `status`, `exec`, `stop`, and restart-after-stop passed,
  - `pwd` returned `/workspace`,
  - nested cwd read `/workspace/src/file.txt`,
  - host path isolation returned `isolated`,
  - harness `createConfiguredCommandRunner` in `macos-vm` mode returned production-ready health and
    mapped the command result to a `sys_bash` `tool_result`.
- During `.4.4` proof, fixed a lifecycle edge case:
  - `start` accepts optional `--workspace`,
  - `exec` fails closed if an already-running VM has no workspace binding,
  - `stop` requests guest shutdown through `VZVirtualMachine.requestStop()` and waits for daemon exit
    before clearing state, so restart-after-stop remains bootable.

## Checks Run

- `node --check apps/desktop/scripts/build-macos-vm-linux-assets.mjs`
- `pnpm --filter @agent-platform/harness test -- test/macosVmCommandRunner.test.ts`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop native:vm:assets:build-linux -- --out-dir /private/tmp/agent-platform-linux-assets-ubuntu-4-3q`
- `pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- ... --out-dir /private/tmp/agent-platform-linux-runtime-ubuntu-4-3q/images`
- `pnpm --filter @agent-platform/desktop native:vm:sign-dev`
- Real helper smoke tests using `apps/desktop/native/macos-vm-runner/.build/arm64-apple-macosx/debug/macos-vm-runner exec`
- `.4.4` full gate:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm format:check`
  - `pnpm docs:lint`
  - `pnpm build`
  - `pnpm test` rerun outside shell sandbox after sandboxed `listen EPERM`
  - `pnpm --filter @agent-platform/desktop native:vm:build`
  - `pnpm --filter @agent-platform/desktop native:vm:test`
  - `git diff --check`

## Next

1. Close Beads issue `agent-platform-macos-production-sandbox.4.4` and parent
   `agent-platform-macos-production-sandbox.4`.
2. Commit and push `.4.4` proof changes.
3. Start `agent-platform-macos-production-sandbox.5`, which owns packaging/staging production
   integration.
