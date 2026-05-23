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
- **Session:** Added initial Docker sandbox command runner for `sys_bash`.
- **Branch:** `main`
- **Latest commit before this change:** `0ded8a7` (`Merge pull request #224 from jwill9999/staging`).

## Current State

- User wants shell commands to run in a safer environment that is less close to the host system.
- The implementation is local and verified so far; commit and push are next.
- The approach keeps policy separate from execution by adding a Docker-backed `CommandRunner`
  delegate instead of moving security decisions into the model or shell prompt.

## Recent Work

- Added `createDockerSandboxCommandRunner` behind the existing harness `CommandRunner` interface.
- Added `createConfiguredCommandRunner` with modes:
  - `AGENT_PLATFORM_COMMAND_RUNNER=auto`
  - `AGENT_PLATFORM_COMMAND_RUNNER=docker-sandbox`
  - `AGENT_PLATFORM_COMMAND_RUNNER=host`
- Wired `createSystemToolExecutor` to use the configured runner by default while preserving injected test runners.
- Managed desktop backends default `AGENT_PLATFORM_COMMAND_RUNNER=auto`; non-desktop harness usage
  stays on host mode unless explicitly configured.
- Docker sandbox behavior:
  - mounts only the selected Project as `/workspace`,
  - uses `--network none`,
  - applies memory, CPU, PID, timeout, and output bounds,
  - runs as non-root `1000:1000`,
  - does not inherit host environment variables.
- Verified locally so far:
  - `pnpm --filter @agent-platform/harness test -- test/commandRunner.test.ts`
  - `pnpm --filter @agent-platform/harness typecheck`
  - `pnpm --filter @agent-platform/harness lint`

## Next

1. Run full quality gate for the sandbox runner change.
2. Commit and push to `origin/main`.
3. Follow up later with runner capability metadata and VM/remote adapters if Docker proves too
   heavy for public desktop default.
