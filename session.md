# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-13
- **Session:** **`agent-platform-j9x.3`** — idempotent seed + default agent

---

## What happened (recent)

- **`packages/db`:** **`runSeed`**, **`DEFAULT_AGENT_ID`** (`default`), **`DEMO_SKILL_ID`** (`demo-skill`); idempotent inserts (`onConflictDoNothing`) for demo skill, default agent, and allowlist link.
- **CLI:** **`pnpm seed`** (root) → **`@agent-platform/db`** `node dist/seed/run.js` — requires **`SQLITE_PATH`** (runs migrations via **`openDatabase`** then seed).
- **Tests:** `seed.test.ts` — idempotency + **`loadAgentById`** / **`AgentSchema`** for default agent.
- **CI:** `task/**` push branches; **Seed (idempotent)** step runs **`pnpm run seed`** twice against `/tmp/agent-ci.sqlite`.
- **`README`:** documents **`pnpm seed`** and Docker note for same **`SQLITE_PATH`** as API.

---

## Current state

- **Branch:** **`task/agent-platform-j9x.3`** — push **`origin`**, **`bd close agent-platform-j9x.3`**. Next: **`task/agent-platform-j9x.4`** (CRUD API) from **`task/agent-platform-j9x.3`**.

---

## Next (priority order)

1. Branch **`task/agent-platform-j9x.4`** from **`origin/task/agent-platform-j9x.3`**.
2. Implement **`docs/tasks/agent-platform-j9x.4.md`**.

---

## Blockers / questions for owner

- (none)

---

## Quick commands

```bash
bd ready --json
bd show <id>
pnpm install && pnpm run build && pnpm run test
SQLITE_PATH=/path/to/db.sqlite pnpm run seed
docker compose up --build
```
