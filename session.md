# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-15
- **Session:** Completed Epic 1 (Agent Schema & Factory) — all 3 tasks done (4wm, 2zy, yvd). 117 tests passing.

---

## Paused — frontend UI / design (next return)

**Do not start `agent-platform-ntf` until planning completes.** Roadmap and Cursor design notes: **`docs/planning/frontend-ui-phases.md`**.

---

## What happened (this session)

- **Task `agent-platform-4wm`** (completed): Added `systemPrompt` and `description` to Agent schema across contracts, DB, mappers, seeds, UI, tests.
- **Task `agent-platform-2zy`** (completed): Agent Factory — `buildAgentContext`/`destroyAgentContext` in `packages/harness/src/factory.ts`.
- **Task `agent-platform-yvd`** (completed): MCP session lifecycle management:
  - `McpSessionManager` class in `packages/mcp-adapter/src/manager.ts`: `openSessions` (parallel with `Promise.allSettled`), `getSession`, `closeAll`, `isHealthy`, `reconnect`.
  - Factory updated to use `McpSessionManager` instead of inline try/catch loops.
  - `AgentContext.mcpSessions` replaced with `AgentContext.mcpManager` (the manager instance).
  - `destroyAgentContext` now delegates to `mcpManager.closeAll()`.
  - 13 manager unit tests + 10 updated factory tests.
- **Epic 1 (`agent-platform-nzq`)** complete. PR opened: `task/agent-platform-yvd` → `feature/agent-platform-runtime`.

---

## Current state

### Epics (in dependency order)

| Epic | ID | Tasks | Status |
|------|-----|-------|--------|
| **Agent Schema & Factory** | `agent-platform-nzq` | 3 (~~4wm~~ → ~~2zy~~ → ~~yvd~~) | **Complete** — PR pending |
| **Agent Runtime Loop** | `agent-platform-n0l` | 6 (9v1 → 6d5 → 40r → 16f → 5pe; icb parallel) | Open — unblocked after Epic 1 merges |
| **Harness Hardening** | `agent-platform-qlp` | 4 (k7m → 9yb → dtc → xk3) | Open — blocked on Epic 2 |

### Ready task (after Epic 1 PR merges)

**`agent-platform-9v1`** — LLM reasoning node in harness graph.  
Spec: `docs/tasks/agent-platform-n0l.1.md`  
Branch from: updated `feature/agent-platform-runtime` after Epic 1 merge.

### Git

- **`task/agent-platform-4wm`** — committed, pushed
- **`task/agent-platform-2zy`** — committed, pushed
- **`task/agent-platform-yvd`** — committed, pushed (segment tip)
- Branch chain: `main` → `feature/agent-platform-runtime` → `task/agent-platform-4wm` → `task/agent-platform-2zy` → `task/agent-platform-yvd`
- PR: `task/agent-platform-yvd` → `feature/agent-platform-runtime`

---

## Next (priority order)

1. Merge Epic 1 PR (`task/agent-platform-yvd` → `feature/agent-platform-runtime`).
2. Start Epic 2: `git checkout -b task/agent-platform-9v1` from updated `feature/agent-platform-runtime`.
3. Follow spec at `docs/tasks/agent-platform-n0l.1.md`.

---

## Blockers / questions for owner

- (none)

---

## Quick commands

```bash
bd ready --json
bd show agent-platform-9v1
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
```
