# Task: Destructive Command Policy

**Beads issue:** `agent-platform-electron-command-sandbox.5`  
**Spec file:** `docs/tasks/agent-platform-electron-command-sandbox.5.md`  
**Parent epic:** `agent-platform-electron-command-sandbox` — Command runner and sandbox policy

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-command-sandbox.5.md`

## Summary

Define and enforce first-release policy for destructive or risky shell commands.

## Requirements

- Classify safe read-only commands, approval-required writes, and blocked destructive commands.
- Cover obvious destructive patterns: recursive removals, disk/permission changes, shell redirection, chained scripts, package manager lifecycle hooks, and commands targeting outside-root paths.
- Keep the policy conservative and easy to extend.
- Provide clear policy reasons in denial or approval prompts.

## Implementation Plan

1. Extract command classification rules from existing shell guardrails where useful.
2. Add policy functions with focused unit tests.
3. Integrate policy decisions with the `CommandRunner` and approval path.
4. Document known limitations and future hardening needs.

## Tests And Verification

- Unit tests for read-only, approval-required, and blocked commands.
- Integration tests for denied destructive commands and approved safe writes.
- Root gates before PR closeout.

## Definition Of Done

- [ ] Destructive commands are blocked or approval-gated before execution.
- [ ] Safe read-only commands remain usable.
- [ ] Policy reasons are visible in bounded audit/approval output.
- [ ] Tests cover command chaining, removals, writes, package/script execution, and outside-root targeting.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
