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

- **Date:** 2026-06-16
- **Session:** Paused after starting Project Experience `.1`.
- **Branch:** `jwill9999/project-experience-capability-metadata`
- **Base:** `staging` at `531ec2b` (`docs: move workflow matrix to pre-production gate (#235)`)

## Current State

- PR #235 has merged to `staging`; local `staging` is clean and aligned with `origin/staging`.
- Post-merge verification passed locally:
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `git diff --check`
- `agent-platform-project-experience.1` is claimed and `in_progress`.
- No implementation files have been edited for `.1` yet.
- Current investigation started by reading:
  - [docs/tasks/agent-platform-project-experience.1.md](docs/tasks/agent-platform-project-experience.1.md)
  - [packages/contracts/src/project.ts](packages/contracts/src/project.ts)
  - [packages/db/src/repositories/projects.ts](packages/db/src/repositories/projects.ts)
  - [apps/api/src/infrastructure/http/v1/projectsRouter.ts](apps/api/src/infrastructure/http/v1/projectsRouter.ts)
  - [packages/contracts/test/project.test.ts](packages/contracts/test/project.test.ts)
- The `.1` spec has a stale dependency-table row: it should show `.1` as upstream of `.2`, matching
  Beads. Fix this during the `.1` implementation/docs update.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. Continue `agent-platform-project-experience.1` on
   `jwill9999/project-experience-capability-metadata`.
2. Add shared Chat/Coding Project workspace/profile/capability contracts and compatibility helpers.
3. Update API/project mapping so existing coding Projects derive sensible default capabilities.
4. Add focused contracts/API tests for defaults, deferred profile fallbacks, and backwards
   compatibility.
5. Run focused gates first, then broader required gates before closing `.1`.
