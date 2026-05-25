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
- **Session:** Completed `.4.3` guest command execution and workspace mount.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commit:** pending this session.

## Current State

- Production sandbox work remains on `jwill9999/macos-production-sandbox-vm-lifecycle-exec`; do not push directly to `main`.
- The macOS VM production path is Apple `Virtualization.framework` with `VZLinuxBootLoader` and a raw ARM64 Linux `Image`.
- Docker and host command runners remain development-only paths; production/staging must prove `macos-vm` or stay fail-closed.
- `.4.2`, `.4.2.1`, `.4.2.2`, and `.4.2.3` are complete.
- `.4.3` is implemented and verified locally; close it in Beads once the final diff/checks are committed.

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

## Next

1. Update `docs/tasks/agent-platform-macos-production-sandbox.4.3.md` with final evidence.
2. Close Beads issue `agent-platform-macos-production-sandbox.4.3`.
3. Commit and push this branch.
4. Start `agent-platform-macos-production-sandbox.4.4`, which owns local proof/closure for parent task `.4`.
