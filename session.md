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
- **Session:** Implemented `agent-platform-project-experience.2` Workspaces/sidebar simplification and
  prepared it for manual UX review.
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

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. Commit and push task 2 changes if not already done in this session.
2. Ask the user to manually test Workspaces, Chat, Coding Project creation/opening, recent Projects,
   and refresh feedback.
3. Close `agent-platform-project-experience.2` only after manual UX feedback is accepted or filed as
   follow-up Beads work.
