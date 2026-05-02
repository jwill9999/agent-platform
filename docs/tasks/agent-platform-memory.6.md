# Task: Add self-learning workflow with review controls and tests

**Beads id:** `agent-platform-memory.6`  
**Parent epic:** `agent-platform-memory` - Memory management and self-learning

## Summary

Add the first limited self-learning loop: generate reviewed learning candidates from observed outcomes and approved corrections.

## Requirements

- Use observability and memory candidate data to propose improvement candidates.
- Start with a narrow objective, such as repeated recoverable workspace/path errors.
- Require human review before creating durable memory, Beads tasks, or policy/prompt changes.
- Include before/after metrics for implemented improvements.
- Avoid autonomous code, policy, or prompt changes.

## Implementation Plan

1. Add self-learning candidate workflow and review states.
2. Integrate the first monitored objective.
3. Allow approved candidates to create memory records or task proposals.
4. Add safety and regression tests.

## Tests And Verification

- Unit tests for monitored-goal evaluation.
- Tests proving candidates remain pending review.
- Integration test for approving a candidate into a durable memory or task proposal.

## Definition Of Done

- A limited self-learning loop works end to end.
- All durable changes remain review-gated.
- The workflow can be expanded to additional objectives later.
