# Task: Foundation: CI (GitHub Actions)

**Beads issue:** `agent-platform-mov.5`  
**Spec file:** `docs/tasks/agent-platform-mov.5.md` (this file)  
**Parent epic:** `agent-platform-mov` — Epic: Foundation — monorepo, contracts, Docker, CI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-mov.5.md`

## Task requirements

### From Beads (description)

Workflow on PR/push: pnpm install, typecheck, lint, test; cache pnpm store; fail fast; optional docker build job if not too slow for MVP.

### From Beads (acceptance criteria)

Green run on main with current repo; documented in README; required status check for PRs if branch protection enabled later.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.4` | [Foundation: apps/api skeleton + /health](./agent-platform-mov.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-j9x.1` | [Persistence: DB schema + ORM + migrations (SQLite)](./agent-platform-j9x.1.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-mov.5` shows expected upstream issues **closed** before PR.
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
- [ ] `bd close agent-platform-mov.5 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
