---
name: feature-planning
description: Draft or revise complete Agent Platform planning material, task specifications, verification strategy and execution contract from owner requirements before implementation approval.
---

# Feature planning

Use the [documentation skill](../documentation/SKILL.md) and its canonical folder guide for artifact
locations, publication responsibility and cross-document consistency.

Produce a complete proposed handoff for implementation. Remain read-only: do not approve the plan or
mutate repository, Beads or workflow state. An authorized coordinator publishes the drafts below.
Planning/publication approval does not authorize application implementation or a live workflow.

## Establish requirements and feasibility

Read [AGENTS.md](../../../AGENTS.md), [shared instructions](../../../docs/agent-instructions-shared.md),
the parent Beads issue and existing child specs, applicable ADRs and the smallest useful source set.
Follow [task documentation rules](../../../docs/tasks/README.md) and the
[task template](../../../docs/tasks/_template.md); reuse existing records rather than duplicate them.

Resolve objective, requirements with stable identifiers, non-goals, testable acceptance criteria,
task dependencies, exact source/branch, allowed paths/actions, roles, delivery destination, quality
gates, retries, spend limits and escalation policy. Ask only for unresolved choices that materially
change scope, behavior, authority, destination or policy. Preserve valid decisions already made.
Before presenting the plan for agreement, review it for unresolved ambiguity, conflicting requirements
and unsupported assumptions. If anything remains unclear after checking available evidence, ask the
human in the loop a focused question explaining the uncertainty and its impact. Record the answer in
the relevant requirements or decision record and update affected tasks and tests. Do not silently
choose an interpretation, treat silence as agreement, or label the plan agreed while questions remain
unresolved. Continue independent drafting where possible; wait for the answer before finalizing the
affected scope. Preserve and reuse answers already provided rather than asking for repeated approval.

Establish test feasibility before promising coverage: Docker/services, supported browser or desktop
host, test data/reset strategy, provider access, credentials availability without reading secrets,
runner requirements and permitted cost. Record missing prerequisites and their owning tasks. Do not
claim implementation readiness when a required verification environment has no feasible provision.

## Task identity and branch naming

Accept the owner's task title, description or external reference as the starting point; they need not
know a Beads ID or Git branch. Search existing Beads records and linked plans before proposing new
work. Resolve the intended feature and task from evidence. If multiple records fit and context does
not distinguish them, ask the human rather than selecting by filename, recency or current checkout.

Keep readable titles alongside stable Beads IDs. For new feature plans propose a descriptive filename
based on the agreed feature name; task specifications retain the required Beads-ID filename. Record
an explicit mapping in the feature manifest: feature/task title, Beads ID, spec path, verification-plan
links, repository/worktree, task branch, parent branch and integration destination. Reuse recorded
branches; proposed names are not evidence that branches exist. Preserve repository chaining rules.
Show this mapping to the owner with the plan so implementation does not have to infer task identity.

## Required planning outputs and locations

Return drafts with explicit intended paths and task links. Use existing feature locations when
present; otherwise propose stable names under the following directories and include them in scope.
The table defines planning outputs, not permission for the read-only planner to write them.

| Output                                     | Location and required content                                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature plan and document manifest         | `docs/planning/`: objective, requirements, exclusions, task/dependency map, decisions, and links to every handoff artifact                                |
| Task specifications                        | `docs/tasks/<issue-id>.md`, using the task template: detailed requirements, implementation boundary, dependencies, tests, definition of done and sign-off |
| Task tracking                              | Beads: parent/children, acceptance criteria and real blocking edges; each description starts with `Spec: docs/tasks/<issue-id>.md`                        |
| Verification plan                          | `docs/testing/`: requirement-to-scenario mapping, environments, expected outcomes, evidence and task/feature completion gates                             |
| Review and verification results            | `docs/reviews/`: critique findings/dispositions and, after execution, actual results linked to the verification plan and tested revision                  |
| Architecture decisions                     | Applicable existing `docs/adr/` or `docs/architecture/` documents; propose changes only when the feature changes architecture                             |
| Execution contract and approval references | Exact artifact location supported by workflow control, identified in the manifest; never invent a persisted approval or storage interface                 |

