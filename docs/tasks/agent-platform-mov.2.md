# Task: Foundation: packages/contracts (Zod + types)

**Beads issue:** `agent-platform-mov.2`  
**Spec file:** `docs/tasks/agent-platform-mov.2.md` (this file)  
**Parent epic:** `agent-platform-mov` — Epic: Foundation — monorepo, contracts, Docker, CI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-mov.2.md`

## Task requirements

### From Beads (description)

packages/contracts: Skill, Agent, Output union (text, code, tool_result, error, thinking), ExecutionLimits, Plan/Task shapes, secrets refs; Zod parse/export; unit tests for round-trip samples.

### From Beads (acceptance criteria)

Contract tests pass; types exported from package; README lists public exports; no app code—library only.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.1` | [Foundation: scaffold pnpm monorepo](./agent-platform-mov.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.4` | [Foundation: apps/api skeleton + /health](./agent-platform-mov.4.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-mov.2` shows expected upstream issues **closed** before PR.
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
- [ ] `bd close agent-platform-mov.2 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
