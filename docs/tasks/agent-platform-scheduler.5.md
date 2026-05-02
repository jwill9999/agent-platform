# Task: Add notification hooks, end-to-end tests, and epic polish

**Beads id:** `agent-platform-scheduler.5`  
**Parent epic:** `agent-platform-scheduler` - Scheduler and background work

## Summary

Complete the scheduler epic with notification/audit hooks, representative scheduled maintenance jobs, end-to-end coverage, documentation, and manual verification.

## Requirements

- Emit structured notification/audit events for job success, failure, cancellation, and retry exhaustion.
- Provide a local/in-app notification surface or documented event hook for later external channels.
- Add at least one safe representative scheduled maintenance workflow, such as dry-run memory cleanup or runtime-config backup check, if the prior task boundaries support it.
- Add end-to-end coverage for creating/running/inspecting a scheduled job.
- Update docs for scheduler configuration, safety, recovery, and manual testing.
- Confirm no high-risk scheduled action can bypass policy/HITL.

## Implementation Plan

1. Add notification/audit event contracts or reuse existing observability event shapes.
2. Wire runner terminal states into notification hooks.
3. Add representative maintenance job wiring where safe.
4. Add E2E/API integration coverage.
5. Update docs and session handoff with manual test instructions.
6. Run broad quality gates and close the epic.

## Tests And Verification

- E2E or integration test for schedule creation, execution, status inspection, and logs.
- Tests for notification/audit events on success and failure.
- Regression test showing high-risk scheduled targets still require policy/HITL.
- Full affected package quality gates.
- Manual UI test through Settings scheduler page.

## Definition Of Done

- Scheduler jobs are durable, inspectable, controllable, and documented.
- Completion/failure events are visible to users/operators.
- The epic is manually tested and ready to merge.
