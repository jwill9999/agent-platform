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
- Prove the visible UI exposes enough runner health/status for a user or tester to understand why a
  command is running, unavailable, or denied.
- Prove normal non-command project workflows still function with the packaged VM runner configured.
- Use Playwright as the QA harness for user-visible behavior wherever the packaged Electron target
  allows it; helper-only tests are not sufficient for this task.
- Capture enough evidence to debug failures in CI without manual reproduction.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop test:e2e`
- Packaged Electron E2E story: successful `macos-vm` command execution.
- Packaged Electron E2E story: host-path isolation.
- Packaged Electron E2E story: unavailable VM fails closed.
- Packaged Electron E2E story: runner health/status is visible and matches command behavior.
- Packaged Electron E2E story: existing project open/chat flow still works with VM mode enabled.
- Screenshots, traces, logs, and runner manifest artifacts are captured for failures.

## Definition Of Done

- E2E tests exercise the same packaged app shape a user installs.
- Tests verify visible user behavior, not only internal helper calls.
- Regressions in command execution, runner mode, or fail-closed behavior fail the E2E suite.
- User-visible regressions in the project/chat workflow are covered before staging gate work starts.
