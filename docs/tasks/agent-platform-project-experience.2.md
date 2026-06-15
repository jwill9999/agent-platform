# Task: Audit and finish Workspaces/sidebar Project and Chat navigation

**Beads issue:** `agent-platform-project-experience.2`  
**Spec file:** `docs/tasks/agent-platform-project-experience.2.md`

## Summary

Audit the current Workspaces/sidebar navigation after Electron stabilisation and finish any remaining
gaps so users can clearly distinguish Projects from Personal Chat, reopen Projects, and start/open
Project flows without scattered calls to action.

## Requirements

- Preserve the current left navigation structure where it is working; do not rebuild navigation for
  its own sake.
- Workspaces/sidebar should clearly distinguish Projects from Personal Chat.
- Recent Projects should remain compact and responsive with visible refresh/loading feedback.
- Project rows should use readable `text-sm` sizing and compact metadata.
- Users can open or create Projects from Workspaces/sidebar without duplicate or conflicting CTAs.
- Users can reopen previously opened Projects from persisted Project records.
- Chat/session access remains available without making Project navigation ambiguous.
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
| `agent-platform-project-experience.1` | `agent-platform-project-experience.3` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Component tests for Projects/Chats explorer rows, empty states, and loading/error states.
- Playwright: verify the left explorer shows Projects/Chats, opens a stored Project, and exposes the
  new/open Project action.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Workspaces/sidebar clearly separates Projects and Personal Chat.
- [ ] Users can reopen stored Projects from the explorer.
- [ ] Users can start/open/create Project flows without duplicate or conflicting CTAs.
- [ ] Labels remain user-facing and avoid `/workspace`/backend wording.
