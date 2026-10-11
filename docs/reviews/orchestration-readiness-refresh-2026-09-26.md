# Orchestration readiness refresh — 26 September 2026

## Completion of the bounded assessment

The owner subsequently authorized completing this task without further authorization. The bounded
assessment and independent evidence review are now published for feature integration; the live
implementation pilot remains **blocked**. This section supersedes the initial-refresh status below.
Delivery is supervised assessment, not managed orchestration. Beads `.12` remains in progress pending
prerequisite dispositions and feature integration; no task closure or autonomous acceptance is claimed.

A separately authorized isolated reviewer used the existing Codex account, immutable image and fixed
model-only gateway. [First review](evidence/readiness-skill-review-2026-09-26.json) retains snapshot
hashes and the complete response. It found four issues: stale binding guidance, assessment-versus-runtime
closure ambiguity, missing authoritative run discovery, and a host-specific production Git check.
The first two are corrected in the skills and task documentation. Discovery and executable feasibility
are explicit requirements of the new [standalone readiness gate](../tasks/agent-platform-pilot-zero.17.md),
which directly blocks `.13`. No matching existing repair was found in the canonical Beads inventory;
the broader historical review/notification repair does not own these missing production capabilities.

### Final independent outcome

[Second review](evidence/readiness-skill-review-final-2026-09-26.json), snapshot
`48c651d80e606f18e2457cdda70af6ed374845adf51bab6a33f6a53909dd371c`, returned no actionable
findings in the revised bounded assessment and skills. It did not independently inspect the test logs
or Beads read-back. The coordinator retains the [dependency read-back](evidence/readiness-pilot-dependencies-2026-09-26.json)
and initial test output separately; those are not re-labelled as critic-verified evidence.
Both skill validators, Markdown, local-link and diff checks pass. Whitespace and this result/disposition
section were added after the second snapshot; the reviewed substantive guidance is unchanged.
This is not a schema-conformant execution-contract approval or live pilot acceptance.

### Candidate first task and required path

Recommend a narrowly planned slice of [permission scope coverage](../tasks/agent-platform-harness-baseline-p4.md):
a hard-denied/path-escape action stays denied after approval, with an independent backend no-effect
assertion and one connected UI journey. This is a candidate, not an approved execution plan. `.13`
must reconcile existing coverage and choose the exact remaining scenario, files and test environment.
Required route: approved task → implementing (test artifacts) → task verification → independent task
review → the selected feature evaluation/delivery/finalization coordinators. The current standalone
implementing packet rejects import, and coordinator-dispatched completion rejects authority. These
prevent claiming that this route is executable; status/preview or a review-only run cannot replace it.

### Independent scenario assessment

The critic reasoned through no-run, matching active run, failed lookup, missing entrypoint/import,
stale approval, permitted direct assessment and predecessor failure. Its retained response gives
safe decisions and limitations for all seven. This is independent procedural evaluation with no tools,
not a live agent-to-agent progression test. Runtime behavior remains covered only by the stated
fixtures and prior qualified reviewer probes; live workflow ownership remains unestablished.

### Required pilot gates

`.13` depends directly on `.12`, completed `.16`, and new open `.17`. The new gate retains run
discovery, implementation import, required coordinator completion and selected-host feasibility as
requirements. Desktop host conformance remains failed and is mandatory only if a desktop pilot is
selected. A2A and reusable packaging remain reference options, not work introduced by this assessment.

The current host's fixture Git workaround does not establish production feasibility:
`StandalonePhaseRuntime.create` source verification still invokes `/usr/bin/git`. Verify the actual
host path before launch. An unset database variable is not proof of no run or no broker grant.
This review does not authorize opening an unknown live journal, issuing grants or launching a workflow.

## Boundary and verdict

Owner authorized refreshing the existing readiness task against the merged feature branch.
Assessment owner: `agent-platform-pilot-zero.12`; prerequisite execution-path inventory: `.8`.
Mode: supervised direct assessment, no managed phase launch, model call or runtime repair.

**Verdict: not ready for the implementation pilot.** This is a bounded source/test refresh, not
independent behavioral qualification or completion of the entire readiness task. Existing priorities
remain unchanged. A2A and packaging research remain future discussion context.

Reviewed feature revision: `e54ce1537504954fb0ee875981f46e04910f9157`.
Assessment checkout before edits: `77ba58a0e73ba829f541e174d4184d4f5710f172` on
`task/approved-document-binding`. A comparison of `packages/` and `.agents/` against the fetched
feature branch showed no differences. Later task-branch commits preserve reference/session docs.

## Current capability matrix

