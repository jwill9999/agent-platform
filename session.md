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
- **Session:** Added command runner health/status contract.
- **Branch:** `jwill9999/macos-production-sandbox-health-contract`
- **Latest commit:** pending commit for `agent-platform-macos-production-sandbox.2`.

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
  - `agent-platform-macos-production-sandbox.2` is implemented locally on
    `jwill9999/macos-production-sandbox-health-contract`,
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
- Focused checks passed:
  `pnpm --filter @agent-platform/harness test -- test/commandRunnerHealth.test.ts`,
  `pnpm --filter @agent-platform/harness test -- test/commandRunner.test.ts test/commandRunnerHealth.test.ts`,
  `pnpm --filter @agent-platform/harness typecheck`, and
  `pnpm --filter @agent-platform/harness lint`.
- Full repository gate passed:
  `pnpm lint && pnpm typecheck && pnpm format:check && pnpm docs:lint && pnpm test && pnpm build && git diff --check`.

## Next

1. Commit and push `jwill9999/macos-production-sandbox-health-contract`.
2. After this branch/pipelines pass, branch from it for `agent-platform-macos-production-sandbox.3`
   to add the ADR and native VM helper skeleton.
3. Keep staging policy strict: packaged macOS command execution must prove `macos-vm` or remain
   explicitly disabled before anything merges to `main`.
