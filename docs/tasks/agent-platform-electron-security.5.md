# Task: Add local app data and credential deletion flow

**Beads issue:** `agent-platform-electron-security.5`
**Spec file:** `docs/tasks/agent-platform-electron-security.5.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.5.md`

## Summary

Add a supported way to delete local app data and credentials while preserving user-owned Project
folders by default.

## Requirements

- Delete app-managed SQLite/config/log/temp data when requested.
- Delete stored credentials through the secure storage adapter.
- Never delete user Project folders as part of the normal app-data deletion flow.
- Require clear user confirmation for destructive local deletion actions.
- Document uninstall/reset expectations.

## Implementation plan

1. Define deletion scope for app-managed data, logs, temp files, metadata, and credentials.
2. Implement deletion helpers in a testable module.
3. Wire the deletion flow to the appropriate desktop settings or reset surface.
4. Add explicit confirmation copy and guardrails.
5. Document what is and is not deleted.

## Dependency order

| Upstream                             | Downstream                           |
| ------------------------------------ | ------------------------------------ |
| `agent-platform-electron-security.4` | `agent-platform-electron-security.5` |
| `agent-platform-electron-security.5` | `agent-platform-electron-security.6` |

## Tests and verification

- Unit tests for deletion scope.
- Tests proving user Project folders are preserved.
- UI or integration test for the confirmation flow if a visible surface is added.

## Definition of done

- [ ] Users can delete local app data through a supported flow.
- [ ] Users can delete stored credentials through the supported flow.
- [ ] User Project folders are preserved by default.
- [ ] Destructive action requires clear confirmation.
- [ ] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
