# Task: Add retrieval and prompt memory bundles with source metadata

**Beads id:** `agent-platform-memory.4`  
**Parent epic:** `agent-platform-memory` - Memory management and self-learning

## Summary

Retrieve approved, relevant memories into prompt bundles with source metadata and conservative ranking.

## Requirements

- Retrieve memories by scope, kind, relevance, confidence, status, and expiry.
- Keep retrieval conservative and source-linked.
- Build prompt memory bundles that distinguish fact, preference, procedure, decision, and failure-learning memories.
- Add trace metadata for retrieved and omitted memory counts.
- Avoid retrieving pending, expired, low-confidence, or cross-scope memories.

## Implementation Plan

1. Add memory retrieval service and ranking filters. **Done.**
2. Add prompt bundle formatting. **Done.**
3. Integrate retrieval into prompt/context construction behind a feature-safe policy. **Done.**
4. Add observability trace events for memory retrieval decisions. **Done.**

## Tests And Verification

- Unit tests for scope and status filtering.
- Unit tests for ranking and expiry.
- Integration tests proving prompt bundles include relevant approved memory only.
- Security tests for cross-project/session isolation.

## Definition Of Done

- Approved memories can inform prompts with clear source metadata.
- Retrieval is conservative, test-covered, and traceable.
- Stale or unsafe memory is excluded.

## Implementation Notes

- Retrieval is bounded to global, current session, current agent, and explicitly known current project scope.
- Only approved/reviewed memories are eligible; pending candidates remain review-only.
- Prompt bundles include source metadata and are appended after short-term working memory in the system prompt.
- A `memory_retrieval` trace event records included and omitted counts.
