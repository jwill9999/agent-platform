# Orchestration skill readiness review

Assessment date: 24 September 2026. Owner authorized skill creation/review and non-launch validation.
The new skills are repository files, not just proposals. No runtime or application code is changed.

## Scope and status

- Created [orchestration](../../.agents/skills/orchestration/SKILL.md).
- Created [feature implementation](../../.agents/skills/feature-implementation/SKILL.md).
- Reviewed planning and critique; subsequently revised feature-planning with explicit owner authorization.
- Plan-critique source remains unchanged.
- Owner approval covers this bounded manual skill preparation on the current task branch into the
  harness review feature. It does not approve a live pilot, paid calls, runtime repair or merge.
- Beads prerequisites are tasks `.8`, `.9`, `.skills-gate`, `.10`, `.11`, `.12`, `.13` under
  `agent-platform-pilot-zero`; their specifications and actual blocking edges define the sequence.

## Existing skill findings

Planning already names objective, requirements, dependencies, paths, roles, operations, checks,
retry/escalation policy, schema validation, distinct critique and human approval. It lacks an explicit
execution handoff and a supported validator invocation. The implementation skill supplies the handoff;
the exact validator/critic path still requires qualification for the selected pilot.

Plan critique checks authority containment and evidence binding. Its default-staging wording must not
be interpreted as permission to promote this feature. The new implementation skill preserves the
actual approved destination. Recommend a later narrowly reviewed correction to make explicit delivery
authority clearer in the existing critique skill.

Neither planning nor critique proves a conformant reviewer launch is installed. Do not fabricate an
independent review from a self-review or use globally privileged collaboration to bypass isolation.

## Runtime capability assessment

| Capability                         | Evidence                                                                         | Assessment                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Status and resume preview          | [MCP server](../../packages/workflow-control/src/mcpServer.ts)                   | Implemented read interfaces; not launch operations                                                 |
| Implementation output import       | [Phase runtime](../../packages/workflow-control/src/phaseRuntime.ts)             | Standalone implementing phase explicitly rejects artifact import                                   |
| Coordinator completion             | [Phase jobs](../../packages/workflow-control/src/phaseJobs.ts)                   | Some completion paths explicitly lack coordinator authority                                        |
| Desktop continuation               | [Continuation worker](../../packages/workflow-control/src/continuationWorker.ts) | Explicit nonconformant-host result; not unattended proof                                           |
| Candidate adoption and delivery    | [Bootstrap](../../packages/workflow-control/src/bootstrap.ts)                    | Approved candidate adoption and brokered commit/push exist; not complete autonomous implementation |
| Full isolated review and execution | [ADR-0004](../adr/0004-codex-development-orchestration-control-plane.md)         | Required; not exercised by this assessment                                                         |

These are source observations, not live failure reproductions. Runtime readiness remains unqualified.
The task for connected handoff qualification remains a blocker of the exact first-pilot plan. Select
and scope a supported repair or execution path there before declaring launch readiness. No blanket
runtime repair is authorized by these skill tasks.

## Manual decision walkthrough

This is an author walkthrough of written decisions, not independent agent behavior or runtime testing.

| Input                                              | Written decision                                               | Limitation                         |
| -------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| Eligible approved task, confirmed no run           | Check creation readiness, do not choose direct work by absence | No launch exercised                |
| Matching active run                                | Verify binding, ownership and health, assess continuation      | No resume exercised                |
| State lookup fails                                 | Unknown state; no duplicate creation                           | Source-level procedure only        |
| Approved task, missing launcher/import             | Report concrete blocker, no silent fallback                    | Current runtime evidence above     |
| Changed plan or revoked grant                      | Resolve new authority before dependent mutations               | No approval-state injection        |
| Explicitly permitted direct task, no managed owner | Declare direct mode and preserve scope                         | Does not count as managed evidence |
| First task fails                                   | Dependent task must not start                                  | Two-task pilot remains separate    |

## Validation and remaining review

Both skills require frontmatter validation, Markdown lint, relative-link checks and diff checks.
The system and bundled Python lacked YAML support; an isolated uv environment supplies the validator
dependency without changing the project. Validation results are recorded in the session handoff.

Independent behavioral review remains outstanding: ADR-0004 prohibits built-in collaboration when
session-wide mutation-capable tools are exposed. This session has such tools. No isolated reviewer
was launched, and no independent approval is claimed. The owner can review the written skills now;
formal acceptance and the live pilot remain gated on appropriate review and runtime readiness.

Record future findings in the [field evaluation](orchestration-field-evaluation.md) and follow the
[staged assessment](orchestration-staged-assessment.md). Skills guide the route; they do not enforce
permissions, automatically activate a workflow or resolve the runtime limitations.

## Planning revision after owner discussion

The owner authorized implementing the identified gaps in feature-planning. It now specifies an artifact
manifest and locations, task/template links, authorized coordinator publication and read-back,
requirement-level test scenarios, independent backend-effect assertions, fixture boundaries, test
feasibility, task and feature integration gates, actual-result reporting and exact approved handoff.
Earlier planning-gap findings above describe the pre-revision state. A separate documentation skill
has not been created; the planning skill links the existing authoritative rules directly.

Author walkthrough: a multi-task user-facing feature now requires task specs and linked scenarios,
plus an owned final integration check. A mocked UI response cannot establish backend success; an
unavailable required environment blocks readiness, and skipped required journeys block sign-off.
Read-only planning returns drafts for an authorized publisher; missing approval persistence or a
conformant critic is reported rather than invented. These are static procedure checks, not live
agent behavior or independent critique.
