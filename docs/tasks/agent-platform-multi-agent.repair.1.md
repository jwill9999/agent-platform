# Task: Authorize both protected delivery boundaries

**Beads issue:** `agent-platform-multi-agent.repair.1`
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Repair the delivery contract and broker mismatch found by the autonomous pilot so the final task-tip
pull request and the cumulative feature-to-`staging` pull request are separately, immutably, and
least-privilege authorized.

## Requirements

- Preserve parsing and denial behavior for stored version-1 execution contracts.
- Represent the task-tip-to-feature and feature-to-`staging` boundaries with exact repository, base,
  head ref, merge method, protection digest, and applicable required-check set.
- Keep squash-only merging, forbid administrative bypass, and reject cross-boundary replay.
- Add focused positive and negative tests for both boundaries and stale or swapped authority.
- Update the pilot report with machine-valid contracts and freshly derived material digests.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.9`; discovered during
  `agent-platform-multi-agent.10` verification.
- **Downstream:** `agent-platform-multi-agent.10` delivery and closeout.
- **Branch parent:** `task/agent-platform-multi-agent.10`.

## Implementation plan

1. Select the smallest schema-compatible design that keeps stored v1 contracts valid.
2. Implement exact boundary authorization and fail-closed broker validation.
3. Add regression tests for correct, stale, and cross-boundary requests.
4. Recompute the pilot material digest and obtain independent critic review.

## Tests and verification

- Focused workflow-control contract and delivery-broker tests.
- Package build, typecheck, lint, and tests.
- Repository format, documentation, dependency-cycle, typecheck, lint, build, and test gates.
- Independent critic review against the exact corrected head and contract digest.

## Definition of done

- [x] Both pull-request boundaries are independently and exactly authorized.
- [x] Stored version-1 contracts continue to parse and retain their original behavior.
- [x] Cross-boundary and stale-authority requests fail closed in focused tests.
- [x] Pilot report and approval material match the implemented schema.

## Sign-off

**Owner:** Workflow-control repair worker
**Reviewer:** Independent delivery-contract critic
