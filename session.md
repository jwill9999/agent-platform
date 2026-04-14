# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-15
- **Session:** Full API + harness + runtime assessment. Three epics and 13 tasks created in Beads with detailed specs in `docs/tasks/`.

---

## Paused — frontend UI / design (next return)

**Do not start `agent-platform-ntf` until planning completes.** Roadmap and Cursor design notes: **`docs/planning/frontend-ui-phases.md`**.

---

## What happened (this session)

- **Assessment:** Reviewed every source file across `apps/api`, `packages/harness`, `packages/planner`, `packages/plugin-sdk`, `packages/plugin-session`, `packages/plugin-observability`, `packages/agent-validation`, `packages/mcp-adapter`, `packages/model-router`, and `packages/contracts`.
- **Finding:** Foundation is solid (contracts, validation, plugins, MCP adapter, DB layer). The gap is the orchestration layer — nothing connects persisted agent config to actual LLM execution. The `/v1/chat/stream` endpoint is a raw OpenAI pass-through that bypasses all governance (allowlists, limits, plugins).
- **Architecture validation:** Compared against the 5-layer harness/runtime architecture (from project ADR and owner's article). Platform aligns well; the missing piece is specifically the runtime execution engine.
- **Planning:** Created 3 epics, 13 tasks, 13 spec files. All dependency-chained in Beads with `blocks` edges.
- **CLAUDE.md** created for future agent context.

---

## Current state

### Epics (in dependency order)

| Epic | ID | Tasks | Status |
|------|-----|-------|--------|
| **Agent Schema & Factory** | `agent-platform-nzq` | 3 (4wm → 2zy → yvd) | Open — first task ready |
| **Agent Runtime Loop** | `agent-platform-n0l` | 6 (9v1 → 6d5 → 40r → 16f → 5pe; icb parallel) | Open — blocked on Epic 1 |
| **Harness Hardening** | `agent-platform-qlp` | 4 (k7m → 9yb → dtc → xk3) | Open — blocked on Epic 2 |

### Ready task

**`agent-platform-4wm`** — Agent schema: add identity fields (`systemPrompt`, `description`).  
Spec: `docs/tasks/agent-platform-nzq.1.md`

### Git

- All work goes on **`feature/agent-platform-runtime`** (to be created from `main`).
- Three segments (one per epic), each with chained task branches and one PR at segment tip → `feature/agent-platform-runtime`.
- Final: `feature/agent-platform-runtime` → `main`.

---

## Next (priority order)

1. Start **`agent-platform-4wm`**: `git checkout -b feature/agent-platform-runtime main && git checkout -b task/agent-platform-4wm`
2. Follow spec at `docs/tasks/agent-platform-nzq.1.md`.
3. After Epic 1 segment lands, start Epic 2 from updated `feature/agent-platform-runtime`.

---

## Blockers / questions for owner

- (none)

---

## Quick commands

```bash
bd ready --json
bd show agent-platform-4wm
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
git checkout main && git pull
```
