# Task: Add toolchain observability trace view

**Beads issue:** `agent-platform-operator-experience.5`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.5.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.5.md`

## Task requirements

Add an engineer-facing frontend trace/details view for existing tool lifecycle evidence. The view should help diagnose what the agent did, where it failed, which approvals/policies applied, and what artifacts were produced without overwhelming the normal chat feed.

## Stack constraints

Use Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript. Do not introduce new UI libraries, change data contracts, or add backend logic.

## Dependency order

### Upstream — must be complete before this task

| Issue                                  | Spec                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `agent-platform-operator-experience.4` | [Redesign HITL approval cards](./agent-platform-operator-experience.4.md) |

### Downstream — waiting on this task

| Issue                                  | Spec                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `agent-platform-operator-experience.6` | [Establish artifact viewer design patterns](./agent-platform-operator-experience.6.md) |

## Implementation plan

1. Inventory existing frontend-accessible trace/tool/approval/debug fields.
2. Define trace view layout: timeline, selected event details, filters, and copied identifiers.
3. Show raw/redacted payloads only in explicit details sections.
4. Link events to related artifacts where existing data permits.
5. Add empty/unavailable states when trace data is absent.

## Git workflow

Branch `task/agent-platform-operator-experience.5` from `task/agent-platform-operator-experience.4`.

## Tests

- Web unit tests for trace/details rendering if code changes.
- Typecheck, lint, and targeted manual/Playwright checks for trace view states.

## Definition of done

- [ ] Engineer-facing trace/details view is specified or implemented.
- [ ] Normal chat remains summary-first.
- [ ] Policy decisions, approvals, trace ids, errors, and payloads are inspectable when present.
- [ ] No backend contracts or new UI libraries are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-operator-experience.5 --reason "Toolchain observability trace view added"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
