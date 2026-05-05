# Task: Define operator design system foundations

**Beads issue:** `agent-platform-operator-experience.1`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.1.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.1.md`

## Task requirements

Define the frontend design-system foundation for operator experience surfaces before building individual screens. The design system should cover how the app presents agent activity, approvals, artifacts, debug details, branch/check status, and workbench shells.

This task is frontend-only planning/design-system work. It must not change backend contracts or add backend logic.

## Stack constraints

Use:

- Next.js App Router
- shadcn/ui components
- Tailwind CSS
- TypeScript
- Radix behavior through shadcn/ui primitives

Do not:

- introduce new UI libraries
- introduce new styling systems
- introduce new animation/state-management libraries
- change data contracts
- include backend logic

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. Do **not** close this issue until every **upstream** task below is already **closed**.

### Upstream — must be complete before this task

| Issue | Spec |
| ----- | ---- |
| N/A   | N/A  |

### Downstream — waiting on this task

| Issue                                  | Spec |
| -------------------------------------- | ---- |
| Future operator-experience child tasks | TBD  |

### Planning notes

This task should establish constraints and reusable design language. Later tasks can implement the activity feed, approvals, artifacts, and debug/details surfaces using this foundation.

## Implementation plan

1. Review current frontend structure and existing UI primitives.
2. Document the visual language for operator surfaces: density, spacing, typography, status colors, risk colors, icon usage, and dark/light behavior.
3. Define the component inventory:
   - tool activity event rows
   - approval cards
   - risk badges
   - status chips
   - artifact cards
   - artifact viewer
   - debug/details drawer
   - branch/check status panels
   - diff viewer shell
   - empty, loading, error, and blocked states
4. Define interaction rules:
   - raw JSON hidden by default
   - technical details available through explicit details views
   - approval cards explain action, target, reason, risk, and outcome
   - artifacts open inside the app surface, not surprise new tabs
   - destructive, external, or sensitive actions have distinct risk treatment
5. Decide whether this task should produce docs only, static mock components, or an internal design-system route before implementation starts.

## Git workflow (mandatory)

Branch `task/agent-platform-operator-experience.1` from `feature/agent-platform-operator-experience` after the feature branch is created.

This is the first task in the operator-experience segment. Later child tasks should branch from this task branch unless the segment is explicitly split during refinement.

## Tests (required before sign-off)

- Documentation/spec changes: run Prettier check and `git diff --check`.
- If UI components or routes are added: run relevant web unit tests, typecheck, lint, and targeted Playwright/manual UI checks.

## Definition of done

- [ ] Stack constraints are documented and reflected in the parent epic.
- [ ] Component inventory exists for the operator experience surfaces.
- [ ] Status/risk vocabulary and visual treatment are defined.
- [ ] Layout guidance exists for chat, right drawer, details drawer, and artifact viewer.
- [ ] Example states are documented for pending, running, approval-required, approved, denied, failed, completed, blocked, and unavailable.
- [ ] No new UI libraries, backend logic, or data-contract changes are introduced.

## Sign-off

- [ ] Task branch created from the correct parent before implementation work.
- [ ] Required checks executed and passing.
- [ ] Definition of done is complete.
- [ ] If segment tip: PR merged `task/<tip> -> feature/agent-platform-operator-experience`; otherwise write “N/A — merge at segment end”.
- [ ] `bd close agent-platform-operator-experience.1 --reason "Operator design system foundations defined"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
