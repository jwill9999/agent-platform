# Task: Reassess IDE and workbench architecture

**Beads issue:** `agent-platform-operator-experience.8`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.8.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.8.md`

## Task requirements

Reassess whether the product should keep extending the embedded IDE, support external host IDE/browser workflows, or use a hybrid model. The output should document trade-offs, user workflows, plugin/extensibility implications, and Docker host-access constraints.

This task is architectural/design documentation unless explicitly expanded during refinement.

## Stack constraints

Use Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript for any frontend prototypes. Do not introduce new UI libraries, change data contracts, or add backend logic in this task.

## Dependency order

### Upstream — must be complete before this task

| Issue                                  | Spec                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `agent-platform-operator-experience.7` | [Design branch and diff approval workflows](./agent-platform-operator-experience.7.md) |

### Downstream — waiting on this task

| Issue                                  | Spec                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `agent-platform-operator-experience.9` | [Document Docker host integration constraints](./agent-platform-operator-experience.9.md) |

## Implementation plan

1. Inventory the current embedded IDE/code-viewing surface and known pain points.
2. Compare options:
   - continue embedded IDE investment
   - external host IDE/browser handoff
   - hybrid internal viewer plus host handoff
3. Evaluate plugin/extensibility needs for diagnostics, terminal output, SonarQube, CodeQL, and review comments.
4. Document Docker/container implications and open risks.
5. Recommend the next implementation path and follow-up tasks.

## Git workflow

Branch `task/agent-platform-operator-experience.8` from `task/agent-platform-operator-experience.7`.

## Tests

- Documentation/spec checks for design-only work.
- If frontend prototypes are added: web unit tests and targeted visual/manual checks.

## Definition of done

- [ ] Current IDE/workbench state is documented.
- [ ] Embedded, external, and hybrid approaches are compared.
- [ ] Docker and plugin implications are documented.
- [ ] Recommended next path is stated.
- [ ] No backend contracts or new UI libraries are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-operator-experience.8 --reason "IDE and workbench architecture reassessed"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
