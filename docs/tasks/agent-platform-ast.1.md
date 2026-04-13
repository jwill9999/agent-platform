# Task: Frontend: Next.js app + useChat + API wiring

**Beads issue:** `agent-platform-ast.1`  
**Spec file:** `docs/tasks/agent-platform-ast.1.md` (this file)  
**Parent epic:** `agent-platform-ast` — Epic: Frontend — Next.js chat + config UI

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-ast.1.md`

## Task requirements

### From Beads (description)

apps/web: Next.js App Router; Vercel AI SDK useChat pointing to backend stream; env for API base URL; minimal layout; no business logic in client beyond forms.

### From Beads (acceptance criteria)

Manual or E2E smoke: message sends and streams; types imported from contracts where possible.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-2tw.4` | [Harness: chat streaming + model router (OpenAI first)](./agent-platform-2tw.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-ast.2` | [Frontend: Output renderers (text, code, tool_result, error, thinking)](./agent-platform-ast.2.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-ast.1`** from **`feature/<feature-name>`** (chained Git):  
   `git fetch origin && git checkout feature/<feature-name> && git pull` then `git checkout -b task/agent-platform-ast.1`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-ast.1` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-ast.1`** to `origin`. **Do not** PR to `feature/<feature-name>` yet. The next task in this segment branches from **`task/agent-platform-ast.1`**.

## Git workflow (mandatory)

**Segment:** Frontend (ast.1–ast.3). **Chained branches:** first task in segment from `feature/<feature-name>`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-ast.3`** → `feature/<feature-name>`.

| | |
|---|---|
| **Parent for this branch** | **`feature/<feature-name>`** |
| **This task’s branch** | **`task/agent-platform-ast.1`** |
| **Segment tip (opens PR to `feature/<feature-name>`)** | **`task/agent-platform-ast.3`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-ast.3`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-ast.1`** from **`feature/<feature-name>`**. |
| **Intermediate tasks** | Push **`task/agent-platform-ast.1`**; next task checks out from **`task/agent-platform-ast.1`** (or from remote `origin/task/agent-platform-ast.1`). |
| **Segment tip** | One PR **`task/agent-platform-ast.3` → `feature/<feature-name>`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/<feature-name>`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **Branch** **`task/agent-platform-ast.1`** pushed; next task branches from here (**no** PR to `feature/<feature-name>` until **`task/agent-platform-ast.3`**)
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-ast.1`** and tests are green (PR to `feature` only at segment tip).

- [ ] **Task branch** **`task/agent-platform-ast.1`** created from **`feature/<feature-name>`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-ast.3`**
- [ ] `bd close agent-platform-ast.1 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
