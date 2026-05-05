# Task: Redesign HITL approval cards

**Beads issue:** `agent-platform-operator-experience.4`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.4.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.4.md`

## Task requirements

Redesign human-in-the-loop approval cards so they present decisions in human-readable terms. Cards should explain the requested action, target, reason, risk, and approve/deny outcomes. Raw arguments and policy payloads should remain available through details, not as the primary card content.

## Stack constraints

Use Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript. Do not introduce new UI libraries, change data contracts, or add backend logic.

## Dependency order

### Upstream — must be complete before this task

| Issue                                  | Spec                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `agent-platform-operator-experience.3` | [Split activity feed from debug payloads](./agent-platform-operator-experience.3.md) |

### Downstream — waiting on this task

| Issue                                  | Spec                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `agent-platform-operator-experience.5` | [Add toolchain observability trace view](./agent-platform-operator-experience.5.md) |

## Implementation plan

1. Review existing approval request rendering and status transitions.
2. Define card states: pending, approving, denying, approved, denied, expired, failed.
3. Define copy pattern: action, target, why approval is required, risk, what approval allows, what denial prevents.
4. Use shadcn/ui primitives for buttons, badges, cards/dialogs, accordions, tooltips, and details panels.
5. Keep raw/redacted payload and policy details behind an explicit control.

## Git workflow

Branch `task/agent-platform-operator-experience.4` from `task/agent-platform-operator-experience.3`.

## Tests

- Web unit tests for approval card states and actions if code changes.
- Targeted manual/Playwright checks for approve, deny, failed, and expired states.

## Definition of done

- [ ] Approval cards explain action, target, reason, risk, and result.
- [ ] Raw JSON is not the default approval-card content.
- [ ] Approve and Deny actions are visually clear.
- [ ] High-risk/external/destructive actions have distinct treatment when existing data supports it.
- [ ] No backend contracts or new UI libraries are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-operator-experience.4 --reason "HITL approval cards redesigned"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
