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
2. Follow **Git workflow (mandatory)** below: create **`task/<issue-id>`** from **`feature/agent-platform-mvp`** before writing implementation commits.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list <issue-id>` shows expected upstream issues **closed** before your PR.
5. Open PR **`task/<issue-id>` → `feature/agent-platform-mvp`**; merge when reviewed. Do **not** merge individual tasks to `main`.

## Git workflow (mandatory)

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Feature branch** | Long-running integration branch: **`feature/agent-platform-mvp`**. All task PRs target this branch. |
| **Task branch** | Before starting work: `git fetch origin && git checkout feature/agent-platform-mvp && git pull` then `git checkout -b task/<issue-id>` (use this Beads id, e.g. `task/agent-platform-mov.1`). |
| **PR** | Push **`task/<issue-id>`** to `origin` and open a PR into **`feature/agent-platform-mvp`**. Merge via PR (squash or merge commit per team preference). |
| **After merge** | Delete the remote/local task branch when done. |
| **MVP complete** | When all tasks are merged on **`feature/agent-platform-mvp`**, open **one** PR **`feature/agent-platform-mvp` → `main`**. |

## Tests (required before sign-off)

- **Unit (minimum):** Run the project’s unit test command for packages you changed; **all must pass** before the task is signed off. Add or update tests for new logic.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed**.
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/<issue-id>` → `feature/agent-platform-mvp`** (not `main`).
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete **only after** the PR for this task is merged into **`feature/agent-platform-mvp`** and tests are green.

- [ ] **Task branch** `task/<issue-id>` was created **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged into **`feature/agent-platform-mvp`** (link: _________________________________)
- [ ] `bd close <issue-id> --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
