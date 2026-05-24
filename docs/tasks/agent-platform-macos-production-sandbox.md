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

| Requirement                                  | Owning task(s)                                                  | Completion evidence                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fail-closed production defaults              | `.1`                                                            | Unset/unknown packaged desktop runner mode denies execution; host and Docker require explicit development-only configuration.                             |
| Shared runner health/status contract         | `.2`, `.5.2`                                                    | Shared health contract distinguishes disabled, unavailable, development-only, starting, ready, and failed-closed states for tests and UI.                 |
| Production runner architecture decision      | `.3`                                                            | ADR records Apple Virtualization.framework as the macOS production boundary and records Docker/host as development-only adapters.                         |
| Native helper command surface                | `.3`, `.4.2`, `.4.3`                                            | Swift helper provides deterministic JSON commands for prepare/start/status/stop/exec and later backs those commands with real VM behavior.                |
| Bootable image source/build path             | `.4.2.1`                                                        | Documented reproducible source or build pipeline for an `arm64` Linux guest image, plus checksum/manifest evidence from asset preparation.                |
| Apple Virtualization.framework boot contract | `.4.2.1`, with corrective updates to `.4.1` artifacts if needed | `VZLinuxBootLoader` contract with raw disk, matching kernel, matching initrd, and helper validation for all selected boot assets.                         |
| Real VM boot and lifecycle                   | `.4.2.2`, `.4.2.3`                                              | Real image boots; status is ready only for a genuinely running VM; stale PID/socket/ready state and failed starts fail closed.                            |
| Guest bootstrap and command service model    | `.4.2.1`, `.4.3`                                                | Image/bootstrap includes required service prerequisites; `.4.3` proves command execution through the guest service inside `/workspace`.                   |
| Command contract and workspace isolation     | `.4.3`, `.4.4`                                                  | `sys_bash` maps stdout/stderr/exit/duration/timeout/truncation/cwd correctly, runs as non-root, and cannot see host-only paths.                           |
| Staging asset availability                   | `.4.2.1`, `.5.1`, `.5.4`                                        | Staging can obtain the same image/assets without manual host setup; packaging fails if assets are absent; staging E2E publishes evidence.                 |
| Production packaging boundary                | `.5.1`, `.5.2`                                                  | App-owned helper/runtime/asset paths are used by the packaged app with no developer-only environment variables.                                           |
| User-visible packaged E2E behavior           | `.5.3`, `.5.4`                                                  | Playwright/user-visible packaged Electron tests prove VM command execution, health visibility, fail-closed behavior, and project/chat flow.               |
| Production resource and policy hardening     | `.6.1`                                                          | CPU, memory, timeout, output, user, filesystem persistence/write scope, and network policy are documented, enforced, visible, and tested.                 |
| Safe reset and repair                        | `.6.2`                                                          | Reset validates app-owned runtime path shape, refuses Project/symlink/arbitrary paths, handles running/corrupt states, and preserves support diagnostics. |
| Signing, notarization, and entitlements      | `.6.3`                                                          | Signed/notarized artifact starts the helper and reports `macos-vm` health; release fails closed if entitlements or hardened runtime block it.             |
| Future platform adapter boundaries           | `.6.4`                                                          | Windows/Linux targets are documented as future adapters without weakening macOS safety or reclassifying host execution as production.                     |

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

## Task Sign-Off Matrix

This matrix is the final audit surface before implementation continues. Each row states what the
task can independently close, the evidence required to close it, and what must remain open for later
tasks.

