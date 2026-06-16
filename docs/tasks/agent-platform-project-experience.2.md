# Task: Simplify Workspaces/sidebar Chat and Coding Project navigation

**Beads issue:** `agent-platform-project-experience.2`  
**Spec file:** `docs/tasks/agent-platform-project-experience.2.md`

## Summary

Audit the current Workspaces/sidebar navigation after Electron stabilisation and simplify the visible
choices to general Chat plus one Coding Project entry that offers both New project and Open folder
actions.

## Requirements

- Preserve the current left navigation structure where it is working; do not rebuild navigation for
  its own sake.
- Workspaces/sidebar should clearly distinguish general Chat from Coding Projects.
- The Workspaces screen should expose one general Chat entry and one Coding Project entry, not
  separate `New Project` and `Open Project` cards.
- The Coding Project entry should offer two clear actions: create a new coding project or open an
  existing folder.
- Recent Projects should remain compact and responsive with visible refresh/loading feedback.
- Project rows should use readable `text-sm` sizing and compact metadata.
- Users can open or create Coding Projects from Workspaces/sidebar without duplicate or conflicting
  CTAs.
- Users can reopen previously opened Projects from persisted Project records.
- Chat/session access remains available without making Coding Project navigation ambiguous.
- Automation, scheduled-task, email, docs/research, and generated-app workspaces should not be
  added to this screen until their product definitions are agreed.
- Navigation must work from Workspaces, Personal Chat, Project Chat/Coding, and secondary panels.

## Implementation Plan

1. Audit current Workspaces/sidebar behavior against the requirements above.
2. Identify remaining duplicated CTAs, missing loading/error states, or confusing labels.
3. Make focused UI changes rather than a wholesale navigation rebuild.
4. Ensure Project clicks route to the project-scoped chat surface.
5. Add tests for any remaining gaps.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.1` | `agent-platform-project-experience.2` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Component tests for Projects/Chats explorer rows, empty states, and loading/error states.
- Playwright: verify the left explorer shows Chat/Coding Project navigation, opens a stored Coding
  Project, and exposes both New project and Open folder actions from the Coding Project entry.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Workspaces/sidebar clearly separates general Chat and Coding Projects.
- [ ] Workspaces shows one Coding Project entry with New project and Open folder actions.
- [ ] Users can reopen stored Projects from the explorer.
- [ ] Users can start/open/create Coding Project flows without duplicate or conflicting CTAs.
- [ ] Deferred automation/task/docs/research surfaces are not exposed as current workspace cards.
- [ ] Labels remain user-facing and avoid `/workspace`/backend wording.
