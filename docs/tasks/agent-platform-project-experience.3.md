# Task: Make Project Chat the default Project surface

**Beads issue:** `agent-platform-project-experience.3`  
**Spec file:** `docs/tasks/agent-platform-project-experience.3.md`

## Summary

Change Project entry so opening a Project lands in a project-scoped chat instead of the IDE.

## Requirements

- Open Project creates or resumes a Project-scoped chat session.
- The selected/default agent is derived from Project profile/capabilities.
- Project Chat shows Project name, profile/status, onboarding state, and relevant relative folder
  context without showing runtime implementation details.
- The agent receives active Project context for safe read/inspect work.
- General Chat remains independent from Project Chat.

## Implementation Plan

1. Add or adapt route/state for Project Chat.
2. Update Open Project/reopen Project navigation to land in Project Chat.
3. Bind Project Chat sessions to Project id and profile-derived default agent.
4. Render a compact Project header/status near the chat.
5. Add tests for Project Chat creation/resume and Chat/Project separation.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.2` | `agent-platform-project-experience.4` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused API/UI tests for Project Chat session binding and default agent selection.
- Playwright: open a Project, verify Project Chat appears, verify general Chat remains separate, and
  verify Project labels are user-facing.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Opening/reopening a Project lands in Project Chat, not the IDE.
- [ ] Project Chat binds to the selected Project and profile-appropriate agent.
- [ ] General Chat and Project Chat remain separate.
- [ ] Project Chat avoids runtime/backend implementation labels.
