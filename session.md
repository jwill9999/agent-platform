# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-20
- **Session:** Implemented per-tool rate limiting + wall-time deadline propagation (PRs #68 merged; rate limiting on task branch).

---

## What happened (this session)

### Wall-time deadline propagation (PR #68 — merged)

Cooperative deadline checking across all harness graph nodes. `startedAtMs`/`deadlineMs` propagated into graph state. 11 new tests.

### Per-tool rate limiting (task branch)

Added `ToolRateLimiter` — sliding-window rate limiter (default 30 calls/min per tool) integrated into the tool dispatch loop. New `toolRateLimitPerMinute` field in `ExecutionLimits`. 8 new tests.

---

## Current state

### Git

- **`main`** — includes PR #68 (wall-time deadline)
- **`feature/per-tool-rate-limit`** — branched from `main`
- **`task/per-tool-rate-limit`** — pushed to origin, segment tip
- Next: open PR `task/per-tool-rate-limit` → `feature/per-tool-rate-limit`

### Quality

- **398 harness tests**, all passing (480 total across all packages)
- Build, typecheck, lint, format all pass

### Key commits

| Commit    | Description                                            |
| --------- | ------------------------------------------------------ |
| `31c3855` | feat(harness): per-tool sliding-window rate limiting   |
| `5855611` | Merge PR #68 — wall-time deadline propagation → `main` |

---

## Next (priority order)

1. **Merge rate limiting** — Open PR for per-tool rate limit branch
2. **Document security architecture** — Add contributor guide for security guard patterns

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
