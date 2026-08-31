# Task: Define execution contract and normative workflow state machine

**Beads issue:** `agent-platform-multi-agent.1`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Implement the versioned contracts that make an approved feature plan and every workflow transition
machine-valid before privileged orchestration code is introduced.

## Requirements

- Add schemas for execution contracts, roles/capabilities, task packets/results, findings, evidence
  references, retry budgets, waits, cancellation, recovery targets, repair children, and finalization.
- Encode the normative state table and invariants from the epic.
- Reject authority expansion, stale policy/contract versions, invalid recovery targets, and ambiguous
  retry accounting.
- Keep the package independent from GitHub and Beads adapters.

## Dependency order

- **Upstream:** None.
- **Downstream:** `agent-platform-multi-agent.2`.
- **Branch parent:** `feature/multi-agent-orchestration`.

## Implementation plan

1. Select the package/module ownership and define exported Zod schemas and TypeScript types.
2. Implement pure transition validation and policy-digest/version checks.
3. Add fixtures for valid, invalid, cancelled, waiting, repair, recovery, and finalizing runs.
4. Document schema/version migration rules.

## Tests and verification

- Focused unit tests for every state edge and invalid transition.
- Property/table tests for authority monotonicity, retry counts, wait deadlines, and recovery targets.
- Run build, typecheck, lint, format, package tests, and Sonar analysis for touched code.

## Definition of done

- [x] Acceptance criteria and requirements pass.
- [x] Exact-head review and tests pass; branch is pushed through the approved Git/ref path.
- [x] Intermediate-task integration gate passes; no segment-tip PR is required.
- [x] Brokered Beads close is verified before `.2` becomes ready.

## Sign-off

**Owner:** Implementation worker  
**Reviewer:** Code reviewer and workflow-contract evaluator

## Completion evidence

- Exact implementation head: `5f5587e`.
- Package build, lint, typecheck, and 32 focused tests pass.
- Every ordinary state edge and absent edge is table-tested; cancellation, waits, fencing, retry,
  recovery, repair-child, authority, idempotency, and finalization failures have focused coverage.
- Dependency-cycle, Prettier, documentation-link, and diff checks pass.
- SonarQube MCP was attempted twice but reported delayed server initialization; the mandatory fallback
  lint, typecheck, tests, build, and static dependency checks passed with no errors.
