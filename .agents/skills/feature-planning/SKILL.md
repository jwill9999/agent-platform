---
name: feature-planning
description: Draft or revise Agent Platform requirements, task dependencies, definition of done and verification before authorized native development.
---

# Feature planning

Use the [documentation skill](../documentation/SKILL.md) and its canonical folder guide for artifact
locations, publication responsibility and cross-document consistency.

Produce a complete reviewable native-development plan from owner requirements. A planning-only
assignment stays within planning; an authorized coordinator may save documents/Beads within scope.
Reuse existing owner end-to-end authorization. It permits progressing from reviewed planning through
implementation/tests/repairs/review/CI without another routine phase grant. Read-only planning and
review assignments are responsibilities, not evidence that tools are technically disabled.

## Establish requirements and feasibility

Read [AGENTS.md](../../../AGENTS.md), [shared instructions](../../../docs/agent-instructions-shared.md),
the parent Beads issue and existing child specs, applicable ADRs and the smallest useful source set.
Follow [task documentation rules](../../../docs/tasks/README.md) and the
[task template](../../../docs/tasks/_template.md); reuse existing records rather than duplicate them.

Resolve objective, requirements with stable identifiers, non-goals, testable acceptance criteria,
task dependencies, exact source/branch, expected file/action areas, responsibilities, delivery destination, quality
gates, retries, spend limits and escalation policy. Ask only for unresolved choices that materially
change scope, behavior, owner intent, agreed behavior/delivery or explicitly reserved actions. Preserve valid decisions already made.
Before presenting the plan, check conflicting requirements and unsupported assumptions. Resolve
ordinary technical/file/subtask choices from available evidence within owner scope. Ask and wait
only when unresolved owner intent, agreed behavior/delivery, an explicitly reserved action or a
required unavailable input needs the owner's decision. Explain the concrete impact and record the
answer; do not treat silence as agreement on that material question. Continue independent work
where possible and reuse earlier decisions without repeated approval.

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

| Output                              | Location and required content                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature plan and document manifest  | `docs/planning/`: objective, requirements, exclusions, task/dependency map, decisions, and links to every handoff artifact                                |
| Task specifications                 | `docs/tasks/<issue-id>.md`, using the task template: detailed requirements, implementation boundary, dependencies, tests, definition of done and sign-off |
| Task tracking                       | Beads: parent/children, acceptance criteria and real blocking edges; each description starts with `Spec: docs/tasks/<issue-id>.md`                        |
| Verification plan                   | `docs/testing/`: requirement-to-scenario mapping, environments, expected outcomes, evidence and task/feature completion gates                             |
| Review and verification results     | `docs/reviews/`: critique findings/dispositions and, after execution, actual results linked to the verification plan and tested revision                  |
| Architecture decisions              | Applicable existing `docs/adr/` or `docs/architecture/` documents; propose changes only when the feature changes architecture                             |
| Authorization and review references | Recorded owner scope, source revision and independent findings/dispositions; prototype contracts only when explicitly selected                            |

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

## Validate, critique, publish and hand off

1. Check that requirements, real Beads tasks/dependencies, tests/DoD, source/branches and delivery
   are consistent, feasible and complete. Native developer tickets do not require a workflow-control
   version1 contract, discovery, admission, gateway or exact-material persisted approval.
2. Obtain a distinct source-aware independent critique for substantive plans using
   [plan critique](../plan-critique/SKILL.md). The critic may use available native tools to inspect
   source. Record actionable findings and correction evidence; recheck affected semantics after fixes.
   No blanket no-tool procedure or managed launcher is required for normal review.
3. Save/read back the plan/specs, real Beads links/dependencies and full Notion mirrors with reviewed
   source provenance. Document publication alone grants no implementation authority.
4. Check actual owner authorization. If it already covers end-to-end delivery, continue directly into
   [implementation](../feature-implementation/SKILL.md) with the reviewed plan/test map; do not ask for
   another routine handoff grant. Otherwise present the concrete proposed scope for agreement.
5. Resolve ordinary file/subtask/retry refinements from evidence within the agreed objective. Re-review
   substantive changed semantics and tests; seek owner clarification only when intent, agreed behavior/
   delivery or a reserved action changes. Do not fabricate approvals or count planned tests as passed.

The PAUSED [workflow-control prototype](../../../docs/workflow-control-planning.md) retains its own
contracts/document binding/enforcement for explicitly selected prototype runs. Those controls do not
apply as default native developer prerequisites. Product permission controls remain unchanged.
