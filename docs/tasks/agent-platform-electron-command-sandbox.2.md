# Task: Define CommandRunner Interface

**Beads issue:** `agent-platform-electron-command-sandbox.2`  
**Spec file:** `docs/tasks/agent-platform-electron-command-sandbox.2.md`  
**Parent epic:** `agent-platform-electron-command-sandbox` — Command runner and sandbox policy

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-command-sandbox.2.md`

## Summary

Add a typed, swappable command execution boundary before changing host command behavior.

## Requirements

- Define a `CommandRunner` contract with command, cwd, env policy, timeout, output bounds, workspace metadata, and audit metadata.
- Return structured success, failure, denied, and approval-required results.
- Keep the interface independent of Electron so Docker, VM, macOS sandbox, or remote runners can replace it later.
- Adapt current shell execution through the interface with no unexpected behavior change.

## Implementation Plan

1. Add the interface near the harness/tool execution boundary.
2. Add a default adapter for current shell execution.
3. Wire `sys_bash` toward the interface behind existing approvals and guardrails.
4. Add unit tests for result shapes and adapter behavior.

## Tests And Verification

- Focused harness tests for the new interface and current shell adapter.
- `pnpm --filter @agent-platform/harness typecheck`
- `pnpm --filter @agent-platform/harness lint`
- `pnpm --filter @agent-platform/harness test -- <focused tests>`
- Root gates before PR closeout.

## Definition Of Done

- [ ] `CommandRunner` is typed and exported from the appropriate harness boundary.
- [ ] Existing `sys_bash` behavior is adapted through the interface without broad behavior changes.
- [ ] Result shapes cover success, command failure, denied, and approval-required outcomes.
- [ ] Tests prove the interface can be swapped without changing chat/harness call sites.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
