# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-20
- **Session:** PR #69 merged — per-tool rate limiting now on `main`. Both security hardening features (deadline + rate limit) shipped.

---

## What happened (this session)

### Wall-time deadline propagation (PR #68 — merged)

Cooperative deadline checking across all harness graph nodes. `startedAtMs`/`deadlineMs` propagated into graph state. 11 new tests.

### Per-tool rate limiting (task branch)

Added `ToolRateLimiter` — sliding-window rate limiter (default 30 calls/min per tool) integrated into the tool dispatch loop. New `toolRateLimitPerMinute` field in `ExecutionLimits`. 8 new tests.

---

## Current state

### Git

- **`main`** — up to date, includes PR #69 (`c57b33f`) — per-tool rate limiting
- Feature/task branches cleaned up
- No open PRs

### Quality

- **398 harness tests**, 480 total across all packages, all passing
- Build, typecheck, lint, format all pass

### Key commits

| Commit    | Description                                            |
| --------- | ------------------------------------------------------ |
| `c57b33f` | Merge PR #69 — per-tool rate limiting → `main`         |
| `5855611` | Merge PR #68 — wall-time deadline propagation → `main` |

---

## Next (priority order)

1. **Document security architecture** — Add contributor guide for security guard patterns

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
