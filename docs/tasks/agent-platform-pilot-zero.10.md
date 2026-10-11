# Task: Create the repository orchestration skill with explicit readiness and blockers

**Beads:** `agent-platform-pilot-zero.10`  
**Parent assessment:** `agent-platform-pilot-zero` (within `agent-platform-multi-agent`)  
**Spec:** `docs/tasks/agent-platform-pilot-zero.10.md`

## Requirements

Create a discoverable orchestration skill referencing canonical runtime/approval rules. Describe actual supported tools, readiness, absent-state versus failed-lookup handling, new-run versus resume, current approval checks, runtime health, evidence and blocker reporting. No automatic authority is granted by skill discovery.

## Allowed boundary

After scoped approval: .agents/skills/orchestration/SKILL.md and only needed companion metadata/references, related skill index, assessment evidence and session. No runtime or credential configuration changes.

## Implementation plan

Use the skill-creator guidance and readiness findings. Name only verified available entrypoints; where creation/import/coordinator support is absent, report a blocker instead of inventing commands or changing the database. Reference canonical policy rather than duplicating it. Keep permitted fallback explicit and record execution-mode decisions.

## Dependency order

Upstream blocking issues: `agent-platform-pilot-zero.skills-gate`.

Downstream blocking issues: `agent-platform-pilot-zero.11`.

Beads is authoritative. Keep these references aligned with actual dependency edges. Any newly
identified required runtime repair must block the pilot plan; an assessment report is not runtime
qualification. During an active managed run all issue mutations and synchronization use the journaled
broker; direct Beads writes apply only outside an active run.

## Tests and verification

Run the skill validator and Markdown/link checks. Exercise read-only examples for new task/no run, existing valid run, failed status lookup, missing runtime, stale approval and blocked progression. Independent behavioral review must use a permitted reviewer path; no live activation for this test.

Reuse the [staged assessment](../reviews/orchestration-staged-assessment.md) and
[field evaluation](../reviews/orchestration-field-evaluation.md). Record limitations and manual
interventions. Static skill validation alone cannot establish behavioral or runtime correctness.
No paid benchmark, live specialist launch or fault injection is authorized by this task's creation.

## Definition of done

Skill is discoverable, references resolve and validation/review show correct start/resume/block outcomes without manual bypass or invented capabilities. Scope-bound source and evidence are pushed with required integration gates; runtime limitations remain visible.

Assessment/skill prerequisites must satisfy their declared completion conditions. Runtime gaps
identified by this assessment need linked proposals and explicit pilot-gate dependencies; they do
not require out-of-scope runtime repair before the assessment can finish with a blocked verdict. Record exact evidence/source, review and checks; preserve findings and
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
