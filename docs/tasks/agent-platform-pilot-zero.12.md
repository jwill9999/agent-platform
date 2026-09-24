# Task: Qualify the connected skill handoff and reconcile runtime blockers

**Beads:** `agent-platform-pilot-zero.12`  
**Parent assessment:** `agent-platform-pilot-zero` (within `agent-platform-multi-agent`)  
**Spec:** `docs/tasks/agent-platform-pilot-zero.12.md`

## Requirements

Assess planning, critique, implementation and orchestration as a connected procedure against actual runtime interfaces. This task validates readiness and scopes missing repairs; it is not an umbrella authorization to repair the runtime.

## Allowed boundary

Read relevant skills/runtime/configuration; write bounded isolated test artifacts, readiness evidence, scoped repair specs and session. No credentials, live model calls or managed phase launch without separate explicit scope.

## Implementation plan

Run safe preflight and isolated behavioral checks permitted by the gate. Verify effective start/resume availability, result import, coordinator completion, approvals, notification and evidence retrieval. For any required runtime gap, reuse an existing open repair or create a bounded linked proposal. Add unresolved prerequisite repair/gate dependencies to the first-pilot plan before declaring readiness.

## Dependency order

Upstream blocking issues: `agent-platform-pilot-zero.11`.

Downstream blocking issues: `agent-platform-pilot-zero.13`.

Beads is authoritative. Keep these references aligned with actual dependency edges. Any newly
identified required runtime repair must block the pilot plan; an assessment report is not runtime
qualification. During an active managed run all issue mutations and synchronization use the journaled
broker; direct Beads writes apply only outside an active run.

## Tests and verification

Cover no run, existing run, failed lookup, missing entrypoint, stale scope, unavailable phase and truthful blocker reporting. Preserve fixture boundaries; dry-run success is not live conformance. Review actual blockers against current source rather than historical labels.

Reuse the [staged assessment](../reviews/orchestration-staged-assessment.md) and
[field evaluation](../reviews/orchestration-field-evaluation.md). Record limitations and manual
interventions. Static skill validation alone cannot establish behavioral or runtime correctness.
No paid benchmark, live specialist launch or fault injection is authorized by this task's creation.

## Definition of done

Published readiness verdict with supported/blocked/not-exercised capabilities and evidence. Every blocker necessary for the first pilot is linked and enforced as an additional dependency of its plan/launch gate. Assessment may finish with a blocked verdict; that must not make a runnable pilot appear ready.

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
