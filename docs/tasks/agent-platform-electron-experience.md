# Epic: Desktop Project experience

**Beads issue:** `agent-platform-electron-experience`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.md`

## Objective

Deliver the chat-first Project experience on top of the Electron runtime and native Project model.

## Post-QA Stabilisation Status

The implementation tasks for this epic were completed, but owner manual QA found release-blocking
regressions in the delivered experience. Corrective work now belongs to
`agent-platform-electron-stabilisation`.

The current product direction is stricter than the original epic wording:

- Project Chat is the primary Project surface.
- Opening or reopening a Project must route to Project Chat, not the built-in IDE.
- Slash commands and Project context belong in Project Chat.
- The built-in IDE is not a primary workflow for stabilisation. It should be removed from primary
  navigation, hidden, or replaced later by an explicit external/default IDE handoff.
- Generated output such as landing pages, Markdown documents, PDFs, and HTML previews should render
  in chat/activity surfaces where practical.

The completed tasks in this epic should be treated as implementation history, not release
acceptance. Release acceptance now depends on the stabilisation tasks and their Electron E2E/manual
QA closeout.

## Requirements

- Show Projects and Chats/Sessions in the left explorer.
- Support recent/reopen Projects.
- Make Project chat the default Project surface.
- De-prioritise the built-in IDE as a primary workflow; any direct file-editing handoff should be
  explicit and secondary.
- Preserve Project/session context when moving between Project Chat and any optional file/IDE
  surface.
- Preserve the same Project/session context for slash commands and ordinary Project chat.
- Add breadcrumbs or equivalent quiet location affordance.
- Support generic Project profiles beyond coding.
- Hide runtime implementation details in normal UI.
- Do not reintroduce browser-only Project opening, duplicate folder CTAs, or manual absolute path
  entry as the desktop Product path.

## Task Chain

1. `agent-platform-electron-experience.1` - Desktop Project navigation model.
2. `agent-platform-electron-experience.2` - Recent Projects in left explorer.
3. `agent-platform-electron-experience.3` - Project chat as default entry.
4. `agent-platform-electron-experience.4` - Open IDE from Project chat.
5. `agent-platform-electron-experience.5` - Breadcrumbs/return navigation.
6. `agent-platform-electron-experience.6` - Project profile/capability labels.
7. `agent-platform-electron-experience.7` - Slash-command context parity in Project chat.
8. `agent-platform-electron-experience.8` - Electron E2E for navigation and reopen.

## Dependencies

| Upstream                               | Downstream                              |
| -------------------------------------- | --------------------------------------- |
| `agent-platform-electron-onboarding`   | `agent-platform-electron-experience.1`  |
| `agent-platform-electron-experience.1` | `agent-platform-electron-experience.2`  |
| `agent-platform-electron-experience.2` | `agent-platform-electron-experience.3`  |
| `agent-platform-electron-experience.3` | `agent-platform-electron-experience.4`  |
| `agent-platform-electron-experience.4` | `agent-platform-electron-experience.5`  |
| `agent-platform-electron-experience.5` | `agent-platform-electron-experience.6`  |
| `agent-platform-electron-experience.6` | `agent-platform-electron-experience.7`  |
| `agent-platform-electron-experience.7` | `agent-platform-electron-experience.8`  |
| `agent-platform-electron-experience`   | `agent-platform-electron-stabilisation` |

## Testing Strategy

- Renderer tests for navigation states.
- API/session tests for Project reopen metadata.
- Electron E2E against built runtime: recent Project reopen, Project chat, `/help`/`/init` context
  parity, optional IDE/file handoff, return navigation, and rendered preview surfaces where relevant.
- Visual/UI assertions that `/workspace`, backend roots, and internal states are not primary user-facing copy.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:lint`, and relevant Electron E2E.

## Definition Of Done

- Users can reopen previous Projects.
- Opening a Project lands in chat by default.
- Built-in IDE behavior is either removed from primary navigation or explicitly secondary.
- Slash commands and ordinary Project chat preserve the same Project/session context.
- UI avoids scattered Project CTAs and implementation paths/states.
- Production-like Electron E2E covers Project reopen, Project chat, optional file/IDE handoff, and
  rendered preview expectations where implemented.
- Owner/manual QA closeout happens in `agent-platform-electron-stabilisation` before release work
  starts.
