# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-17
- **Session:** Seeded **Coding** specialist in `runSeed` (stable id/slug); prior OpenAPI/Makefile/legacy-repair work — branch `task/explorer-collapse-cta` (tip `76b8274`).

---

## What happened (this session)

### Agents API + local dev workflow

- **`contracts/openapi/agent-platform.yaml`** — `PUT /v1/agents/{idOrSlug}` request body uses **`AgentCreateBody`** (same as POST) so OpenAPI validation no longer requires `id`/`slug` in JSON; matches `agentsRouter` + UI.
- **`Makefile`** — `make up` runs **`seed`**; **`make restart`** = down + up (keeps SQLite); **`make new`** = install + reset (full scratch); **`setup`** = install + up only.
- **`README.md`**, **`docs/development.md`**, **`CLAUDE.md`** — document first-time start, restart, scratch.

### DB — stale schema repair

- **`packages/db/src/legacyRepair.ts`** + **`database.ts`** — after **`migrate()`**, idempotent repair for pre-0005 **`skills`** / slug columns when journal vs file drift.

### IDE explorer + toolbar — `task/explorer-collapse-cta` _(earlier commits)_

- **`ide-with-chat.tsx`** — Explorer “Collapse all folders” CTA; removed duplicate sidebar **Menu** button.

### Frontend V0 Integration epic — `feature/frontend-v0` — PR #52 (all CI green) _(historical)_

Completed the `agent-platform-cfg` task (config dashboards). Full epic chain:

1. **agent-platform-fdu** — Tailwind v4 + shadcn foundation (previously done)
2. **agent-platform-lsh** — Layout shell, sidebar, theme toggle (previously done)
3. **agent-platform-cht** — Chat interface + AI SDK v4 wiring (previously done, PR #51 superseded)
4. **agent-platform-cfg** — Config dashboards (this session)
   - `AgentsDashboard` — card grid, search, visual editor with model override + execution limits
   - `SkillsDashboard` — card grid, inline editor (goal, constraints, output schema)
   - `McpDashboard` — list layout, transport selector (stdio/http/sse), args/metadata editors
   - `ToolsDashboard` — card grid, inline editor (name, description, config JSON)
   - Models page — styled InfoCard layout with lucide icons
   - Plugins page — centered empty state with Puzzle icon
   - Sessions page — styled form + session list with badges
   - New UI primitives: Input, Badge, Label, Textarea
   - Fixed e2e test: disambiguated "AI Studio" heading selector (sidebar h1 vs empty state h2)
   - Fixed layout height chain: main → flex column for proper Chat visibility

---

## Current state

### Epics

| Epic                        | ID                   | Status                | PR     |
| --------------------------- | -------------------- | --------------------- | ------ |
| **Agent Schema & Factory**  | `agent-platform-nzq` | **Complete** — merged | —      |
| **Agent Runtime Loop**      | `agent-platform-n0l` | **Complete** — merged | PR #25 |
| **Harness Hardening**       | `agent-platform-qlp` | **Complete** — merged | PR #26 |
| SonarCloud fixes            | —                    | **Complete** — merged | PR #27 |
| SSEClientTransport replace  | `agent-platform-pe4` | **Complete** — merged | PR #28 |
| Structured logger           | `agent-platform-qhe` | **Complete** — merged | PR #29 |
| Correlation IDs             | `agent-platform-hnx` | **Complete** — merged | PR #30 |
| Rate limiting & cost        | `agent-platform-nqn` | **Complete** — merged | PR #31 |
| Runtime config API          | `agent-platform-16p` | **Complete** — merged | PR #32 |
| Provider-agnostic routing   | `agent-platform-bto` | **Complete** — merged | PR #33 |
| **OpenAPI Integration**     | `agent-platform-fx5` | **Complete** — merged | PR #34 |
| **Runtime Hardening**       | —                    | **Complete** — merged | PR #39 |
| **DB Safety**               | —                    | **Complete** — merged | PR #41 |
| **Frontend V0 Integration** | `agent-platform-o63` | **Complete** — PR #52 | PR #52 |

### Quality

- 237+ tests passing (55 API + 159 harness + 7 web + others)
- Build, typecheck, lint, format all clean
- All CI checks green on PR #52 (verify, docker, e2e, GitGuardian, SonarCloud)

### Git

- **`task/explorer-collapse-cta`** — tip includes OpenAPI agent fix + Makefile + legacy DB repair (`52284e2`); push/PR when ready.
- **Working tree (not in that commit):** local edits may remain on `Makefile`, `packages/db` legacy repair + tests — commit separately if still needed.
- `main` — up to date with `origin/main` at session start
- `feature/frontend-v0` — base branch for frontend epic
- `task/agent-platform-cfg` — segment tip, PR #52 open → `feature/frontend-v0`
- PR #51 closed (superseded by #52)

### Ready backlog

| ID                   | Priority | Title                                      | Status |
| -------------------- | -------- | ------------------------------------------ | ------ |
| `agent-platform-a9g` | P2       | Chat file/context attachments              | Open   |
| `agent-platform-d8u` | P2       | Concurrent session safety                  | Open   |
| `agent-platform-psa` | P2       | Context window management                  | Open   |
| `agent-platform-1nx` | P2       | Docs restructure: README as index          | Open   |
| `agent-platform-hkn` | P2       | Observability layer with pluggable metrics | Open   |
| `agent-platform-3kd` | P3       | Plugin sandboxing design spike             | Open   |
| `agent-platform-ged` | P3       | Deep health check                          | Open   |
| `agent-platform-tgp` | P3       | Secret rotation mechanism                  | Open   |

---

## Next (priority order)

1. **Push `task/explorer-collapse-cta`** and open PR (or merge per your branching rules).
2. **Merge PR #52** — Frontend V0 Integration → `feature/frontend-v0`, then `feature/frontend-v0` → `main`
3. **`agent-platform-a9g`** — Chat file/context attachments (P2, frontend)
4. **`agent-platform-d8u`** — Concurrent session safety (P2, harness/reliability)
5. **`agent-platform-psa`** — Context window management (P2, harness/runtime)
6. **Agent/model selector** — User discussed wanting agent picker in chat header (needs task)

---

## Blockers / questions for owner

- PR #52 needs review and merge to `feature/frontend-v0`, then `feature/frontend-v0` → `main`

---

## Key references

- **Code review:** `docs/reviews/2026-04-15-api-harness-review.md`
- **Architecture ADR:** `docs/planning/architecture.md`
- **Task specs:** `docs/tasks/` directory
- **Frontend UI phases:** `docs/planning/frontend-ui-phases.md`

---

## Quick commands

```bash
bd ready --json
gh pr view 52
pnpm install && pnpm build && pnpm typecheck && pnpm lint && pnpm test
```
