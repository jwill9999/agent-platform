# Task: Frontend: Output renderers (text, code, tool_result, error, thinking)

**Beads issue:** `agent-platform-ast.2`  
**Spec file:** `docs/tasks/agent-platform-ast.2.md` (this file)  
**Parent epic:** `agent-platform-ast` — Epic: Frontend — Next.js chat + config UI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-ast.2.md`

## Task requirements

### From Beads (description)

Render Output union; code blocks with syntax highlight; tool_result panel; error states; thinking gated behind toggle + user setting stub.

### From Beads (acceptance criteria)

Storybook or component tests optional; visual regression not required.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-ast.1` | [Frontend: Next.js app + useChat + API wiring](./agent-platform-ast.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-ast.3` | [Frontend: configuration UI (skills, MCP, agents, plugins, models)](./agent-platform-ast.3.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-ast.2`** from **`task/agent-platform-ast.1`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-ast.1 && git pull` then `git checkout -b task/agent-platform-ast.2`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-ast.2` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-ast.2`** to `origin`. **Do not** PR to `feature/<feature-name>` yet. The next task in this segment branches from **`task/agent-platform-ast.2`**.

## Git workflow (mandatory)

**Segment:** Frontend (ast.1–ast.3). **Chained branches:** first task in segment from `feature/<feature-name>`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-ast.3`** → `feature/<feature-name>`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-ast.1`** |
| **This task’s branch** | **`task/agent-platform-ast.2`** |
| **Segment tip (opens PR to `feature/<feature-name>`)** | **`task/agent-platform-ast.3`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-ast.3`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-ast.2`** from **`task/agent-platform-ast.1`**. |
| **Intermediate tasks** | Push **`task/agent-platform-ast.2`**; next task checks out from **`task/agent-platform-ast.2`** (or from remote `origin/task/agent-platform-ast.2`). |
| **Segment tip** | One PR **`task/agent-platform-ast.3` → `feature/<feature-name>`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/<feature-name>`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [x] Beads **description** and **acceptance_criteria** satisfied.
- [x] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [x] All **upstream** Beads issues are **closed** (per Beads).
- [x] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [x] **Branch** **`task/agent-platform-ast.2`** pushed; next task branches from here (**no** PR to `feature/<feature-name>` until **`task/agent-platform-ast.3`**)
- [x] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-ast.2`** and tests are green (PR to `feature` only at segment tip).

- [x] **Task branch** **`task/agent-platform-ast.2`** created from **`task/agent-platform-ast.1`** before implementation
- [x] **Unit tests** executed and passing (minimum gate)
- [x] **Checklists** in this document (Definition of done + Sign-off) are complete
- [x] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-ast.3`**
- [x] `bd close agent-platform-ast.2 --reason "…"`
- [x] `decisions.md` updated only if architectural decision changed
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
