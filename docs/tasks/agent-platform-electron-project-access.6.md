# Task: Share Project context across chat and slash commands

**Beads issue:** `agent-platform-electron-project-access.6`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.6.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.6.md`

## Summary

Make slash commands and ordinary Project chat resolve Project context through the same session binding.

## Requirements

- `/help` must work in a Project-bound session.
- `/init` must see the Project context without requiring a previous natural-language message.
- Slash command handlers should not perform separate stale session lookups.
- Ordinary Project chat and slash commands should use the same Project context source.
- Missing Project context should produce clear user-facing guidance.

## Implementation plan

1. Review slash command dispatch and chat session loading.
2. Pass the already loaded session and Project context into slash command handlers.
3. Add tests for `/help`, `/init`, ordinary chat, and missing Project context.
4. Ensure handlers stay registry-agnostic and extensible.
5. Document the context propagation contract.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-project-access.5` | `agent-platform-electron-project-access.6` |
| `agent-platform-electron-project-access.6` | `agent-platform-electron-project-access.7` |

## Tests and verification

- API/chat tests for slash command context propagation.
- Regression tests proving `/init` sees Project context on the first command.
- Unit tests for command registry/context contract.
- Root gates and PR checks before closure.

## Definition of done

- [x] `/help` works in Project-bound sessions.
- [x] `/init` receives Project context on the first slash command.
- [x] Ordinary Project chat and slash commands share one context source.
- [x] Missing Project context has clear guidance.
- [x] Relevant tests and root gates pass.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- Added an explicit resolved Project context (`projectId` plus `project`) to slash command execution.
- `/init` now uses the resolved Project context instead of reading `session.projectId` directly.
- Session chat prompt construction and slash command execution now share `resolveSessionProjectContext`.
- Added API regression coverage for desktop-registered Project `/init` as the first chat message.
- Added compose-backed Playwright coverage for opening a desktop Project and running `/init` through the IDE chat UI.
