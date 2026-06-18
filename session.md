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
- **Session:** Fixed SonarQube warnings across API, desktop, harness, workflow, web files, and CI dependency install steps.
- **Branch:** `jwill9999/project-experience-capability-metadata`
- **Base:** current branch tracks `origin/jwill9999/project-experience-capability-metadata`; latest pushed commit `8db558e`.

## Current State

**SonarQube Cleanup:**

- Fixed requested SonarQube warnings in API/router tests, desktop E2E/runtime code, web chat/webview/Git panels, workflow CI, harness browser tools, and macOS VM asset script.
- Fixed `.github/workflows/check-cycles.yml` Sonar rule `githubactions:S6505` by adding `--ignore-scripts` to `pnpm install --frozen-lockfile`.
- Fixed `.github/workflows/ci.yml` Sonar rule `githubactions:S6505` by adding `--ignore-scripts` to all four `pnpm install --frozen-lockfile` steps.
- Used subagents for the requested file groups; `apps/api/test/readinessCheck.test.ts` had no open Sonar issues and was left unchanged.
- Local completion gate passed: Prettier check, `pnpm lint`, `pnpm typecheck`, focused API tests (`projectsRouter`, `readinessCheck`), and focused web Vitest run.
- Sonar Agentic Analysis is unavailable for this org: `403 Forbidden - Agentic Analysis is not activated`; remote issue list remains stale until the next Sonar project analysis.

**Changes Committed & Pushed:**

- Commit `5eeb001` (`fix sonarqube warnings`) contains the scoped Sonar fixes and validation-hook formatting.
- Commit `bd8953e` (`fix check cycles workflow install warning`) contains the workflow install-script hardening.
- Commit `8db558e` (`harden ci dependency installs`) contains the CI install-script hardening.
- Unrelated local changes intentionally left untouched: `apps/web/components/project/project-terminal-dock.tsx` and untracked `deps-graph.svg`.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. After CI/Sonar reruns, confirm the stale remote Sonar issues are closed or only unrelated files remain.
2. Decide separately whether to keep, commit, or discard the unrelated `project-terminal-dock.tsx` and `deps-graph.svg` local changes.
