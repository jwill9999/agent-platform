# Task: Support frontend create file and folder in browser workspaces

**Beads issue:** `agent-platform-project-workspaces.4`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.4.md`

## Summary

Add practical create-file and create-folder support for browser-opened worktrees so the current IDE
does not feel half-finished while backend mounting evolves.

## Requirements

- Users can create a new file in the currently open browser workspace.
- Users can create a new folder in the currently open browser workspace.
- Agent-proposed new files should become reviewable workbench artifacts before creation.
- Applying a new-file proposal should create the file through the active browser directory handle.
- The UI must make unsupported states clear when browser permissions are missing.

## Implementation Plan

1. Extend the file-system hook with `createFile` and `createDirectory` operations.
2. Add UI affordances in the explorer for create file/folder.
3. Extend the review flow so agent-generated new files apply through the active workspace handle.
4. Refresh or incrementally update the tree after creation.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.3` | `agent-platform-project-workspaces.5` |

## Tests And Verification

- Hook/helper tests for path normalization and duplicate handling.
- Manual test: open host folder, create `readme.md`, verify it appears on disk.
- Manual test: create nested folder and file, refresh tree, verify persistence.
- Manual test: agent proposes a new file and applying it creates the file in the open project.

## Definition Of Done

- [ ] Create file/folder works for browser-opened worktrees.
- [ ] Agent new-file proposals do not write to Docker `/workspace`.
- [ ] Tree updates after creation without a full page reload.
