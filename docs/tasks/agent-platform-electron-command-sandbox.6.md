# Task: Sandbox Regression Coverage

**Beads issue:** `agent-platform-electron-command-sandbox.6`  
**Spec file:** `docs/tasks/agent-platform-electron-command-sandbox.6.md`  
**Parent epic:** `agent-platform-electron-command-sandbox` — Command runner and sandbox policy

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-command-sandbox.6.md`

## Summary

Add regression coverage that proves the command boundary works across relevant harness, API, and desktop paths.

## Requirements

- Cover in-root command success, outside-root denial, destructive policy, approval-required flow, audit events, and output bounding.
- Include Project-bound desktop context where possible.
- Verify user-facing output does not leak host absolute paths unnecessarily.
- Keep tests deterministic and provider-key-free.

## Implementation Plan

1. Inventory coverage added in `.2` through `.5`.
2. Add missing integration and E2E coverage at the lowest reliable layer.
3. Extend Electron E2E only where it catches desktop-specific regressions.
4. Document the final sandbox regression suite.

## Tests And Verification

- Focused harness/API tests.
- Relevant Electron or browser Playwright tests if UI/session behavior is affected.
- Root gates before PR closeout.

## Implementation Notes

- Added API integration coverage for a desktop-registered Project session where a write-capable `sys_bash` command requires approval, resumes after approval, writes inside the selected Project root, and streams only canonical `/workspace` paths.
- Documented the command sandbox regression suite in [docs/testing/command-sandbox-regression-suite.md](../testing/command-sandbox-regression-suite.md), including the harness, API, audit, and desktop E2E coverage boundaries.

## Definition Of Done

- [x] Regression suite covers allowed, denied, approval-required, and destructive command paths.
- [x] Project-bound desktop context is covered where command execution uses Project roots.
- [x] Tests do not require cloud model credentials.
- [x] Docs identify the command-sandbox regression suite.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
