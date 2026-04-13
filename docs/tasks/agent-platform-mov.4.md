# Task: Foundation: apps/api skeleton + /health

**Beads issue:** `agent-platform-mov.4`  
**Spec file:** `docs/tasks/agent-platform-mov.4.md` (this file)  
**Parent epic:** `agent-platform-mov` — Epic: Foundation — monorepo, contracts, Docker, CI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-mov.4.md`

## Task requirements

### From Beads (description)

Minimal HTTP server (framework per ADR); GET /health returns JSON ok; imports types from contracts; Dockerfile CMD matches compose; logs structured minimally.

### From Beads (acceptance criteria)

curl localhost/health from host or compose succeeds; unit test for health handler; image builds in compose.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.2` | [Foundation: packages/contracts (Zod + types)](./agent-platform-mov.2.md) |
| `agent-platform-mov.3` | [Foundation: Docker + Docker Compose + SQLite volume](./agent-platform-mov.3.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.5` | [Foundation: CI (GitHub Actions)](./agent-platform-mov.5.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-mov.4` shows expected upstream issues **closed** before PR.
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
- [ ] `bd close agent-platform-mov.4 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
