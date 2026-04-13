# Task: Harness: agent resolution + validation layer

**Beads issue:** `agent-platform-2tw.2`  
**Spec file:** `docs/tasks/agent-platform-2tw.2.md` (this file)  
**Parent epic:** `agent-platform-2tw` — Epic: Harness — MCP, validation, LangGraph, streaming

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-2tw.2.md`

## Task requirements

### From Beads (description)

Load persisted agent; merge allowlists with registries; enforce ExecutionLimits; reject disallowed skills/tools; pure functions testable without LLM.

### From Beads (acceptance criteria)

Unit tests for allowlist matrix; property tests optional; hooks for plugin policy later.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-j9x.4` | [Persistence: CRUD API for registries and agents](./agent-platform-j9x.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-2tw.3` | [Harness: LangGraph minimal graph + trace events](./agent-platform-2tw.3.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Follow **Git workflow (mandatory)** below: create **`task/<task-name>`** for this task (here: **`task/agent-platform-2tw.2`**) from **`feature/<feature-name>`** before implementation commits. *Active MVP feature branch:* **`feature/agent-platform-mvp`**.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-2tw.2` shows expected upstream issues **closed** before your PR.
5. Open PR **`task/agent-platform-2tw.2` → `feature/<feature-name>`** (use **`feature/agent-platform-mvp`** for this MVP); merge when reviewed. Do **not** merge this task to `main`.

## Git workflow (mandatory)

**Naming:** **`feature/<feature-name>`** for integration; **`task/<task-name>`** for each task (`decisions.md`).

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Feature branch** | Pattern **`feature/<feature-name>`**. *This initiative (MVP):* **`feature/agent-platform-mvp`**. |
| **Task branch** | Pattern **`task/<task-name>`**. *This task:* **`task/agent-platform-2tw.2`**. Before starting: `git fetch origin && git checkout feature/agent-platform-mvp && git pull` then `git checkout -b task/agent-platform-2tw.2`. |
| **PR** | Push **`task/agent-platform-2tw.2`** to `origin`; PR into **`feature/agent-platform-mvp`**. |
| **Feature complete** | Final PR **`feature/agent-platform-mvp` → `main`** only after all tasks for this feature are merged on the feature branch. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed**.
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-2tw.2` → `feature/agent-platform-mvp`** (not `main`).
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete **only after** the PR for this task is merged into **`feature/agent-platform-mvp`** and tests are green.

- [ ] **Task branch** **`task/agent-platform-2tw.2`** was created **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged into **`feature/agent-platform-mvp`** (link: _________________________________)
- [ ] `bd close agent-platform-2tw.2 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
