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
- **Session:** Implemented Project Experience `.16` multi-tab Project resource previews.
- **Branch:** `task/project-experience-16-multi-tab-previews`
- **Base:** `fd1aab1` (Project Experience `.15`, merged through PR #245)
- **Head:** `eb788d1` (`feat add scoped multi-tab resource previews`)
- **Pull request:** [#246](https://github.com/jwill9999/agent-platform/pull/246) into `staging`

## What Happened

- PR #245 merged Project Experience `.15` into `staging` at `fd1aab1`; its Beads task is closed.
- Added a normalized tab-state model with deterministic de-duplication, activation, adjacent
  selection on close, close-last behavior, minimize, and restore.
- Added one reusable Project/session-scoped preview provider for standard Chat and IDE Chat. State is
  safely restored from session storage, filtered by Project, and isolated by Project/session scope.
- Added accessible tablist/tab/tabpanel relationships, arrow/Home/End navigation, Delete and
  Command/Ctrl+W close shortcuts, explicit per-tab close controls, and safe focus restoration.
- Added an accessible minimized right-side dock, horizontal tab overflow, and a full-width narrow
  viewport fallback that does not obscure desktop-width Project Chat controls.
- Missing resources remain closeable error previews without disrupting other tabs. Existing
  Markdown, HTML, image, PDF, source, diff, Download, and Electron Save As behavior is preserved.
- Added a Gherkin E2E strategy plus browser and production-built Electron coverage for multi-tab
  navigation, de-duplication, focus, minimize/restore, persistence, isolation, and unavailable files.

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

- Beads task `agent-platform-project-experience.16` is `in_progress` until its PR passes hosted
  CI/Sonar/review and merges into `staging`.
- Local implementation and all planned local verification are complete.
- Project Experience `.1` through `.5`, `.7`, and `.15` are closed. The remaining sequence is `.8`
  activity/evidence, then `.6` staged E2E closure.
- macOS production task `.6.3` remains externally blocked on a Developer ID identity, notarization
  credentials, and a VM-capable Apple Silicon runner; `.6.4` waits on that evidence.

## Next

1. Monitor PR #246 hosted CI, SonarCloud, security scans, artifacts, and review comments; fix findings until
   all required checks are green.
2. Merge the green PR, close/sync Beads `.16`, then start `.8` from the cumulative `staging` state.
