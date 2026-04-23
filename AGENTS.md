# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

**Beads = task state** (next task, open/done, dependencies). **Git = code history** (branches, commits). When picking or finishing work, use **`bd ready`** / **`bd show`** / **`bd close`**—do not rely on Git alone. See **`decisions.md`** → _Task management: Beads vs Git_.

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

See `docs/configuration.md` for the full environment variable reference including BFF, rate-limiting, and model defaults.

## Quick Reference

**Frontend UI / design pause:** Do not treat **`agent-platform-ntf`** as ready to implement until product planning completes — see **`docs/planning/frontend-ui-phases.md`**.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**

```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**

- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Key Decisions (Locked)

- Single user, no auth (MVP)
- SQLite on Docker volume (Postgres expansion path)
- Docker for all runtime — never run API/web locally
- No hardcoded model IDs — provider + model + API key are user-configurable
- Built-in system tools — bash, read/write/list files with risk tiers, PathJail, bash guard, and HITL approval
- Frontend UI unblocked — see `docs/planning/frontend-ui-phases.md` for phased approach
- Plugin hooks: backend lifecycle only for MVP

See `decisions.md` for the full locked decision table.

## Reference Documentation

For detailed specs beyond this summary, consult:

| Document                            | Contents                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/architecture.md`              | System overview, data flow with security checkpoints, streaming protocol, session locking                    |
| `docs/architecture/message-flow.md` | Mermaid diagrams of the full message lifecycle (chat, tool dispatch, error handling)                         |
| `docs/api-reference.md`             | All `/v1` endpoints, request/response shapes, NDJSON protocol, endpoint exposure table                       |
| `docs/configuration.md`             | Environment variables, execution limits schema, context window, model routing, MCP transports, rate limiting |
