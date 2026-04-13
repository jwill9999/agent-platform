# Task: Foundation: scaffold pnpm monorepo

**Beads issue:** `agent-platform-mov.1`  
**Spec file:** `docs/tasks/agent-platform-mov.1.md` (this file)  
**Parent epic:** `agent-platform-mov` — Epic: Foundation — monorepo, contracts, Docker, CI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-mov.1.md`

## Task requirements

### From Beads (description)

Root package.json with pnpm workspaces; apps/* and packages/* layout; shared TypeScript config (strict); ESLint + Prettier; scripts: build, test, typecheck, lint.

### From Beads (acceptance criteria)

pnpm install succeeds; pnpm -r typecheck passes (stub packages ok); workspace globs correct; README or CONTRIBUTOR note on commands.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| — | *No `blocks` dependencies (parent epic only)* |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-mov.2` | [Foundation: packages/contracts (Zod + types)](./agent-platform-mov.2.md) |
| `agent-platform-mov.3` | [Foundation: Docker + Docker Compose + SQLite volume](./agent-platform-mov.3.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-mov.1`** from **`feature/agent-platform-mvp`** (chained Git):  
   `git fetch origin && git checkout feature/agent-platform-mvp && git pull` then `git checkout -b task/agent-platform-mov.1`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-mov.1` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-mov.1`** to `origin`. **Do not** PR to `feature/agent-platform-mvp` yet. The next task in this segment branches from **`task/agent-platform-mov.1`**.

## Git workflow (mandatory)

**Segment:** Foundation (mov.1–mov.5). **Chained branches:** first task in segment from `feature/agent-platform-mvp`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-mov.5`** → `feature/agent-platform-mvp`.

| | |
|---|---|
| **Parent for this branch** | **`feature/agent-platform-mvp`** |
| **This task’s branch** | **`task/agent-platform-mov.1`** |
| **Segment tip (opens PR to `feature/agent-platform-mvp`)** | **`task/agent-platform-mov.5`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-mov.5`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-mov.1`** from **`feature/agent-platform-mvp`**. |
| **Intermediate tasks** | Push **`task/agent-platform-mov.1`**; next task checks out from **`task/agent-platform-mov.1`** (or from remote `origin/task/agent-platform-mov.1`). |
| **Segment tip** | One PR **`task/agent-platform-mov.5` → `feature/agent-platform-mvp`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/agent-platform-mvp`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **Branch** **`task/agent-platform-mov.1`** pushed; next task branches from here (**no** PR to `feature/agent-platform-mvp` until **`task/agent-platform-mov.5`**)
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-mov.1`** and tests are green (PR to `feature` only at segment tip).

- [ ] **Task branch** **`task/agent-platform-mov.1`** created from **`feature/agent-platform-mvp`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-mov.5`**
- [ ] `bd close agent-platform-mov.1 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
