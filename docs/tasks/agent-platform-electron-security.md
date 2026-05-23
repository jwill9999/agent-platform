# Epic: Desktop security, data, and lifecycle

**Beads issue:** `agent-platform-electron-security`  
**Spec file:** `docs/tasks/agent-platform-electron-security.md`

## Objective

Lock down the Electron security boundary and define local data, secret, and deletion lifecycle before broad Project access is enabled.

## Requirements

- Define secure `BrowserWindow` defaults.
- Define and implement a narrow preload bridge contract.
- Validate IPC senders and payloads.
- Add or document Content Security Policy expectations.
- Move SQLite/app data assumptions toward OS app data paths.
- Define secure secret storage strategy.
- Add a supported local app data and credential deletion flow.
- Ensure deletion never removes user-owned Project folders by default.

## Task Chain

1. `agent-platform-electron-security.1` — Audit and lock Electron security defaults.
2. `agent-platform-electron-security.2` — Define preload bridge contract and IPC validation.
3. `agent-platform-electron-security.3` — Move desktop SQLite/config usage to app data paths.
4. `agent-platform-electron-security.4` — Implement secure secret storage strategy.
5. `agent-platform-electron-security.5` — Add local app data and credential deletion flow.
6. `agent-platform-electron-security.6` — Add data lifecycle and security regression tests.

## Dependencies

| Upstream                             | Downstream                               |
| ------------------------------------ | ---------------------------------------- |
| `agent-platform-electron-foundation` | `agent-platform-electron-project-access` |

## Testing Strategy

- Unit tests for app data path and deletion helpers.
- Contract tests for preload-exposed APIs.
- Security regression tests proving renderer has no generic filesystem/shell access.
- Tests proving data deletion preserves user Project folders.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm docs:lint`.

## Definition Of Done

- Renderer has no generic Node, filesystem, or shell access.
- Preload exposes only named, typed APIs.
- App data path is used for local SQLite/config/logs where applicable.
- Secrets are protected or a safe fallback is explicitly implemented.
- Users can delete local app data and credentials.
- Data deletion preserves user-owned Project folders by default.
