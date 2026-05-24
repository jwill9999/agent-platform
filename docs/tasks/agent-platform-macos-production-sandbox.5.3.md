# Task: Add packaged Electron VM command E2E

**Beads issue:** `agent-platform-macos-production-sandbox.5.3`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.5.3.md`  
**Parent task:** `agent-platform-macos-production-sandbox.5`

## Summary

Add end-to-end tests that exercise the packaged macOS Electron app from the user perspective and
prove command execution runs inside the VM.

## Requirements

- Launch the packaged macOS app in the E2E harness.
- Open a real Project folder through the UI flow.
- Send a chat/tool request that uses `sys_bash`.
- Prove output comes from guest `/workspace`.
- Prove host-only paths and credentials are not visible inside the guest.
- Prove missing/unhealthy VM assets produce a clear fail-closed result.
- Capture enough evidence to debug failures in CI without manual reproduction.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop test:e2e`
- Packaged Electron E2E story: successful `macos-vm` command execution.
- Packaged Electron E2E story: host-path isolation.
- Packaged Electron E2E story: unavailable VM fails closed.

## Definition Of Done

- E2E tests exercise the same packaged app shape a user installs.
- Tests verify visible user behavior, not only internal helper calls.
- Regressions in command execution, runner mode, or fail-closed behavior fail the E2E suite.
