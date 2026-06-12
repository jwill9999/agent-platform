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
- **Session:** Fixed Personal Chat workspace state leak after recent desktop UI polish.
- **Branch:** `jwill9999/electron-stabilisation-e2e-backfill`
- **Latest commit:** pending; previous `c023aaa` polishes desktop preview, Git, external IDE,
  status, Push, and recent-project refresh UX.

## Current State

- Electron stabilisation remains gated by `.12`, which is blocked on owner manual sign-off `.18`.
- `.17` is closed: deterministic `.12` gaps now have Electron Playwright coverage.
- `.19` is closed: first-loaded Workspaces layout is covered at compact and expanded Electron window
  sizes.
- `.20` is open as a non-blocking follow-up to define the broader E2E expectation matrix across
  Workspaces, Project Chat/Coding, Personal Chat, secondary file view, and future specialized
  workflows.
- `.18` is open for owner manual QA sign-off. It should use
  `docs/qa/electron-stabilisation-automation-matrix.md` to reduce manual scope to native/subjective
  checks and any automation ambiguity.
- `.12` should remain blocked until `.18` records owner sign-off and any findings are classified.
- Terminal dock now defaults to `MesloLGS NF`; users can still choose the other terminal fonts from
  the toolbar.
- `.21` is closed: the Workspace Preview native WebView bounds regression shown when the Git/GitHub
  rail collapses is fixed and covered by targeted Electron E2E.
- `.22` is closed: the Git & GitHub Changes tab now renders structured, readable unified diffs in
  the desktop side panel and is covered by targeted Electron E2E.
- `.23` is closed: Workspace Preview sizing/controls are clearer, Open in IDE uses the desktop
  external launcher instead of `/ide`, the command-runner badge says `Agent commands off`, and the
  Push tab/action no longer shows an inline ahead-count badge.
- `.24` is closed: Personal Chat entered from Workspaces now marks the Chat nav item active and
  resets stale system-selected Coding agent state back to Personal assistant before creating the
  personal chat session.

## Recent Work

- Added `workspaceNavigationChangedEvent` so programmatic `history.pushState` navigation updates
  the left sidebar active state.
- Added `aria-current` to workspace sidebar links and covered the Chat active state in Electron
  E2E.
- Guarded Chat agent selection with system/user ownership so Personal Chat defaults to Personal
  assistant without overriding a deliberate manual selector choice.
- Added Beads task/spec `agent-platform-electron-stabilisation.24` for the Personal Chat regression.
- Updated `apps/web/components/project/project-webview-panel.tsx` so native WebView bounds are
  deduped by rounded viewport rectangle and resynced via `ResizeObserver`, window resize, and an
  animation-frame layout check while a WebView is active.
- Added optional `bounds` to `DesktopWorkspaceWebViewState` and recorded the last applied bounds in
  `apps/desktop/src/main/webviewService.ts` for diagnostics/E2E verification.
- Extended `apps/desktop/e2e/webview-runtime.e2e.ts` to collapse the Git/GitHub panel and assert the
  recorded native bounds still match the visible preview viewport.
- Added Beads task/spec `agent-platform-electron-stabilisation.21` for this regression.
- Updated `apps/web/components/project/project-git-github-panel.tsx` so the diff preview renders
  file headers, hunks, additions, deletions, and context lines with readable row styling, line
  numbers, stable scroll, and compact selected-file metadata.
- Extended `apps/desktop/e2e/project-git-workflow.e2e.ts` to select a modified README diff and
  assert hunk/addition rows render in the improved preview.
- Added Beads task/spec `agent-platform-electron-stabilisation.22` for the Git diff rendering
  improvement.
- Updated Workspace Preview controls to labeled `Wide` and `Focus` actions and responsive panel
  widths.
- Added desktop `projects.openInIde` bridge plus a system IDE/folder launcher with
  `AGENT_PLATFORM_DESKTOP_IDE_COMMAND` override and common IDE fallbacks.
- Updated Project Chat and Git conflict resolver Open in IDE actions to use the desktop launcher
  instead of the internal `/ide` route.
- Changed the command-runner badge from duplicate `disabled disabled` to `Agent commands off` and
  kept the Push tab/action label to `Push` without an inline count badge.
- Added explicit short-lived `Refreshing` feedback to the left-sidebar Recent Projects refresh
  control so fast reloads no longer feel inert.
- Added Beads task/spec `agent-platform-electron-stabilisation.23` for the preview/IDE/status UI
  refinement.
- Added `apps/desktop/e2e/stabilisation-backfill.e2e.ts`.
- Covered settings/model/API key persistence, restart persistence, Project-scoped versus Personal
  Chat sessions, missing/unavailable Projects, and UI leakage/layout smoke.
- Updated `apps/desktop/e2e/project-access.e2e.ts` to remove stale/flaky assumptions uncovered by
  full-suite ordering.
- Added `docs/qa/electron-stabilisation-automation-matrix.md`.
- Added Beads task `agent-platform-electron-stabilisation.18` for owner manual QA sign-off and made
  `.12` depend on `.17` and `.18`.
- Added Beads task `agent-platform-electron-stabilisation.19` for first-load responsive layout E2E
  coverage.
- Added Beads task `agent-platform-electron-stabilisation.20` as a non-blocking follow-up for the
  workflow expectation matrix.
- Changed `apps/web/components/project/project-terminal-dock.tsx` so new terminal sessions default
  to `MesloLGS NF`.

## Checks Run

- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/stabilisation-backfill.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/webview-runtime.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-git-workflow.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-access.e2e.ts`
- `pnpm --filter @agent-platform/contracts typecheck`
- `pnpm --filter @agent-platform/desktop test:e2e` (`8 passed`)
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/web typecheck`
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`

SonarQube MCP/tools were not exposed by tool discovery in this session, so the completion gate used
the documented fallback checks above.

## Next

1. Owner runs/signs off `agent-platform-electron-stabilisation.18`.
2. Close `.12` only after `.18` sign-off and finding classification.
