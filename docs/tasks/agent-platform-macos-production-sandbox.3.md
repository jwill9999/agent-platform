# Task: Record ADR and add native VM helper skeleton

**Beads issue:** `agent-platform-macos-production-sandbox.3`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.3.md`  
**Parent epic:** `agent-platform-macos-production-sandbox` — macOS production sandbox runner

## Summary

Record the macOS production runner decision and add the native Swift helper skeleton that will own Apple Virtualization.framework integration.

## Requirements

- Create an ADR for the macOS VM-backed production command runner.
- Add a Swift package under the desktop app for the native VM helper.
- Implement helper commands for `status`, `prepare`, `start`, `stop`, and `exec` as structured JSON stubs.
- Add desktop package scripts to build and test the helper.
- Document that the helper is the production path, while Docker remains development-only.

## Implementation Plan

Follow Stage 3 and Stage 4 in the implementation plan:
[Decide the macOS VM runtime shape](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-3-decide-the-macos-vm-runtime-shape) and
[Build the native macOS VM helper skeleton](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-4-build-the-native-macos-vm-helper-skeleton).

## Tests And Verification

- `pnpm docs:lint`
- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts`

## Definition Of Done

- ADR records Apple Virtualization.framework as the first production runner.
- Swift helper builds locally on macOS.
- Helper emits deterministic JSON status for all skeleton commands.
- Desktop package scripts can build and test the helper.
