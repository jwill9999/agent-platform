# ADR-0003: macOS production command sandbox runner

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Jason Williams (owner)
- **Related:**
  - Epic `agent-platform-macos-production-sandbox`
  - Task `agent-platform-macos-production-sandbox.3`
  - [ADR-0002: Electron desktop runtime for local Project access](0002-electron-desktop-runtime.md)
  - [macOS production sandbox runner plan](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md)

## Context

The desktop application must run user Project commands without relying on end-user Docker
installation or host shell fallback. Staging must exercise the same execution path intended for
production before anything merges to `main`.

The current Electron runtime gives the app trusted access to selected local Project folders, but it
does not by itself isolate command execution. Host execution gives commands direct access to the
user system. Docker is useful during development, but a packaged desktop product cannot assume the
user has Docker installed, running, or configured correctly.

## Decision

We adopt Apple Virtualization.framework as the first production command runner for packaged macOS
builds.

The Electron app starts a native helper process that owns a managed Linux VM lifecycle. The harness
continues to call the shared `CommandRunner` interface. The macOS VM runner implements that
interface by sending approved commands to the guest and returning structured health and execution
results.

Production macOS builds use `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm`. If the VM runner is missing,
unhealthy, or unavailable, command execution fails closed. Host and Docker runners remain explicit
development modes only.

### Guest boundary

- Mount only approved Project folders into the guest at `/workspace`.
- Keep app data, credentials, Electron runtime files, and backend state outside the guest mount.
- Run commands as a non-root guest user.
- Enforce command timeout, output limit, CPU, memory, process, and network policy.
- Return structured health and execution results to the backend.
- Make staging prove `macos-vm` runner health and packaged command execution before release.

### Alternatives considered

- **Host execution** — rejected for production because commands run directly on the user system.
- **Docker** — retained for development and adapter testing, but rejected as the product guarantee
  because end users may not have Docker installed or running.
- **Remote execution** — rejected for the first release because command execution must remain local.
- **macOS App Sandbox alone** — rejected because it protects the app process but does not provide a
  Linux-like command execution environment or dependency isolation for Project tooling.

## Consequences

### Positive

- Packaged macOS command execution has a production isolation boundary that does not depend on user
  Docker setup.
- The harness `CommandRunner` boundary stays shared across local, staging, and production
  environments.
- Staging can assert a concrete runner mode and health state instead of inferring safety from
  environment strings.
- Windows and Linux can add equivalent runner adapters later without changing the harness contract.

### Negative / risks

- The product must package, bootstrap, update, and test a local VM runtime.
- Apple Virtualization.framework makes the first production runner macOS-specific.
- Release engineering must include VM image handling, signing/notarization, helper packaging, and
  packaged Electron E2E coverage.
- Resource use, VM boot latency, and guest image updates become product concerns.

### Follow-up actions

- [ ] Implement the native VM helper skeleton — beads `agent-platform-macos-production-sandbox.3`.
- [ ] Implement VM lifecycle and command execution — beads `agent-platform-macos-production-sandbox.4`.
- [ ] Add packaged staging E2E gate — beads `agent-platform-macos-production-sandbox.5`.
- [ ] Add release hardening and future Windows/Linux adapter plan — beads `agent-platform-macos-production-sandbox.6`.

## References

- Task spec: [docs/tasks/agent-platform-macos-production-sandbox.3.md](../tasks/agent-platform-macos-production-sandbox.3.md)
- Epic spec: [docs/tasks/agent-platform-macos-production-sandbox.md](../tasks/agent-platform-macos-production-sandbox.md)
- Desktop runtime docs: [docs/desktop-runtime.md](../desktop-runtime.md)