Beads is authoritative for scheduling; linked specifications carry detailed requirements. Every child
task links to the feature plan and relevant verification scenarios. Keep acceptance criteria and
specification definitions of done aligned. Proposed new tasks remain drafts until publication assigns
real IDs; unresolved placeholders prevent a final handoff. Use a documentation skill if one becomes
available and applicable; until then these linked repository rules remain authoritative.

## Define verification before implementation

For each requirement identify relevant unit, integration and connected end-to-end coverage. Specify
scenario ID, task owner, prerequisites/data, user actions or inputs, expected visible result, backend
state/side effects, assertion method, evidence to retain and local/hosted checks. Use explicit
applicability reasons for omitted layers, not generic promises to run tests.

For user-facing journeys, require Playwright or the appropriate desktop harness against the connected
application and real backend. Check actual persisted state or tool effects independently of UI text.
A mocked frontend response, dispatcher-only test or successful HTTP status alone does not prove the
full journey. Document mocked external providers and exactly which boundaries remain unverified.
Follow the [browser quality gate](../playwright-quality-gate/SKILL.md) where applicable.

Include relevant denied/approved permissions, errors, cancellation, retries, interrupted recovery and
regression cases. Specify safe test fixtures, cleanup and isolation. Require task-level affected
journeys plus a final feature-level integrated check across task boundaries, with an assigned task
and dependency gate so it cannot be lost between individual sign-offs.

Separate the verification plan from its eventual results. Implementation must create or update the
specified tests and report passed, failed, skipped, blocked and not-run scenarios against the tested
revision, with logs/artifacts and remaining gaps. Required failed or unexecuted journeys block
completion; green unit tests cannot substitute for required E2E evidence. Any proposed change to
required coverage must be explicit and reviewed, never silently marked not applicable.

The current contract digest covers parsed contract fields, not the contents of externally linked
specifications or test plans. Do not claim those documents are bound merely because links exist.
Require a content-addressed manifest and a supported approval/handoff verification mechanism before
claiming exact-document runtime enforcement. Until that mechanism is qualified, record the gap as a
blocking prerequisite for a managed implementation handoff; do not fabricate an approval binding.

## Validate, critique, publish and hand off

1. Produce execution-contract version `1` matching
   [contracts](../../../packages/workflow-control/src/contracts.ts). Bind requirements, tasks, paths,
   operations, delivery and gates consistently with all drafts. Do not invent evidence or permissions.
2. Validate through a supported workflow-control validation path. If unavailable, identify the missing
   interface; manual inspection is not machine validation or approval.
3. Require independent critique for both orchestrated and explicitly permitted direct implementation;
   no active orchestration run is needed for this review obligation. Submit the contract and complete
   document manifest to a distinct critic using
   [plan critique](../plan-critique/SKILL.md) through a permitted reviewer path. Check documentation
   completeness, traceability, feasibility and test/sign-off gates as well as contract authority.
   Record every finding and disposition; unresolved findings or missing review block final readiness.
4. The authorized coordinator saves the drafts and links Beads through the applicable publication
   path: journaled brokers exclusively during an active managed run, permitted direct tools otherwise.
   Publication must preserve the reviewed content. Read back files, links and dependency edges; any
   material publication change returns to validation and critique. Draft publication is not approval.
5. Present the concrete reviewed material for explicit human approval under
   [planning and approval rules](../../../docs/workflow-control-planning.md). The authoritative approval
   binds the exact version and material digest; a conversational statement alone does not fabricate
   the persisted runtime record. Report missing persistence capability as a blocker.
6. Hand the [implementation skill](../feature-implementation/SKILL.md) the manifest, exact source and
   approved contract, task/spec links, verification plan, critique/dispositions, approval evidence and
   remaining prerequisites. Implementation checks these bindings before work. Missing required
   material leaves the handoff incomplete; it must not reconstruct requirements by assumption.

Any later material contract or policy change invalidates approval and repeats critique and human
approval. Record planning gaps and manual supplementation in the
[field evaluation](../../../docs/reviews/orchestration-field-evaluation.md). Skills guide the workflow;
they do not grant runtime authority or establish that unattended execution succeeds.
