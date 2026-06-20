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
- **Session:** Implemented the first Project Experience `.4` pass for local IDE handoff copy,
  fallback behavior, bridge detection, documentation, and regression coverage.
- **Branch:** `jwill9999/project-experience-ide-handoff`
- **Base:** branched from `jwill9999/project-experience-capability-metadata`, which contains
  completed Project Experience `.1` and `.2` work.

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

**Project Experience Task 4:**

- Beads issue `agent-platform-project-experience.4` is claimed/in progress.
- Implemented `Open local IDE` copy in Project Chat and the Git conflict resolver so the handoff is
  clearly a local editor/folder handoff, not the internal `/ide` workbench.
- Split desktop Project folder bridge detection from IDE handoff bridge detection, so stale or
  partial preload bridges show the right unavailable state.
- Added launcher unit coverage for unavailable Project folders, E2E test override, configured IDE
  command precedence, system folder fallback, and no-opener fallback copy.
- Added web unit coverage proving folder selection and local IDE handoff are detected separately.
- Documented `AGENT_PLATFORM_DESKTOP_IDE_COMMAND` and
  `AGENT_PLATFORM_DESKTOP_TEST_OPEN_IDE` in `docs/configuration.md`.

**Project Experience Task 4 Verification:**

- Passed: `pnpm --filter @agent-platform/desktop run test -- test/ideLauncher.test.ts`.
- Passed: `pnpm --filter @agent-platform/web run test -- test/desktop-projects.test.ts`.
- Passed: `pnpm --filter @agent-platform/desktop run typecheck`.
- Passed: `pnpm --filter @agent-platform/web run typecheck`.
- Passed: `pnpm --filter @agent-platform/desktop run lint`.
- Passed: `pnpm --filter @agent-platform/web run lint`.
- Passed: `pnpm format:check`.
- Passed: `pnpm docs:lint:md`.
- Passed: `git diff --check`.
- Passed: `pnpm --filter @agent-platform/desktop run test:e2e -- project-access.e2e.ts project-git-workflow.e2e.ts`
  (4/4 Electron tests).

**Context Optimisation:**

- Beads issue `agent-platform-context-optimisation` is now P1.
- Evidence added: a simple Beads question reused stale Coding session
  `bad6e0a5-d8e0-4eee-b94d-a2dc4c8f65da` with 87 messages and about 526k stored characters,
  including multiple very large tool outputs, causing OpenAI API TPM pressure.
- Current implementation has an 8k approximate context window, but still needs durable compaction,
  bounded tool-output replay, stale-session handling, explicit output-token caps, and clearer
  rate-limit/context diagnostics.
- Parked for now because self-hosted runner validation is unavailable; keep it as a P1 follow-up.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- `.2` depends on `.1` and will simplify Workspaces/sidebar UI after capability metadata exists.

## Next

1. Manual test `.4`: open an existing Coding Project, click `Open local IDE`, confirm the local IDE
   or system folder opener launches, then return to Agent Platform and confirm Project Chat/session
   context remains intact.
2. Review whether `.4` needs a future preferred-IDE settings picker task; current implementation
   uses configured command, detected common IDEs, then system folder fallback.
3. Keep `agent-platform-context-optimisation` queued as P1 once runner validation is available or
   the issue starts blocking Project Chat again.
