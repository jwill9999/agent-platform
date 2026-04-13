# Task: Planner+Plugins: LLM planner JSON + validation + repair

**Beads issue:** `agent-platform-dx3.2`  
**Spec file:** `docs/tasks/agent-platform-dx3.2.md` (this file)  
**Parent epic:** `agent-platform-dx3` — Epic: Planner + plugin SDK + memory/observability

> **Beads:** The issue description in bd must start with: `Spec: docs/tasks/agent-platform-dx3.2.md`

## Task requirements

### From Beads (description)

Planner calls model to emit Plan JSON; strict Zod validation against resolved agent; reject/repair loop policy; no tool execution in planner.

### From Beads (acceptance criteria)

Unit tests with fixtures; rejects disallowed tools; integration with graph behind feature flag if needed.

## Dependency order

**Scheduling source of truth:** Beads `blocks` edges. If planning finds **new** dependencies, update **`bd dep add`** first, then edit this spec’s tables.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-dx3.1` | [Planner+Plugins: plugin-sdk package + hook contracts](./agent-platform-dx3.1.md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-o36.1` | [MVP E2E: automated happy path + CI job](./agent-platform-o36.1.md) |

### Planning notes

- Record cross-task assumptions (env vars, shared packages, API shape).
- New dependencies → update Beads **first**, then this file, so work is not completed in the wrong order.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Create **`task/agent-platform-dx3.2`** from **`task/agent-platform-dx3.1`** (chained Git):  
   `git fetch origin && git checkout task/agent-platform-dx3.1 && git pull` then `git checkout -b task/agent-platform-dx3.2`.
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list agent-platform-dx3.2` shows expected upstream Beads issues **closed** where applicable.
5. **Not the segment tip:** push **`task/agent-platform-dx3.2`** to `origin`. **Do not** PR to `feature/<feature-name>` yet. The next task in this segment branches from **`task/agent-platform-dx3.2`**.

## Git workflow (mandatory)

**Segment:** Planner + plugins (dx3.1–dx3.4). **Chained branches:** first task in segment from `feature/<feature-name>`; each later task from **previous** `task/...`. **One PR per segment** from **`task/agent-platform-dx3.4`** → `feature/<feature-name>`.

| | |
|---|---|
| **Parent for this branch** | **`task/agent-platform-dx3.1`** |
| **This task’s branch** | **`task/agent-platform-dx3.2`** |
| **Segment tip (opens PR to `feature/<feature-name>`)** | **`task/agent-platform-dx3.4`** |
| **This task is segment tip?** | **No — merge only after `task/agent-platform-dx3.4`** |

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **Chain** | Branch **`task/agent-platform-dx3.2`** from **`task/agent-platform-dx3.1`**. |
| **Intermediate tasks** | Push **`task/agent-platform-dx3.2`**; next task checks out from **`task/agent-platform-dx3.2`** (or from remote `origin/task/agent-platform-dx3.2`). |
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
- [ ] **Branch** **`task/agent-platform-dx3.2`** pushed; next task branches from here (**no** PR to `feature/<feature-name>` until **`task/agent-platform-dx3.4`**)
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

Complete after work is on **`task/agent-platform-dx3.2`** and tests are green (PR to `feature` only at segment tip).

- [ ] **Task branch** **`task/agent-platform-dx3.2`** created from **`task/agent-platform-dx3.1`** before implementation
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] **PR to `feature`:** N/A — segment merges on **`task/agent-platform-dx3.4`**
- [ ] `bd close agent-platform-dx3.2 --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
