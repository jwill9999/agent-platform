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

## Environment Model

| Environment | Purpose                                      | Runner Policy                                                                                                                                                           | Required Evidence                                                                                                                                   |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local       | Developer productivity and fast feedback.    | Host and Docker may be enabled only through explicit developer configuration; macOS VM should be available for production-path development as early as possible.        | Unit tests, adapter tests, Swift helper tests, and local VM smoke tests where the task claims VM behavior.                                          |
| Staging     | Production rehearsal before merge to `main`. | Must run the packaged macOS app with `macos-vm`, or command execution must be explicitly disabled for that release. Host/Docker fallback is not valid staging evidence. | Packaged Electron E2E, runner health proving `macos-vm`, command output proving `/workspace`, fail-closed unavailable test, and full quality gates. |
| Production  | Released app used by end users.              | Uses the packaged macOS app with the managed VM runner. Missing or unhealthy runner fails closed.                                                                       | Signed/notarized artifact smoke, packaged runner startup, staging evidence from the same artifact shape, and manual release verification.           |

Configuration must use the same variable names and defaults in staging and production. Differences
between staging and production should be limited to credentials, artifact identity, and release-safe
test data. Any setting that changes runner safety must be exposed in runner health and asserted by
tests.

## Proposed Task Chain

1. `agent-platform-macos-production-sandbox.1` — Correct runner defaults and fail closed.
2. `agent-platform-macos-production-sandbox.2` — Add runner health/status contract.
3. `agent-platform-macos-production-sandbox.3` — Record ADR and add native VM helper skeleton.
4. `agent-platform-macos-production-sandbox.4` — Implement macOS VM lifecycle and command execution.
5. `agent-platform-macos-production-sandbox.5` — Package VM assets and gate staging with packaged E2E.
6. `agent-platform-macos-production-sandbox.6` — Release hardening and future platform adapter plan.

Tasks `.4`, `.5`, and `.6` are intentionally decomposed into child tasks. They must not be treated
as complete until their child tasks and evidence tasks are closed.

## Dependencies

| Upstream                                    | Downstream                                  |
| ------------------------------------------- | ------------------------------------------- |
| `agent-platform-electron-command-sandbox`   | `agent-platform-macos-production-sandbox`   |
| `agent-platform-macos-production-sandbox.1` | `agent-platform-macos-production-sandbox.2` |
| `agent-platform-macos-production-sandbox.2` | `agent-platform-macos-production-sandbox.3` |
| `agent-platform-macos-production-sandbox.3` | `agent-platform-macos-production-sandbox.4` |
| `agent-platform-macos-production-sandbox.4` | `agent-platform-macos-production-sandbox.5` |
| `agent-platform-macos-production-sandbox.5` | `agent-platform-macos-production-sandbox.6` |

Nested task dependencies:

| Upstream                                        | Downstream                                      |
| ----------------------------------------------- | ----------------------------------------------- |
| `agent-platform-macos-production-sandbox.4.1`   | `agent-platform-macos-production-sandbox.4.2`   |
| `agent-platform-macos-production-sandbox.4.2.1` | `agent-platform-macos-production-sandbox.4.2.2` |
| `agent-platform-macos-production-sandbox.4.2.2` | `agent-platform-macos-production-sandbox.4.2.3` |
| `agent-platform-macos-production-sandbox.4.2.3` | `agent-platform-macos-production-sandbox.4.3`   |
| `agent-platform-macos-production-sandbox.4.3`   | `agent-platform-macos-production-sandbox.4.4`   |
| `agent-platform-macos-production-sandbox.5.1`   | `agent-platform-macos-production-sandbox.5.2`   |
| `agent-platform-macos-production-sandbox.5.2`   | `agent-platform-macos-production-sandbox.5.3`   |
| `agent-platform-macos-production-sandbox.5.3`   | `agent-platform-macos-production-sandbox.5.4`   |
| `agent-platform-macos-production-sandbox.6.1`   | `agent-platform-macos-production-sandbox.6.2`   |
| `agent-platform-macos-production-sandbox.6.2`   | `agent-platform-macos-production-sandbox.6.3`   |
| `agent-platform-macos-production-sandbox.6.3`   | `agent-platform-macos-production-sandbox.6.4`   |

## Child Task Specs

