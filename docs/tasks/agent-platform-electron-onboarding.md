# Epic: Desktop Project onboarding and `/init`

**Beads issue:** `agent-platform-electron-onboarding`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.md`

## Objective

Restore Project onboarding and `/init` on top of the Electron-native, backend-bound Project model.

## Requirements

- Reintegrate extracted slash command infrastructure.
- Ensure `/init` starts or resumes onboarding only for backend-bound Projects.
- Ensure `/init`, `/help`, and ordinary Project chat all read Project context from the same
  Project/session binding.
- Run the `AGENTS.md` lifecycle against the selected Project root.
- Keep review/approval before file-changing work is enabled.
- Preserve refresh/rescan and instruction update flows where still valid.
- Keep user-facing copy generic and avoid runtime implementation details.
- Treat browser File System Access handles, Docker `/workspace` paths, and manual absolute path entry
  as non-Product paths for desktop acceptance.

## Proposed Task Chain

1. Rebase/extract slash infrastructure.
2. `/init` desktop Project context integration.
3. Shared Project context for slash commands and ordinary Project chat.
4. `AGENTS.md` draft/review/write path for native Projects.
5. Refresh/rescan and update candidates.
6. Project onboarding UI cleanup.
7. Electron E2E for Open Project to `/init` to review to approval.

## Dependencies

| Upstream                                  | Downstream                           |
| ----------------------------------------- | ------------------------------------ |
| `agent-platform-electron-command-sandbox` | `agent-platform-electron-experience` |

## Testing Strategy

- Unit/API tests for slash command dispatch and missing Project behavior.
- API integration tests for `/init` with a backend-bound desktop Project.
- API integration tests proving slash commands and ordinary chat resolve the same Project id/session.
- Tests proving approved writes land only in selected Project root.
- Electron E2E against built runtime: Open Project, run `/help`, run `/init`, review draft, approve
  setup, and verify writes land in the selected Project root.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:lint`, and relevant Electron E2E.

## Definition Of Done

- `/init` does not run without a backend-bound Project.
- `/init` works after Electron Project open.
- `/init` uses the same Project context as ordinary Project chat.
- Approved instructions write to the selected Project root only.
- User reviews setup before writes are enabled.
- Production-like Electron E2E verifies the full onboarding path.
