# Task: [Short title]

**Beads issue:** `agent-platform-…`  
**Spec file:** `docs/tasks/agent-platform-….md` (this file)  
**Parent epic:** `agent-platform-…` — [Epic title]

The Beads issue **description** must begin with: `Spec: docs/tasks/<issue-id>.md`

## Task requirements

Summarize **what** must exist after this task (product/technical outcomes). Pull from the Beads **description**; expand here if planning adds detail.

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. Do **not** close this issue until every **upstream** task below is already **closed**.

### Upstream — must be complete before this task

| Issue | Spec |
|-------|------|
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Downstream — waiting on this task

| Issue | Spec |
|-------|------|
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Planning notes

If planning discovers **additional** dependencies (e.g. shared contracts, env vars), add them here **and** add or adjust **`bd dep add`** so Beads stays the single scheduling source of truth.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Follow **Git workflow (mandatory)** below: branch from the **parent branch** listed there (**`feature/<feature-name>`** for the first task in a segment, or **`task/<previous-task-name>`** when chaining).
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list <issue-id>` shows expected upstream Beads issues **closed** before you finish (unless this spec says otherwise for parallel planning).
5. If this is the **last task in a segment**, open **one PR** **`task/<tip> → feature/<feature-name>`**. If **not** the last, hand off: the **next** task branches from **`task/<this-task-name>`**.

## Git workflow (mandatory)

**Chained tasks:** **`feature/<feature-name>`** → **`task/<task-1>`** → **`task/<task-2>`** → … → **one PR** from **`task/<last>`** → **`feature/<feature-name>`**.

| Rule | Detail |
|------|--------|
| **No `main`** | Never push commits directly to **`main`**. |
| **First task in segment** | Branch **`task/<task-name>`** from **`feature/<feature-name>`** (e.g. `feature/agent-platform-mvp`). |
| **Later tasks in segment** | Branch **`task/<task-name>`** from **`task/<previous-task-name>`** after the previous task’s work is pushed. |
| **Intermediate tasks** | **No** separate PR to `feature`. Push your branch; complete sign-off; next developer checks out from your **`task/...`** branch. |
| **Last task in segment** | Open **one** PR **`task/<tip> → feature/<feature-name>`** to land the whole segment. |
| **Next segment** | First task branches from **updated** **`feature/<feature-name>`** after the segment PR is merged. |
| **Release** | When the feature is ready: **`feature/<feature-name>` → `main`** via one PR. |

## Tests (required before sign-off)

- **Unit (minimum):** Run the project’s unit test command for packages you changed; **all must pass** before the task is signed off. Add or update tests for new logic.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **Git:** branch pushed; **if this is the segment tip**, **PR** merged **`task/<tip> → feature/<feature-name>`**; if **not** tip, next task can branch from **`task/<this-task-name>`**.
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

- [ ] **Task branch** created from the correct **parent** (`feature/...` or previous **`task/...`**) **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Checklists** in this document (Definition of done + Sign-off) are complete
- [ ] If **segment tip:** **PR** merged **`task/<tip> → feature/<feature-name>`** (link: _________________) — *if not tip, write “N/A — merge at segment end”*
- [ ] `bd close <issue-id> --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** _____________________ **Date:** _____________
