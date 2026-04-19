# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-19
- **Session:** **Fix MCP Playwright streaming + CI/SonarCloud** — All code fixes complete, PR #62 fully green (verify, docker, e2e, SonarCloud, GitGuardian) — branch `task/mcp-image-streaming` (tip `f1dd918`).

---

## What happened (this session)

### Fix: MCP Playwright streaming hang, screenshot rendering, Docker workflow

**Three bugs fixed:**

1. **Stream hang / body timeout** — Root cause: MCP tool names contain colons (`serverId:toolName`) which violate OpenAI's `^[a-zA-Z0-9_-]+$` pattern. `toCoreMessages()` was sending unsanitized names back to the LLM on the second call (after tool dispatch), causing silent API rejection. Fixed by applying `sanitiseToolName()` in `toCoreMessages()` for both tool-call and tool-result messages. Also added 15s heartbeat to prevent undici body timeout.

2. **Screenshots appear as YAML/broken links** — `summarizeToolContent()` only handled `text` blocks. Added `extractImageOutputs()` to capture base64 images, `isMcpLocalPath()` to strip `.playwright-mcp/` file paths, and `image` Output type across contracts/harness/frontend.

3. **LLM passes filename to read-only `/app/`** — Added `rewriteFileArgs()` in MCP adapter that redirects `/app/` paths to writable `/tmp/playwright-mcp/`.

**Docker workflow:**

- Makefile rewritten as Docker-only (no local Node commands)
- API key propagation via `.env` → docker-compose interpolation
- Chromium installed in Docker image, MCP Playwright seeded in DB
- `/dev/shm` increased to 256MB for Chrome rendering

---

## Current state

### Git

- **`task/mcp-image-streaming`** — tip `f1dd918` (pushed to origin)
- **`feature/mcp-streaming-fix`** — parent feature branch (pushed)
- `main` — unchanged
- **PR #62** — `task/mcp-image-streaming` → `feature/mcp-streaming-fix` — all checks ✅

### Quality

- All CI checks pass: verify (lint, typecheck, build, test, seed), docker, e2e, SonarCloud, GitGuardian
- SonarCloud Quality Gate passed (0 new issues)
- 200+ harness/mcp-adapter/contracts tests passing
- `packages/db` tests fail locally (pre-existing native binding issue — works in CI/Docker)

### Ready backlog

| ID                   | Priority | Title                                      | Status |
| -------------------- | -------- | ------------------------------------------ | ------ |
| `agent-platform-a9g` | P2       | Chat file/context attachments              | Open   |
| `agent-platform-d8u` | P2       | Concurrent session safety                  | Open   |
| `agent-platform-psa` | P2       | Context window management                  | Open   |
| `agent-platform-1nx` | P2       | Docs restructure: README as index          | Open   |
| `agent-platform-hkn` | P2       | Observability layer with pluggable metrics | Open   |

---

## Next (priority order)

1. **Merge PR #62** — `task/mcp-image-streaming` → `feature/mcp-streaming-fix` → `main`
2. **Web UI verification** — Open http://localhost:3001 in Docker and confirm screenshots render inline, submit button recovers, stream completes
3. **Fix pre-push hook** — `packages/db` native binding needs rebuild or Docker-based test runner
4. **Coding agent config** — 60s timeout / 8K context too small for MCP workflows

---

## Blockers / questions for owner

- Pre-push hook fails locally due to `better-sqlite3` native binding mismatch (tests pass in Docker)

---

## Key references

- **Architecture ADR:** `docs/planning/architecture.md`
- **Task specs:** `docs/tasks/` directory
- **Frontend UI phases:** `docs/planning/frontend-ui-phases.md`

---

## Quick commands

```bash
make up          # Docker build + start + seed
make restart     # Rebuild + restart (keeps DB)
make reset       # Wipe DB + rebuild + reseed
```
