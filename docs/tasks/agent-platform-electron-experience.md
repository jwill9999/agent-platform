# Epic: Desktop Project experience

**Beads issue:** `agent-platform-electron-experience`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.md`

## Objective

Deliver the chat-first Project experience on top of the Electron runtime and native Project model.

## Requirements

- Show Projects and Chats/Sessions in the left explorer.
- Support recent/reopen Projects.
- Make Project chat the default Project surface.
- Keep IDE as an optional deeper view.
- Preserve Project/session context when moving between chat and IDE.
- Add breadcrumbs or equivalent quiet location affordance.
- Support generic Project profiles beyond coding.
- Hide runtime implementation details in normal UI.

## Proposed Task Chain

1. Desktop Project navigation model.
2. Recent Projects in left explorer.
3. Project chat as default entry.
4. Open IDE from Project chat.
5. Breadcrumbs/return navigation.
6. Project profile/capability labels.
7. Electron E2E for navigation and reopen.

## Dependencies

| Upstream                             | Downstream                        |
| ------------------------------------ | --------------------------------- |
| `agent-platform-electron-onboarding` | `agent-platform-electron-release` |

## Testing Strategy

- Renderer tests for navigation states.
- API/session tests for Project reopen metadata.
- Electron E2E against built runtime: recent Project reopen, Project chat, IDE handoff, return navigation.
- Visual/UI assertions that `/workspace`, backend roots, and internal states are not primary user-facing copy.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:lint`, and relevant Electron E2E.

## Definition Of Done

- Users can reopen previous Projects.
- Opening a Project lands in chat by default.
- IDE preserves Project/session context.
- UI avoids scattered Project CTAs and implementation paths/states.
- Production-like Electron E2E covers Project reopen, Project chat, and IDE handoff.
