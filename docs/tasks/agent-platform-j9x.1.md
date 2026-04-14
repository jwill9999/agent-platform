# Task: Persistence: DB schema + ORM + migrations (SQLite)

**Beads issue:** `agent-platform-j9x.1`  
**Spec file:** `docs/tasks/agent-platform-j9x.1.md` (this file)  
**Parent epic:** `agent-platform-j9x` — Epic: Persistence + API shell + secrets

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-j9x.1.md`

## Task requirements

### From Beads (description)

Drizzle or Prisma; tables for skills, tools/MCP servers, agents with allowlists, sessions, chat metadata, plugin catalog refs; migrations; connect to SQLite file on volume path from env.

### From Beads (acceptance criteria)

migrate up on clean DB; migrate test in CI; schema matches contracts v0; no secrets in plain text columns.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.5` | [Foundation: CI (GitHub Actions)](./agent-platform-mov.5.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-j9x.2` | [Persistence: encrypted secrets storage](./agent-platform-j9x.2.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-j9x.1`** from **`feature/agent-platform-persistence`** (chained Git):  
   `git fetch origin && git checkout feature/agent-platform-persistence && git pull` then `git checkout -b task/agent-platform-j9x.1`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-j9x.1` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-j9x.1`** to `origin`. **Do not** PR to `feature/agent-platform-persistence` yet. The next task in this segment branches from **`task/agent-platform-j9x.1`**.

## Git workflow (mandatory)

**Segment:** Persistence + API (j9x.1–j9x.4). **Chained branches:** first task in segment from `feature/agent-platform-persistence`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-j9x.4`** → `feature/agent-platform-persistence`.

| | |
|---|---|
| **Parent for this branch** | **`feature/agent-platform-persistence`** |
| **This task’s branch** | **`task/agent-platform-j9x.1`** |
| **Segment tip (opens PR to `feature/agent-platform-persistence`)** | **`task/agent-platform-j9x.4`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-j9x.4`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-j9x.1`** from **`feature/agent-platform-persistence`**. |
| **Intermediate tasks** | Push **`task/agent-platform-j9x.1`**; next task checks out from **`task/agent-platform-j9x.1`** (or from remote `origin/task/agent-platform-j9x.1`). |
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
- [x] **Branch** **`task/agent-platform-j9x.1`** pushed; next task branches from here (**no** PR to `feature/agent-platform-persistence` until **`task/agent-platform-j9x.4`**)
- [x] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-j9x.1`** and tests are green (PR to `feature` only at segment tip).

- [x] **Task branch** **`task/agent-platform-j9x.1`** created from **`feature/agent-platform-persistence`** before implementation
- [x] **Unit tests** executed and passing (minimum gate)
- [x] **Checklists** in this document (Definition of done + Sign-off) are complete
- [x] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-j9x.4`**
- [x] `bd close agent-platform-j9x.1` (closed: Drizzle schema + migrations + tests + API migrate hook)
- [x] `decisions.md` updated only if architectural decision changed
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
