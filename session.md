# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-20
- **Session:** **Post-merge** — PR #67 merged to `main`. Security guards + comprehensive doc updates now on `main`.

---

## What happened (this session)

### 1. Harness Security Guards (prior session, same branch)

Implemented 3 critical + 2 partial security defences from `docs/planning/security.md`:

- `injectionGuard.ts` — 13-pattern regex scanner, XML untrusted wrapping, system prompt reinforcement
- `outputGuard.ts` — 8 credential patterns, outbound body scanning, redaction
- `mcpTrustGuard.ts` — tool name shadowing, description injection, suspicious schema fields
- `totalToolCalls` counter with configurable limit
- 10MB file size limits on write/append operations
- Optional domain allowlist in `urlGuard.ts`

### 2. Documentation Audit

Full audit of documentation against current codebase — rewrote `docs/configuration.md`, `docs/database.md`, `docs/development.md`; created message-flow Mermaid diagrams; updated API reference, architecture docs; synced all three AI instruction files; corrected "Filesystem via MCP" decision across all files.

### 3. PR #67 CI Failures — Fixed

- **SonarCloud code issues (3):** Fixed regex patterns in `outputGuard.ts` — use `\w` instead of `[A-Za-z0-9_]`, remove duplicate character class ranges caused by `/i` flag.
- **SonarCloud duplication (4.4% → target <3%):** Refactored test files using `it.each` tables and shared helpers — `urlGuard.test.ts` (70.5% → eliminated), `injectionGuard.test.ts` (38.6% → eliminated), `toolDispatch.test.ts` (11.7% → eliminated). Net reduction: 141 lines.
- **SonarCloud security hotspots (2):** Marked as Safe — HTTP URL and hardcoded IP in `urlGuard.test.ts` are intentional test fixtures for the URL security guard.
- **GitGuardian (2 findings):** Added `gitguardian:ignore` comments on test fixtures (jwt.io example JWT and test password pattern in `outputGuard.test.ts`).

---

## Current state

### Git

- **`main`** — up to date, includes merged PR #67 (`d5b4d2e`)
- Feature/task branches cleaned up
- No open PRs

### Quality

- **379 harness tests**, all passing
- Build, typecheck, lint all pass
- SonarCloud hotspots reviewed; code issues fixed; duplication reduced

### Key commits

| Commit    | Description                                       |
| --------- | ------------------------------------------------- |
| `d5b4d2e` | Merge PR #67 — security guards + docs into `main` |

---

## Next (priority order)

1. **Wall-time deadline** — Propagate API wall-time into graph state so nodes can check remaining time (minor gap from Threat 2)
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
