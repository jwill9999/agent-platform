# Task: Open IDE From Project Chat

**Beads issue:** `agent-platform-electron-experience.4`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.4.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.4.md`

## Summary

Add a clear Project chat affordance to open the IDE while preserving the selected Project and current
conversation context.

## Requirements

- Provide one clear IDE handoff action from Project chat.
- Preserve active Project metadata, selected session, and current chat context.
- Avoid scattered duplicate Project open buttons.
- The IDE should show the same Project and allow continuing the conversation.

## Implementation Plan

1. Add a compact IDE handoff control in the Project chat surface.
2. Route to IDE with active Project/session identifiers.
3. Ensure the IDE assistant panel reuses or loads the same Project-bound session.
4. Remove or suppress duplicate Project open affordances that conflict with the desktop path.
5. Add E2E coverage from Project chat to IDE and back to the same context.

## Tests And Verification

- Renderer tests for IDE handoff state.
- Electron E2E for Project chat to IDE handoff.
- Assertions that active Project/session labels are preserved.
- Existing IDE file tree and `/init` tests remain green.

## Definition Of Done

- [x] Project chat exposes one clear IDE handoff action.
- [x] IDE opens with the same Project and session context.
- [x] Duplicate/confusing Project open affordances are not visible in the handoff flow.
- [x] Electron E2E verifies chat-to-IDE continuity.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation Notes

- Project chat now binds a Project session during Project open instead of waiting for later chat
  interaction, so the composer and IDE handoff are ready as soon as setup completes.
- The `Open IDE` handoff carries both `projectId` and `sessionId`.
- The IDE validates a handed-off Project session, restores that session for the assistant panel, and
  avoids replacing it with a different reusable Project session.
- Existing duplicate browser folder/manual path affordances remain suppressed in the desktop Project
  flow.

## Local Verification

- `make up`
- `pnpm --filter @agent-platform/web exec vitest run test/project-navigation.test.ts test/project-onboarding-assessment-panel.test.ts`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/desktop run test:e2e`
- `pnpm exec playwright test -c e2e/playwright.config.ts e2e/ide-project-opening-parked.spec.ts`
- `pnpm docs:lint`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm run test:e2e`
