# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-20
- **Session:** Implemented wall-time deadline propagation into harness graph nodes (closes Threat 2 gap).

---

## What happened (this session)

### Wall-time deadline propagation

Implemented cooperative deadline checking so every graph node (LLM calls, tool dispatch) checks remaining time before starting work. The API-level `timeoutMs` is now propagated into graph state as `startedAtMs` / `deadlineMs`, and a pure `checkDeadline()` helper returns `{expired, remainingMs, elapsedMs}`.

**Files created:**

- `packages/harness/src/deadline.ts` — core helper function
- `packages/harness/test/deadline.test.ts` — 6 unit tests

**Files modified:**

- `graphState.ts` — added `startedAtMs` + `deadlineMs` annotations
- `trace.ts` — added `deadline_exceeded` event type
- `buildGraph.ts` — deadline checks in routing functions
- `llmReason.ts` — deadline check before LLM call
- `toolDispatch.ts` — deadline check + tool timeout capping
- `chatRouter.ts` — wire initial state with `Date.now()` + `timeoutMs`
- `index.ts` — export new symbols
- Docs: `architecture.md`, `configuration.md`, `security.md`

**Tests:** 390 total (11 new deadline tests), all passing.

---

## Current state

### Git

- **`main`** — includes merged PR #67 (`d5b4d2e`)
- **`feature/wall-time-deadline`** — branched from `main`
- **`task/wall-time-deadline`** — pushed to origin (`c555718`), segment tip
- Next step: open PR `task/wall-time-deadline` → `feature/wall-time-deadline`

### Quality

- **390 tests** (harness 390), all passing
- Build, typecheck, lint, format all pass
- SonarCloud: pending CI run on new branch

### Key commits

| Commit    | Description                                       |
| --------- | ------------------------------------------------- |
| `c555718` | feat(harness): wall-time deadline propagation     |
| `d5b4d2e` | Merge PR #67 — security guards + docs into `main` |

---

## Next (priority order)

1. **Open PR** — `task/wall-time-deadline` → `feature/wall-time-deadline` (then merge feature → `main`)
2. **Per-tool rate limiting** — Harness-level rate limiting per tool type (lower priority)
3. **Document security architecture** — Add contributor guide for security guard patterns

---

## Blockers / questions for owner

- **PR review** — Security guards are advisory (trace events + logging), not hard-blocking. Confirm this posture is acceptable or if hard-blocking is needed for specific patterns.
- **Domain allowlist** — Currently optional (no allowlist = allow all). Should a default allowlist be configured?

---

## Key references

| Document                              | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `docs/architecture.md`                | System design, package roles, data flow    |
| `docs/architecture/message-flow.md`   | Mermaid diagrams: chat → LLM → tools       |
| `docs/api-reference.md`               | REST endpoints, error shapes, schemas      |
| `docs/configuration.md`               | Env vars, model routing, limits, MCP setup |
| `docs/planning/security.md`           | Threat model (8 categories)                |
| `docs/planning/frontend-ui-phases.md` | Frontend UI phased plan (paused)           |
| `docs/tasks/`                         | Task spec files                            |

---

## Quick commands

```bash
make up          # Docker build + start + seed
make restart     # Rebuild + restart (keeps DB)
make reset       # Wipe DB + rebuild + reseed
pnpm test        # Vitest unit tests
pnpm typecheck   # TypeScript across all packages
pnpm lint        # ESLint (max-warnings 0)
```
