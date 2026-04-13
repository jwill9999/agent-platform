# Task: [Short title]

**Beads issue:** `agent-platform-…`  
**Spec file:** `docs/tasks/agent-platform-….md` (this file)  
**Parent epic:** `agent-platform-…` — [Epic title]

The Beads issue **description** must begin with: `Spec: docs/tasks/<issue-id>.md`

## Task requirements

Summarize **what** must exist after this task (product/technical outcomes). Pull from the Beads **description**; expand here if planning adds detail.

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. Do **not** close this issue until every **upstream** task below is already **closed**.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Planning notes

If planning discovers **additional** dependencies (e.g. shared contracts, env vars), add them here **and** add or adjust **`bd dep add`** so Beads stays the single scheduling source of truth.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Follow **Git workflow (mandatory)** below: create **`task/<task-name>`** from **`feature/<feature-name>`** before writing implementation commits (use the real feature branch name for this initiative).
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list <issue-id>` shows expected upstream issues **closed** before your PR.
5. Open PR **`task/<task-name>` → `feature/<feature-name>`**; merge when reviewed. Do **not** merge individual tasks to `main`.

## Git workflow (mandatory)

**Naming:** integration branches are **`feature/<feature-name>`**; task branches are **`task/<task-name>`** (see `decisions.md`). Substitute the actual names for your initiative.

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Feature branch** | Pattern **`feature/<feature-name>`**. *Example (Agent Platform MVP):* **`feature/agent-platform-mvp`**. Task PRs target the active feature branch. |
| **Task branch** | Pattern **`task/<task-name>`**. *This task:* **`task/<issue-id>`** (e.g. `task/agent-platform-mov.1`). Before starting: `git fetch origin && git checkout feature/<feature-name> && git pull` then `git checkout -b task/<task-name>`. |
| **PR** | Push **`task/<task-name>`** to `origin`; open a PR into **`feature/<feature-name>`**. |
| **After merge** | Delete the remote/local task branch when done. |
| **Feature complete** | When all tasks for **`feature/<feature-name>`** are merged, open **one** PR **`feature/<feature-name>` → `main`**. |

## Tests (required before sign-off)

- **Unit (minimum):** Run the project’s unit test command for packages you changed; **all must pass** before the task is signed off. Add or update tests for new logic.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed**.
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/<task-name>` → `feature/<feature-name>`** (not `main`).
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete **only after** the PR for this task is merged into **`feature/<feature-name>`** and tests are green.

- [ ] **Task branch** **`task/<task-name>`** was created **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged into **`feature/<feature-name>`** (link: _________________________________)
- [ ] `bd close <issue-id> --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
