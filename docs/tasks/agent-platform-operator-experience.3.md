# Task: Split activity feed from debug payloads

**Beads issue:** `agent-platform-operator-experience.3`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.3.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.3.md`

## Task requirements

Separate the user-facing activity feed from technical tool/debug payloads in the frontend. The primary chat/workbench surface should show concise summaries, while raw or redacted payloads, trace ids, policy decisions, timings, and errors should be available only through an explicit details surface.

This task must use existing data shapes and frontend contracts.

## Stack constraints

Use Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript. Do not introduce new UI libraries, change data contracts, or add backend logic.

## Dependency order

### Upstream — must be complete before this task

| Issue                                  | Spec                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `agent-platform-operator-experience.2` | [Define human-readable tool event model](./agent-platform-operator-experience.2.md) |

### Downstream — waiting on this task

| Issue                                  | Spec                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `agent-platform-operator-experience.4` | [Redesign HITL approval cards](./agent-platform-operator-experience.4.md) |

## Implementation plan

1. Identify where raw tool events and payloads currently render in chat/tool activity.
2. Apply the event model from `.2` for default summaries.
3. Add or define an explicit details pattern using shadcn/ui primitives such as Sheet, Dialog, Accordion, Tabs, ScrollArea, and Tooltip where appropriate.
4. Ensure payload details are collapsed by default and clearly marked as technical.
5. Add loading, failed, empty, and unavailable states.

## Git workflow

Branch `task/agent-platform-operator-experience.3` from `task/agent-platform-operator-experience.2`.

## Tests

- Web unit tests for summary rendering and details expansion if code changes.
- Typecheck, lint, and focused manual/Playwright checks for chat activity states if UI changes.

## Definition of done

- [x] User-facing activity no longer defaults to raw JSON/system payloads.
- [x] Technical payloads remain inspectable through explicit details.
- [x] Failed and approval-required states remain understandable.
- [x] No backend contracts or new UI libraries are introduced.

## Sign-off

- [x] Required checks pass.
- [x] `bd close agent-platform-operator-experience.3 --reason "Activity feed separated from debug payloads"`
- [x] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
