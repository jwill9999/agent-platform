# Task: Design branch and diff approval workflows

**Beads issue:** `agent-platform-operator-experience.7`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.7.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.7.md`

## Task requirements

Define frontend workflow patterns for branch state, check status, diffs, and review/approval decisions. This task should coordinate with `agent-platform-branch-feedback-status` and establish how branch/diff evidence should appear as operator artifacts.

Do not add backend contracts in this task.

## Stack constraints

Use Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript. Do not introduce new UI libraries, change data contracts, or add backend logic.

## Dependency order

### Upstream — must be complete before this task

| Issue                                  | Spec                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `agent-platform-operator-experience.6` | [Establish artifact viewer design patterns](./agent-platform-operator-experience.6.md) |

### Downstream — waiting on this task

| Issue                                  | Spec                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `agent-platform-operator-experience.8` | [Reassess IDE and workbench architecture](./agent-platform-operator-experience.8.md) |

## Implementation plan

1. Define branch status panel states: clean, dirty, ahead/behind, checks pending, checks failed, checks passed, review required.
2. Define diff review shell and approval/rejection affordances.
3. Document how CI/Sonar/CodeQL/review feedback should link into branch artifacts.
4. Define how user decisions should be represented without implying backend enforcement that does not yet exist.
5. Identify any follow-up work that belongs in `agent-platform-branch-feedback-status`.

## Git workflow

Branch `task/agent-platform-operator-experience.7` from `task/agent-platform-operator-experience.6`.

## Tests

- Documentation/spec checks for design-only work.
- If mock/frontend components are added: web unit tests and targeted visual/manual checks.

## Definition of done

- [ ] Branch and diff workflow states are documented.
- [ ] Review/approval decision patterns are documented.
- [ ] Relationship to `agent-platform-branch-feedback-status` is explicit.
- [ ] No backend contracts or new UI libraries are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-operator-experience.7 --reason "Branch and diff approval workflows designed"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
