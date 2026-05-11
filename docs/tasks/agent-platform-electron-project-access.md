# Epic: Native Project access and session binding

**Beads issue:** `agent-platform-electron-project-access`  
**Spec file:** `docs/tasks/agent-platform-electron-project-access.md`

## Objective

Replace browser-only Project opening with Electron-native folder selection that creates a backend-bound Project and Project chat session.

## Requirements

- Expose native folder selection through the desktop bridge.
- Pass the selected host path to the backend through trusted Electron main code.
- Create or update a backend Project record for the selected folder.
- Bind Project sessions to the selected Project id.
- Make the Project/session binding available to both ordinary chat messages and slash commands such
  as `/help` and `/init`.
- Render file tree and file content from the backend-bound Project.
- Show Project names and relative paths in the UI.
- Define web-only fallback behavior.

## Proposed Task Chain

1. Native folder picker bridge.
2. Backend Project registration for desktop paths.
3. Project-bound session creation.
4. Recent Projects list and reopen.
5. Backend-backed file tree/read APIs for desktop Projects.
6. Shared chat/slash-command Project context propagation.
7. Web-only fallback UI.
8. Electron E2E for Project open to session binding.

## Dependencies

| Upstream                           | Downstream                                |
| ---------------------------------- | ----------------------------------------- |
| `agent-platform-electron-security` | `agent-platform-electron-command-sandbox` |

## Testing Strategy

- Unit/API tests for Project registration and path validation.
- Session binding tests proving `projectId` is set after native open.
- Renderer tests for Project UI states with mocked desktop bridge.
- Electron E2E against a built desktop runtime: open temp Project, create Project record, create
  Project session, verify `/help`, verify `/init` sees the Project context, and verify normal Project
  chat sees the same context.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:lint`, and relevant Electron E2E.

## Definition Of Done

- User can click Open Project and select a local folder through Electron.
- Backend receives a real host path through the trusted desktop bridge.
- Session has `projectId`.
- `/help` works in the Project session.
- `/init` and ordinary Project chat receive the same backend-bound Project context.
- UI hides `/workspace` and host absolute paths by default.
- Production-like Electron E2E proves Project open and session binding.
