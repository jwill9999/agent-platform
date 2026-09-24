# Documentation guide

Use this guide to choose a home for new documentation and find the authoritative record.
Existing documents keep their paths; this guide does not authorize bulk moves or rename historical work.
Follow [shared agent instructions](agent-instructions-shared.md) and [task rules](tasks/README.md).

## Where documents belong

| Location                          | Purpose                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/planning/`                  | Proposed feature plans, scope, requirements and document manifests. Label draft, reviewed and approved status with evidence; a saved plan is not approval.                     |
| `docs/tasks/`                     | Per-task specifications named after their Beads IDs, with requirements, dependencies, tests, definition of done and sign-off. Use the [task template](tasks/_template.md).     |
| `docs/adr/`                       | Architectural decisions and their rationale, alternatives and consequences. Follow existing ADR numbering and style.                                                           |
| `docs/architecture/`              | Current system structure, interfaces and behavior. Link relevant ADRs; distinguish intended design from implemented behavior.                                                  |
| `docs/design/`                    | Detailed product/technical design, interaction models, threat models and design alternatives. Link the owning feature and accepted decisions.                                  |
| `docs/testing/`                   | Verification strategies and reproducible automated unit/integration/E2E scenario definitions. Link requirements, tasks and result reports.                                     |
| `docs/qa/`                        | Manual/exploratory QA procedures and coverage matrices. Existing matrices stay here and are linked from verification plans.                                                    |
| `docs/reviews/`                   | Critiques, assessments, findings/dispositions and execution-result reports with exact source/revision and evidence boundaries.                                                 |
| `docs/development/`               | Contributor workflows and local development procedures.                                                                                                                        |
| Existing top-level guides         | Maintained operational/reference guides such as API, configuration, deployment and workflow control. Update the existing authoritative guide rather than add a competing copy. |
| `docs/demo/`, `docs/superpowers/` | Existing demonstration or workflow-specific material. Preserve current references; new general feature plans use `docs/planning/`.                                             |

## Authority and links

Beads is authoritative for backlog, task status and dependency ordering. Do not introduce a second
backlog in Markdown. A feature plan describes the work; each task has one canonical specification
linked by the required Beads description prefix. Beads acceptance criteria and the specification's
definition of done must agree. Link existing records instead of copying detailed requirements.

Each feature plan includes a document manifest: exact task/spec links, design/ADR references where
applicable, verification plan, review/findings, execution-contract location and approval evidence.
Use stable requirement and scenario identifiers to connect these documents. For a new document use a
clear feature-based filename; reuse a current relevant document when that avoids duplicate authority.
If ownership or location is unclear, inspect existing references and ask the human before final agreement.

## Verification and completion evidence

The verification plan states what must be tested, by whom, using which environment/data, with expected
UI outcomes and independently checked backend effects. It maps relevant unit, integration and E2E
scenarios to requirements and assigns the final feature integration gate to a task.

The result report states what actually ran, the exact tested revision/environment, passed/failed/
skipped/blocked/not-run outcomes, evidence links, fixture/mock boundaries and unresolved gaps.
Never mark planned coverage as proven. Required failures or unexecuted journeys prevent sign-off.
Use the [planning procedure](../.agents/skills/feature-planning/SKILL.md) for detailed requirements.

## Publication and maintenance

Read-only planners and critics return drafts/findings with intended paths. An authorized coordinating
agent publishes through journaled brokers during an active managed run, or permitted direct tools
otherwise. Publication does not approve implementation, execution, merge or release.

Read back saved documents and Beads links/dependencies. Keep drafts, reviewed material and approval
bindings distinguishable. Material changes require the appropriate renewed critique and approval;
retain prior findings and evidence rather than rewriting history as a success.

Validate changed Markdown and local references; preserve existing links. Session-specific continuation
belongs in the repository's `session.md`, pointing to durable task and review records. Skills link this
guide rather than maintain competing folder maps. Do not move old documents simply to satisfy the new map.
