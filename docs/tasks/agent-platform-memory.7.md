# Task: Add retention, expiry, cleanup, and cross-scope safety tests

**Beads id:** `agent-platform-memory.7`  
**Parent epic:** `agent-platform-memory` - Memory management and self-learning

## Summary

Complete the memory epic with retention controls, expiry handling, cleanup flows, and cross-scope safety verification.

## Requirements

- Enforce memory expiry and retention policies.
- Add cleanup commands/API paths where appropriate.
- Verify global/project/agent/session scope isolation.
- Add export and clear safety checks.
- Document operational guidance and privacy/security behaviour.

## Implementation Plan

1. Add retention and expiry enforcement.
2. Add cleanup and scope-clear flows.
3. Add comprehensive cross-scope safety tests.
4. Update memory documentation and session handoff.

## Tests And Verification

- Expiry and cleanup unit tests.
- Cross-scope isolation integration tests.
- Export/clear safety tests.
- Broad quality gates before closing the epic.

## Definition Of Done

- Memory retention and cleanup are documented and tested.
- Cross-scope leakage is prevented by tests.
- The memory epic is ready for final PR/merge.
