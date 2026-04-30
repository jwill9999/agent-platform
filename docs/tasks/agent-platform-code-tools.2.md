# Task: Define coding tool contracts and evidence model

**Beads id:** `agent-platform-code-tools.2`  
**Parent epic:** `agent-platform-code-tools` - Structured coding tool pack

## Summary

Define the contracts for the coding tool pack before implementation. The contract layer should describe inputs, outputs, risk tiers, audit events, and evidence artifacts consumed by critic and Definition-of-Done checks.

Contract reference: [Coding Tool Contracts](../coding-tool-contracts.md).

## Requirements

- Define tool contracts for structured edits, git inspection, test runner, repository map, and code search.
- Define shared evidence artifact schemas.
- Define audit event shape for successful, failed, and denied coding tool calls.
- Define output truncation and artifact storage rules.
- Keep contracts compatible with existing `packages/contracts` patterns.

## Contract Sketch

```json
{
  "coding_evidence": {
    "kind": "edit|git|test|repo_map|search",
    "summary": "human readable summary",
    "artifacts": ["diff", "stdout", "stderr", "file_list", "failure_summary"],
    "riskTier": "zero|low|medium|high|critical",
    "status": "succeeded|failed|denied",
    "sourceTool": "tool name"
  }
}
```

## Implementation Plan

1. Review existing output, tool, and tool execution contracts.
2. Draft Zod schema additions for coding tools and evidence artifacts.
3. Define common result envelope conventions.
4. Document how critic/DoD should consume evidence.
5. Document migration impact before implementation tasks begin.

## Dependency Order

| Upstream                      | Downstream                    |
| ----------------------------- | ----------------------------- |
| `agent-platform-code-tools.1` | `agent-platform-code-tools.3` |

Beads dependency: this task depends on `agent-platform-code-tools.1`; `agent-platform-code-tools.3` depends on this task.

## Tests And Verification

- Contract docs are complete.
- Schema names and payload examples are unambiguous.
- Follow-up implementation tasks can be tested against the examples.

## Definition Of Done

- Tool contract list is documented.
- Evidence artifact shape is documented.
- Risk/audit model is documented.
- No implementation begins before contracts are agreed.

## Outcome

- Contract documentation is defined in `docs/coding-tool-contracts.md`.
- Runtime baseline links to the contract reference.
