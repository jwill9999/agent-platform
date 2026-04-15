# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-15
- **Session:** Implemented tasks `agent-platform-4wm` (schema identity fields) and `agent-platform-2zy` (Agent Factory). Both complete and passing all quality gates (101 tests).

---

## Paused — frontend UI / design (next return)

**Do not start `agent-platform-ntf` until planning completes.** Roadmap and Cursor design notes: **`docs/planning/frontend-ui-phases.md`**.

---

## What happened (this session)

- **Task `agent-platform-4wm`** (completed): Added `systemPrompt` (required) and `description` (optional) to `AgentSchema` in contracts, DB schema, mappers, registry, seeds, web UI, and all test fixtures. Migration `0002_keen_owl.sql` generated. Committed and pushed.
- **Task `agent-platform-2zy`** (completed): Implemented Agent Factory in `packages/harness/src/factory.ts`:
  - `AgentContext` type: agent, systemPrompt, skills, tools, mcpSessions, pluginDispatcher, modelConfig.
  - `buildAgentContext(db, agentId, options?)`: loads agent/skills/tools/MCP configs from DB, opens MCP sessions (graceful failure), discovers MCP tools, builds augmented system prompt (deterministic sort by ID), resolves plugin chain, resolves model config.
  - `destroyAgentContext(ctx)`: closes all MCP sessions with error resilience.
  - `AgentNotFoundError` typed error.
  - 11 unit tests with mocked DB/MCP covering: full assembly, MCP failure resilience, system prompt augmentation order, model config resolution, plugin chain, missing entity filtering.
  - Added workspace deps: `@agent-platform/db`, `@agent-platform/mcp-adapter`, `@agent-platform/plugin-sdk`, `@agent-platform/plugin-session`.

---

## Current state

### Epics (in dependency order)

| Epic | ID | Tasks | Status |
|------|-----|-------|--------|
| **Agent Schema & Factory** | `agent-platform-nzq` | 3 (~~4wm~~ → ~~2zy~~ → yvd) | 2 of 3 complete |
| **Agent Runtime Loop** | `agent-platform-n0l` | 6 (9v1 → 6d5 → 40r → 16f → 5pe; icb parallel) | Open — blocked on Epic 1 |
| **Harness Hardening** | `agent-platform-qlp` | 4 (k7m → 9yb → dtc → xk3) | Open — blocked on Epic 2 |

### Ready task

**`agent-platform-yvd`** — MCP session lifecycle management.  
Spec: `docs/tasks/agent-platform-nzq.3.md`  
Branch from: `task/agent-platform-2zy`

### Git

- **`task/agent-platform-4wm`** — committed, pushed
- **`task/agent-platform-2zy`** — current branch, needs commit + push
- Branch chain: `main` → `feature/agent-platform-runtime` → `task/agent-platform-4wm` → `task/agent-platform-2zy`

---

## Next (priority order)

1. Commit and push `task/agent-platform-2zy`, close bead.
2. Start **`agent-platform-yvd`**: `git checkout -b task/agent-platform-yvd` from `task/agent-platform-2zy`.
3. Follow spec at `docs/tasks/agent-platform-nzq.3.md`.
4. After Epic 1 segment (yvd) lands, start Epic 2 from updated branch.

---

## Blockers / questions for owner

- (none)

---

## Quick commands

```bash
bd ready --json
bd show agent-platform-yvd
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
git checkout task/agent-platform-2zy
```
