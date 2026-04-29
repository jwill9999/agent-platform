# Task: Implement repository map and code search

**Beads id:** `agent-platform-code-tools.6`  
**Parent epic:** `agent-platform-code-tools` - Structured coding tool pack

## Summary

Implement repository discovery helpers so agents can quickly understand project structure, find relevant files, and search code without overloading context.

## Requirements

- Add repository map generation with ignored directories excluded.
- Add code search helper backed by fast local search.
- Include file counts, key package/app boundaries, and likely test locations.
- Bound output by result count and size.
- Respect workspace/repo path policy.

## Tool Set

```json
{
  "repo_tools": [
    { "name": "repo_map", "riskTier": "low" },
    { "name": "code_search", "riskTier": "low" },
    { "name": "find_related_tests", "riskTier": "low" }
  ]
}
```

## Implementation Plan

1. Define repository map and search contracts.
2. Implement ignore handling for `.git`, `node_modules`, build outputs, coverage, and workspace data.
3. Use `rg` or equivalent fast search for content queries.
4. Return structured results with paths, line numbers, and snippets.
5. Add tests over fixture repositories.

## Dependency Order

| Upstream                      | Downstream                    |
| ----------------------------- | ----------------------------- |
| `agent-platform-code-tools.5` | `agent-platform-code-tools.7` |

Beads dependency: this task depends on `agent-platform-code-tools.5`; `agent-platform-code-tools.7` depends on this task.

## Tests And Verification

- Unit tests for ignored directories and output limits.
- Search tests for literal and regex-like queries.
- Related-test discovery tests for common naming conventions.

## Definition Of Done

- Agents can discover repo structure through typed tools.
- Search results are bounded and useful.
- Ignored/generated directories are excluded.
- Tests cover common discovery workflows.
