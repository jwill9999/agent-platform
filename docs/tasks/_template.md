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

| Issue              | Spec                           |
| ------------------ | ------------------------------ |
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Downstream — waiting on this task

| Issue              | Spec                           |
| ------------------ | ------------------------------ |
| `agent-platform-…` | [Title](./agent-platform-….md) |

### Planning notes

If planning discovers **additional** dependencies (e.g. shared contracts, env vars), add them here **and** add or adjust **`bd dep add`** so Beads stays the single scheduling source of truth.

## Implementation plan

1. Read Beads acceptance criteria and this spec.
2. Follow **Git workflow (mandatory)** below: branch from the **parent branch** listed there (**`staging`** for the first bounded MVP task, or an accepted local task tip when chaining).
3. Implement with tests per **Tests** section; **unit tests must pass** before sign-off.
4. Ensure `bd dep list <issue-id>` shows expected upstream Beads issues **closed** before you finish (unless this spec says otherwise for parallel planning).
5. If this is the **last task in a segment**, open **one cumulative PR** **`task/<tip> → protected staging`**. If **not** the last, hand off: the **next** task branches from **`task/<this-task-name>`**.

## Git workflow (mandatory)

Default bounded MVP route: **`staging` → local task commits/tips → one PR into protected `staging`**.
Group related fixes, tests and documentation. A separate focused PR is reserved for an urgent blocker.

| Rule                 | Detail                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Base                 | First task starts from actual current staging. Following local task tips can branch from an accepted prior local tip.                           |
| Batch                | Publish the cumulative final tip after combined local gates and critic review. No intermediate feature PR or duplicated push cycle is required. |
| Qualification        | Keep repairs in the same PR. All required/executed exact-head hosted checks, security findings and actionable comments must clear.              |
| Authority            | Merge only with actual owner-granted protected-staging authority; passing checks alone grants none.                                             |
| Optional integration | Use a feature branch only for owner-agreed larger or parallel work that needs one.                                                              |
| Release              | Never commit directly to staging/main. Staging-to-main promotion requires separate explicit human approval.                                     |

## Tests (required before sign-off)

- **Unit (minimum):** Run the project’s unit test command for packages you changed; **all must pass** before the task is signed off. Add or update tests for new logic.
- **Integration / E2E:** When this task crosses API, DB, Docker, or browser boundaries (`decisions.md` default DoD).

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied.
- [ ] Every **pre-close** checkbox below is complete before the Beads close transition.
- [ ] All **upstream** Beads issues are **closed** (per Beads).
- [ ] **Unit tests** run and pass (minimum); integration/E2E as required above.
- [ ] **Git:** accepted changes published through the cumulative pushed tip; the declared protected-staging delivery is merged and verified. An intermediate local tip needs no separate push or PR.
- [ ] **Intermediate task:** exact-head acceptance, required review/tests, publication through cumulative ancestry, and declared batch delivery gate pass; no nonexistent PR is required.
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Pre-close sign-off

- [ ] **Task branch** created from the correct **parent** (`staging` or accepted previous **`task/...`**) **before** implementation work
- [ ] **Unit tests** executed and passing (minimum gate)
- [ ] **Definition of done and pre-close checklists** are complete
- [ ] If **segment tip:** **PR** merged **`task/<tip> → protected staging`** (link: **\*\*\*\***\_**\*\*\*\***) — _if not tip, write “N/A — merge at segment end”_
- [ ] If **intermediate:** exact accepted head and segment integration evidence recorded — _if tip, write “N/A — tip PR gate applies”_
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

The close operation happens after the declared gates pass, using normal authorized Beads tools for
native development. Only transitions owned by an explicitly selected prototype run use its broker.
Existing end-to-end owner authorization covers routine repairs and phase transitions; final owner
acceptance/merge authority stays separate.

## Post-close verification

- [ ] Close transition id/reason recorded (broker transition for an active run; manual operation id otherwise)
- [ ] Beads issue re-read as `closed`; downstream readiness reconciled
- [ ] If an explicit prototype run owns this transition, its journal and Beads agree

**Reviewer / owner:** \***\*\*\*\*\***\_\***\*\*\*\*\*** **Date:** **\*\***\_**\*\***
