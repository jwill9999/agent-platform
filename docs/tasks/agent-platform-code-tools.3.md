# Task: Implement structured edit tool

**Beads id:** `agent-platform-code-tools.3`  
**Parent epic:** `agent-platform-code-tools` - Structured coding tool pack

## Summary

Implement a typed structured edit tool for safe code changes. This should be safer and more reviewable than raw shell writes, producing clear diffs and rejecting unsafe path operations.

## Requirements

- Add a structured edit/apply patch tool to the system tool registry.
- Enforce PathJail and workspace/repository path boundaries before edits.
- Support dry-run or preview mode.
- Return changed files, diff summary, and structured evidence.
- Reject binary files, oversized patches, traversal paths, and symlink escapes.
- Audit successful, failed, and denied edits.

## Tool Shape

```json
{
  "name": "apply_patch",
  "riskTier": "medium",
  "requiresApproval": false,
  "input": {
    "patch": "unified diff or structured patch payload",
    "dryRun": true
  },
  "output": {
    "applied": false,
    "changedFiles": [],
    "diffSummary": "",
    "evidenceId": "optional"
  }
}
```

## Implementation Plan

1. Add contracts and system tool definition using the model from task 2.
2. Implement patch validation and path extraction.
3. Enforce PathJail for all touched paths.
4. Apply changes through a deterministic patch engine.
5. Return structured diff/evidence output.
6. Add unit and integration tests for safe and denied edits.

## Dependency Order

| Upstream                      | Downstream                    |
| ----------------------------- | ----------------------------- |
| `agent-platform-code-tools.2` | `agent-platform-code-tools.4` |

Beads dependency: this task depends on `agent-platform-code-tools.2`; `agent-platform-code-tools.4` depends on this task.

## Tests And Verification

- Unit tests for valid patch, dry run, invalid patch, path traversal, symlink escape, oversized patch, and binary-file denial.
- Integration test through tool dispatch.
- Existing full quality gate passes.

## Definition Of Done

- Agents can make bounded structured edits.
- Tool output includes readable diff evidence.
- Unsafe paths are denied before file mutation.
- Audit logs capture edit attempts.
- Tests cover allowed and denied paths.
