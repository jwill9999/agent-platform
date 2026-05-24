# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise, and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive: [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-05-24
- **Session:** Split `.4.2` into explicit boot-proof child tasks.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commit:** pending `.4.2` child task split.

## Current State

- The Docker sandbox runner branch exists and has a PR, but it is now explicitly treated as
  foundation/development-adapter work, not the production sandbox solution.
- User clarified that packaged macOS staging must test production-ready behavior before merge to
  `main`; host or Docker fallback must not count as release evidence.
- Environment model is now explicit:
  - local: developer productivity and fast feedback,
  - staging: production rehearsal with packaged macOS runner evidence,
  - production: released signed/notarized app.
- New production tracking exists:
  - Plan: `docs/superpowers/plans/2026-05-24-macos-production-sandbox-runner.md`
  - Epic: `agent-platform-macos-production-sandbox`
- Production sandbox task chain is in progress:
  - `agent-platform-macos-production-sandbox.1` is complete and pushed on
    `jwill9999/docker-sandbox-command-runner`,
  - `agent-platform-macos-production-sandbox.2` is complete and pushed on
    `jwill9999/macos-production-sandbox-health-contract`,
  - `agent-platform-macos-production-sandbox.3` is implemented locally on
    `jwill9999/macos-production-sandbox-vm-helper-skeleton`,
  - `agent-platform-macos-production-sandbox.4.1` is complete,
  - `agent-platform-macos-production-sandbox.4.2` is claimed and started,
  - `agent-platform-macos-production-sandbox.4` remains in progress on
    `jwill9999/macos-production-sandbox-vm-lifecycle-exec`,
  - command runner defaults to `disabled`,
  - desktop managed backend defaults to `AGENT_PLATFORM_COMMAND_RUNNER=disabled`,
  - `host` and `docker-sandbox` are now explicit development modes only,
  - `macos-vm` is a recognized mode and the health contract reports it as production-ready only
    when a VM runner is configured.

## Recent Work

- Reverted the accidental direct `main` push with commit `0dc0d47`; feature work remains on
  `jwill9999/docker-sandbox-command-runner`.
- Created a staged production plan for a macOS VM-backed `CommandRunner` using Apple
  `Virtualization.framework`, with staging required to run packaged Electron E2E against the same
  runner path production will use.
- Added task specs for the full chain:
  1. fail-closed runner defaults,
  2. runner health/status contract,
  3. ADR and native Swift helper skeleton,
  4. VM lifecycle and command execution,
  5. packaging plus staging E2E gate,
  6. release hardening and future Windows/Linux adapter plan.
- Created Beads epic `agent-platform-macos-production-sandbox` and child tasks `.1` through `.6`
  with dependencies.
- Added environment-specific evidence rules: `.4` requires real local macOS VM command execution,
  `.5` requires packaged staging E2E proving `macos-vm` and fail-closed behavior, and `.6` requires
  signing/notarization plus release smoke evidence.
- Verified docs with `pnpm docs:lint`.
- Implemented fail-closed runner behavior with focused tests for harness and desktop defaults.
- Updated API integration tests that intentionally execute approved shell commands to opt into
  `AGENT_PLATFORM_COMMAND_RUNNER=host` explicitly.
- Stabilized the API pre-push suite by disabling Vitest file parallelism while retaining the
  single-fork API test pool.
- Verified the implementation with:
  `pnpm lint && pnpm typecheck && pnpm format:check && pnpm docs:lint && pnpm test && pnpm build && git diff --check`.
- Added `CommandRunnerHealth` / `CommandRunnerHealthStatus` and
  `getConfiguredCommandRunnerHealth()` in the harness.
- Added focused health-contract tests for disabled, host, Docker, unavailable macOS VM, and ready
  macOS VM modes.
- Recorded ADR-0003 for the production macOS sandbox runner: Apple Virtualization.framework is the
  production path, Docker/host modes remain development-only, and staging must prove the packaged
  macOS VM path or keep command execution explicitly disabled.
- Added a native Swift package at `apps/desktop/native/macos-vm-runner` with deterministic JSON
  skeleton commands for `status`, `prepare`, `start`, `stop`, and `exec`.
