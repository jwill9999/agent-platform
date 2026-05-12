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

## Tests And Verification

- Harness/API focused tests for Project-bound command cwd and PathJail denial.
- Tests for relative paths, absolute host paths, `/workspace` mappings, and symlink escapes.
- Root gates before PR closeout.

## Definition Of Done

- [ ] Host runner defaults to the selected Project root.
- [ ] Outside-root cwd and path references are denied before execution.
- [ ] Denial messages are user-safe and avoid exposing unnecessary host paths.
- [ ] Existing browser/Docker command behavior does not regress.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
