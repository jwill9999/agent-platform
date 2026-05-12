# Task: Host Runner With Project PathJail

**Beads issue:** `agent-platform-electron-command-sandbox.3`  
**Spec file:** `docs/tasks/agent-platform-electron-command-sandbox.3.md`  
**Parent epic:** `agent-platform-electron-command-sandbox` — Command runner and sandbox policy

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-command-sandbox.3.md`

## Summary

Implement the first host command runner for desktop Projects with Project-root PathJail enforcement.

## Requirements

- Default command cwd to the active Project root when a Project-bound session is available.
- Deny cwd or explicit file/path references outside the approved Project root.
- Preserve current Docker `/workspace` behavior where needed while adding host Project support.
- Bound stdout/stderr, timeout, and error shape.
- Treat symlinks and path normalization as part of the enforcement boundary.

## Implementation Plan

1. Reuse existing PathJail behavior where possible.
2. Add host Project root resolution for Project-bound desktop sessions.
3. Implement runner-level cwd/path validation before command execution.
4. Add integration tests for in-root success and outside-root denial.

## Implementation Notes

- Added `createProjectScopedCommandRunner`, a runner wrapper that validates command `cwd` and
  shell-discovered path accesses with `PathJail` before delegating to the host shell runner.
- `/workspace/...` command paths are rewritten to resolved host Project paths before execution,
  preserving existing Docker/canonical workspace behavior while allowing desktop Project roots.
- Outside-root command paths, outside-root cwd values, and symlink escapes return structured
  `PATH_ACCESS_DENIED` results before command execution.
- API chat runtime now passes the Project session `PathJail` into `createSystemToolExecutor`, so
  `sys_bash` is protected at both the tool-dispatch boundary and the command-runner boundary.

## Tests And Verification

- Harness/API focused tests for Project-bound command cwd and PathJail denial.
- Tests for relative paths, absolute host paths, `/workspace` mappings, and symlink escapes.
- Root gates before PR closeout.

## Definition Of Done

- [x] Host runner defaults to the selected Project root.
- [x] Outside-root cwd and path references are denied before execution.
- [x] Denial messages are user-safe and avoid exposing unnecessary host paths.
- [x] Existing browser/Docker command behavior does not regress.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
