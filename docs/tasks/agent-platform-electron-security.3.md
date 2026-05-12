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

- [x] Desktop SQLite/config/log/temp paths resolve under OS app data locations.
- [x] Desktop backend receives those paths when managed by Electron.
- [x] Docker runtime storage remains unchanged.
- [x] First-run and migration assumptions are documented.
- [x] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- The desktop runtime resolver now uses `AGENT_PLATFORM_DESKTOP_SQLITE_PATH` for explicit desktop
  SQLite overrides instead of consuming generic `SQLITE_PATH`.
- Generic `SQLITE_PATH` remains the API child process input, but Electron derives and sets that
  value after desktop path resolution.
- The managed backend environment now receives resolved desktop paths for:
  - `SQLITE_PATH`,
  - `AGENT_PLATFORM_DESKTOP_CONFIG_PATH`,
  - `AGENT_PLATFORM_DESKTOP_CONFIG_DIR`,
  - `AGENT_PLATFORM_DESKTOP_DATA_DIR`,
  - `AGENT_PLATFORM_DESKTOP_LOG_DIR`,
  - `AGENT_PLATFORM_DESKTOP_TEMP_DIR`.
- Docker's `/data/agent.sqlite` convention remains container-only and is not consumed as a desktop
  runtime input.
- First-run behavior is documented in [Desktop Runtime](../desktop-runtime.md).

## Verification notes

- `pnpm --filter @agent-platform/desktop test -- test/runtimePaths.test.ts test/backendSupervisor.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/desktop smoke:backend`
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
