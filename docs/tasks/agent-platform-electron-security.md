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

## Proposed Task Chain

1. Electron security hardening checklist.
2. Preload bridge contract and IPC validation.
3. SQLite app data migration.
4. Secure secret storage spike.
5. Local app data and credential deletion flow.
6. Data lifecycle tests.

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
