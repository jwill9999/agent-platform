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

- **Date:** 2026-06-12
- **Session:** Closed `.6.2` with signed/packaged VM repair smoke; documented `.6.3` notarization
  blocker.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commits:** pending this session.

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
- `.6.2` is closed. Signed/packaged repair smoke packaged the signed helper/assets, repaired corrupt
  app-owned VM runtime state, preserved Project data and diagnostics, restored assets, and proved
  packaged helper `prepare/start/status/stop` works after repair.
- `.6.3` is in progress but externally blocked. Signing/quarantine/entitlement verifier exists, and
  signed packaged helper execution is proven, but real Developer ID signing/notarization cannot be
  produced locally: `security find-identity -v -p codesigning` returned `0 valid identities found`,
  and no Apple/notary credential environment variables are present.
- `.6.4` is in progress. Future Windows/Linux adapter docs and traceability draft exist; final
  closure is blocked by `.6.3`.
- `.5` and `.5.4` are closed. PR #227 recorded green `staging-packaged-macos-vm-e2e` evidence on the
  self-hosted Apple Silicon runner.

## Recent Work

- Added `apps/desktop/scripts/smoke-macos-vm-repair.mjs` and `native:vm:smoke-repair` to make `.6.2`
  packaged repair evidence repeatable.
- Ran `.6.2` smoke with pristine prepared VM assets from `/private/tmp/agent-platform-linux-runtime-6-2/images`
  and work dir `/private/tmp/agent-platform-macos-vm-repair-smoke-6-2`.
- Smoke result: repair deleted only app-owned `state`/`images`, preserved `logs/support.log`,
  preserved Project `README.md`, restored `images/manifest.json`, and the packaged helper returned
  `prepare: disabled`, `start: ready`, `status: ready`, `stop: disabled`.
- Closed Beads issue `agent-platform-macos-production-sandbox.6.2`.
- Updated `.6.3` spec/Beads notes with the concrete signing/notarization blocker.
- Updated `.6.4` audit so `.6.1` and `.6.2` are closed and only `.6.3` blocks final closure.

## Checks Run

- `pnpm --filter @agent-platform/desktop native:vm:host-check -- --json`
- `node --check apps/desktop/scripts/build-macos-vm-linux-assets.mjs`
- `node --check apps/desktop/scripts/smoke-macos-vm-repair.mjs`
- `pnpm --filter @agent-platform/desktop native:vm:assets:build-linux -- --out-dir /private/tmp/agent-platform-linux-assets-6-1`
- `pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- --source-image /private/tmp/agent-platform-linux-assets-6-1/source.raw --kernel /private/tmp/agent-platform-linux-assets-6-1/vmlinuz --initrd /private/tmp/agent-platform-linux-assets-6-1/initrd.img --bootstrap /private/tmp/agent-platform-linux-assets-6-1/guest-bootstrap.sh --out-dir /private/tmp/agent-platform-linux-runtime-6-1/images`
- `pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- --source-image /private/tmp/agent-platform-linux-assets-6-1/source.raw --kernel /private/tmp/agent-platform-linux-assets-6-1/vmlinuz --initrd /private/tmp/agent-platform-linux-assets-6-1/initrd.img --bootstrap /private/tmp/agent-platform-linux-assets-6-1/guest-bootstrap.sh --out-dir /private/tmp/agent-platform-linux-runtime-6-2/images`
- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:sign-dev`
- `pnpm --filter @agent-platform/desktop native:vm:verify-signing -- --helper /Users/letuscode/projects/agent-platform/apps/desktop/native/macos-vm-runner/.build/arm64-apple-macosx/debug/macos-vm-runner --json`
- `pnpm --filter @agent-platform/desktop native:vm:smoke-repair -- --assets-dir /private/tmp/agent-platform-linux-runtime-6-2/images --work-dir /private/tmp/agent-platform-macos-vm-repair-smoke-6-2`
- `macos-vm-runner start/status/exec/stop` live proof against `/private/tmp/agent-platform-linux-runtime-6-1`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmHostCheck.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/backendSupervisor.test.ts test/macosVmSigning.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm format:check`
- `pnpm docs:lint`
- `git diff --check`

SonarQube MCP/tools were not exposed by tool discovery in this session, so the completion gate used
the documented fallback checks above.

## Next

1. Provide a VM-capable Apple Silicon runner/session with Developer ID signing identity and Apple
   notary credentials.
2. Complete `.6.3`: produce signed/notarized artifact smoke evidence proving helper execution,
   entitlements, no quarantine block, notarization success, and `macos-vm` ready health.
3. Complete `.6.4`: refresh final traceability audit, close `.6`, then close
   `agent-platform-macos-production-sandbox`.
4. After the epic closes, decide whether the next focus is the divergent pull/merge resolver or the
   broader Git workflow UI epic.
