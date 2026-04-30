# Task: Add context window and token optimisation

**Beads id:** `agent-platform-context-optimisation`  
**Priority:** P2  
**Related epic:** `agent-platform-memory`

## Summary

Add context window management and token-budget optimisation once the memory foundations are in place. The goal is to compact long sessions deliberately, preserving important task state through short-term memory/session summaries rather than blindly dropping old messages.

## Background

There is older planning in `docs/tasks/agent-platform-psa.md` for context window management. That spec is useful source material, but it is not currently attached to a live Beads issue and predates the current memory epic.

This backlog task keeps the optimisation work visible until the right stage of the memory roadmap.

## Intended Timing

Pick this up after the memory epic has enough foundation to provide structured short-term state, especially:

- `agent-platform-memory.2` short-term working memory artifacts.
- `agent-platform-memory.4` retrieval and prompt memory bundles.

## Requirements

- Define an input context budget per agent/model.
- Track approximate or model-specific input token usage before LLM calls.
- Preserve required context:
  - system/developer instructions
  - latest user request
  - active project/task state
  - pending approvals
  - current working summary
  - high-value recent messages and tool summaries
- Compact or window long conversation history within the budget.
- Prefer structured short-term memory/session summaries over blind truncation.
- Emit trace metadata for context decisions, including included/dropped message counts and estimated tokens.
- Keep behaviour inspectable and test-covered.

## Non-Goals For First Pass

- Perfect model-specific tokenizer support for every provider.
- Aggressive cost optimisation across all prompt inputs.
- Automatic long-term memory creation from every compacted message.

## Tests And Verification

- Unit coverage for token counting and budget enforcement.
- Unit coverage for preserving required context under tight budgets.
- Integration coverage for long chat histories that would otherwise exceed the configured budget.
- Regression coverage proving short conversations are unaffected.

## Definition Of Done

- Long sessions are compacted or windowed within a configured input token budget.
- Important session state survives compaction through structured memory.
- Prompt construction records context-window trace metadata.
- The behaviour is documented and covered by tests.
