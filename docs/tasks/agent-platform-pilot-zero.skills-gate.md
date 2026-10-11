# Task: Review prerequisite findings and approve bounded skill implementation

**Beads:** `agent-platform-pilot-zero.skills-gate`  
**Parent assessment:** `agent-platform-pilot-zero` (within `agent-platform-multi-agent`)  
**Spec:** `docs/tasks/agent-platform-pilot-zero.skills-gate.md`

## Requirements

Owner reviews readiness and planning-skill findings, proposed routing rules and exact skill implementation boundaries. Record what is approved, deferred or requires a separate repair. Task creation and a green planning check do not approve implementation.

## Allowed boundary

Review the two assessment reports, proposed skill specs and source/task references. Record the owner decision and exact scope in Beads and review evidence.

## Implementation plan

Present concrete scope for the orchestration and feature-implementation skills, their interfaces, allowed paths, validation and branch/delivery boundary. Resolve material routing/fallback authority questions. Identify runtime repairs separately and assign their own approval/dependency boundaries.

## Dependency order

Upstream blocking issues: `agent-platform-pilot-zero.8`, `agent-platform-pilot-zero.9`.

Downstream blocking issues: `agent-platform-pilot-zero.10`.

Beads is authoritative. Keep these references aligned with actual dependency edges. Any newly
identified required runtime repair must block the pilot plan; an assessment report is not runtime
qualification. During an active managed run all issue mutations and synchronization use the journaled
broker; direct Beads writes apply only outside an active run.

## Tests and verification

Confirm decision corresponds to the reviewed material; no unresolved authority choice is silently assumed. Verify dependencies and evidence links. Do not close this gate without the actual scoped owner decision.

Reuse the [staged assessment](../reviews/orchestration-staged-assessment.md) and
[field evaluation](../reviews/orchestration-field-evaluation.md). Record limitations and manual
interventions. Static skill validation alone cannot establish behavioral or runtime correctness.
No paid benchmark, live specialist launch or fault injection is authorized by this task's creation.

## Definition of done

Recorded owner approval identifies exact skill scope, permitted validation, unresolved/deferred runtime work and integration boundary. Approval does not start a live run, grant paid-model spend, broaden permissions or authorize staging/production.

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
