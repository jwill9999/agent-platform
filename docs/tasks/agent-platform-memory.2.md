# Task: Add short-term working memory artifacts for runs and tasks

**Beads id:** `agent-platform-memory.2`  
**Parent epic:** `agent-platform-memory` - Memory management and self-learning

## Summary

Add short-term session/run memory artifacts that preserve task continuity without becoming durable long-term memory.

## Requirements

- Capture structured working state for the current session/run:
  - current goal
  - active project/task
  - decisions made
  - important files/tools used
  - relevant tool summaries
  - pending approvals/blockers
  - next expected action
- Keep short-term artifacts scoped to session/run.
- Make the artifacts inspectable for debugging.
- Do not automatically promote short-term memory to long-term memory.

## Implementation Plan

1. Add short-term memory artifact contracts.
2. Store/update artifacts at safe milestones such as tool batches, chat turn completion, and session close.
3. Add prompt/context builder hooks to include the working summary where appropriate.
4. Add tests for long session continuity and resume behaviour.

## Tests And Verification

- Unit tests for artifact creation and update merging.
- Integration tests proving session resume retains the working summary.
- Regression tests proving raw tool output is summarized rather than copied wholesale.

## Definition Of Done

- Current task state survives long sessions and resumes.
- Short-term memory remains session-scoped and inspectable.
- No durable learning happens without a later review workflow.
