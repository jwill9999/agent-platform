# Task: Planner+Plugins: observability plugin

**Beads issue:** `agent-platform-dx3.3`  
**Spec file:** `docs/tasks/agent-platform-dx3.3.md` (this file)  
**Parent epic:** `agent-platform-dx3` — Epic: Planner + plugin SDK + memory/observability

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-dx3.3.md`

## Task requirements

### From Beads (description)

First-party plugin: structured logs for skills/tools/path/errors; wire to plugin manager resolution order.

### From Beads (acceptance criteria)

Logs appear in tests or captured stream; no PII beyond configured fields.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-dx3.1` | [Planner+Plugins: plugin-sdk package + hook contracts](./agent-platform-dx3.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-dx3.4` | [Planner+Plugins: session memory + plugin resolution (global → user → agent)](./agent-platform-dx3.4.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Follow **Git workflow (mandatory)** below: create **`task/agent-platform-dx3.3`** from **`feature/agent-platform-mvp`** before implementation commits.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-dx3.3` shows expected upstream issues **closed** before your PR.
5. Open PR **`task/agent-platform-dx3.3` → `feature/agent-platform-mvp`**; merge when reviewed. Do **not** merge this task to `main`.

## Git workflow (mandatory)

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Feature branch** | **`feature/agent-platform-mvp`**. Task PRs target this branch. |
| **Task branch** | Before starting: `git fetch origin && git checkout feature/agent-platform-mvp && git pull` then `git checkout -b task/agent-platform-dx3.3`. |
| **PR** | Push **`task/agent-platform-dx3.3`** to `origin`; PR into **`feature/agent-platform-mvp`**. |
| **MVP complete** | Final PR **`feature/agent-platform-mvp` → `main`** only after all MVP tasks are merged on the feature branch. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed**.
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-dx3.3` → `feature/agent-platform-mvp`** (not `main`).
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete **only after** the PR for this task is merged into **`feature/agent-platform-mvp`** and tests are green.

- [ ] **Task branch** `task/agent-platform-dx3.3` was created **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged into **`feature/agent-platform-mvp`** (link: _________________________________)
- [ ] `bd close agent-platform-dx3.3 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
