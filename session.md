# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-13
- **Session:** Planning + repo bootstrap (decisions, beads, git)

---

## What happened (recent)

- Confirmed product decisions: single user, Docker, SQLite volume first, secrets, OpenAI-first router with user-supplied model + key, filesystem MCP inside container boundary, tests required per task, bd for tasks.
- Initialized **bd (beads)** in this repo for epics/tasks; `AGENTS.md` documents workflow.
- Added **`decisions.md`** (this log + DoD) and **`session.md`** (this file).
- Broke each epic into **child tasks** in bd with **description + acceptance**; **blocks** dependencies between tasks (fixed one inverted CI edge). **`docs/tasks/<issue-id>.md`** per task: requirements, plan, dependency tables, DoD; Beads description starts with `Spec: …`.
- **Git workflow:** No commits to **`main`** except via PR. **`feature/<feature-name>`** and **`task/<task-name>`**. **Chained segments:** task 2 branches from task 1, …, **one PR** from **segment tip** (e.g. `task/agent-platform-mov.5`) **→ `feature/agent-platform-mvp`**. Example: `feature/agent-platform-mvp`, `task/agent-platform-mov.1` … `task/agent-platform-mov.5`. Sign-off: **unit tests** + checklist + **`bd close`**; **PR to `feature`** on segment tip only.

---

## Current state

- **Codebase:** No application monorepo yet—only ADR/plan markdown and project metadata.
- **Tracking:** Beads (**bd**) initialized with six epics (blocked chain: Foundation → Persistence → Harness; Planner after Harness; Frontend after Harness; E2E after Frontend + Planner). Run `bd ready --json` for next work.
- **Epic IDs (bd):** `agent-platform-mov` (foundation), `agent-platform-j9x` (persistence + API), `agent-platform-2tw` (harness), `agent-platform-dx3` (planner + plugins), `agent-platform-ast` (frontend), `agent-platform-o36` (MVP E2E).
- **Git:** Remote `origin` on GitHub; naming **`feature/<feature-name>`** and **`task/<task-name>`** per `decisions.md` / `docs/tasks/README.md` (e.g. `feature/agent-platform-mvp`).

---

## Next (priority order)

1. **`bd update agent-platform-mov.1 --claim`** then implement **Foundation: scaffold pnpm monorepo** (`agent-platform-mov.1`). Run `bd ready` after closing each task.
2. Then **contracts** (`mov.2`) and **Docker** (`mov.3`) in parallel after `mov.1`; then **API health** (`mov.4`); then **CI** (`mov.5`).
3. Longer horizon unchanged: Persistence → Harness → Planner+plugins → Frontend → E2E (see bd graph).

---

## Blockers / questions for owner

- (none)

---

## Quick commands

```bash
bd ready --json          # Next unblocked work
bd show <id>             # Issue detail
```
