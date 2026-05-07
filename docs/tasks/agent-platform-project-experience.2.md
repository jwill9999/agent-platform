# Task: Add left explorer Project and Chat navigation

**Beads issue:** `agent-platform-project-experience.2`  
**Spec file:** `docs/tasks/agent-platform-project-experience.2.md`

## Summary

Move Project and Chat navigation into the left explorer so users can see recent Projects, reopen
Projects, start/open Chats, and avoid scattered calls to action.

## Requirements

- Left explorer should show primary routes plus compact Projects and Chats/Sessions sections.
- Project rows should use readable `text-sm` sizing and compact metadata.
- Users can open a new Project from the explorer.
- Users can reopen previously opened Projects from persisted Project records.
- Chat/session list remains accessible without overwhelming the Project list.
- Navigation must work from Home, Chat, Project Chat, and IDE.

## Implementation Plan

1. Fetch Project records in the app shell/sidebar or a dedicated explorer component.
2. Add compact Projects and Chats/Sessions sections below top-level menu items.
3. Add Open Project/New Project affordance in the Projects section.
4. Route Project clicks to the project-scoped chat surface from task `.3`.
5. Add empty/loading/error states that avoid implementation terminology.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.1` | `agent-platform-project-experience.3` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Component tests for Projects/Chats explorer rows, empty states, and loading/error states.
- Playwright: verify the left explorer shows Projects/Chats, opens a stored Project, and exposes the
  new/open Project action.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Left explorer shows compact Projects and Chats/Sessions sections.
- [ ] Users can reopen stored Projects from the explorer.
- [ ] Users can start/open Project flow from the explorer.
- [ ] Labels remain user-facing and avoid `/workspace`/backend wording.
