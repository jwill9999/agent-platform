# Task: [Short title]

**Beads issue:** `agent-platform-…`  
**Spec file:** `docs/tasks/agent-platform-….md` (this file)  
**Parent epic:** `agent-platform-…` — [Epic title]

The Beads issue **description** must begin with: `Spec: docs/tasks/<issue-id>.md`

## Task requirements

Summarize **what** must exist after this task (product/technical outcomes). Pull from the Beads **description**; expand here if planning adds detail.

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. Do **not** close this issue until every **upstream** task below is already **closed**.

### Upstream (complete before this task)

| Issue | Spec |
|-------|------|
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Downstream (blocked until this task is done)

| Issue | Spec |
|-------|------|
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Planning notes (cross-links)

If planning discovers **additional** dependencies (e.g. shared contracts, env vars), add them here **and** add or adjust **`bd dep add`** so Beads stays the single scheduling source of truth.

## Implementation plan

Numbered steps the implementer should follow (files, packages, integration points). Update this section during planning if scope shifts.

1. …
2. …

## Tests (required before sign-off)

- **Unit:** …
- **Integration / E2E:** …

## Definition of done

Concrete checklist including Beads **acceptance_criteria** and any tests above.

- [ ] …
- [ ] …

## Sign-off

- [ ] All items in **Definition of done** satisfied
- [ ] Beads issue closed: `bd close <id> --reason "…"`
- [ ] `decisions.md` updated only if this task introduced or changed an architectural decision
- [ ] `session.md` updated at end of session if handoff matters

**Reviewer / owner:** _____________________ **Date:** _____________
