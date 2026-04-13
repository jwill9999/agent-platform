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

---

## Current state

- **Codebase:** No application monorepo yet—only ADR/plan markdown and project metadata.
- **Tracking:** Beads (**bd**) initialized with six epics (blocked chain: Foundation → Persistence → Harness; Planner after Harness; Frontend after Harness; E2E after Frontend + Planner). Run `bd ready --json` for next work.
- **Epic IDs (bd):** `agent-platform-mov` (foundation), `agent-platform-j9x` (persistence + API), `agent-platform-2tw` (harness), `agent-platform-dx3` (planner + plugins), `agent-platform-ast` (frontend), `agent-platform-o36` (MVP E2E).
- **Git:** Repository initialized by bd bootstrap (add `git remote` when you use a host).

---

## Next (priority order)

1. **Phase 0 — Foundation:** pnpm workspaces, `packages/contracts` (Zod + stream types including `thinking`), one Dockerfile + `docker-compose.yml`, SQLite volume, minimal CI.
2. **Phase 1:** DB schema + migrations + seed default agent; `apps/api` CRUD; encrypted secrets storage.
3. Continue per `agent_platform_mvp_be346e14.plan.md` critical path (MCP adapter → harness → stream → web).

---

## Blockers / questions for owner

- (none)

---

## Quick commands

```bash
bd ready --json          # Next unblocked work
bd show <id>             # Issue detail
```
