# Task: Harness: integration test — agent + MCP tool path

**Beads issue:** `agent-platform-2tw.5`  
**Spec file:** `docs/tasks/agent-platform-2tw.5.md` (this file)  
**Parent epic:** `agent-platform-2tw` — Epic: Harness — MCP, validation, LangGraph, streaming

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-2tw.5.md`

## Task requirements

### From Beads (description)

End-to-end in test or compose: register MCP tool, allowlisted agent, single chat turn invokes tool; verify validation rejects disallowed tool.

### From Beads (acceptance criteria)

Automated test green in CI; documented setup for local MCP.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-2tw.4` | [Harness: chat streaming + model router (OpenAI first)](./agent-platform-2tw.4.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| — | *No `blocks` dependencies (parent epic only)* |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-2tw.5`** from **`task/agent-platform-2tw.4`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-2tw.4 && git pull` then `git checkout -b task/agent-platform-2tw.5`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-2tw.5` shows expected upstream Beads issues **closed** where applicable.
5. **Segment tip:** open **one PR** **`task/agent-platform-2tw.5` → `feature/<feature-name>`** to merge this entire segment (**Harness (2tw.1–2tw.5)**) into the feature branch.

## Git workflow (mandatory)

**Segment:** Harness (2tw.1–2tw.5). **Chained branches:** first task in segment from `feature/<feature-name>`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-2tw.5`** → `feature/<feature-name>`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-2tw.4`** |
| **This task’s branch** | **`task/agent-platform-2tw.5`** |
| **Segment tip (opens PR to `feature/<feature-name>`)** | **`task/agent-platform-2tw.5`** |
| **This task is segment tip?** | **Yes — merge whole segment here** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-2tw.5`** from **`task/agent-platform-2tw.4`**. |
| **Intermediate tasks** | Push **`task/agent-platform-2tw.5`**; next task checks out from **`task/agent-platform-2tw.5`** (or from remote `origin/task/agent-platform-2tw.5`). |
| **Segment tip** | One PR **`task/agent-platform-2tw.5` → `feature/<feature-name>`**. |
| **Next segment** | After merge, branch **`task/<first-of-next>`** from **updated** `feature/<feature-name>`. |

## Tests (required before sign-off)

- **Unit (minimum):** Run unit tests for packages you changed; **all must pass** before sign-off.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **PR** merged: **`task/agent-platform-2tw.5` → `feature/<feature-name>`** (segment **Harness (2tw.1–2tw.5)** complete)
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-2tw.5`** and tests are green

- [ ] **Task branch** **`task/agent-platform-2tw.5`** created from **`task/agent-platform-2tw.4`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR** merged **`task/agent-platform-2tw.5` → `feature/<feature-name>`** (link: _________________)
- [ ] `bd close agent-platform-2tw.5 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
