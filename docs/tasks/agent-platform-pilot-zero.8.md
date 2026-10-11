# Task: Assess the supported single-task orchestration execution path

**Beads:** `agent-platform-pilot-zero.8`  
**Parent assessment:** `agent-platform-pilot-zero` (within `agent-platform-multi-agent`)  
**Spec:** `docs/tasks/agent-platform-pilot-zero.8.md`

## Requirements

Read-only inventory of the actual start/resume entrypoint, persisted state and approval, isolation/model access, implementation output import, phase coordination, acceptance and delivery. Distinguish supported, unverified and unavailable capabilities. Revalidate source-level blockers; do not infer live failure from old notes.

## Allowed boundary

Read relevant workflow-control source, canonical read-only journal, project configuration and pilot records. Write only assessment evidence and session handoff when executing this documentation task.

## Implementation plan

Map one candidate remaining permission scenario to required phases. Inspect current source/configuration and use only non-mutating diagnostics. Identify exact missing capabilities and existing related work. Propose bounded follow-up repairs with evidence; do not issue credentials, launch workers, edit runtime or access secret contents.

## Dependency order

Upstream blocking issues: None (read-only assessment).

Downstream blocking issues: `agent-platform-pilot-zero.skills-gate`.

Beads is authoritative. Keep these references aligned with actual dependency edges. Any newly
identified required runtime repair must block the pilot plan; an assessment report is not runtime
qualification. During an active managed run all issue mutations and synchronization use the journaled
broker; direct Beads writes apply only outside an active run.

## Tests and verification

Check every availability claim against cited current source/configuration or a supported read-only observation. Record failed/unknown status lookup separately from no matching run. Validate report Markdown and links.

Reuse the [staged assessment](../reviews/orchestration-staged-assessment.md) and
[field evaluation](../reviews/orchestration-field-evaluation.md). Record limitations and manual
interventions. Static skill validation alone cannot establish behavioral or runtime correctness.
No paid benchmark, live specialist launch or fault injection is authorized by this task's creation.

## Definition of done

Published capability matrix, candidate first-task recommendation and specific blocker dispositions; observed versus inferred evidence is explicit. Any required runtime repairs have bounded proposals/links. No live readiness or autonomous success claimed without proof.

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
