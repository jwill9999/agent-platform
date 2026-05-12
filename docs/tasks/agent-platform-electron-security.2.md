# Task: Define preload bridge contract and IPC validation

**Beads issue:** `agent-platform-electron-security.2`
**Spec file:** `docs/tasks/agent-platform-electron-security.2.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.2.md`

## Summary

Define the narrow preload API that the renderer may use and validate IPC payloads and senders in the
main process.

## Requirements

- Expose only named, typed APIs from preload.
- Avoid generic `invoke`, filesystem, shell, or path access from renderer code.
- Validate IPC payloads with shared schemas or local validators.
- Verify the sender frame/origin for IPC calls where Electron supports it.
- Keep the contract swappable so future desktop APIs can be added without broadening the trust boundary.

## Implementation plan

1. Inventory existing preload and IPC channels.
2. Define a typed desktop bridge contract for current capabilities.
3. Add payload validation for each IPC handler.
4. Add sender/origin checks around IPC handlers.
5. Add contract tests for exposed API names and representative invalid payloads.

## Dependency order

| Upstream                             | Downstream                           |
| ------------------------------------ | ------------------------------------ |
| `agent-platform-electron-security.1` | `agent-platform-electron-security.2` |
| `agent-platform-electron-security.2` | `agent-platform-electron-security.3` |

## Tests and verification

- Unit/contract tests for bridge API shape.
- Unit tests for valid and invalid IPC payloads.
- Desktop package typecheck, lint, and tests.

## Definition of done

- [ ] Preload exposes only named, typed APIs.
- [ ] Renderer cannot call generic IPC or filesystem/shell operations.
- [ ] IPC handlers validate payloads and reject malformed requests.
- [ ] IPC sender/origin validation is implemented or explicitly documented where not applicable.
- [ ] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
