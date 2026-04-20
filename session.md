# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-20
- **Session:** Lazy skill loading merged to `main` (PR #70 → #71). Branches cleaned.

---

## What happened (this session)

### Lazy skill loading — merged ✅

- Implemented lazy skill loading: stubs-only system prompt + `sys_get_skill_detail` on-demand tool
- Extended Skill schema with `description` and `hint` (contracts + DB migration 0009)
- Governor: warn@3, error@5 per-skill loads (reasoning loop detection)
- Addressed PR review: trace accuracy, ghost-tool filtering, SonarQube fix
- 14 new tests, 412 total harness tests passing
- Full architecture docs: `docs/architecture/lazy-skill-loading.md`
- PR #70 (`task → feature`), PR #71 (`feature → main`) — both merged

---

## Current state

### Git

- **`main`** — includes lazy skill loading (PR #71), per-tool rate limiting (PR #69), all prior features
- No open feature or task branches

### Quality

- **412 harness tests**, all passing
- Build, typecheck, lint all clean
- SonarQube Quality Gate passed on PR #70

### Key commits on `main`

| Commit    | Description                                      |
| --------- | ------------------------------------------------ |
| `bd0deea` | Merge PR #71 — lazy skill loading → `main`       |
| `2506999` | fix: PR #70 review (trace ok, ghost-tool filter) |
| `3a95ede` | feat(harness): implement lazy skill loading      |
| `c57b33f` | Merge PR #69 — per-tool rate limiting → `main`   |

---

## Next (priority order)

1. **Frontend UI** — `agent-platform-ntf` is unblocked (P2). See `docs/planning/frontend-ui-phases.md` for phased approach.
2. **Document security architecture** — Add contributor guide for security guard patterns
3. **Domain allowlist** — Currently optional (no allowlist = allow all). Consider default config.

---

## Blockers / questions for owner

- **Domain allowlist** — Currently optional (no allowlist = allow all). Should a default allowlist be configured?

---

## Key references

| Document                                  | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `docs/architecture.md`                    | System design, package roles, data flow    |
| `docs/architecture/message-flow.md`       | Mermaid diagrams: chat → LLM → tools       |
| `docs/api-reference.md`                   | REST endpoints, error shapes, schemas      |
| `docs/configuration.md`                   | Env vars, model routing, limits, MCP setup |
| `docs/planning/lazy-skill-loading.md`     | Lazy skill pattern (planning reference)    |
| `docs/architecture/lazy-skill-loading.md` | Lazy skill loading implementation guide    |
| `docs/planning/security.md`               | Threat model (8 categories)                |
| `docs/planning/frontend-ui-phases.md`     | Frontend UI phased plan (unblocked)        |
| `docs/tasks/`                             | Task spec files                            |

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
