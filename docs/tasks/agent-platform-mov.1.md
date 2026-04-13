# Task: Foundation: scaffold pnpm monorepo

**Beads issue:** `agent-platform-mov.1`  
**Spec file:** `docs/tasks/agent-platform-mov.1.md` (this file)  
**Parent epic:** `agent-platform-mov` — Epic: Foundation — monorepo, contracts, Docker, CI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-mov.1.md`

## Task requirements

### From Beads (description)

Root package.json with pnpm workspaces; apps/* and packages/* layout; shared TypeScript config (strict); ESLint + Prettier; scripts: build, test, typecheck, lint.

### From Beads (acceptance criteria)

pnpm install succeeds; pnpm -r typecheck passes (stub packages ok); workspace globs correct; README or CONTRIBUTOR note on commands.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| — | *No `blocks` dependencies (parent epic only)* |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.2` | [Foundation: packages/contracts (Zod + types)](./agent-platform-mov.2.md) |
| `agent-platform-mov.3` | [Foundation: Docker + Docker Compose + SQLite volume](./agent-platform-mov.3.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create a short-lived branch; implement with tests per **Tests** section.
3. Ensure `bd dep list agent-platform-mov.1` shows expected upstream issues **closed** before PR.
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
- [ ] `bd close agent-platform-mov.1 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
