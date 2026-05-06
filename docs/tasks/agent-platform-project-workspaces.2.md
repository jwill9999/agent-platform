# Task: Bind workbench chats and sessions to an active project

**Beads issue:** `agent-platform-project-workspaces.2`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.2.md`

## Summary

Make code workbench chats explicitly inherit the active project workspace instead of operating as
generic sessions with incidental file context.

## Requirements

- Workbench UI must show which project is active.
- New workbench chat sessions must be associated with the active project.
- Chat context should include active project metadata, workspace capability state, and selected/open
  file context.
- General chat sessions must not silently inherit project file context.
- Switching projects must not leave stale file handles or stale chat project state.

## Implementation Plan

1. Extend session creation or workbench state so a project binding is explicit.
2. Carry project metadata into the chat prompt/context payload.
3. Make the branch/status panel read from the active project binding.
4. Add UI states for no project, project selected, and project unavailable.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.1` | `agent-platform-project-workspaces.3` |

## Tests And Verification

- Component or hook tests for active project binding.
- Manual test: open project A, start chat, switch to project B, confirm context changes.
- Verify general chat remains project-neutral.

## Definition Of Done

- [ ] Workbench chat has an explicit active project binding.
- [ ] UI makes active project context visible.
- [ ] Project switching cannot reuse stale context accidentally.
