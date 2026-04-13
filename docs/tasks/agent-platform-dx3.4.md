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
2. Create **`task/agent-platform-dx3.4`** from **`task/agent-platform-dx3.3`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-dx3.3 && git pull` then `git checkout -b task/agent-platform-dx3.4`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-dx3.4` shows expected upstream Beads issues **closed** where applicable.
5. **Segment tip:** open **one PR** **`task/agent-platform-dx3.4` → `feature/<feature-name>`** to merge this entire segment (**Planner + plugins (dx3.1–dx3.4)**) into the feature branch.

## Git workflow (mandatory)

**Segment:** Planner + plugins (dx3.1–dx3.4). **Chained branches:** first task in segment from `feature/<feature-name>`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-dx3.4`** → `feature/<feature-name>`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-dx3.3`** |
| **This task’s branch** | **`task/agent-platform-dx3.4`** |
| **Segment tip (opens PR to `feature/<feature-name>`)** | **`task/agent-platform-dx3.4`** |
| **This task is segment tip?** | **Yes — merge whole segment here** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-dx3.4`** from **`task/agent-platform-dx3.3`**. |
| **Intermediate tasks** | Push **`task/agent-platform-dx3.4`**; next task checks out from **`task/agent-platform-dx3.4`** (or from remote `origin/task/agent-platform-dx3.4`). |
| **Segment tip** | One PR **`task/agent-platform-dx3.4` → `feature/<feature-name>`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/<feature-name>`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-dx3.4` → `feature/<feature-name>`** (segment **Planner + plugins (dx3.1–dx3.4)** complete)
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-dx3.4`** and tests are green

- [ ] **Task branch** **`task/agent-platform-dx3.4`** created from **`task/agent-platform-dx3.3`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged **`task/agent-platform-dx3.4` → `feature/<feature-name>`** (link: _________________)
- [ ] `bd close agent-platform-dx3.4 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
