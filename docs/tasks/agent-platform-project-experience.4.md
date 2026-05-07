# Task: Add optional IDE handoff with session continuity

**Beads issue:** `agent-platform-project-experience.4`  
**Spec file:** `docs/tasks/agent-platform-project-experience.4.md`

## Summary

Let users explicitly open the IDE from an active Project Chat and continue the same Project/session
context there.

## Requirements

- Project Chat exposes a clear but secondary Open IDE action.
- IDE opens with the active Project, session, agent, and conversation context preserved.
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
- Playwright: open Project Chat, send/verify context, open IDE, verify same Project/session, return to
  Project Chat, and verify conversation continuity.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] IDE opens only after explicit user action from Project context.
- [ ] IDE preserves Project/session/conversation context.
- [ ] Users can return from IDE to Project Chat.
- [ ] IDE primary labels use Project/folder terminology.
