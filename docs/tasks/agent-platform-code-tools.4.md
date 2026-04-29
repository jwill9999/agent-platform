# Task: Implement read-only git tools

**Beads id:** `agent-platform-code-tools.4`  
**Parent epic:** `agent-platform-code-tools` - Structured coding tool pack

## Summary

Implement low-risk typed git inspection tools so agents can reason about repository state without using mutating shell commands.

## Requirements

- Add read-only tools for status, diff, log, branch info, and changed files.
- Prevent mutation commands in this task.
- Bound output sizes and summarize large diffs.
- Scope commands to the configured repository/workspace.
- Return structured evidence for critic/DoD.

## Tool Set

```json
{
  "git_tools": [
    { "name": "git_status", "riskTier": "low" },
    { "name": "git_diff", "riskTier": "low" },
    { "name": "git_log", "riskTier": "low" },
    { "name": "git_branch_info", "riskTier": "low" },
    { "name": "git_changed_files", "riskTier": "low" }
  ]
}
```

## Implementation Plan

1. Add tool contracts and system tool definitions.
2. Implement git command wrappers using non-interactive flags.
3. Validate working directory is within the approved repo/workspace.
4. Normalize outputs into structured JSON.
5. Add output truncation and diff summary behavior.
6. Add tests with a temporary git repository.

## Dependency Order

| Upstream                      | Downstream                    |
| ----------------------------- | ----------------------------- |
| `agent-platform-code-tools.3` | `agent-platform-code-tools.5` |

Beads dependency: this task depends on `agent-platform-code-tools.3`; `agent-platform-code-tools.5` depends on this task.

## Tests And Verification

- Temporary-repo tests for clean/dirty status, staged/unstaged files, branch info, and log.
- Diff truncation test.
- Denial test for non-repo or outside-workspace paths.

## Definition Of Done

- Read-only git inspection is available as typed tools.
- No git mutation is possible through these tools.
- Outputs are structured and bounded.
- Tests cover normal and edge states.
