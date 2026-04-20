# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

The **Makefile** loads **nvm** when present and runs **`nvm install`** in the repo root so **`.nvmrc`** is applied (installs that Node version if missing). Use that for consistent Node across `make install`, `build`, `seed`, etc.

```bash
# Install
pnpm install

# Build all packages (required before running)
pnpm build

# Run API + Web together (builds first)
make up                        # PORT=3000, WEB_PORT=3001 (build, seed, API + web)
make restart                   # down + up — keeps SQLite
make new                       # install + reset — full scratch (wipes DB)
make reset                     # down + wipe DB + build + seed + up (no install)

# Run individual services
make api                       # build + start API (port 3000)
make web                       # start Next.js dev server (port 3001)

# Seed database
SQLITE_PATH=<path> pnpm seed   # idempotent
# `make seed` runs `pnpm rebuild:native`, verifies native addon via `new Database(':memory:')`, then seeds with cwd `packages/db`. Root `pnpm seed` uses `pnpm --filter @agent-platform/db run seed` (needs prior `pnpm build`).

# Quality gates
pnpm typecheck                 # TypeScript across all packages
pnpm lint                      # ESLint (max-warnings 0)
pnpm format:check              # Prettier
pnpm test                      # Vitest unit tests
pnpm test:e2e                  # Playwright (requires running compose stack)

# Run a single Vitest test file
pnpm --filter <package-name> run test -- <path/to/test.ts>
```

**Node version:** managed by `.nvmrc` (v20). The Makefile auto-runs `nvm install` when nvm is present.

## Architecture

This is a **pnpm monorepo** with two apps and eleven shared packages.

### Apps

| App        | Tech                  | Port | Purpose                                           |
| ---------- | --------------------- | ---- | ------------------------------------------------- |
| `apps/api` | Express + TypeScript  | 3000 | REST JSON API, agent execution host               |
| `apps/web` | Next.js 15 + React 19 | 3001 | Chat UI; proxies to API via `/api/chat` BFF route |

**API clean architecture:**

- `src/application/` — use cases
- `src/infrastructure/` — DB, MCP clients, HTTP middleware, external calls
- `src/interfaces/http/` — thin Express routes/controllers (do NOT put business logic here)
- `src/index.ts` — bootstrap (open DB → mount Express → signal handlers)

### Shared Packages

