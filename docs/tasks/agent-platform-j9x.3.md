# Task: Persistence: seed + default agent

**Beads issue:** `agent-platform-j9x.3`  
**Spec file:** `docs/tasks/agent-platform-j9x.3.md` (this file)  
**Parent epic:** `agent-platform-j9x` — Epic: Persistence + API shell + secrets

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-j9x.3.md`

## Task requirements

### From Beads (description)

Seed script: default agent row, empty registries optional demo skill; idempotent migrations+seed in dev and CI.

### From Beads (acceptance criteria)

pnpm seed or equivalent runs clean; default agent queryable; documented in README.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-j9x.2` | [Persistence: encrypted secrets storage](./agent-platform-j9x.2.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-j9x.4` | [Persistence: CRUD API for registries and agents](./agent-platform-j9x.4.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-j9x.3`** from **`task/agent-platform-j9x.2`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-j9x.2 && git pull` then `git checkout -b task/agent-platform-j9x.3`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-j9x.3` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-j9x.3`** to `origin`. **Do not** PR to `feature/agent-platform-persistence` yet. The next task in this segment branches from **`task/agent-platform-j9x.3`**.

## Git workflow (mandatory)

**Segment:** Persistence + API (j9x.1–j9x.4). **Chained branches:** first task in segment from `feature/agent-platform-persistence`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-j9x.4`** → `feature/agent-platform-persistence`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-j9x.2`** |
| **This task’s branch** | **`task/agent-platform-j9x.3`** |
| **Segment tip (opens PR to `feature/agent-platform-persistence`)** | **`task/agent-platform-j9x.4`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-j9x.4`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-j9x.3`** from **`task/agent-platform-j9x.2`**. |
| **Intermediate tasks** | Push **`task/agent-platform-j9x.3`**; next task checks out from **`task/agent-platform-j9x.3`** (or from remote `origin/task/agent-platform-j9x.3`). |
| **Segment tip** | One PR **`task/agent-platform-j9x.4` → `feature/agent-platform-persistence`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/agent-platform-persistence`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [x] Beads **description** and **acceptance_criteria** satisfied.
- [x] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [x] All **upstream** Beads issues are **closed** (per Beads).
- [x] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [x] **Branch** **`task/agent-platform-j9x.3`** pushed; next task branches from here (**no** PR to `feature/agent-platform-persistence` until **`task/agent-platform-j9x.4`**)
- [x] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-j9x.3`** and tests are green (PR to `feature` only at segment tip).

- [x] **Task branch** **`task/agent-platform-j9x.3`** created from **`task/agent-platform-j9x.2`** before implementation
- [x] **Unit tests** executed and passing (minimum gate)
- [x] **Checklists** in this document (Definition of done + Sign-off) are complete
- [x] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-j9x.4`**
- [x] `bd close agent-platform-j9x.3`
- [x] `decisions.md` updated only if architectural decision changed
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
