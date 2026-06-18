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

- **Date:** 2026-06-18
- **Session:** Implemented `agent-platform-project-experience.2` Workspaces/sidebar simplification,
  then repaired failing GitHub Actions setup for Node/native dependency handling and aligned E2E
  expectations with the new Workspaces copy.
- **Branch:** `jwill9999/project-experience-workspace-navigation`
- **Base:** branched from `jwill9999/project-experience-capability-metadata`; task 2 is not closed
  until manual testing is reviewed.

## Current State

**Project Experience Task 2:**

- Beads issue `agent-platform-project-experience.2` is claimed/in progress.
- Workspaces now presents two main choices: `Chat` and `Coding Project`.
- The previous separate `New Project` and `Open Project` cards are collapsed into the single
  `Coding Project` entry with `New project` and `Open folder` actions.
- Sidebar Recent Projects remain available on the Workspaces surface and now show loading, empty,
  and refresh-error states.
- User-facing copy avoids `/workspace` or backend terminology and keeps deferred surfaces out of the
  current navigation.
- Manual testing is still pending; do not close the Beads task until feedback is reviewed.

**Verification:**

- Passed: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, and
  `git diff --check`.
- Passed before the final docs update: focused Playwright `e2e/mvp-e2e.spec.ts` against local API/web.
- Docker rebuild for a later Playwright rerun hit local disk pressure (`ENOSPC`) while writing the
  Next.js build cache; no source failure was identified.

**CI Pipeline Repair:**

- Moved the repo baseline to Node 24 in `.nvmrc`, package engines, GitHub Actions, Dockerfiles, and
  user/developer docs.
- Added `pnpm/action-setup` before setup-node pnpm caching in `check-cycles.yml`.
- Kept hardened `pnpm install --frozen-lockfile --ignore-scripts` in CI and added explicit
  `pnpm run rebuild:native` steps before DB-backed tests and Electron/VM E2E jobs.
- Extended `pnpm run rebuild:native` to force-run `node-pty`'s native install build as well as
  `better-sqlite3`; desktop Electron imports `node-pty` in the main process, so Linux desktop E2E
  needs this after install scripts are skipped.
- Added explicit Electron binary setup for Electron E2E jobs, because hardened installs also skip
  Electron's binary download/path setup. The setup now uses `scripts/install-electron-binary.mjs`
  and fails early if `path.txt` or the executable is still missing.
- Excluded CI-only native setup helpers from Sonar application analysis after SonarCloud flagged
  helper implementation details that are not product runtime code.
- Updated desktop/VM E2E project-opening helpers to use the new `Open folder` Workspaces action
  instead of the removed `Open Project` button label.
- Updated desktop E2E to use the visible `Attach files` file chooser path and the current `Chat`
  workspace label, matching the simplified Workspaces UX.
- Kept browser E2E selectors aligned with surface-specific labels: Workspaces uses `Chat` /
  `Open folder`, while the legacy `/ide` Project binding panel still uses `Open Project`.
- Increased `verify`, browser `e2e`, and `desktop-e2e` CI timeouts because Playwright Chromium
  install can exceed the old 15-minute verify cap after the Node/Playwright baseline update.
- Removed standalone Chromium installation from `verify` and `desktop-e2e`; browser E2E now installs
  only Playwright browser OS dependencies and uses the GitHub runner's system Chrome channel instead
  of downloading a standalone Chromium archive.
- Disabled browser E2E video capture in CI because system Chrome runs do not install Playwright's
  bundled `ffmpeg`; traces, screenshots, HTML reports, and Docker logs remain available on failure.
- Escaped the `deps:check-cycles` Makefile target so GNU make no longer fails with
  `multiple target patterns`.
- Verified locally: `pnpm run rebuild:native`, `make workspace-init`, `make deps:check-cycles`,
  `pnpm --filter @agent-platform/api test -- test/settingsRouter.test.ts test/projectsRouter.test.ts`,
  full `pnpm build`, full `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and
  `git diff --check`.
- Verified locally after the latest desktop E2E alignment:
  `SECRETS_MASTER_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= pnpm --filter @agent-platform/desktop run test:e2e -- e2e/project-access.e2e.ts`.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. Monitor GitHub Actions for the branch/PR and confirm CI, E2E, desktop E2E, VM E2E, and circular
   dependency checks are green.
2. Ask the user to manually test Workspaces, Chat, Coding Project creation/opening, recent Projects,
   and refresh feedback.
3. Close `agent-platform-project-experience.2` only after manual UX feedback is accepted or filed as
   follow-up Beads work.