| Capability | Evidence | Current disposition |
| --- | --- | --- |
| Planning publication and exact handoff | [Planning skill](../../.agents/skills/feature-planning/SKILL.md) | Written procedure exists; mandates authorized publisher, linked specs/tests, independent critique and approved material |
| Documentation locations | [Documentation skill](../../.agents/skills/documentation/SKILL.md) | Exists; earlier report statements that it was absent are superseded |
| Implementation routing | [Implementation skill](../../.agents/skills/feature-implementation/SKILL.md) | Explicit task selection, authority and orchestration-first assessment; connected agent behavior not established by reading instructions |
| New run versus continuation | [Orchestration skill](../../.agents/skills/orchestration/SKILL.md) | No-run, matching-run and failed-lookup branches defined; no live state lookup or launch performed |
| Approval document integrity | [Integrated repair report](approved-document-binding-implementation.md) | Integrated via PR273; Beads `.16` closed; not a remaining implementation prerequisite |
| Isolated critic | [Qualified reviewer evidence](../workflow-control-supervised-review.md) | Prior bounded reviewer qualification available; not a fresh review of the complete current skill handoff |
| MCP start/resume | [MCP server](../../packages/workflow-control/src/mcpServer.ts) | Only status and resume-preview tools; neither starts execution |
| Implementation output import | [Phase runtime](../../packages/workflow-control/src/phaseRuntime.ts) | Implementing packet explicitly rejects with phase_artifact_import_unavailable |
| Supported standalone phases | [Phase runtime](../../packages/workflow-control/src/phaseRuntime.ts) | Packet path admits task verification/review; other phases reject, subject also to role/evidence authority |
| Coordinator phase completion | [Phase jobs](../../packages/workflow-control/src/phaseJobs.ts) | Coordinator-dispatched completion explicitly rejected; scoped path gap, not proof all coordinator APIs are absent |
| Desktop continuation | [Continuation worker](../../packages/workflow-control/src/continuationWorker.ts) | Direct conformance probe fails with host_resume_unavailable as designed |
| Local continuation and notifications | Focused fixture suites below | Deterministic checks are distinct from live host execution and full pilot acceptance |
| Host prerequisites | Docker info responded, server 29.8.0 | Engine available; does not qualify image, credentials, broker or model connection |

## Safe-check limits

No WORKFLOW_CONTROL_DB was configured in this assessment process. Consequently existing-run state,
leases, broker grants and resume identity were not established. This means **unknown**, not no run.
Do not create a database, adopt a run, assume no broker grants, or launch from this observation.
No independent critic or model call was made, and no credentials were inspected.

The written handoff covers: confirmed no run → creation readiness; matching active run → scoped
resume checks; failed lookup → unknown/blocker; missing entrypoint or unavailable phase → explicit
blocker; stale approval → no execution. These are source-level procedure checks, not a claim that
an agent has followed all cases correctly in a managed workflow.

## Blocker ownership and next bounded work

Live Beads `.12` remains blocked by `.11`, which remains blocked by `.10`. Their independent skill
review/completion obligations are not satisfied merely because their files were merged. Pilot plan
`.13` remains blocked by `.12`; `.16` is closed. No task was closed or reprioritized in this refresh.

Reuse `.8` for the confirmed execution-path limitations and `.12` for handoff qualification, avoiding
duplicate repair tasks. Before a runnable pilot plan, these existing gate owners must resolve or link
bounded proposals for every required path; `.13` must remain blocked while that is incomplete.

Recommended next assessment: determine the supported standalone route through implementation-result
import and coordinator completion, with explicit evidence boundaries. Then scope only the missing
capabilities through the existing planning/review process. Desktop continuation is a separate
host-specific condition: do not make it mandatory for a deliberately standalone pilot, and do not
claim the standalone route solves desktop resumption. The pilot host/path and exact task still need
to be fixed in its reviewed plan. No runtime repair is authorized by this report.

Retain the existing skill qualification obligations. A live review/model run is outside this task's
non-launch test boundary unless its separate scope and environment are established. Documentation
and unit/fixture checks cannot substitute for that evidence.

## Checks performed

- Workflow-control TypeScript build passed.
- Focused Vitest suites: phaseJobs, phaseRuntime, continuationWorker and continuationNotifications;
  **88 passed across four files**, 41.03 seconds. These include fixture credentials/launcher transport,
  not a paid specialist session or end-to-end pilot. [Retained output](evidence/readiness-refresh-tests-2026-09-26.log).
- The first invocation failed 86 fixture setups because the default `/usr/bin/git` requires an Xcode
  license acceptance. Rerunning with the existing absolute WORKFLOW_GIT_BINARY fallback passed;
  no source change or license acceptance was performed. This was an environment issue, not 86 defects.
- Direct `node packages/workflow-control/dist/cli.js host-conformance` returned the expected explicit
  host_resume_unavailable failure. **Desktop progression gate fails**; this is not waived by unit tests.
- Docker information was read successfully; no new container, managed phase or model session launched.
- Report Markdown, local relative references and diff validation passed before publication.

No new runtime source or skill changes. This refresh does not claim independent critique, full skill
behavioral acceptance, complete configured live-state inspection or closure of task `.12`.
