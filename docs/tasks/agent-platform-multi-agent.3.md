# Task: Build workflow-control persistence and recovery

**Beads issue:** `agent-platform-multi-agent.3`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Create `packages/workflow-control` with durable state, fenced ownership, brokered Beads/Dolt writes,
artifacts, waits, and crash reconciliation.

## Requirements

- Add SQLite schema/migrations for contracts, runs, transitions, leases, attempts, waits, findings,
  external effects, and evidence metadata.
- Implement CAS versions, fencing tokens, prepared/committed sagas, and idempotency keys.
- Make a journaled broker the only official Beads MCP writer; broker Dolt synchronization.
- Reconcile Beads-authoritative lifecycle and every partial failure ordering.
- Store content-addressed artifacts outside Git under the ADR-0004 path.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.2`.
- **Downstream:** `agent-platform-multi-agent.4`.
- **Branch parent:** `task/agent-platform-multi-agent.2`.

## Implementation plan

1. Scaffold package, schema, migrations, library, CLI, and stdio MCP entry point.
2. Implement leases, transition journal, waits, and reconciliation engine.
3. Implement the single Beads/Dolt broker and authoritative-state comparison.
4. Add fault-injection harnesses around every local/external write boundary.

## Tests and verification

- Crash before/after SQLite, Beads, Dolt, and artifact operations without duplicate effects.
- Fence stale owners; reconcile open/closed mismatches and ambiguous sync outcomes.
- Run build, typecheck, lint, format, package/integration tests, and Sonar analysis.

## Definition of done

- [ ] Restart/reconciliation tests pass for every external boundary.
- [ ] No direct active-run Beads/Dolt write path remains.
- [ ] Intermediate integration gate and brokered close pass.

## Sign-off

**Owner:** Workflow-control implementation worker  
**Reviewer:** Persistence/recovery reviewer
