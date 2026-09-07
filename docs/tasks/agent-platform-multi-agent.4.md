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

- [x] Maker-checker and approval flows are evidence-backed and machine-valid.
- [x] Intermediate integration gate and Beads close pass.

## Sign-off

**Owner:** Planning-workflow implementation worker  
**Reviewer:** Independent plan critic

## Completion evidence

- Exact implementation head: `04c0a1e`.
- Read-only `feature_planner` and `plan_critic` profiles and validated repository skills separate the
  maker/checker roles without treating prompts as policy.
- Critic reviews bind the immutable contract material digest, planner/critic identities, policy, and
  content-addressed evidence. Approved, corrected, rejected, and focused human-decision shapes are
  machine-valid.
- SQLite migration `2` persists reviews, findings, dispositions, human-decision payloads, and explicit
  evidence-backed human approvals across restart.
- All findings require disposition, the latest review must approve, and any material contract or
  policy change automatically invalidates approval.
- Package build, lint, typecheck, 85 unit tests, one real Docker isolation test, both skill validators,
  format, docs, dependency-cycle, and diff gates pass.
- SonarQube resolves the project but touched-file analysis reports delayed server initialization; the
  mandatory fallback completed with no errors.
