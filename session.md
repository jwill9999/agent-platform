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

- **Date:** 2026-06-20
- **Session:** Closed `agent-platform-project-experience.2` after manual testing and kept the
  long-session LLM failure tracked separately as P1 context optimisation.
- **Branch:** `jwill9999/project-experience-capability-metadata`
- **Base:** current branch contains completed Project Experience `.1` and `.2` work. Next
  implementation should branch from here for context optimisation before `.4`.

## Current State

**Project Experience Task 2:**

- Beads issue `agent-platform-project-experience.2` is closed.
- Workspaces now presents two main choices: `Chat` and `Coding Project`.
- The previous separate `New Project` and `Open Project` cards are collapsed into the single
  `Coding Project` entry with `New project` and `Open folder` actions.
- Sidebar Recent Projects remain available on the Workspaces surface and now show loading, empty,
  and refresh-error states.
- User-facing copy avoids `/workspace` or backend terminology and keeps deferred surfaces out of the
  current navigation.
- User manual testing is broadly positive. The remaining LLM failure appears to be session context
  replay/token pressure, not the Workspaces navigation UI.

**Verification:**

- Added `apps/desktop/e2e/project-access.e2e.ts` assertions for the simplified Workspaces landing
  screen: Chat, Coding Project, New project, Open folder, and no deferred workspace cards.
- Passed: `pnpm --filter @agent-platform/web run test -- project-navigation.test.ts` (Vitest runs
  the web test suite; 30 files / 158 tests passed).
- Passed: `pnpm exec prettier --check apps/desktop/e2e/project-access.e2e.ts`.
- Passed: `pnpm --filter @agent-platform/desktop run lint -- e2e/project-access.e2e.ts`.
- Passed under Node 24:
  `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" pnpm --filter @agent-platform/desktop run test:e2e -- project-access.e2e.ts`.
- Note: running the Electron E2E under Node 25 fails before UI launch because native
  `better-sqlite3` bindings are built for Node 24. Use the repo Node 24 baseline.

**Context Optimisation:**

- Beads issue `agent-platform-context-optimisation` is now P1.
- Evidence added: a simple Beads question reused stale Coding session
  `bad6e0a5-d8e0-4eee-b94d-a2dc4c8f65da` with 87 messages and about 526k stored characters,
  including multiple very large tool outputs, causing OpenAI API TPM pressure.
- Current implementation has an 8k approximate context window, but still needs durable compaction,
  bounded tool-output replay, stale-session handling, explicit output-token caps, and clearer
  rate-limit/context diagnostics.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. Branch from `jwill9999/project-experience-capability-metadata` for
   `agent-platform-context-optimisation`.
2. Claim and implement `agent-platform-context-optimisation` before expanding deeper Project Chat
   surfaces.
3. Continue Project Experience with `.4` only after the context failure mode is handled or explicitly
   deferred again.