| Package                         | Role                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`            | Zod schemas shared between all layers (agents, skills, tools, sessions, plans)                                                    |
| `packages/db`                   | Drizzle ORM + better-sqlite3; migrations in `drizzle/`; AES-256-GCM secret storage                                                |
| `packages/harness`              | LangGraph-based agent execution (ReAct loop + plan mode)                                                                          |
| `packages/model-router`         | OpenAI provider routing via Vercel AI SDK; provider+model+key are user-configurable                                               |
| `packages/mcp-adapter`          | MCP client lifecycle (`session.ts`); transforms MCP tools to contract tools                                                       |
| `packages/plugin-sdk`           | Plugin interface + hook dispatcher; hooks: `onSessionStart`, `onTaskStart`, `onPromptBuild`, `onToolCall`, `onTaskEnd`, `onError` |
| `packages/planner`              | LLM-driven planning layer producing structured JSON output                                                                        |
| `packages/agent-validation`     | Agent schema validation                                                                                                           |
| `packages/plugin-session`       | Session plugin implementation                                                                                                     |
| `packages/plugin-observability` | Logging/tracing plugin                                                                                                            |
| `packages/logger`               | Structured JSON logging via `createLogger(service)`                                                                               |

### Data Flow

Chat message → Next.js BFF (`/api/chat`) → API `/v1/sessions/:id/chat` → harness (`buildGraph`) → model-router → LLM → plugin hooks → NDJSON stream back to UI.

For the full message lifecycle with security checkpoints and error handling, see **`docs/architecture/message-flow.md`**.

**Streaming protocol:** NDJSON (`application/x-ndjson`). Each line is an `Output` union: `text`, `code`, `tool_result`, `thinking`, `error`.

### API Routes (`/v1`)

Skills, Tools, MCP Servers, Agents, Sessions — all CRUD. Error shape: `{ error: { code, message, details? } }`. No auth (single-user MVP).

### Database

SQLite via Drizzle ORM. Tables: `agents`, `skills`, `tools`, `mcp_servers`, `sessions`, `secret_refs`. Secrets are never stored in plaintext — always AES-256-GCM encrypted with `key_version` for rotation.

## Conventions

**TypeScript:**

- Target ES2022, `NodeNext` module resolution, strict mode
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `noUncheckedIndexedAccess: true` — indexed access returns `T | undefined`

**Error shape:** `{ error: { code, message, details? } }` — enforced via `HttpError` class in `apps/api/src/infrastructure/http/httpError.ts`.

**Secrets:** Never plaintext. AES-256-GCM encrypted in `secret_refs` table. Never log master key, IV, ciphertext, or decrypted values.

**No hardcoded model IDs.** Provider + model + API key are user-configurable. Resolution: agent `modelOverride` → env defaults → system fallback (`openai`/`gpt-4o`).

**Frontend data:** API is single source of truth. Frontend must never hardcode backend defaults — fetch from `GET /v1/settings`.

**Security modules** live in `packages/harness/src/security/` (injection guard, output guard, MCP trust guard, URL guard, bash guard, path jail). Wiring points are in the application-layer nodes (`toolDispatch.ts`, `llmReason.ts`) and `factory.ts`.

## Environment Variables

- `SQLITE_PATH` — required for API to serve `/v1` routes
- `SECRETS_MASTER_KEY` — base64-encoded 32-byte key for AES-256-GCM secret encryption
- `AGENT_OPENAI_API_KEY` — LLM API key (via `.env` or docker-compose)

See `docs/configuration.md` for the full environment variable reference including BFF, rate-limiting, and model defaults.

## Task & Git Workflow

This project uses **bd (beads)** for all issue tracking — not markdown TODOs or external trackers.

```bash
bd ready --json          # find unblocked work
bd show <id>             # view issue details
bd update <id> --claim   # claim atomically
bd close <id>            # complete work
```

**Branching rules (locked):**

- `feature/<feature-name>` — integration branch
- `task/<task-name>` — individual work units, chained linearly (each branches from the previous task branch)
- Never commit directly to `main`
- One PR per segment tip → `feature/<feature-name>`; then `feature` → `main` at release

Task spec files live in `docs/tasks/<issue-id>.md` (requirements, implementation plan, DoD). Do not delete them after completion.

## Shell Commands

Always use non-interactive flags to avoid hanging on prompts:

```bash
cp -f   mv -f   rm -f   rm -rf   cp -rf
```

`cp`/`mv`/`rm` may be aliased to `-i` on some systems.

## Key Decisions (Locked)

- **Single user, no auth** — MVP is local-first, no multi-tenant
- **SQLite on Docker volume** — Postgres is the documented expansion path
- **No hardcoded model IDs** — provider + model + API key are user-configurable
- **Built-in system tools** — bash, read/write/list files with risk tiers, PathJail, bash guard, and HITL approval
- **Docker for all runtime** — never run API/web locally
- **Frontend UI paused** — do not implement `agent-platform-ntf` until `docs/planning/frontend-ui-phases.md` planning completes
- **Plugin hooks:** backend lifecycle only for MVP

See `decisions.md` for the full locked decision table and `session.md` for current session context.

## Reference Documentation

For detailed information beyond what is summarised above, consult:

| Document                            | Contents                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/architecture.md`              | System overview, data flow with security checkpoints, streaming protocol, session locking                    |
| `docs/architecture/message-flow.md` | Mermaid diagrams of the full message lifecycle (chat, tool dispatch, error handling)                         |
| `docs/api-reference.md`             | All `/v1` endpoints, request/response shapes, NDJSON streaming protocol, endpoint exposure table             |
| `docs/configuration.md`             | Environment variables, execution limits schema, context window, model routing, MCP transports, rate limiting |
