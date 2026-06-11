# Task: Add runner health/status contract

**Beads issue:** `agent-platform-macos-production-sandbox.2`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.2.md`  
**Parent epic:** `agent-platform-macos-production-sandbox` — macOS production sandbox runner

## Summary

Add a structured runner health contract so the API, desktop UI, E2E tests, and staging workflows can prove whether command execution is disabled, development-only, or production-ready through the macOS VM runner.

## Requirements

- Define runner health/status types in the harness.
- Distinguish `ready`, `unavailable`, and `disabled`.
- Include `mode`, `production`, `canExecute`, and optional detail fields.
- Export the contract from the harness package.
- Add tests for production VM, unavailable VM, disabled, Docker, and host modes.
- Keep the contract serializable and stable for API, desktop UI, packaged E2E, and staging workflow
  assertions.
- Include enough detail to distinguish development-only readiness from production runner readiness.
- Ensure unavailable production runner health cannot be interpreted as executable.

## Implementation Plan

Follow Stage 2 in the implementation plan:
[Add runner health contract](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-2-add-runner-health-contract).

## Tests And Verification

- `pnpm --filter @agent-platform/harness test -- test/commandRunnerHealth.test.ts`
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/harness lint`
- Tests must cover disabled, unknown/unavailable production VM, ready production VM, host, and
  Docker modes.
- Tests must assert `canExecute` and `production` values independently, so host/Docker cannot pass
  as production evidence.

## Definition Of Done

- Runner health is represented by shared harness types.
- Tests can assert a packaged app is using `macos-vm`.
- Host and Docker can be reported as non-production development modes.
- Unavailable production runner is visible as unavailable and cannot execute.
- This task is independently signable with contract tests because later tasks consume the contract
  but do not change its safety semantics without updating this spec.
