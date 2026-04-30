# Task: Add memory contracts, schema, repository, and policy model

**Beads id:** `agent-platform-memory.1`  
**Parent epic:** `agent-platform-memory` - Memory management and self-learning

## Summary

Create the persistence and contract foundation for scoped memory records before any retrieval or self-learning behaviour is added.

## Requirements

- Add shared contracts for memory scopes, kinds, statuses, source metadata, confidence, expiry, and review state.
- Add database schema/repository APIs for creating, reading, updating, deleting, and querying memory records.
- Support at least these scopes: global, project, agent, session.
- Support at least these kinds: fact, preference, decision, procedure, failure_learning, correction, working_note.
- Include policy fields for review status, confidence, source, timestamps, expiry, and redaction/safety state.
- Do not add automatic prompt retrieval in this task.

## Implementation Plan

1. Add Zod contracts and exported TypeScript types.
2. Add DB migration/schema and repository methods.
3. Add validation and secret-safe serialization tests.
4. Document the memory record model.

## Tests And Verification

- Contract round-trip tests.
- DB repository create/read/update/delete/query tests.
- Secret/redaction safety tests for stored source metadata.
- Typecheck, lint, format, and relevant package tests.

## Definition Of Done

- Memory records can be persisted and queried by scope/kind/status.
- Contracts are shared across packages.
- No memory is injected into prompts yet.
- Tests and docs cover the policy model.
