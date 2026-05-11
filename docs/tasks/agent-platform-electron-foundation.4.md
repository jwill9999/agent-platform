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

- [ ] Desktop app data path is resolved through OS app-data conventions.
- [ ] SQLite/config/log paths are explicit and test-covered.
- [ ] Docker development volume behavior remains unchanged.
- [ ] Uninstall/cleanup expectations are documented for later implementation.
- [ ] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Test strategy

- Unit tests for path resolution.
- Backend config/supervisor tests if touched.
- Documentation link checks.
