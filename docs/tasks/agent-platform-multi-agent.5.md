# Task: Implement orchestrator and Beads scheduler

**Beads issue:** `agent-platform-multi-agent.5`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Implement the single-writer orchestrator that schedules Beads-ready tasks and manages isolated role,
branch, acceptance, and close lifecycles.

## Requirements

- Schedule only tasks whose Beads blocking dependencies are closed.
- Serialize pilot writes while allowing at most four isolated read-only/verification specialists.
- Acquire fenced leases, issue bounded work packets, collect results, and enforce assigned paths.
- Close intermediate tasks through the broker after exact-head acceptance/integration gates.
- Prevent any second workflow-state or Beads writer.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.4`.
- **Downstream:** `agent-platform-multi-agent.6`.
- **Branch parent:** `task/agent-platform-multi-agent.4`.

## Implementation plan

1. Implement ready-task selection, leases, queues, and concurrency accounting.
2. Connect the isolated launcher and result contract.
3. Implement task acceptance, integration-gate, brokered close, and dependent readiness flow.
4. Add cancellation, timeout, escalation, and restart paths.

## Tests and verification

- Reject blocked/overlapping tasks and a second orchestrator.
- Prove downstream readiness only after authoritative upstream close.
- Exercise cancellation, timeout, stale leases, and bounded concurrency.
- Run build, typecheck, lint, format, integration tests, and Sonar analysis.

## Definition of done

- [x] Scheduler behavior matches Beads and the normative state machine.
- [x] Intermediate integration gate and brokered close pass.

## Completion evidence

- Persists scheduler intent before the authoritative Beads claim, admits only dependency-ready work,
  and enforces one mutating specialist or at most four isolated read-only specialists.
- Launches specialists through a create-then-start Docker boundary with deadline cancellation,
  durable restart reconciliation, and fail-closed result release.
- Uses a generation-pinned, revoke-wins credential protocol with broker-owned TTL cleanup, durable
  CAS transitions, and legacy active-lease quarantine.
- Requires a clean, stable exact-head integration gate against an immutable base SHA before the
  broker may close the Beads task.
- Independent critic review completed with no actionable findings after remediation.
- Package build, typecheck, lint, 112 unit/integration tests, the real Docker isolation test,
  documentation lint, dependency-cycle check, formatting, and diff checks pass.

## Sign-off

**Owner:** Orchestration implementation worker  
**Reviewer:** Concurrency/state reviewer