| Task     | Independent closure claim                                                                               | Required sign-off evidence                                                                                                                                                                            | Does not claim                                                          |
| -------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `.1`     | Packaged/managed desktop runner selection fails closed by default.                                      | Unit/adapter tests for unset, unknown, disabled, explicit host, explicit Docker, and managed desktop defaults.                                                                                        | Real VM availability, helper implementation, or packaged execution.     |
| `.2`     | Shared health contract can distinguish production, unavailable, disabled, and development-only runners. | Contract tests for disabled, unavailable `macos-vm`, ready `macos-vm`, host, Docker, `production`, and `canExecute`.                                                                                  | UI rendering, packaged health wiring, or real VM readiness.             |
| `.3`     | Architecture decision and native helper command surface exist.                                          | ADR review, Swift helper build/test, deterministic JSON for `prepare`, `start`, `status`, `stop`, and `exec` stubs.                                                                                   | Real boot, command execution, packaging, staging, or release readiness. |
| `.4.1`   | VM asset contract and validation shape are explicit enough for boot work to start.                      | Asset prepare smoke, manifest validation tests, missing asset fail-closed diagnostics, and source/staging documentation.                                                                              | Final boot proof or command execution.                                  |
| `.4.2.1` | Reproducible bootable guest image and `VZLinuxBootLoader` contract are selected and staged.             | Pinned image source/build path, raw image, matching kernel/initrd, manifest/checksums, helper validation, and local/staging/release acquisition docs.                                                 | Successful VM boot or daemon reliability.                               |
| `.4.2.2` | Real image boots and readiness is accurate for successful and failed starts.                            | Local real-boot smoke, missing/invalid/incompatible asset negative smokes, diagnostics, and no stale PID/socket/ready markers after failure.                                                          | Long-running daemon reliability or command execution.                   |
| `.4.2.3` | VM daemon lifecycle is reliable and stale state cannot report ready.                                    | Alive-status smoke, killed-daemon smoke, repeated start/stop smoke, stale PID/socket/ready marker smoke, and deterministic cleanup evidence.                                                          | Guest command execution or workspace isolation.                         |
| `.4.3`   | Commands execute inside the guest through `/workspace` and match `CommandRunner` behavior.              | Harness/native tests and local smokes for cwd mapping, stdout, stderr, exit code, duration, timeout, truncation, non-root user, concurrency, denied failures, and host-path isolation.                | Packaged app behavior or staging gate.                                  |
| `.4.4`   | Local macOS VM runner is proven end to end and parent `.4` can close.                                   | Full quality gate, helper lifecycle proof, harness proof with `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm`, manifest/helper/macOS evidence, and Beads evidence note.                                      | Packaged app, staging, signing, or release readiness.                   |
| `.5.1`   | Packaged artifact contains the helper and pinned VM assets.                                             | Native build, packaged artifact inspection, asset checksum verification, missing asset packaging failure, and app-owned path proof.                                                                   | Packaged startup health or user-visible command E2E.                    |
| `.5.2`   | Packaged app starts with app-owned `macos-vm` paths and accurate health.                                | Desktop/path tests, packaged smoke for health visibility, missing helper/assets fail-closed smoke, and no developer-only env dependency.                                                              | Successful user command E2E or staging gate.                            |
| `.5.3`   | Packaged Electron user flows prove VM command behavior and no project/chat regression.                  | Playwright packaged E2E for `/workspace` output, host-path isolation, unavailable fail-closed behavior, runner health visibility, normal project/chat flow, traces, logs, screenshots, and artifacts. | GitHub staging enforcement.                                             |
| `.5.4`   | Staging cannot pass without packaged macOS VM E2E evidence.                                             | Staging GitHub Actions job, production-like env, pinned asset manifest/log evidence, full quality gate, and proof host/Docker cannot satisfy the gate.                                                | Signed/notarized release readiness.                                     |
| `.6.1`   | Production resource, filesystem, user, timeout, output, and network policy are enforced.                | Unit/native/VM command tests for CPU, memory, timeout, truncation, non-root user, filesystem write scope/persistence, network policy, and diagnostics visibility.                                     | Reset/repair or signing/notarization behavior.                          |
| `.6.2`   | VM reset/repair is user-safe and path-safe.                                                             | Runtime path validation tests, symlink/arbitrary path/Project folder refusal tests, running/stopped/corrupt runtime tests, packaged repair smoke, and support diagnostic preservation.                | Signing/notarization or future platform plan.                           |
| `.6.3`   | Signed/notarized artifact can start and use the VM helper or fail closed.                               | Signing/notarization workflow, entitlement inspection, signed artifact smoke, helper execution logs, `macos-vm` health, and failure behavior for signing/quarantine/hardened runtime issues.          | Windows/Linux adapter design or epic closure.                           |
| `.6.4`   | Epic is ready to close with future platform boundaries documented.                                      | Docs lint, Windows/Linux adapter review, Beads audit, traceability audit from every epic requirement to closed evidence, and final local/staging/release sign-off.                                    | Any unresolved macOS production release work.                           |

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
