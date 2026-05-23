# Epic: macOS production sandbox runner

**Beads issue:** `agent-platform-macos-production-sandbox`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.md`  
**Implementation plan:** [macOS production sandbox runner plan](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md)

## Objective

Build the packaged macOS production command runner so staging tests the same local VM-backed command execution path that will ship to users.

## Problem

The current Docker command runner is useful for local development, but it cannot be the production safety guarantee because end users should not need Docker installed, configured, or running. Staging must not pass code to `main` by testing host or Docker fallback when the packaged product needs a bundled local sandbox.

## Production Rule

```text
Packaged macOS app:
  sys_bash -> command policy -> approval/path jail -> macOS VM runner -> Linux guest command

VM unavailable:
  fail closed with a clear status

Host/Docker:
  explicit development-only modes
```

## Proposed Task Chain

1. `agent-platform-macos-production-sandbox.1` — Correct runner defaults and fail closed.
2. `agent-platform-macos-production-sandbox.2` — Add runner health/status contract.
3. `agent-platform-macos-production-sandbox.3` — Record ADR and add native VM helper skeleton.
4. `agent-platform-macos-production-sandbox.4` — Implement macOS VM lifecycle and command execution.
5. `agent-platform-macos-production-sandbox.5` — Package VM assets and gate staging with packaged E2E.
6. `agent-platform-macos-production-sandbox.6` — Release hardening and future platform adapter plan.

## Dependencies

| Upstream                                    | Downstream                                  |
| ------------------------------------------- | ------------------------------------------- |
| `agent-platform-electron-command-sandbox`   | `agent-platform-macos-production-sandbox`   |
| `agent-platform-macos-production-sandbox.1` | `agent-platform-macos-production-sandbox.2` |
| `agent-platform-macos-production-sandbox.2` | `agent-platform-macos-production-sandbox.3` |
| `agent-platform-macos-production-sandbox.3` | `agent-platform-macos-production-sandbox.4` |
| `agent-platform-macos-production-sandbox.4` | `agent-platform-macos-production-sandbox.5` |
| `agent-platform-macos-production-sandbox.5` | `agent-platform-macos-production-sandbox.6` |

## Child Task Specs

| Task                                          | Spec                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `agent-platform-macos-production-sandbox.1`   | `docs/tasks/agent-platform-macos-production-sandbox.1.md`                |
| `agent-platform-macos-production-sandbox.2`   | `docs/tasks/agent-platform-macos-production-sandbox.2.md`                |
| `agent-platform-macos-production-sandbox.3`   | `docs/tasks/agent-platform-macos-production-sandbox.3.md`                |
| `agent-platform-macos-production-sandbox.4`   | `docs/tasks/agent-platform-macos-production-sandbox.4.md`                |
| `agent-platform-macos-production-sandbox.5`   | `docs/tasks/agent-platform-macos-production-sandbox.5.md`                |
| `agent-platform-macos-production-sandbox.6`   | `docs/tasks/agent-platform-macos-production-sandbox.6.md`                |
| `agent-platform-macos-production-sandbox` DoD | PR checks, packaged E2E, Sonar/Problems gate, and review comments green. |

## Testing Strategy

- Unit tests for runner mode selection and fail-closed behavior.
- Unit tests for runner health/status normalization.
- Swift helper tests for native CLI status and execution output.
- Desktop adapter tests for helper invocation and error mapping.
- Packaged macOS Electron E2E proving `sys_bash` runs through `macos-vm`.
- Packaged macOS Electron E2E proving unavailable VM runner fails closed and does not use host fallback.
- Staging workflow requires packaged macOS runner evidence before merge to `main`.

## Definition Of Done

- Packaged macOS desktop builds do not default to host or Docker command execution.
- Production command execution uses the managed macOS VM runner.
- Missing or unhealthy VM runner blocks command execution with a clear status.
- Host and Docker runners remain explicit development-only modes.
- The app package includes the native helper and required VM assets.
- Staging tests the packaged macOS app and runner path before any merge to `main`.
- Documentation explains the production runner, development overrides, staging gate, and future Windows/Linux adapter path.