- Added desktop package scripts and tests for building/testing the native helper.
- Started `.4` by adding the harness-side `macos-vm` runner adapter, preserving
  `AGENT_PLATFORM_MACOS_VM_RUNNER_PATH` through the managed desktop backend, and expanding the Swift
  helper lifecycle contract for deterministic runtime-dir and missing-image behavior.
- Continued `.4` by adding app-owned `AGENT_PLATFORM_MACOS_VM_RUNTIME_DIR` propagation, requiring
  the harness `macos-vm` adapter to pass `--runtime-dir` to the native helper, and making Swift
  `exec` fail closed for unconfigured runtime, missing image, or VM not started.
- Corrected the task graph so broad tasks cannot be mistaken for completed production sandboxing:
  `.4.1` through `.4.4` cover guest image/bootstrap, VM boot, guest command execution, and local
  proof; `.5.1` through `.5.4` cover packaging, packaged runner health, packaged Electron E2E, and
  staging gate evidence; `.6.1` through `.6.4` cover resource/network hardening, VM reset/repair,
  signing/notarization smoke, and future platform adapter closure.
- Completed `.4.1` by documenting the macOS VM asset layout, adding
  `native:vm:assets:prepare`, validating manifest/image/bootstrap/service fields in the Swift
  helper, and proving `prepare` succeeds while `status` remains unavailable until `.4.2` boots the
  VM.
- Opened PR #227 from `jwill9999/macos-production-sandbox-vm-lifecycle-exec` into recreated
  `staging`; closed older Docker-only PR #226.
- Addressed PR review comments by requiring the macOS VM health check to see an existing runtime
  directory before reporting `production_runner_ready`, mapping missing/non-executable helper
  process failures to distinct denied reasons, and streaming VM asset SHA-256 hashes instead of
  reading whole images into memory.
- Investigated PR #227 SonarCloud failure: quality gate failed on `3.8% Duplication on New Code`
  with the duplicated lines isolated to `MacosVmRunnerCore.swift`. Refactored repeated runtime and
  asset validation response blocks into shared helper functions so Sonar can recalculate below the
  threshold.
- Found that expected `CI` and `Promptfoo Code Scan` checks were not running on PR #227 because
  workflow branch filters only targeted `main`/`feature/**`. Updated workflow triggers to include
  `staging` so staging PRs run the full validation set.
- Started `.4.2` by adding a helper-owned daemon lifecycle: `start` launches a
  `macos-vm-runner daemon`, the daemon builds a `Virtualization.framework`
  `VZVirtualMachineConfiguration` with EFI bootloader, bounded CPU/memory, disk attachment,
  entropy, and memory balloon devices; `status` now requires a live daemon PID plus ready marker,
  and `stop` clears stale runtime state. Dummy-image smoke fails closed; `.4.2` remains open until a
  real bootable image starts and reports ready.
- Split remaining `.4.2` work into child tasks so `.4.3` is blocked until real boot proof exists:
  `.4.2.1` provisions a bootable arm64 Linux image, `.4.2.2` proves boot/ready status, and `.4.2.3`
  proves daemon lifecycle reliability.
- The helper still fails closed for `start` and `exec`; `.4` is not complete until a real
  Virtualization.framework-backed VM can start and execute commands inside `/workspace`.
- Focused checks passed:
  `pnpm --filter @agent-platform/desktop native:vm:build`,
  `pnpm --filter @agent-platform/desktop native:vm:test`, and
  `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts`.
- Full repository gate passed:
  `pnpm lint && pnpm typecheck && pnpm format:check && pnpm docs:lint && pnpm test && pnpm build && pnpm --filter @agent-platform/desktop native:vm:build && pnpm --filter @agent-platform/desktop native:vm:test && git diff --check`.

## Next

1. Start `.4.2.1`: obtain or generate a real bootable arm64 Linux image compatible with the `.4.1`
   asset contract.
2. Complete `.4.2.2` and `.4.2.3` before starting `.4.3`; `.4.3` is blocked until real boot and
   daemon lifecycle evidence exists.
3. Keep staging policy strict: packaged macOS command execution must prove `macos-vm` or remain
   explicitly disabled before anything merges to `main`.
