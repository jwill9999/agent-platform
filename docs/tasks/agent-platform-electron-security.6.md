# Task: Add data lifecycle and security regression tests

**Beads issue:** `agent-platform-electron-security.6`
**Spec file:** `docs/tasks/agent-platform-electron-security.6.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.6.md`

## Summary

Add regression coverage that proves the security and data lifecycle decisions from this epic remain
intact.

## Requirements

- Cover renderer isolation and bridge exposure.
- Cover IPC validation failure paths.
- Cover app data deletion without deleting Project folders.
- Cover credential deletion behavior.
- Document any areas that require later production-packaged Electron E2E coverage.

## Implementation plan

1. Review tests added by earlier security tasks and identify gaps.
2. Add missing unit, contract, smoke, or Playwright/Electron coverage where practical.
3. Ensure coverage runs in normal CI without requiring host-specific secrets.
4. Update docs and task specs with the final verification matrix.
5. Close the parent epic only after all child tasks and CI gates are complete.

## Dependency order

| Upstream                             | Downstream                           |
| ------------------------------------ | ------------------------------------ |
| `agent-platform-electron-security.5` | `agent-platform-electron-security.6` |

## Tests and verification

- Desktop package tests.
- Root typecheck, lint, build, and relevant test suites.
- CI PR checks, Sonar/Problems gate, and review comment resolution.

## Definition of done

- [ ] Security regression tests cover renderer isolation and bridge exposure.
- [ ] IPC validation failure paths are covered.
- [ ] App data deletion tests prove Project folders are preserved.
- [ ] Credential deletion behavior is covered.
- [ ] Remaining packaged-app E2E gaps are documented.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
