# Task: Implement bounded work, review, and test repair loops

**Beads issue:** `agent-platform-multi-agent.6`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Implement structured implementation, verification, review, and evaluator feedback loops with bounded,
evidence-driven repair.

## Requirements

- Refine worker, reviewer, test-runner, QA, and evaluator role contracts.
- Route failures to the correct owner with exact evidence and remaining budget.
- Require a changed hypothesis, implementation, environment, or test condition before retry.
- Escalate once when per-task or per-finding budgets are exhausted.
- Preserve accepted results across cancellation and recovery.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.5`.
- **Downstream:** `agent-platform-multi-agent.7`.
- **Branch parent:** `task/agent-platform-multi-agent.5`.

## Implementation plan

1. Implement typed findings, ownership, retry accounting, and repair dispatch.
2. Connect focused tests, review, evaluation, and Sonar evidence.
3. Add identical-retry detection and escalation reports.
4. Add seeded failure fixtures for each loop.

## Tests and verification

- Repair seeded compile, test, review, security, QA, and evaluator failures.
- Reject repeated identical retries and prove one evidence-backed escalation.
- Run build, typecheck, lint, format, focused/E2E tests, and Sonar analysis.

## Definition of done

- [ ] Every loop is bounded, role-correct, and evidence-driven.
- [ ] Intermediate integration gate and brokered close pass.

## Sign-off

**Owner:** Repair-loop implementation worker  
**Reviewer:** Code reviewer and test evaluator
