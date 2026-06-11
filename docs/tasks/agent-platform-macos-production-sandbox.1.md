# Task: Correct runner defaults and fail closed

**Beads issue:** `agent-platform-macos-production-sandbox.1`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.1.md`  
**Parent epic:** `agent-platform-macos-production-sandbox` — macOS production sandbox runner

## Summary

Stop treating Docker `auto` mode as a production desktop default. Packaged desktop command execution must fail closed until the macOS VM runner is available, while host and Docker remain explicit development modes.

## Requirements

- Add a disabled command runner mode.
- Default unknown or unset configured runner modes to disabled.
- Make desktop managed backend default to disabled until `macos-vm` exists.
- Keep `host` and `docker-sandbox` available only through explicit environment overrides.
- Update docs so the current Docker PR cannot be read as production sandbox completion.
- Ensure packaged/managed desktop startup cannot infer `host`, `auto`, or `docker-sandbox` from a
  missing variable, unsupported variable, or local developer environment.
- Ensure denied execution returns a clear result/status that downstream UI and E2E tests can assert.

## Implementation Plan

Follow Stage 1 in the implementation plan:
[Correct current PR semantics](../superpowers/plans/2026-05-24-macos-production-sandbox-runner.md#stage-1-correct-current-pr-semantics).

## Tests And Verification

- `pnpm --filter @agent-platform/harness test -- test/commandRunner.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/backendSupervisor.test.ts`
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm docs:lint`
- Tests must cover unset mode, unknown mode, explicit disabled mode, explicit host mode, explicit
  Docker mode, and managed desktop startup defaults.
- Tests must assert no host or Docker execution occurs unless explicitly configured.

Environment evidence:

- Local evidence is sufficient for this task because it changes runner selection policy and desktop
  environment defaults, not real VM execution.
- Tests must assert that production-like desktop defaults are fail-closed and do not select host or
  Docker implicitly.

## Definition Of Done

- Desktop no longer injects `AGENT_PLATFORM_COMMAND_RUNNER=auto` by default.
- Unset/unknown runner mode denies command execution.
- Explicit `host` still works for development tests.
- Documentation states Docker is a development adapter and production must fail closed.
- This task is independently signable with unit/adapter tests because it changes selection policy
  only; it does not claim real VM execution.
