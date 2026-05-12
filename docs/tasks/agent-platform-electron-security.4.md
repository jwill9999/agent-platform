# Task: Implement secure secret storage strategy

**Beads issue:** `agent-platform-electron-security.4`
**Spec file:** `docs/tasks/agent-platform-electron-security.4.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.4.md`

## Summary

Select and implement the first desktop secret storage strategy for model/provider credentials and
other local sensitive settings.

## Requirements

- Prefer OS-backed secure storage on macOS.
- Avoid plaintext credentials in SQLite, logs, config files, or renderer state.
- Define a safe fallback if secure storage is unavailable.
- Keep the storage API swappable for Windows/Linux support later.
- Document operational behavior for credential deletion and reset.

## Implementation plan

1. Evaluate the current secret storage path used by the API and desktop runtime.
2. Choose the first macOS-compatible implementation path and abstraction boundary.
3. Implement or adapt a secure storage adapter for desktop credentials.
4. Add tests for storing, reading, deleting, and unavailable-storage behavior.
5. Document future Windows/Linux considerations.

## Dependency order

| Upstream                             | Downstream                           |
| ------------------------------------ | ------------------------------------ |
| `agent-platform-electron-security.3` | `agent-platform-electron-security.4` |
| `agent-platform-electron-security.4` | `agent-platform-electron-security.5` |

## Tests and verification

- Unit tests for secret storage adapter behavior.
- Tests proving secrets are not written to expected plaintext config/log paths.
- Desktop package typecheck, lint, and tests.

## Definition of done

- [ ] Desktop credentials use protected storage or a documented safe fallback.
- [ ] Credentials are not persisted in plaintext app config, logs, or renderer state.
- [ ] Secret storage has a narrow adapter interface for future platform support.
- [ ] Credential deletion behavior is defined.
- [ ] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
