# Task: Implement macOS VM lifecycle and command execution

**Beads issue:** `agent-platform-macos-production-sandbox.4`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.md`  
**Parent epic:** `agent-platform-macos-production-sandbox` — macOS production sandbox runner

## Summary

Turn the Swift helper and TypeScript adapter into a working macOS VM command runner that starts a managed Linux guest and executes project commands inside it.

## Requirements

- Add the TypeScript `MacosVmCommandRunner` adapter.
- Implement helper lifecycle commands for runtime directory preparation, VM start, status, and stop.
- Implement command execution inside the guest.
- Mount only the selected Project folder into the guest at `/workspace`.
- Exclude app data, credentials, home directories, and host-only paths from the guest.
- Enforce timeout and output limits from `CommandRunnerRequest`.
- Run commands as a non-root guest user.

## Implementation Plan

Follow Stage 5, Stage 6, and Stage 7 in the implementation plan:
[Add Node adapter for macOS VM helper](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-5-add-node-adapter-for-macos-vm-helper),
[Implement VM lifecycle](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-6-implement-vm-lifecycle), and
[Execute commands inside the VM](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-7-execute-commands-inside-the-vm).

Remaining work is split into child tasks so `.4` is not treated as complete until the real VM
runner is proven:

1. `agent-platform-macos-production-sandbox.4.1` — define and provision the guest image/bootstrap
   contract.
2. `agent-platform-macos-production-sandbox.4.2` — implement the Virtualization.framework VM boot
   lifecycle.
3. `agent-platform-macos-production-sandbox.4.3` — implement guest command execution and
   `/workspace` mounting.
4. `agent-platform-macos-production-sandbox.4.4` — run local proof, record evidence, and close `.4`.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop test -- test/macosVmRunner.test.ts`
- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- Manual local helper smoke: `macos-vm-runner status`
- Manual local helper command execution proving guest `/workspace` path.

Environment evidence:

- Local unit and helper tests are not sufficient on their own for this task.
- Completion requires a real macOS VM smoke test that proves command execution inside `/workspace`
  and proves host-only paths are unavailable from the guest.
- Staging packaged E2E is not required until `.5`, but `.4` must leave the VM runner ready for that
  packaged path.

## Definition Of Done

- `macos-vm` runner can start, report ready health, execute commands, and stop.
- Command output proves execution inside the guest workspace.
- Host-only paths are not visible inside the guest.
- Unavailable runner maps to a denied result and does not fall back to host.
