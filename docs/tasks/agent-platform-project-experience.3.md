# Task: Make Project Chat the default Project surface

**Beads issue:** `agent-platform-project-experience.3`  
**Spec file:** `docs/tasks/agent-platform-project-experience.3.md`

## Summary

Change Project entry so opening a Project lands in a project-scoped chat instead of the IDE.

## Desktop Re-scope Note

For desktop Product acceptance, opening a Project means using the Electron-native Project opener to
create or resume a backend-bound Project and chat/session. Renderer-only folder handles and manual
path entry are not valid Project Chat entry paths.

## Requirements

- Open Project creates or resumes a Project-scoped chat session.
- Open Project must attach a backend Project id to the chat/session before `/init` or Project-aware
  agent work can run.
- The selected/default agent is derived from Project profile/capabilities.
- Project Chat shows Project name, profile/status, onboarding state, and relevant relative folder
  context without showing runtime implementation details.
- The agent receives active Project context for safe read/inspect work.
- Slash commands and normal chat messages must receive the same active Project context.
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
- Playwright/Electron: open a Project through native Project access, verify Project Chat appears,
  verify general Chat remains separate, verify `/help`/`/init` receive Project context, and verify
  Project labels are user-facing.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [x] Opening/reopening a Project lands in Project Chat, not the IDE.
- [x] Project Chat binds to the selected Project and profile-appropriate agent.
- [x] Slash commands and ordinary Project chat share the same backend-bound Project context.
- [x] General Chat and Project Chat remain separate.
- [x] Project Chat avoids runtime/backend implementation labels.

## Completion Evidence

- Covered by the merged Electron experience and stabilisation task chain, including PRs #199, #203,
  #204, #220, and #221.
- Latest relevant PR #221 passed GitHub `verify`, `docker`, `e2e`, `desktop-e2e`, markdownlint,
  lychee, GitGuardian, SonarCloud, and Sourcery before merge into
  `feature/agent-platform-electron-stabilisation`.
