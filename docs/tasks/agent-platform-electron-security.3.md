# Task: Move desktop SQLite and config usage to app data paths

**Beads issue:** `agent-platform-electron-security.3`
**Spec file:** `docs/tasks/agent-platform-electron-security.3.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.3.md`

## Summary

Wire the desktop runtime so SQLite, config, logs, and runtime metadata use OS app data paths instead
of repository-relative or Docker-specific locations.

## Requirements

- Use the runtime path helpers introduced by the foundation epic.
- Keep Docker development and CI storage behavior unchanged.
- Ensure desktop-managed backend startup receives the desktop SQLite/config/log paths.
- Document migration or first-run behavior for users who have no existing desktop data.

## Implementation plan

1. Trace how the desktop backend process receives environment and runtime paths.
2. Ensure SQLite/config/log/temp paths are passed from Electron app data resolution.
3. Add tests for desktop backend environment construction.
4. Document first-run behavior and any future migration needs.
5. Verify Docker commands still use their existing volume-backed storage.

## Dependency order

| Upstream                             | Downstream                           |
| ------------------------------------ | ------------------------------------ |
| `agent-platform-electron-security.2` | `agent-platform-electron-security.3` |
| `agent-platform-electron-security.3` | `agent-platform-electron-security.4` |

## Tests and verification

- Unit tests for backend env/config construction.
- Desktop backend smoke test.
- Docker docs or command verification where touched.

## Definition of done

- [ ] Desktop SQLite/config/log/temp paths resolve under OS app data locations.
- [ ] Desktop backend receives those paths when managed by Electron.
- [ ] Docker runtime storage remains unchanged.
- [ ] First-run and migration assumptions are documented.
- [ ] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
