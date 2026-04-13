# Task: Planner+Plugins: session memory + plugin resolution (global → user → agent)

**Beads issue:** `agent-platform-dx3.4`  
**Spec file:** `docs/tasks/agent-platform-dx3.4.md` (this file)  
**Parent epic:** `agent-platform-dx3` — Epic: Planner + plugin SDK + memory/observability

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-dx3.4.md`

## Task requirements

### From Beads (description)

Session-scoped memory plugin; merge order global defaults, user overrides, per-agent allow/deny; tests for effective stack.

### From Beads (acceptance criteria)

Integration test: two agents different memory policy; session reset behavior documented.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-dx3.1` | [Planner+Plugins: plugin-sdk package + hook contracts](./agent-platform-dx3.1.md) |
| `agent-platform-dx3.3` | [Planner+Plugins: observability plugin](./agent-platform-dx3.3.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-o36.1` | [MVP E2E: automated happy path + CI job](./agent-platform-o36.1.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Follow **Git workflow (mandatory)** below: create **`task/<task-name>`** for this task (here: **`task/agent-platform-dx3.4`**) from **`feature/<feature-name>`** before implementation commits. *Active MVP feature branch:* **`feature/agent-platform-mvp`**.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-dx3.4` shows expected upstream issues **closed** before your PR.
5. Open PR **`task/agent-platform-dx3.4` → `feature/<feature-name>`** (use **`feature/agent-platform-mvp`** for this MVP); merge when reviewed. Do **not** merge this task to `main`.

## Git workflow (mandatory)

**Naming:** **`feature/<feature-name>`** for integration; **`task/<task-name>`** for each task (`decisions.md`).

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Feature branch** | Pattern **`feature/<feature-name>`**. *This initiative (MVP):* **`feature/agent-platform-mvp`**. |
| **Task branch** | Pattern **`task/<task-name>`**. *This task:* **`task/agent-platform-dx3.4`**. Before starting: `git fetch origin && git checkout feature/agent-platform-mvp && git pull` then `git checkout -b task/agent-platform-dx3.4`. |
| **PR** | Push **`task/agent-platform-dx3.4`** to `origin`; PR into **`feature/agent-platform-mvp`**. |
| **Feature complete** | Final PR **`feature/agent-platform-mvp` → `main`** only after all tasks for this feature are merged on the feature branch. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed**.
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-dx3.4` → `feature/agent-platform-mvp`** (not `main`).
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete **only after** the PR for this task is merged into **`feature/agent-platform-mvp`** and tests are green.

- [ ] **Task branch** **`task/agent-platform-dx3.4`** was created **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged into **`feature/agent-platform-mvp`** (link: _________________________________)
- [ ] `bd close agent-platform-dx3.4 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
