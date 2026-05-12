# Task: Add app data and runtime config resolution

**Beads issue:** `agent-platform-electron-foundation.4`
**Spec file:** `docs/tasks/agent-platform-electron-foundation.4.md`
**Parent epic:** `agent-platform-electron-foundation` — Electron runtime foundation

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-foundation.4.md`

## Task requirements

Resolve desktop app data paths for SQLite, config, logs, and future runtime state using OS conventions.

This task should make the location explicit for the app while avoiding Docker paths and repository-relative runtime data in desktop mode. Uninstall/removal behavior should be documented for follow-up security/lifecycle work.

## Implementation plan

1. Define path resolution for macOS app data, logs, config, and temp/runtime files.
2. Add helper functions with tests for desktop versus development modes.
3. Wire the backend supervisor/config to use the resolved SQLite/config/log paths.
4. Document cleanup/uninstall expectations and any platform gaps for Windows/Linux follow-up.
5. Keep Docker development storage behavior unchanged.

## Definition of done

- [x] Desktop app data path is resolved through OS app-data conventions.
- [x] SQLite/config/log paths are explicit and test-covered.
- [x] Docker development volume behavior remains unchanged.
- [x] Uninstall/cleanup expectations are documented for later implementation.
- [x] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- Desktop runtime paths are resolved from Electron's OS path abstraction:
  - app data/config/data: `app.getPath('userData')`
  - logs: `app.getPath('logs')`
  - temp/runtime scratch: `app.getPath('temp')`
- The backend supervisor now receives resolved runtime paths instead of deriving repository-relative runtime storage.
- `SQLITE_PATH`, `AGENT_PLATFORM_DESKTOP_CONFIG_PATH`, `AGENT_PLATFORM_DESKTOP_LOG_DIR`, and related overrides remain available for explicit development/testing scenarios.
- Docker development and CI storage remain unchanged; this task only changes the Electron-managed desktop runtime path contract.
- Data deletion/uninstall remains a follow-up lifecycle task. The expected deletion scope is local app data/config/log/temp metadata and stored credentials, not user Project folders.

## Test strategy

- Unit tests for path resolution.
- Backend config/supervisor tests if touched.
- Documentation link checks.

## Verification notes

Local verification completed:

- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/desktop smoke:backend`
- `pnpm --filter @agent-platform/desktop smoke`
- `pnpm --filter @agent-platform/desktop smoke:renderer`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm docs:lint`
- `git diff --check`
- `pnpm --filter @agent-platform/api test -- test/sessionChat.integration.test.ts -t "does not run DoD criteria generation in the user-facing chat runtime"`
- `pnpm test`

The first full `pnpm test` run hit a transient timeout in one existing API integration test. The
focused rerun and a subsequent full `pnpm test` both passed.
