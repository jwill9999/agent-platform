# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise,
and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive:
  [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads
  tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-06-11
- **Session:** Closed `.6.1` with live Apple Silicon VM policy evidence and fixed guest asset build
  issues found during proof.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commits:** `6282a14` closes VM policy hardening; follow-up session handoff commit pending.

## Current State

- Production sandbox work remains on `jwill9999/macos-production-sandbox-vm-lifecycle-exec`; do not
  push directly to `main`.
- Parent epic `agent-platform-macos-production-sandbox` is open at `5/6` complete because `.6`
  remains open.
- `.6.1` is closed. Live VM proof on Apple Silicon macOS verified:
  - VM diagnostics: `2` vCPU, `2048` MiB RAM, `networkDevices: 0`, `networkPolicy: disabled`,
    `agentplatform` uid/gid `1000`, `/workspace` mount, timeout/output limits, and virtualization
    entitlement present.
  - Guest commands run non-root, only `lo` exists under `/sys/class/net`, `/proc/net/route` has no
    routes, `/workspace` writes persist to the host Project path, `/root` is not writable, scratch is
    guest-owned, timeout exits `124`, output clamps at requested bytes, and cwd escape fails closed.
- `.6.2` is in progress. Local repair flow is implemented and unit-covered; remaining sign-off is a
  signed/packaged live repair smoke in the release-shaped runtime.
- `.6.3` is in progress. Signing/quarantine/entitlement verifier exists; remaining sign-off is a
  signed/notarized artifact smoke proving helper execution and `macos-vm` ready health.
- `.6.4` is in progress. Future Windows/Linux adapter docs and traceability draft exist; final
  closure is blocked by `.6.2` and `.6.3`.
- `.5` and `.5.4` are closed. PR #227 recorded green `staging-packaged-macos-vm-e2e` evidence on the
  self-hosted Apple Silicon runner.

## Recent Work

- Completed `.6.1` live policy proof using freshly built VM assets under `/private/tmp`.
- Fixed `apps/desktop/scripts/build-macos-vm-linux-assets.mjs`:
  - generated shell continuations now emit single POSIX `\` continuations instead of literal `\\`,
  - generated guest service now prefers `runuser -u agentplatform -- /bin/sh -c ...` so locked
    service-account dispatch works on Ubuntu.
- Added regression coverage in `apps/desktop/test/packageScripts.test.ts` for the generated shell
  continuation and guest user dispatch snippets.
- Updated `docs/tasks/agent-platform-macos-production-sandbox.6.1.md` with live evidence.
- Updated `docs/tasks/agent-platform-macos-production-sandbox.6.4.md` plus Beads notes for `.6.2`
  and `.6.4` so stale `.5/.5.4/.6.1` blockers are removed.
- Closed Beads issue `agent-platform-macos-production-sandbox.6.1`.

## Checks Run

- `pnpm --filter @agent-platform/desktop native:vm:host-check -- --json`
- `node --check apps/desktop/scripts/build-macos-vm-linux-assets.mjs`
- `pnpm --filter @agent-platform/desktop native:vm:assets:build-linux -- --out-dir /private/tmp/agent-platform-linux-assets-6-1`
- `pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- --source-image /private/tmp/agent-platform-linux-assets-6-1/source.raw --kernel /private/tmp/agent-platform-linux-assets-6-1/vmlinuz --initrd /private/tmp/agent-platform-linux-assets-6-1/initrd.img --bootstrap /private/tmp/agent-platform-linux-assets-6-1/guest-bootstrap.sh --out-dir /private/tmp/agent-platform-linux-runtime-6-1/images`
- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:sign-dev`
- `macos-vm-runner start/status/exec/stop` live proof against `/private/tmp/agent-platform-linux-runtime-6-1`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmHostCheck.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm format:check`
- `pnpm docs:lint`
- `git diff --check`

SonarQube MCP/tools were not exposed by tool discovery in this session, so the completion gate used
the documented fallback checks above.

## Next

1. Complete `.6.2`: run signed/packaged VM repair smoke against the release-shaped runtime and close
   the task if it proves app-owned state repair without Project deletion.
2. Complete `.6.3`: produce signed/notarized artifact smoke evidence proving helper execution,
   entitlements, no quarantine block, and `macos-vm` ready health.
3. Complete `.6.4`: refresh final traceability audit, close `.6`, then close
   `agent-platform-macos-production-sandbox`.
4. After the epic closes, decide whether the next focus is the divergent pull/merge resolver or the
   broader Git workflow UI epic.
