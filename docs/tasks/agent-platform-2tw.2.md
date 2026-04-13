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
2. Create **`task/agent-platform-2tw.2`** from **`task/agent-platform-2tw.1`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-2tw.1 && git pull` then `git checkout -b task/agent-platform-2tw.2`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-2tw.2` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-2tw.2`** to `origin`. **Do not** PR to `feature/agent-platform-mvp` yet. The next task in this segment branches from **`task/agent-platform-2tw.2`**.

## Git workflow (mandatory)

**Segment:** Harness (2tw.1–2tw.5). **Chained branches:** first task in segment from `feature/agent-platform-mvp`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-2tw.5`** → `feature/agent-platform-mvp`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-2tw.1`** |
| **This task’s branch** | **`task/agent-platform-2tw.2`** |
| **Segment tip (opens PR to `feature/agent-platform-mvp`)** | **`task/agent-platform-2tw.5`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-2tw.5`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-2tw.2`** from **`task/agent-platform-2tw.1`**. |
| **Intermediate tasks** | Push **`task/agent-platform-2tw.2`**; next task checks out from **`task/agent-platform-2tw.2`** (or from remote `origin/task/agent-platform-2tw.2`). |
| **Segment tip** | One PR **`task/agent-platform-2tw.5` → `feature/agent-platform-mvp`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/agent-platform-mvp`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **Branch** **`task/agent-platform-2tw.2`** pushed; next task branches from here (**no** PR to `feature/agent-platform-mvp` until **`task/agent-platform-2tw.5`**)
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-2tw.2`** and tests are green (PR to `feature` only at segment tip).

- [ ] **Task branch** **`task/agent-platform-2tw.2`** created from **`task/agent-platform-2tw.1`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-2tw.5`**
- [ ] `bd close agent-platform-2tw.2 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
