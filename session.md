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

- **Date:** 2026-08-29
- **Session:** Implemented Project Experience `.8` Project activity/evidence panel.
- **Branch:** `task/project-experience-8-activity-panel`
- **Base:** `2facadb` (Project Experience `.16`, merged through PR #246)
- **Head:** `b74e4fc` (`feat add project activity evidence rail`)
- **Pull request:** [#247](https://github.com/jwill9999/agent-platform/pull/247) into `staging`

## What Happened

- PR #246 merged Project Experience `.16` into `staging` at `2facadb`; Beads `.16` is closed.
- Added a pure normalized Project activity boundary for changed/generated files, previews, local
  checks, CI, review state, findings, approvals, and derived next actions.
- Added a compact Project/session-aware Activity panel with explicit loading, empty, unavailable,
  disconnected, and non-coding profile fallbacks. User copy strips workspace roots, host paths,
  commit hashes, provider diagnostics, and internal enum formatting.
- Changed/generated resources and diffs open through the shared `.16` multi-tab preview provider;
  stale provider responses cannot overwrite a newly selected Project/session.
- Activity and the existing Git/GitHub workflow share the established 360px evidence rail through
  accessible tabs, preserving the terminal and chat layout.
- Expanded browser and production-rendered Electron coverage for activity grouping, preview opening,
  context preservation, provider fallback, Project/session isolation, and Git-rail navigation.

## Verification

- Passed: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm docs:lint`, and
  `pnpm deps:check-cycles` across the repository.
- Passed: production Docker API/web rebuild and health checks.
- Passed: all 22 browser Playwright scenarios, including the expanded Project resource scenario.
- Passed: all 10 Electron Playwright scenarios using the production-built renderer and managed API.
- SonarQube Agentic Analysis was attempted through the supported CLI fallback but SonarQube Cloud
  returned the known explicit 403 authorization denial. The required typecheck/lint/test fallback
  gate has no errors; hosted SonarCloud remains required on the PR.

## Current State

- Beads task `agent-platform-project-experience.8` is claimed and `in_progress`.
- Local implementation and planned local gates are complete, including the final production Docker
  build, 22-test browser suite, and 10-test Electron suite after the shared-rail layout change.
- Project Experience `.1` through `.5`, `.7`, `.15`, and `.16` are closed. After `.8`, `.6` is the
  staged Project Experience E2E closure task.
- macOS production task `.6.3` remains externally blocked on a Developer ID identity, notarization
  credentials, and a VM-capable Apple Silicon runner; `.6.4` waits on that evidence.

## Next

1. Monitor PR #247 hosted CI, SonarCloud, security, and review feedback to green.
2. Merge the PR, close/sync Beads `.8`, then continue with `.6` staged E2E closure.
