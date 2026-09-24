# Task: Review planning and critique skills for an executable handoff

**Beads:** `agent-platform-pilot-zero.9`  
**Parent assessment:** `agent-platform-pilot-zero` (within `agent-platform-multi-agent`)  
**Spec:** `docs/tasks/agent-platform-pilot-zero.9.md`

## Requirements

Assess feature-planning and plan-critique against the workflow contract and pilot requirements: objective, task graph, exact source, permissions, roles, delivery, checks, retry/spend bounds, evidence and approval binding. The owner subsequently authorized updating feature-planning with documentation, verification and handoff requirements. The owner also authorized revising plan-critique to require independent review on both execution routes and describe compliant-launch blockers.

## Allowed boundary

Read .agents/skills/feature-planning, .agents/skills/plan-critique, related contracts/docs and Beads specs. Write feature-planning/SKILL.md, plan-critique/SKILL.md, review evidence, this spec and session handoff within the authorized revision.

## Implementation plan

Trace a representative pilot request through the documented planning outputs and validation interfaces. Record missing inputs, ambiguous instructions, critic-launch constraints and planning-to-execution handoff gaps. Identify any manual supplementation and separately scope needed corrections.

## Dependency order

Upstream blocking issues: None (read-only assessment).

Downstream blocking issues: `agent-platform-pilot-zero.skills-gate`.

Beads is authoritative. Keep these references aligned with actual dependency edges. Any newly
identified required runtime repair must block the pilot plan; an assessment report is not runtime
qualification. During an active managed run all issue mutations and synchronization use the journaled
broker; direct Beads writes apply only outside an active run.

## Tests and verification

Use a synthetic read-only planning example to compare output requirements with the current schema. Do not fabricate a critic approval, run launch or authoritative approval record. Check reference links and document lint.

Reuse the [staged assessment](../reviews/orchestration-staged-assessment.md) and
[field evaluation](../reviews/orchestration-field-evaluation.md). Record limitations and manual
interventions. Static skill validation alone cannot establish behavioral or runtime correctness.
No paid benchmark, live specialist launch or fault injection is authorized by this task's creation.

## Definition of done

Review report names each confirmed gap or explains adequate coverage, with source evidence, impact and proposed bounded correction. Skill/runtime gaps are distinguished; the authorized planning-skill revision is validated; no runtime execution approval is implied.

All upstream tasks and any subsequently recorded required blockers must satisfy their declared
completion conditions. Record exact evidence/source, review and checks; preserve findings and
update the session handoff. Work must be committed and pushed. Follow the repository's intermediate
versus segment-tip integration rules; do not close a segment tip until its required feature merge.

## Git and sign-off

Backlog documentation is published on the existing permission-baseline task branch into the harness
review feature. Before implementation, the scoped review gate must bind the actual task branch chain,
base and feature destination; this spec does not invent a new branch or permit direct main commits.
No staging/production merge is authorized here. Required diagnostics/tests apply if code changes;
documentation-only work requires Markdown, reference and diff validation.

On 24 September the owner authorized review of existing skills, creation of orchestration and
feature-implementation skills, and bounded non-launch validation before joint review. This supersedes
the earlier task-creation-only boundary. The existing task branch and feature destination above apply.
No live pilot, paid calls, runtime repairs, merge or promotion are included. Independent review and
integration remain evidence gates; drafting does not depend on requesting the same approval again.