| Task                                            | Spec                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `agent-platform-macos-production-sandbox.1`     | `docs/tasks/agent-platform-macos-production-sandbox.1.md`                |
| `agent-platform-macos-production-sandbox.2`     | `docs/tasks/agent-platform-macos-production-sandbox.2.md`                |
| `agent-platform-macos-production-sandbox.3`     | `docs/tasks/agent-platform-macos-production-sandbox.3.md`                |
| `agent-platform-macos-production-sandbox.4`     | `docs/tasks/agent-platform-macos-production-sandbox.4.md`                |
| `agent-platform-macos-production-sandbox.4.1`   | `docs/tasks/agent-platform-macos-production-sandbox.4.1.md`              |
| `agent-platform-macos-production-sandbox.4.2`   | `docs/tasks/agent-platform-macos-production-sandbox.4.2.md`              |
| `agent-platform-macos-production-sandbox.4.2.1` | `docs/tasks/agent-platform-macos-production-sandbox.4.2.1.md`            |
| `agent-platform-macos-production-sandbox.4.2.2` | `docs/tasks/agent-platform-macos-production-sandbox.4.2.2.md`            |
| `agent-platform-macos-production-sandbox.4.2.3` | `docs/tasks/agent-platform-macos-production-sandbox.4.2.3.md`            |
| `agent-platform-macos-production-sandbox.4.3`   | `docs/tasks/agent-platform-macos-production-sandbox.4.3.md`              |
| `agent-platform-macos-production-sandbox.4.4`   | `docs/tasks/agent-platform-macos-production-sandbox.4.4.md`              |
| `agent-platform-macos-production-sandbox.5`     | `docs/tasks/agent-platform-macos-production-sandbox.5.md`                |
| `agent-platform-macos-production-sandbox.5.1`   | `docs/tasks/agent-platform-macos-production-sandbox.5.1.md`              |
| `agent-platform-macos-production-sandbox.5.2`   | `docs/tasks/agent-platform-macos-production-sandbox.5.2.md`              |
| `agent-platform-macos-production-sandbox.5.3`   | `docs/tasks/agent-platform-macos-production-sandbox.5.3.md`              |
| `agent-platform-macos-production-sandbox.5.4`   | `docs/tasks/agent-platform-macos-production-sandbox.5.4.md`              |
| `agent-platform-macos-production-sandbox.6`     | `docs/tasks/agent-platform-macos-production-sandbox.6.md`                |
| `agent-platform-macos-production-sandbox.6.1`   | `docs/tasks/agent-platform-macos-production-sandbox.6.1.md`              |
| `agent-platform-macos-production-sandbox.6.2`   | `docs/tasks/agent-platform-macos-production-sandbox.6.2.md`              |
| `agent-platform-macos-production-sandbox.6.3`   | `docs/tasks/agent-platform-macos-production-sandbox.6.3.md`              |
| `agent-platform-macos-production-sandbox.6.4`   | `docs/tasks/agent-platform-macos-production-sandbox.6.4.md`              |
| `agent-platform-macos-production-sandbox` DoD   | PR checks, packaged E2E, Sonar/Problems gate, and review comments green. |

## Requirements Traceability

These requirements must remain visible across the child tasks so the epic cannot appear complete
while a production-critical detail is still undecided.

| Requirement                                  | Owning task(s)                                                  | Completion evidence                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootable image source/build path             | `.4.2.1`                                                        | Documented reproducible source or build pipeline for an `arm64` Linux guest image, plus checksum/manifest evidence from asset preparation.    |
| Apple Virtualization.framework boot contract | `.4.2.1`, with corrective updates to `.4.1` artifacts if needed | Explicit choice of EFI bootable disk or Linux kernel/initrd boot path; helper validation matches the selected boot contract.                  |
| Guest bootstrap and command service model    | `.4.2.1`, `.4.3`                                                | Image/bootstrap includes required service prerequisites; `.4.3` proves command execution through the guest service inside `/workspace`.       |
| Staging asset availability                   | `.4.2.1`, `.5.1`, `.5.4`                                        | Staging can obtain the same image/assets without manual host setup; packaging fails if assets are absent; staging E2E publishes evidence.     |
| Production packaging boundary                | `.5.1`, `.5.2`                                                  | App-owned helper/runtime/asset paths are used by the packaged app with no developer-only environment variables.                               |
| Signing, notarization, and entitlements      | `.6.3`                                                          | Signed/notarized artifact starts the helper and reports `macos-vm` health; release fails closed if entitlements or hardened runtime block it. |

## Independent Task Sign-Off Rules

Each task and child task must be independently achievable and testable. A task can close only when
its own requirements, tests, and Definition of Done are satisfied; it must not close by assuming a
later task will discover or supply missing requirements.

- If a task uncovers a missing prerequisite, update the current task or create/link a child task
  before implementation continues.
- If a task chooses an architecture boundary that affects later tasks, record that decision in the
  task spec and update downstream specs in the same change.
- If evidence cannot be collected in the required environment, leave the task open and record the
  blocker in Beads.
- Parent tasks `.4`, `.5`, `.6`, and the epic close only after all child tasks are closed and their
  evidence is recorded.
- Staging and production sign-off must use production-like runner configuration; host and Docker are
  never acceptable substitutes for macOS production runner evidence.

## Testing Strategy

Testing must prove sandbox properties, not just command success:

- Unit tests prove runner mode selection, fail-closed defaults, health/status normalization, and
  result mapping.
- Desktop adapter tests prove helper invocation, explicit environment passing, unavailable mapping,
  and absence of silent host fallback.
- Swift helper tests prove native CLI parsing and structured JSON output.
- Local VM smoke tests prove real command execution in `/workspace` before VM lifecycle tasks are
  complete.
- Packaged macOS Electron E2E proves staging uses `macos-vm`, can execute `sys_bash` inside the
  guest, cannot see host-only paths, and fails closed when VM assets are unavailable.
- Manual packaged-app release smoke proves the signed/notarized artifact can start the runner on a
  real macOS machine with a real Project folder.

Per-task evidence rules:

- `.1` and `.2` can complete with unit/adapter tests because they define policy and status
  contracts.
- `.3` can complete with ADR approval and Swift helper skeleton tests because it does not claim real
  VM execution.
- `.4` cannot complete without real local macOS VM command execution proof.
- `.5` cannot complete without packaged Electron E2E proving staging uses `macos-vm` and fail-closed
  behavior.
- `.6` cannot complete without signing/notarization and release smoke evidence.
- The epic cannot close while staging can pass using host or Docker command execution.

## Definition Of Done

- Packaged macOS desktop builds do not default to host or Docker command execution.
- Production command execution uses the managed macOS VM runner.
- Missing or unhealthy VM runner blocks command execution with a clear status.
- Host and Docker runners remain explicit development-only modes.
- The app package includes the native helper and required VM assets.
- Staging tests the packaged macOS app and runner path before any merge to `main`.
- Staging and production share the same runner defaults and environment variable names.
- Every child task records the environment it was tested in and why that evidence is sufficient.
- Documentation explains the production runner, development overrides, staging gate, and future Windows/Linux adapter path.
