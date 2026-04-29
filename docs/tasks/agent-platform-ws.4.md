# Task: Expose workspace files in the UI and API

**Beads issue:** `agent-platform-ws.4`  
**Spec file:** `docs/tasks/agent-platform-ws.4.md` (this file)  
**Parent epic:** `agent-platform-ws` - Host workspace storage for user files

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.4.md`

## Task requirements

Add API and UI support for inspecting files in the configured workspace. Users should be able to see files created by agents, distinguish uploads from generated outputs and scratch files, and download or export files without exposing paths outside the workspace.

## Detailed requirements

- Add or extend API endpoints to list workspace files and fetch/download individual files.
- Keep API responses scoped to workspace-relative paths.
- Represent key workspace areas clearly: `uploads`, `generated`, `scratch`, and `exports`.
- Add UI affordances to inspect recent or all workspace files.
- Add download/export actions for safe files.
- Use human-readable errors when a file is missing, denied, or unsafe.
- Ensure API and UI operations cannot escape the workspace.

## Dependency order

### Upstream - must be complete before this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.3` | [Spec](./agent-platform-ws.3.md) |

### Downstream - waiting on this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.6` | [Spec](./agent-platform-ws.6.md) |

### Planning notes

Prefer dense, practical UI over a marketing-style file browser. The workspace surface should make common agent outputs easy to find without becoming a general-purpose host filesystem explorer.

## Implementation plan

1. Review existing API route patterns, frontend data-fetching hooks, and chat output rendering.
2. Define workspace file response contracts in shared contracts if needed.
3. Implement workspace list/download endpoints with PathJail enforcement.
4. Add UI state and components for workspace files.
5. Connect generated file outputs in chat to the workspace view where appropriate.
6. Add tests for API scoping and UI rendering.

## Tests

- API tests: list and download workspace-relative files.
- API tests: path traversal and outside-workspace requests are denied.
- Web tests: workspace file list renders useful labels and states.
- E2E or focused browser test: created file appears and can be downloaded/exported.
- Run affected API/web tests, typecheck, lint, and format checks.

## Definition of done

- [ ] UI/API list workspace files and show created outputs.
- [ ] Users can download/export safe workspace files.
- [ ] Uploads, generated files, scratch files, and exports are represented clearly.
- [ ] Operations cannot escape the workspace.
- [ ] Errors are human-readable.

## Sign-off

- [ ] Branch `task/agent-platform-ws.4` created from `task/agent-platform-ws.3`.
- [ ] API/web tests pass.
- [ ] `bd close agent-platform-ws.4 --reason "..."`
