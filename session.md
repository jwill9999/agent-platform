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
- **Session:** Completed `.4.2.2` by fixing the macOS VM boot asset contract to use a raw ARM64 kernel.
- **Branch:** `jwill9999/macos-production-sandbox-vm-lifecycle-exec`
- **Latest commit:** `bf10216` — raw ARM64 VM kernel assets and boot diagnostics.

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
  - `agent-platform-macos-production-sandbox.4.2.1` is complete,
  - `agent-platform-macos-production-sandbox.4.2.2` is complete,
  - `agent-platform-macos-production-sandbox.4.2.3` is next,
  - `agent-platform-macos-production-sandbox.4.2` remains in progress until `.4.2.3` closes,
  - `agent-platform-macos-production-sandbox.4` remains in progress on
    `jwill9999/macos-production-sandbox-vm-lifecycle-exec`,
  - command runner defaults to `disabled`,
  - desktop managed backend defaults to `AGENT_PLATFORM_COMMAND_RUNNER=disabled`,
  - `host` and `docker-sandbox` are now explicit development modes only,
  - `macos-vm` is a recognized mode and the health contract reports it as production-ready only
    when a VM runner is configured.
- The previous `VZErrorDomain code 1` boot failure was caused by EFI-stub kernels being passed to
  `VZLinuxBootLoader`. The verified short-term contract is `VZLinuxBootLoader` plus a raw ARM64
  Linux `Image`; a future `VZEFIBootLoader` migration remains a separate design follow-up.

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
- Paused implementation and audited the current Beads/spec graph. Beads dependencies were correct,
  but the epic spec still omitted `.4.2.1` through `.4.2.3`; updated the epic dependency and child
  spec tables so the roadmap matches the tracker.
- Added explicit requirements traceability to the sandbox epic so unresolved production concerns map
  to owning tasks: bootable image source, Virtualization.framework boot contract, guest bootstrap,
  staging asset availability, production packaging boundary, and signing/notarization entitlements.
- Tightened `.4.2.1` so it must select EFI-vs-kernel/initrd boot contract, update the asset
  manifest/helper validation if needed, define the guest command service bootstrap path, and prove
  local/staging/release image acquisition before `.4.2.2` starts.
- Tightened `.5.1`, `.5.4`, and `.6.3` so packaging, staging, and release hardening cannot proceed
  with unpinned local assets or unproven macOS virtualization entitlements.
- Completed a second task-spec audit against the rule that every task must be independently
  achievable and testable before sign-off. Added epic-level sign-off rules and tightened `.4.2.2`,
  `.4.2.3`, `.4.3`, `.4.4`, `.5.2`, `.5.3`, `.6.1`, `.6.2`, and `.6.4` with explicit negative
  tests, user-visible/E2E evidence, runtime cleanup, command-contract behavior, resource/network
  policy, reset/repair safety, and final traceability audit requirements.
- Completed a third audit pass from the foundation tasks upward. Expanded the epic traceability
  table to cover `.1` fail-closed defaults, `.2` health/status contract, `.3` ADR/helper skeleton,
  `.4` lifecycle/execution, `.5` packaging/E2E/staging, and `.6` hardening/release closure.
- Tightened `.1`, `.2`, and `.3` specs and Beads acceptance so the already-closed foundation tasks
  remain independently testable and cannot be misread as claiming real VM boot, packaged execution,
  or release readiness.
- Added an epic-level task sign-off matrix that lists each task's independent closure claim,
  required evidence, and what it explicitly does not claim. This is the audit checklist to use
  before closing any remaining sandbox task.
- Completed `.4.2.1`: selected the Apple `VZLinuxBootLoader` contract instead of EFI
  auto-discovery, added `native:vm:assets:build-linux`, built a real Alpine arm64 Linux asset source
  set locally with Docker, staged it through `native:vm:assets:prepare`, and verified helper
  `prepare` accepts the generated schema v2 manifest. Manifest evidence from local staging:
  `imageSha256=07064e5e9ff695901866b868678ee56a04c97a7fd2f4e9177f930b616719ff40`,
  `kernelSha256=bd4070ac0545ef395ae263b2260c917a837bc09927f82b06e3329e569e640ea2`,
  `initrdSha256=1dbe788c46b3dd4f4f2ab3bd7971c301f978e9750c0855728a56374f2e2b6312`,
  `bootstrapSha256=6d402c59ce305df0d2f89e80f28634d16412a1edb9fe64a45d2e360a16c8660a`.
- Completed `.4.2.2`: reproduced Apple sample failure with Fedora/Alpine EFI-stub kernels, then
  proved Apple’s sample boots with Ubuntu’s decompressed raw ARM64 `Image`.
- Updated the VM asset pipeline so `native:vm:assets:build-linux` downloads Ubuntu cloud-image
  kernel/initrd assets, decompresses the kernel to a raw ARM64 `Image`, and rejects non-raw
  kernels. `native:vm:assets:prepare` now also rejects EFI-stub `PE32+` kernels before boot.
- Improved `macos-vm-runner` lifecycle diagnostics: valid `VZGenericMachineIdentifier`, run-loop
  startup wait instead of a blocking semaphore, full `NSError` details, `vm-config.json`, and guest
  console capture.
- Real boot proof passed locally on macOS 26.5/Xcode 26.3:
  `start` returned ready, `status` returned ready, guest console showed Linux mounting `/dev/vda`,
  OpenRC starting, and `agent-platform-guest-service` starting. `stop` returned disabled and
  subsequent `status` returned unavailable.
- Negative asset proof passed: preparing a Fedora `PE32+ executable` kernel now fails fast with an
  explicit `VZLinuxBootLoader` raw ARM64 `Image` requirement.
- Focused checks passed: `node --check` for build/prepare scripts,
  `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts`,
  `pnpm --filter @agent-platform/desktop native:vm:build`,
  `pnpm --filter @agent-platform/desktop native:vm:test`,
  `pnpm --filter @agent-platform/desktop native:vm:sign-dev`,
  `pnpm docs:lint`, and `git diff --check`.

## Next

1. Complete `.4.2.3` with stale-state, repeated start/stop, daemon survival, and lifecycle
   reliability evidence using the raw ARM64 kernel runtime.
2. Start `.4.3` only after `.4.2.3` is closed; `.4.3` owns real guest command execution inside the
   VM, not just host-side boot readiness.
3. Keep staging policy strict: packaged macOS command execution must prove `macos-vm` or remain
   explicitly disabled before anything merges to `main`.
