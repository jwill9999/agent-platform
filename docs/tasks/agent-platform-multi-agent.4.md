# Task: Implement planning, critic, and approval gate

**Beads issue:** `agent-platform-multi-agent.4`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Implement the planning interview, independent critique, execution-contract validation, and human
approval/version invalidation workflow.

## Requirements

- Add/refine project agent definitions and planning/critic skills without treating prompts as policy.
- Produce and validate the `.1` execution contract from repository evidence and Beads reads.
- Record every critic finding and disposition.
- Require explicit human approval and invalidate it on material scope, authority, destination, or
  policy change.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.3`.
- **Downstream:** `agent-platform-multi-agent.5`.
- **Branch parent:** `task/agent-platform-multi-agent.3`.

## Implementation plan

1. Add planner/critic role configuration, work packets, rubrics, and structured results.
2. Implement contract drafting, validation, finding resolution, and approval persistence.
3. Add policy-digest/version invalidation and focused human-decision output.
4. Seed critic omissions for deterministic verification.

## Tests and verification

- Validate approved, corrected, rejected, and human-decision flows.
- Prove material changes invalidate approval and read-only roles cannot mutate state.
- Run documentation, build, typecheck, lint, format, focused tests, and Sonar gates.

## Definition of done

- [ ] Maker-checker and approval flows are evidence-backed and machine-valid.
- [ ] Intermediate integration gate and brokered Beads close pass.

## Sign-off

**Owner:** Planning-workflow implementation worker  
**Reviewer:** Independent plan critic
