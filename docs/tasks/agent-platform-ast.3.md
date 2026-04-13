# Task: Frontend: configuration UI (skills, MCP, agents, plugins, models)

**Beads issue:** `agent-platform-ast.3`  
**Spec file:** `docs/tasks/agent-platform-ast.3.md` (this file)  
**Parent epic:** `agent-platform-ast` — Epic: Frontend — Next.js chat + config UI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-ast.3.md`

## Task requirements

### From Beads (description)

Forms for CRUD against API: skills markdown, MCP registry, agent allowlists, plugin defaults/overrides, model+provider+key masked; validation client-side mirrors Zod.

### From Beads (acceptance criteria)

Integration tests or Playwright for critical flows; a11y baseline on forms.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-ast.2` | [Frontend: Output renderers (text, code, tool_result, error, thinking)](./agent-platform-ast.2.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-o36.1` | [MVP E2E: automated happy path + CI job](./agent-platform-o36.1.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-ast.3`** from **`task/agent-platform-ast.2`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-ast.2 && git pull` then `git checkout -b task/agent-platform-ast.3`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-ast.3` shows expected upstream Beads issues **closed** where applicable.
5. **Segment tip:** open **one PR** **`task/agent-platform-ast.3` → `feature/agent-platform-mvp`** to merge this entire segment (**Frontend (ast.1–ast.3)**) into the feature branch.

## Git workflow (mandatory)

**Segment:** Frontend (ast.1–ast.3). **Chained branches:** first task in segment from `feature/agent-platform-mvp`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-ast.3`** → `feature/agent-platform-mvp`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-ast.2`** |
| **This task’s branch** | **`task/agent-platform-ast.3`** |
| **Segment tip (opens PR to `feature/agent-platform-mvp`)** | **`task/agent-platform-ast.3`** |
| **This task is segment tip?** | **Yes — merge whole segment here** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-ast.3`** from **`task/agent-platform-ast.2`**. |
| **Intermediate tasks** | Push **`task/agent-platform-ast.3`**; next task checks out from **`task/agent-platform-ast.3`** (or from remote `origin/task/agent-platform-ast.3`). |
| **Segment tip** | One PR **`task/agent-platform-ast.3` → `feature/agent-platform-mvp`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/agent-platform-mvp`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-ast.3` → `feature/agent-platform-mvp`** (segment **Frontend (ast.1–ast.3)** complete)
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-ast.3`** and tests are green

- [ ] **Task branch** **`task/agent-platform-ast.3`** created from **`task/agent-platform-ast.2`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged **`task/agent-platform-ast.3` → `feature/agent-platform-mvp`** (link: _________________)
- [ ] `bd close agent-platform-ast.3 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
