# Task: Create the feature implementation skill and route through orchestration

**Beads:** `agent-platform-pilot-zero.11`  
**Parent assessment:** `agent-platform-pilot-zero` (within `agent-platform-multi-agent`)  
**Spec:** `docs/tasks/agent-platform-pilot-zero.11.md`

## Requirements

Create the missing approved-plan-to-implementation entrypoint. Check plan material, critique/approval, task readiness and scope before mutations; select the permitted execution mode. Load the available orchestration skill when applicable. Workers follow the selected mode rather than independently bypassing it.

## Allowed boundary

After scoped approval: .agents/skills/feature-implementation/SKILL.md and needed companion metadata/references, related skill index, assessment evidence and session. No runtime/policy expansion or unrelated product edits.

## Implementation plan

Use the agreed routing rules and planning review. Resolve technical facts from evidence; ask the owner only for material unresolved scope/authority choices. Preserve fresh-start/resume distinction. Report unavailable dependencies or unauthorized manual fallback. Link orchestration guidance rather than copy its implementation procedure.

## Dependency order

Upstream blocking issues: `agent-platform-pilot-zero.10`.

Downstream blocking issues: `agent-platform-pilot-zero.12`.

Beads is authoritative. Keep these references aligned with actual dependency edges. Any newly
identified required runtime repair must block the pilot plan; an assessment report is not runtime
qualification. During an active managed run all issue mutations and synchronization use the journaled
broker; direct Beads writes apply only outside an active run.

## Tests and verification

Validate the skill and links. Read-only behavioral scenarios: approved eligible task, absent/stale approval, missing orchestration dependency, unavailable runtime, explicitly permitted direct task and ambiguous authority. Verify no files/Beads/runtime are mutated before readiness/authority is established.

Reuse the [staged assessment](../reviews/orchestration-staged-assessment.md) and
[field evaluation](../reviews/orchestration-field-evaluation.md). Record limitations and manual
interventions. Static skill validation alone cannot establish behavioral or runtime correctness.
No paid benchmark, live specialist launch or fault injection is authorized by this task's creation.

## Definition of done

Validated discoverable implementation skill hands off to orchestration or explicitly reports a permitted alternative/blocker; no silent direct implementation. Independent permitted review and declared integration checks pass; no runtime activation implied.

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
