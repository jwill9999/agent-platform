# Build workflow-control before default package tests

Beads: `agent-platform-pilot-zero.1`  
Parent: `agent-platform-pilot-zero`

## Requirements

The default package test command must build current source before running Vitest because process
tests execute `dist/cli.js`. A stale local compiled CLI caused one runtime assertion to fail even
though the current source implemented the expected command. Rebuilding resolved that failure.

## Implementation plan

Change only the package test script to `pnpm build && vitest run`, matching the build-first ordering
already used by the targeted progression/runtime test scripts. Failed builds must prevent tests.
Do not change runtime authority, credentials, application behavior or test assertions.

## Dependency order

Supervised repair identified during pilot-zero assessment; no implementation dependency is required.
Task branch starts from `task/pilot-zero-assessment`; cumulative delivery targets
`feature/pilot-zero-assessment`. No staging/main merge is authorized by this task.

## Tests and definition of done

Run the default package test and verify build precedes Vitest and the package suite passes.
Run typecheck, lint, formatting and relative-link validation. Obtain independent review of the
single script change. Push the exact candidate and require hosted checks and segment-tip integration
before closing the task. The opt-in real isolation test is separate from the ordinary package suite.
No UI behavior changes: browser/Electron tests are not a substitute for this CLI regression.

This fixes test reproducibility only; it does not establish isolated model authentication or
autonomous runtime acceptance. Track those separately under the parent assessment.

## Sign-off

Owner: Jason Williams. Supervised bootstrap reviewer: pilot_zero_critic (Astra).
Pre-change review supported build-first ordering; final candidate review and checks remain required.
