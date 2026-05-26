# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise, and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive: [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-05-26
- **Session:** Continued release hardening with `.6.3` VM signing verification.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commit:** `acc1722` adds the `.6.2` VM repair flow; `.6.3` signing verification is
  pending commit.

## Current State

- Production sandbox work remains on `jwill9999/macos-production-sandbox-vm-lifecycle-exec`; do not push directly to `main`.
- The macOS VM production path is Apple `Virtualization.framework` with `VZLinuxBootLoader` and a raw ARM64 Linux `Image`.
- Docker and host command runners remain development-only paths; production/staging must prove `macos-vm` or stay fail-closed.
- `.4.2`, `.4.2.1`, `.4.2.2`, `.4.2.3`, `.4.3`, `.4.4`, `.4`, `.5.1`, and `.5.2` are complete.
- `.5.3` is complete and pushed.
- `.5` / `.5.4` are on hold: implementation reaches real VM startup, but final staging sign-off
  requires a self-hosted VM-capable Apple Silicon runner labelled `self-hosted`, `macOS`, `ARM64`,
  and `agent-platform-vm`.
- `.6.1` is in progress: production resource/network/filesystem/user policy hardening is
  implemented locally, but live VM smoke evidence is still required before closing.
- `.6.2` is in progress: safe VM runtime repair is implemented locally and covered by desktop unit
  tests; signed/packaged smoke evidence can be added later with the self-hosted runner.
- `.6.3` is in progress: packaged helper signing/quarantine/entitlement verification is implemented
  locally; signed/notarized artifact smoke evidence is still required before closing.

## Recent Work

- Completed `.5.1` through `.5.3`: packaged helper/assets, fail-closed startup/health behavior,
  and packaged Electron E2E coverage for ready and unavailable VM command flows.
- Cleared PR #227 verify/Sonar followups, including harness browser startup budget, remaining
  Sonar issue, fixed security hotspots, and duplicated-test setup.
- Started `.5.4` staging gate work:
  - added a staging-only `staging-packaged-macos-vm-e2e` CI job on `macos-15`,
  - made the job require `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_URL` and
    `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_SHA256`,
  - packages the signed helper with downloaded pinned assets and uploads manifest/evidence
    artifacts,
  - extended the packaged Electron E2E so CI can run the success path against real packaged
    resources while retaining synthetic fail-closed coverage.
- Investigated the three failing PR #227 checks:
  - `verify` failed in `packages/harness/test/browserTools.integration.test.ts` because first
    Chromium startup exceeded the 30s tool timeout on GitHub; increased the integration startup
    budget while keeping action timeouts bounded,
  - SonarCloud reported one open issue, `typescript:S3358`, in `apps/web/app/page.tsx`; extracted
    the command-runner status color ternary into a named helper,
  - `staging-packaged-macos-vm-e2e` failed because the required pinned asset URL/SHA repository
    variables were empty, not because of test code.
- After the asset variables were configured, `staging-packaged-macos-vm-e2e` downloaded and verified
  the pinned archive, then failed real VM startup on GitHub-hosted `macos-15-arm64` with
  `VZErrorDomain` code `2`: `Virtualization is not available on this hardware`.
- Updated `.5.4` CI wiring to require a self-hosted Apple Silicon runner labelled `self-hosted`,
  `macOS`, `ARM64`, and `agent-platform-vm`; hosted macOS is no longer treated as a valid staging
  runner for the production VM gate.
- Put `.5` and `.5.4` on hold in Beads and claimed `.6.1`.
- Implemented `.6.1` policy hardening:
  - exported shared macOS VM production policy details from the harness,
  - clamped macOS VM command timeout/output limits in the TypeScript adapter and native helper,
  - documented the production policy: 2 vCPU, 2048 MiB RAM, disabled guest networking, non-root
    `agentplatform` user, `/workspace` as the only host-backed writable mount, and app-owned guest
    scratch,
  - added policy details to command-runner health,
  - added native diagnostics for network device count and effective production policy,
  - hardened the guest service to clamp job limits and set non-root HOME/TMPDIR scratch.
- Implemented `.6.2` safe VM repair flow:
  - added desktop maintenance IPC/preload action `repairMacosVmRuntime`,
  - validates runtime path ownership under desktop app data and refuses Project/arbitrary/symlink
    paths,
  - stops a running VM daemon via the packaged helper before deleting state,
  - deletes only VM `state` and `images` by default, preserves diagnostics logs, and recopies
    packaged pinned assets,
  - added desktop tests for stopped/running/corrupt runtime repair and unsafe path refusal.
- Started `.6.3` signing/notarization validation:
  - added `native:vm:verify-signing` for packaged helper verification,
  - verifier fails closed for missing/non-executable/quarantined/unsigned helpers and missing
    `com.apple.security.virtualization`,
  - staging packaged VM workflow now stores `helper-signing-report.json` before running the VM E2E,
  - full signed/notarized artifact smoke remains pending the VM-capable Apple Silicon runner.

## Checks Run

- `pnpm --filter @agent-platform/harness test -- test/browserTools.integration.test.ts`
- `pnpm --filter @agent-platform/harness test`
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/harness lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/api test`
- `pnpm --filter @agent-platform/api test -- test/readinessCheck.test.ts`
- `pnpm --filter @agent-platform/api typecheck`
- `pnpm --filter @agent-platform/api lint`
- `pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/macosVmPackaging.test.ts test/packageScripts.test.ts`
- `pnpm --filter @agent-platform/api run typecheck`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/desktop run typecheck`
- `pnpm --filter @agent-platform/api run lint`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/desktop run lint`
- `pnpm --filter @agent-platform/api run build`
- `pnpm --filter @agent-platform/web run build`
- `pnpm --filter @agent-platform/desktop run build`
- `pnpm --filter @agent-platform/api run test`
- `pnpm --filter @agent-platform/desktop run test`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/desktop exec playwright test -c e2e/playwright.electron.config.ts e2e/packaged-vm-command.e2e.ts`
- `pnpm run format:check`
- `pnpm docs:lint`
- `pnpm --filter @agent-platform/harness test -- test/browserTools.integration.test.ts`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/harness test -- test/macosVmCommandRunner.test.ts test/commandRunnerHealth.test.ts`
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/harness lint`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `swift test --package-path apps/desktop/native/macos-vm-runner`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts test/preloadContract.test.ts test/localDataReset.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmSigning.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `git diff --check`
- GitHub PR #227 after CI setup fix: `verify`, `docker`, `desktop-e2e`, `e2e`, `security-scan`,
  CodeQL, markdownlint, lychee, and SonarCloud passed before the local `.5.2` changes.

## Next

1. Commit and push the `.6.3` helper signing verification after final local status review.
2. Register or attach a real Apple Silicon self-hosted GitHub runner with labels `self-hosted`,
   `macOS`, `ARM64`, and `agent-platform-vm`.
3. Confirm the repository variables still contain only the raw checksum and release asset URL:
   `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_SHA256` and
   `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_URL`.
4. Rerun the PR into `staging`, then keep `.5.4`, `.6.1`, `.6.2`, and `.6.3` open until artifacts
   prove real packaged `macos-vm` command execution, policy behavior, repair, and signed/notarized
   helper execution.
