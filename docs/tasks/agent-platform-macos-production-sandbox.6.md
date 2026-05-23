# Task: Release hardening and future platform adapter plan

**Beads issue:** `agent-platform-macos-production-sandbox.6`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.6.md`  
**Parent epic:** `agent-platform-macos-production-sandbox` — macOS production sandbox runner

## Summary

Harden the macOS VM runner for release and document how the same `CommandRunner` contract extends later to Windows and Linux.

## Requirements

- Enforce production resource defaults for memory, CPU, timeout, output, process user, and network.
- Add a reset/repair flow for app-owned VM state that never deletes user Project folders.
- Verify signing and notarization preserve helper execution.
- Document Windows and Linux runner adapter targets.
- Keep host execution development-only across all future platforms.

## Implementation Plan

Follow Stage 10 and Stage 11 in the implementation plan:
[Release hardening](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-10-release-hardening) and
[Future platform adapters](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-11-future-platform-adapters).

## Tests And Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm docs:lint`
- `pnpm test`
- `pnpm build`
- `pnpm --filter @agent-platform/desktop native:vm:build`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- `pnpm --filter @agent-platform/desktop test:e2e`
- Manual signed/notarized macOS artifact smoke test.

## Definition Of Done

- VM runner resource and network behavior is documented and enforced.
- App-owned VM reset/repair is safe and tested.
- Signed/notarized packaged app can start and use the helper.
- Future Windows/Linux runner targets are documented without changing the shared command runner contract.
- The epic can be considered production-ready for macOS-first release.
