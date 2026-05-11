# Task: Add optional IDE handoff with session continuity

**Beads issue:** `agent-platform-project-experience.4`  
**Spec file:** `docs/tasks/agent-platform-project-experience.4.md`

## Summary

Let users explicitly open the IDE from an active Project Chat and continue the same Project/session
context there.

## Desktop Re-scope Note

For desktop Product acceptance, IDE handoff consumes the same backend-bound Project/session created
by Electron native Project access. It must not create a separate renderer-only folder context.

## Requirements

- Project Chat exposes a clear but secondary Open IDE action.
- IDE opens with the active Project, session, agent, and conversation context preserved.
- IDE file tree, file reads, writes, and terminal affordances must be scoped to the same backend
  Project root as Project Chat.
- Users can return from IDE to Project Chat without losing context.
- IDE remains optional and should not be the default Project destination.
- IDE labels must use Project/folder terminology and hide runtime implementation details by default.

## Implementation Plan

1. Define Project Chat -> IDE navigation state or route parameters.
2. Load active Project/session context in IDE.
3. Add return-to-Project-Chat navigation.
4. Update IDE header/sidebar labels to use Project name and relevant folder context.
5. Add regression tests for context preservation.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.3` | `agent-platform-project-experience.5` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused UI tests for IDE handoff state and return navigation.
- Playwright/Electron: open Project Chat from a native Project, send/verify context, open IDE, verify
  the same Project/session/backend root is used, return to Project Chat, and verify conversation
  continuity.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] IDE opens only after explicit user action from Project context.
- [ ] IDE preserves Project/session/conversation context.
- [ ] IDE and Project Chat use the same backend Project id and Project root.
- [ ] Users can return from IDE to Project Chat.
- [ ] IDE primary labels use Project/folder terminology.
