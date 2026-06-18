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
  then repaired failing GitHub Actions setup for Node/native dependency handling.
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
- Added explicit `pnpm --filter @agent-platform/desktop exec install-electron` steps for Electron
  E2E jobs, because hardened installs also skip Electron's binary download/path setup.
- Escaped the `deps:check-cycles` Makefile target so GNU make no longer fails with
  `multiple target patterns`.
- Verified locally: `pnpm run rebuild:native`, `make workspace-init`, `make deps:check-cycles`,
  `pnpm --filter @agent-platform/api test -- test/settingsRouter.test.ts test/projectsRouter.test.ts`,
  full `pnpm build`, full `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and
  `git diff --check`.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. Push the task 2 and CI repair commits if not already done in this session.
2. Monitor GitHub Actions for the branch/PR and confirm CI, E2E, desktop E2E, VM E2E, and circular
   dependency checks are green.
3. Ask the user to manually test Workspaces, Chat, Coding Project creation/opening, recent Projects,
   and refresh feedback.
4. Close `agent-platform-project-experience.2` only after manual UX feedback is accepted or filed as
   follow-up Beads work.
