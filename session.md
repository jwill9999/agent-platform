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

- **Date:** 2026-06-17
- **Session:** Implemented and verified Project Experience `.1`.
- **Branch:** `jwill9999/project-experience-capability-metadata`
- **Base:** current branch tracks `origin/jwill9999/project-experience-capability-metadata`

## Current State

- `agent-platform-project-experience.1` now defines shared workspace profile/capability metadata
  for the current product surfaces:
  - `general_chat`: chat + general tooling/app context.
  - `coding_project`: chat, project files, coding tools, terminal, Git/GitHub, branch selection,
    tests/checks, generated previews, activity evidence, and IDE handoff.
- Deferred workspace profiles exist only as extension points for later epics and are not exposed as
  current Workspaces UI options.
- API project open/desktop registration responses now derive/persist Coding Project workspace
  metadata for legacy and new Project records.
- The `.1` task spec dependency table was corrected so `.1` feeds `.2`, and its DoD checklist is
  complete.
- Local verification passed:
  - `pnpm --filter @agent-platform/contracts typecheck`
  - `pnpm --filter @agent-platform/api typecheck`
  - `pnpm --filter @agent-platform/web typecheck`
  - `pnpm --filter @agent-platform/contracts test -- test/project.test.ts`
  - `pnpm --filter @agent-platform/api test -- test/projectsRouter.test.ts`
  - `pnpm --filter @agent-platform/web test -- test/project-navigation.test.ts test/project-onboarding-assessment-panel.test.ts`
  - `pnpm build`
  - `pnpm docs:lint`
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm test`
  - `git diff --check`
- SonarQube MCP was attempted for touched-file issue discovery, but the server returned
  `Not authorized`; the repo fallback gate passed.
- Unrelated local change present and intentionally left untouched:
  `.github/agents/api-review-specialist.agent.md`.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. Close `agent-platform-project-experience.1` in Beads, commit, push, and open the PR to staging.
2. After CI/review passes and the PR merges, start `agent-platform-project-experience.2`: simplify
   the Workspaces/sidebar UI using the new capability metadata.
