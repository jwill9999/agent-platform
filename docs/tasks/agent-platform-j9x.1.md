# Task: Persistence: DB schema + ORM + migrations (SQLite)

**Beads issue:** `agent-platform-j9x.1`  
**Spec file:** `docs/tasks/agent-platform-j9x.1.md` (this file)  
**Parent epic:** `agent-platform-j9x` — Epic: Persistence + API shell + secrets

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-j9x.1.md`

## Task requirements

### From Beads (description)

Drizzle or Prisma; tables for skills, tools/MCP servers, agents with allowlists, sessions, chat metadata, plugin catalog refs; migrations; connect to SQLite file on volume path from env.

### From Beads (acceptance criteria)

migrate up on clean DB; migrate test in CI; schema matches contracts v0; no secrets in plain text columns.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.5` | [Foundation: CI (GitHub Actions)](./agent-platform-mov.5.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-j9x.2` | [Persistence: encrypted secrets storage](./agent-platform-j9x.2.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-j9x.1` shows expected upstream issues **closed** before PR.
4. Open PR; request review against **Definition of done**.

## Tests (required before sign-off)

- **Unit:** Cover new logic introduced by this task (per Beads acceptance).
- **Integration / E2E:** Required when this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] All **upstream** issues in Beads are **closed**.
- [ ] Tests in this spec are **green** locally and in CI when applicable.
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

- [ ] **Definition of done** complete
- [ ] `bd close agent-platform-j9x.1 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
