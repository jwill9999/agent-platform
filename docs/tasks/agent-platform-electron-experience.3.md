# Task: Project Chat As Default Entry

**Beads issue:** `agent-platform-electron-experience.3`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.3.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.3.md`

## Summary

Make Project chat the default surface after opening or reopening a Project, with the IDE available as
an optional deeper workspace.

## Requirements

- Opening a Project lands in Project chat by default.
- Project chat uses the active Project/session context immediately.
- Chat copy should invite a task, not instruct users to manage paths.
- Existing IDE can still be opened from the Project context.
- Normal chat remains available for non-Project conversations.

## Implementation Plan

1. Identify current post-open routing from Project open/reopen.
2. Route successful Project open to Project chat instead of the IDE workspace.
3. Ensure active Project session binding is created before the first Project chat message.
4. Update empty states and composer placeholders for Project chat.
5. Add tests for first message context and chat-first landing.

## Tests And Verification

- Renderer tests for post-open surface selection.
- API/session tests for Project-bound first chat message.
- Electron E2E for Project open landing in chat.
- Regression checks that IDE still opens with the same Project context.

## Definition Of Done

- [x] Opening or reopening a Project lands in Project chat by default.
- [x] First Project chat message has active Project context.
- [x] Normal chat remains separate from Project chat.
- [x] IDE can still be opened from the active Project.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation Notes

- Desktop Project selection now registers the folder and opens a Project-bound chat session on the
  home surface instead of routing directly to the IDE.
- Recent Projects in the left navigation reopen into Project chat; the Project chat header exposes
  the optional `Open IDE` action for deeper file work.
- Shared desktop Project helpers centralize folder selection, registration, recent Project loading,
  and Project session binding.
- Project chat has Project-specific empty state and composer copy so users are invited to describe a
  task rather than manage paths.

## Local Verification

- `pnpm --filter @agent-platform/web exec vitest run test/project-navigation.test.ts test/project-onboarding-assessment-panel.test.ts`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run test`
- `pnpm exec playwright test -c e2e/playwright.config.ts e2e/ide-project-opening-parked.spec.ts`
- `pnpm --filter @agent-platform/desktop run test:e2e`
- `pnpm docs:lint`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm format:check`
- `pnpm run test:e2e`
- `git diff --check`
- `sh .husky/pre-push`

## PR Verification

- PR #199 targets `feature/agent-platform-project-onboarding`.
- GitHub checks passed: `verify`, `docker`, `e2e`, `desktop-e2e`, docs `markdownlint` and
  `lychee`, GitGuardian, and SonarCloud.
- SonarCloud reports 0 open PR issues and 0 security hotspots after the page-complexity cleanup.
- No inline review comments are present; Sourcery skipped because the cumulative PR diff is above
  its review limit.
