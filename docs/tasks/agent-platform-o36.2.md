# Task: MVP E2E: operator docs + Docker runbook

**Beads issue:** `agent-platform-o36.2`  
**Spec file:** `docs/tasks/agent-platform-o36.2.md` (this file)  
**Parent epic:** `agent-platform-o36` — Epic: MVP E2E — filesystem MCP + default agent path

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-o36.2.md`

## Task requirements

### From Beads (description)

README: clone, env, compose up, seed, open web, first chat; security notes for container boundary and mounts; troubleshooting.

### From Beads (acceptance criteria)

New developer can follow doc without tribal knowledge; decisions.md link for ADR.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-o36.1` | [MVP E2E: automated happy path + CI job](./agent-platform-o36.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| — | *No `blocks` dependencies (parent epic only)* |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Follow **Git workflow (mandatory)** below: create **`task/agent-platform-o36.2`** from **`feature/agent-platform-mvp`** before implementation commits.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-o36.2` shows expected upstream issues **closed** before your PR.
5. Open PR **`task/agent-platform-o36.2` → `feature/agent-platform-mvp`**; merge when reviewed. Do **not** merge this task to `main`.

## Git workflow (mandatory)

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Feature branch** | **`feature/agent-platform-mvp`**. Task PRs target this branch. |
| **Task branch** | Before starting: `git fetch origin && git checkout feature/agent-platform-mvp && git pull` then `git checkout -b task/agent-platform-o36.2`. |
| **PR** | Push **`task/agent-platform-o36.2`** to `origin`; PR into **`feature/agent-platform-mvp`**. |
| **MVP complete** | Final PR **`feature/agent-platform-mvp` → `main`** only after all MVP tasks are merged on the feature branch. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed**.
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-o36.2` → `feature/agent-platform-mvp`** (not `main`).
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete **only after** the PR for this task is merged into **`feature/agent-platform-mvp`** and tests are green.

- [ ] **Task branch** `task/agent-platform-o36.2` was created **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged into **`feature/agent-platform-mvp`** (link: _________________________________)
- [ ] `bd close agent-platform-o36.2 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
