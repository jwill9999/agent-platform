# Copilot Instructions — Agent Platform

## Commands

```bash
# Install & build
pnpm install
pnpm build                     # required before running anything

# Docker runtime (preferred)
make up                        # build + seed + start API (3000) + web (3001)
make restart                   # down + up — keeps SQLite
make reset                     # wipe DB + rebuild + reseed + up
make new                       # full scratch (install + reset)

# Quality gates
pnpm typecheck                 # TypeScript across all packages
pnpm lint                      # ESLint (max-warnings 0)
pnpm format:check              # Prettier
pnpm test                      # Vitest unit tests
pnpm test:e2e                  # Playwright (requires running compose stack)

# Single test file
pnpm --filter <package-name> run test -- <path/to/test.ts>
# Example: pnpm --filter @agent-platform/harness run test -- test/injectionGuard.test.ts

# Seed database
SQLITE_PATH=<path> pnpm seed   # idempotent
```

**Node version:** managed by `.nvmrc` (v20). The Makefile auto-runs `nvm install` when nvm is present.

## Architecture

**pnpm monorepo** — two apps, eleven shared packages.

| App        | Tech                  | Port | Purpose                                     |
| ---------- | --------------------- | ---- | ------------------------------------------- |
| `apps/api` | Express + TypeScript  | 3000 | REST JSON API, agent execution host         |
| `apps/web` | Next.js 15 + React 19 | 3001 | Chat UI, proxies to API via `/api/chat` BFF |

**API clean architecture:**

- `src/application/` — use cases
- `src/infrastructure/` — DB, MCP clients, HTTP middleware, external calls
- `src/interfaces/http/` — thin Express routes/controllers (do NOT put business logic here)

**Key packages:**

- `packages/contracts` — Zod schemas shared across all layers
- `packages/db` — Drizzle ORM + better-sqlite3; migrations in `drizzle/`; AES-256-GCM secret storage
- `packages/harness` — LangGraph-based agent execution (ReAct loop + plan mode)
- `packages/model-router` — OpenAI provider routing via Vercel AI SDK
- `packages/mcp-adapter` — MCP client lifecycle + tool mapping
- `packages/plugin-sdk` — Plugin hooks: `onSessionStart`, `onTaskStart`, `onPromptBuild`, `onToolCall`, `onTaskEnd`, `onError`
- `packages/logger` — Structured JSON logging via `createLogger(service)`

**Data flow:** Chat message → Next.js BFF (`/api/chat`) → API `/v1/sessions/:id/chat` → harness (`buildGraph`) → model-router → LLM → plugin hooks → NDJSON stream back to UI.

For the full message lifecycle with security checkpoints and error handling, see **`docs/architecture/message-flow.md`**.

**Streaming protocol:** NDJSON (`application/x-ndjson`). Each line is an `Output` union: `text`, `code`, `tool_result`, `thinking`, `error`.

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

- `SQLITE_PATH` — required for API `/v1` routes
- `SECRETS_MASTER_KEY` — base64-encoded 32-byte key for AES-256-GCM
- `AGENT_OPENAI_API_KEY` — LLM API key (via `.env` or docker-compose)

## Task Tracking

This project uses **bd (beads)** for all issue tracking — not markdown TODOs.

```bash
bd ready              # find unblocked work
bd show <id>          # view issue details
bd update <id> --claim  # claim atomically
bd close <id>         # complete work
```

Task spec files: `docs/tasks/<issue-id>.md`. Do not delete after completion.

## Git Workflow

- **`feature/<feature-name>`** — integration branch
- **`task/<task-name>`** — individual work, chained linearly from previous task branch
- **Never commit directly to `main`**
- One PR per segment tip → `feature/<feature-name>`; then `feature` → `main` at release

See `decisions.md` for the full locked decision table.

## Shell Commands

Always use non-interactive flags (`cp -f`, `mv -f`, `rm -f`, `rm -rf`) — some systems alias these to `-i`.

## Reference Documentation

For detailed specs beyond this summary, consult:

| Document                            | Contents                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/architecture.md`              | System overview, data flow with security checkpoints, streaming protocol, session locking                    |
| `docs/architecture/message-flow.md` | Mermaid diagrams of the full message lifecycle (chat, tool dispatch, error handling)                         |
| `docs/api-reference.md`             | All `/v1` endpoints, request/response shapes, NDJSON protocol, endpoint exposure table                       |
| `docs/configuration.md`             | Environment variables, execution limits schema, context window, model routing, MCP transports, rate limiting |

## Key Decisions (Locked)

- Single user, no auth (MVP)
- SQLite on Docker volume (Postgres expansion path)
- Docker for all runtime — never run API/web locally
- No hardcoded model IDs — provider + model + API key are user-configurable
- Built-in system tools — bash, read/write/list files with risk tiers, PathJail, bash guard, and HITL approval
- Frontend UI unblocked — see `docs/planning/frontend-ui-phases.md` for phased approach
- Plugin hooks: backend lifecycle only for MVP

SonarQube/Problems Completion Gate (Strict)

- If any code file is changed, a quality gate is mandatory before completion.
- First choice: SonarQube MCP.
- Run SonarQube MCP analysis for all touched files and fix issues in priority order:
- Blocker
- Critical
- Major
- If SonarQube MCP is unavailable, immediately fall back to:
- IDE Problems diagnostics
- Typecheck
- Lint
- Relevant tests
- Completion is blocked when either condition is true:
  - Any unresolved Blocker/Critical issue exists in touched files
  - Any Problems error exists in touched files
- The agent must re-run checks after fixes and repeat until the gate passes or clearly report why it cannot pass.
- Final response must include:
  - Checks run
  - Files fixed
  - Remaining issues (if any) with reason
  - Explicit pass/fail gate status

## Tooling Behavior Rules

- Prefer SonarQube MCP for issue discovery and remediation guidance.
- If MCP cannot run, use Problems + terminal quality commands as authoritative fallback.
- Never claim done if gate status is fail.
