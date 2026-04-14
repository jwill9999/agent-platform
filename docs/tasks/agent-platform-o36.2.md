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
2. Create **`task/agent-platform-o36.2`** from **`task/agent-platform-o36.1`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-o36.1 && git pull` then `git checkout -b task/agent-platform-o36.2`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-o36.2` shows expected upstream Beads issues **closed** where applicable.
5. **Segment tip:** open **one PR** **`task/agent-platform-o36.2` → `feature/<feature-name>`** to merge this entire segment (**MVP E2E (o36.1–o36.2)**) into the feature branch.

## Git workflow (mandatory)

**Segment:** MVP E2E (o36.1–o36.2). **Chained branches:** first task in segment from `feature/<feature-name>`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-o36.2`** → `feature/<feature-name>`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-o36.1`** |
| **This task’s branch** | **`task/agent-platform-o36.2`** |
| **Segment tip (opens PR to `feature/<feature-name>`)** | **`task/agent-platform-o36.2`** |
| **This task is segment tip?** | **Yes — merge whole segment here** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-o36.2`** from **`task/agent-platform-o36.1`**. |
| **Intermediate tasks** | Push **`task/agent-platform-o36.2`**; next task checks out from **`task/agent-platform-o36.2`** (or from remote `origin/task/agent-platform-o36.2`). |
| **Segment tip** | One PR **`task/agent-platform-o36.2` → `feature/<feature-name>`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/<feature-name>`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [x] Beads **description** and **acceptance_criteria** satisfied.
- [x] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [x] All **upstream** Beads issues are **closed** (per Beads).
- [x] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-o36.2` → `feature/<feature-name>`** (segment **MVP E2E (o36.1–o36.2)** complete) — *fill link when merged on GitHub*
- [x] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-o36.2`** and tests are green

- [x] **Task branch** **`task/agent-platform-o36.2`** created from **`task/agent-platform-o36.1`** before implementation
- [x] **Unit tests** executed and passing (minimum gate)
- [x] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged **`task/agent-platform-o36.2` → `feature/<feature-name>`** (link: _________________)
- [x] `bd close agent-platform-o36.2` — done (see Beads history)
- [x] `decisions.md` updated only if architectural decision changed
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
