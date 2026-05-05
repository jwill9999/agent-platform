# Task: Define human-readable tool event model

**Beads issue:** `agent-platform-operator-experience.2`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.2.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.2.md`

## Task requirements

Define the frontend display model that turns existing tool activity into human-readable event summaries. This task must map existing tool ids, risk tiers, policy states, arguments, results, and errors into display labels, status, icon choices, concise summaries, and details affordances.

This task must not change backend contracts. It should consume or adapt existing frontend stream/tool result shapes only.

## Stack constraints

Use Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript. Do not introduce new UI libraries, change data contracts, or add backend logic.

## Dependency order

### Upstream — must be complete before this task

| Issue                                  | Spec                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `agent-platform-operator-experience.1` | [Define operator design system foundations](./agent-platform-operator-experience.1.md) |

### Downstream — waiting on this task

| Issue                                  | Spec                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `agent-platform-operator-experience.3` | [Split activity feed from debug payloads](./agent-platform-operator-experience.3.md) |

## Implementation plan

1. Inventory existing frontend tool activity rendering and browser/approval result rendering.
2. Define status vocabulary: pending, running, approval required, approved, denied, failed, completed, blocked, unavailable.
3. Define risk vocabulary and visual treatment using existing data.
4. Map common tool ids to friendly action labels.
5. Define summary copy patterns for action, target, reason, result, and next step.
6. Document how raw/redacted details are linked without becoming the default view.

## Git workflow

Branch `task/agent-platform-operator-experience.2` from `task/agent-platform-operator-experience.1`.

## Tests

- If documentation only: Prettier check and `git diff --check`.
- If frontend helpers/components are added: relevant web unit tests, typecheck, lint, and targeted visual/manual checks.

## Definition of done

- [ ] Existing tool activity inputs are inventoried.
- [ ] Tool labels and summary copy rules are documented.
- [ ] Status/risk vocabulary is documented.
- [ ] Details/debug affordance rules are documented.
- [ ] No backend contracts or new UI libraries are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-operator-experience.2 --reason "Human-readable tool event model defined"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
