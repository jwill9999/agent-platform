# Epic: Desktop Project onboarding and `/init`

**Beads issue:** `agent-platform-electron-onboarding`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.md`

## Objective

Restore Project onboarding and `/init` on top of the Electron-native, backend-bound Project model.

## Requirements

- Reintegrate extracted slash command infrastructure.
- Ensure `/init` starts or resumes onboarding only for backend-bound Projects.
- Run the `AGENTS.md` lifecycle against the selected Project root.
- Keep review/approval before file-changing work is enabled.
- Preserve refresh/rescan and instruction update flows where still valid.
- Keep user-facing copy generic and avoid runtime implementation details.

## Proposed Task Chain

1. Rebase/extract slash infrastructure.
2. `/init` desktop Project context integration.
3. `AGENTS.md` draft/review/write path for native Projects.
4. Refresh/rescan and update candidates.
5. Project onboarding UI cleanup.
6. Electron E2E for Open Project to `/init` to review to approval.

## Dependencies

| Upstream                                  | Downstream                           |
| ----------------------------------------- | ------------------------------------ |
| `agent-platform-electron-command-sandbox` | `agent-platform-electron-experience` |

## Testing Strategy

- Unit/API tests for slash command dispatch and missing Project behavior.
- API integration tests for `/init` with a backend-bound desktop Project.
- Tests proving approved writes land only in selected Project root.
- Electron E2E against built runtime: Open Project, run `/init`, review draft, approve setup.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:lint`, and relevant Electron E2E.

## Definition Of Done

- `/init` does not run without a backend-bound Project.
- `/init` works after Electron Project open.
- Approved instructions write to the selected Project root only.
- User reviews setup before writes are enabled.
- Production-like Electron E2E verifies the full onboarding path.
