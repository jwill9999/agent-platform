# Epic: Electron runtime foundation

**Beads issue:** `agent-platform-electron-foundation`  
**Spec file:** `docs/tasks/agent-platform-electron-foundation.md`

## Objective

Create the macOS-first Electron runtime foundation and prove the app can launch a built renderer and local backend without user-managed Docker.

## Requirements

- Add an Electron desktop app package, likely `apps/desktop`.
- Decide and document the desktop packaging/build tool for the first spike.
- Load the built React/Next renderer in Electron.
- Start, supervise, and stop the local backend from Electron main.
- Establish desktop runtime configuration.
- Resolve app data paths through OS conventions.
- Preserve the existing Docker developer workflow.

## Task Chain

1. `agent-platform-electron-foundation.1` — Scaffold the Electron desktop app.
2. `agent-platform-electron-foundation.2` — Build/load the renderer for desktop runtime.
3. `agent-platform-electron-foundation.3` — Implement the backend supervisor spike.
4. `agent-platform-electron-foundation.4` — Add app data/runtime config resolution.
5. `agent-platform-electron-foundation.5` — Document desktop versus Docker development workflows.

## Dependencies

| Upstream                               | Downstream                             |
| -------------------------------------- | -------------------------------------- |
| `agent-platform-electron-extract`      | `agent-platform-electron-foundation.1` |
| `agent-platform-electron-foundation.1` | `agent-platform-electron-foundation.2` |
| `agent-platform-electron-foundation.2` | `agent-platform-electron-foundation.3` |
| `agent-platform-electron-foundation.3` | `agent-platform-electron-foundation.4` |
| `agent-platform-electron-foundation.4` | `agent-platform-electron-foundation.5` |
| `agent-platform-electron-foundation.5` | `agent-platform-electron-security`     |

## Testing Strategy

- Unit tests for runtime config helpers.
- Smoke test proving Electron can launch the built renderer.
- Backend supervisor test or scripted smoke proving readiness and shutdown.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm docs:lint`.

## Definition Of Done

- macOS Electron app launches locally.
- Built renderer loads without requiring the normal browser dev server.
- Local backend starts, reports readiness, logs to a known location, and stops on app quit.
- App data path can be resolved for SQLite/config/logs.
- Docker dev workflow remains usable and documented.
- All child tasks are closed through PR/check/review gates before the epic closes.
