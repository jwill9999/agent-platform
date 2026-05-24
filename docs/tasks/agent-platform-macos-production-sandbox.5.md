# Task: Package VM assets and gate staging with packaged E2E

**Beads issue:** `agent-platform-macos-production-sandbox.5`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.5.md`  
**Parent epic:** `agent-platform-macos-production-sandbox` — macOS production sandbox runner

## Summary

Package the native helper and VM assets with the macOS Electron app, then make staging prove packaged command execution through the VM runner before merge to `main`.

## Requirements

- Bundle the Swift helper with the packaged Electron app.
- Bundle or bootstrap the Linux guest image through an app-owned runtime path.
- Validate helper and image availability at app startup.
- Add packaged Electron E2E for successful `sys_bash` execution through `macos-vm`.
- Add packaged Electron E2E proving unavailable VM runner fails closed.
- Update staging workflow so Docker/host testing is not sufficient release evidence.

## Implementation Plan

Follow Stage 8 and Stage 9 in the implementation plan:
[Package the runner with Electron](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-8-package-the-runner-with-electron) and
[Add production-like E2E and staging gate](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-9-add-production-like-e2e-and-staging-gate).

## Tests And Verification

- `pnpm --filter @agent-platform/desktop test:e2e`
- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- Staging GitHub Actions macOS packaged app job.
- Manual packaged app pass on macOS using a real Project folder.

Environment evidence:

- This task is the staging gate. It cannot complete with local-only evidence.
- Staging must run the packaged macOS artifact with production-like environment variables and
  runner defaults.
- E2E must prove runner health reports `macos-vm`, successful command execution happens in
  `/workspace`, host-only paths are not visible, and unavailable VM assets fail closed.

## Definition Of Done

- Packaged macOS artifact includes the VM helper and required runner assets.
- Packaged app reports runner health as `macos-vm` when ready.
- Packaged E2E proves command output comes from `/workspace` inside the guest.
- Packaged E2E proves missing/unhealthy VM runner fails closed.
- Staging cannot pass to `main` with only host or Docker command execution.
