# Agent Instructions — Shared

> **Single source of truth** for the operating instructions shared by every coding-agent surface in this repo (Claude Code, GitHub Copilot, OpenAI/Codex Agents, etc.). The per-tool entry-point files (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`) are thin wrappers that point here.

If you change a rule in this file, you do **not** need to mirror it in those wrappers.

Sections covered here:

- [Commands](#commands)
- [Architecture](#architecture)
- [Conventions](#conventions)
- [Environment Variables](#environment-variables)
- [Task Tracking (Beads)](#task-tracking-beads)
- [Git Workflow](#git-workflow)
- [Shell Commands](#shell-commands)
- [Key Decisions (Locked)](#key-decisions-locked)
- [Reference Documentation](#reference-documentation)
- [SonarQube / Problems Completion Gate](#sonarqube--problems-completion-gate)
- [Session Completion](#session-completion)

---

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

# Run individual services
make api                       # build + start API (port 3000)
make web                       # start Next.js dev server (port 3001)

# Quality gates
pnpm typecheck                 # TypeScript across all packages
pnpm lint                      # ESLint (max-warnings 0)
pnpm format:check              # Prettier
pnpm test                      # Vitest unit tests
pnpm test:e2e                  # Playwright (requires running compose stack)
pnpm docs:lint                 # markdownlint + lychee link check

# Single test file
pnpm --filter <package-name> run test -- <path/to/test.ts>
# Example: pnpm --filter @agent-platform/harness run test -- test/injectionGuard.test.ts

# Seed database
SQLITE_PATH=<path> pnpm seed   # idempotent
```

**Node version:** managed by `.nvmrc` (v20). The Makefile auto-runs `nvm install` when nvm is present.

---

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
- `src/index.ts` — bootstrap (open DB → mount Express → signal handlers)

**Key packages:**

- `packages/contracts` — Zod schemas shared across all layers
- `packages/db` — Drizzle ORM + better-sqlite3; migrations in `drizzle/`; AES-256-GCM secret storage
- `packages/harness` — LangGraph-based agent execution (ReAct loop + plan mode)
- `packages/model-router` — OpenAI provider routing via Vercel AI SDK
- `packages/mcp-adapter` — MCP client lifecycle + tool mapping
- `packages/plugin-sdk` — Plugin hooks: `onSessionStart`, `onTaskStart`, `onPromptBuild`, `onToolCall`, `onTaskEnd`, `onError`
- `packages/planner` — LLM-driven planning layer producing structured JSON output
- `packages/agent-validation` — Agent schema validation
- `packages/plugin-session` — Session plugin implementation
- `packages/plugin-observability` — Logging/tracing plugin (also exposes runtime tools)
- `packages/logger` — Structured JSON logging via `createLogger(service)`

**Data flow:** Chat message → Next.js BFF (`/api/chat`) → API `/v1/sessions/:id/chat` → harness (`buildGraph`) → model-router → LLM → plugin hooks → NDJSON stream back to UI.

For the full message lifecycle with security checkpoints and error handling, see [docs/architecture/message-flow.md](architecture/message-flow.md).

**Streaming protocol:** NDJSON (`application/x-ndjson`). Each line is an `Output` union: `text`, `code`, `tool_result`, `thinking`, `error`.

---

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

---

## Environment Variables

- `SQLITE_PATH` — required for API `/v1` routes
- `SECRETS_MASTER_KEY` — base64-encoded 32-byte key for AES-256-GCM
- `AGENT_OPENAI_API_KEY` — LLM API key (via `.env` or docker-compose)

See [docs/configuration.md](configuration.md) for the full environment variable reference including BFF, rate-limiting, and model defaults.

---

## Task Tracking (Beads)

This project uses **bd (beads)** for ALL issue tracking — not markdown TODOs, TodoWrite, TaskCreate, or external trackers.

```bash
bd ready              # find unblocked work
bd show <id>          # view issue details
bd update <id> --claim  # claim atomically
bd close <id>         # complete work
bd sync               # sync with git
```

Run `bd prime` for the detailed command reference and session-close protocol. Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files. Task spec files live in `docs/tasks/<issue-id>.md` (requirements, implementation plan, DoD); do not delete them after completion.

Every task issue must follow the required Beads schema in `docs/tasks/README.md` under **Expected Beads Schema (required)**, including a description first line of `Spec: docs/tasks/<issue-id>.md`.

**Beads = task state** (next task, open/done, dependencies). **Git = code history** (branches, commits). When picking or finishing work, use `bd ready` / `bd show` / `bd close` — do not rely on Git alone. See `decisions.md` → _Task management: Beads vs Git_.

---

## Git Workflow

Branching rules (locked):

- **`feature/<feature-name>`** — integration branch
- **`task/<task-name>`** — individual work units, chained linearly (each branches from the previous task branch)
- **Never commit directly to `main`**
- One PR per segment tip → `feature/<feature-name>`; then `feature` → `main` at release

Required branch lifecycle:

1. Create or use a **`feature/<feature-name>`** branch as the integration branch.
2. Create the first **`task/<task-name>`** branch from that feature branch.
3. Each subsequent task branch must be created from the previous task branch.
4. The final task branch in the chain contains the cumulative task changes and opens the integration PR into **`feature/<feature-name>`**.
5. After integration testing and CI/CD pipelines pass on the feature branch, merge **`feature/<feature-name>`** into **`main`** via PR.

---

## Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts. `cp` / `mv` / `rm` may be aliased to `-i` on some systems, causing the agent to hang waiting for y/n input.

```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# Recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

Other commands that may prompt:

- `scp` — use `-o BatchMode=yes`
- `ssh` — use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` — use `-y`
- `brew` — use `HOMEBREW_NO_AUTO_UPDATE=1`

---

## Key Decisions (Locked)

- Single user, no auth (MVP)
- SQLite on Docker volume (Postgres expansion path)
- Docker for all runtime — never run API/web locally
- No hardcoded model IDs — provider + model + API key are user-configurable
- Built-in system tools — bash, read/write/list files with risk tiers, PathJail, bash guard, and HITL approval
- Frontend UI unblocked — see [docs/planning/frontend-ui-phases.md](planning/frontend-ui-phases.md)
- Plugin hooks: backend lifecycle only for MVP

See `decisions.md` for the full locked decision table and ADRs in [docs/adr/](adr/) for architectural records.

---

## Reference Documentation

| Document                                                          | Contents                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [docs/architecture.md](architecture.md)                           | System overview, data flow with security checkpoints, streaming protocol, session locking                    |
| [docs/architecture/message-flow.md](architecture/message-flow.md) | Mermaid diagrams of the full message lifecycle (chat, tool dispatch, error handling)                         |
| [docs/api-reference.md](api-reference.md)                         | All `/v1` endpoints, request/response shapes, NDJSON protocol, endpoint exposure table                       |
| [docs/configuration.md](configuration.md)                         | Environment variables, execution limits schema, context window, model routing, MCP transports, rate limiting |
| [docs/adr/](adr/)                                                 | Architecture Decision Records                                                                                |

---

## SonarQube / Problems Completion Gate

**Strict.** If any code file is changed, a quality gate is mandatory before completion.

1. **First choice:** SonarQube MCP. Run analysis for all touched files and fix issues in priority order:
   - Blocker
   - Critical
   - Major
2. **If SonarQube MCP is unavailable, immediately fall back to:**
   - IDE Problems diagnostics
   - Typecheck
   - Lint
   - Relevant tests

**Completion is blocked when either condition is true:**

- Any unresolved Blocker/Critical issue exists in touched files
- Any Problems error exists in touched files

The agent must re-run checks after fixes and repeat until the gate passes or clearly report why it cannot pass. Final response must include: checks run, files fixed, remaining issues (with reason), and an explicit pass/fail gate status.

**Tooling behaviour:**

- Prefer SonarQube MCP for issue discovery and remediation guidance
- If MCP cannot run, Problems + terminal quality commands are the authoritative fallback
- Never claim done if the gate status is failed

---

## Session Completion

When ending a work session, you MUST complete ALL steps below. Work is **NOT** complete until `git push` succeeds.

1. **File issues for remaining work** — create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) — tests, linters, builds
3. **Update issue status** — close finished work, update in-progress items
4. **PUSH TO REMOTE** — mandatory:

   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up** — clear stashes, prune remote branches
6. **Verify** — all changes committed AND pushed
7. **Hand off** — provide context for next session via `session.md`

**Critical rules:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push
- If push fails, resolve and retry until it succeeds
