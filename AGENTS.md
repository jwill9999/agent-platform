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

<!-- BEGIN BEADS INTEGRATION -->

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Version-controlled: Built on Dolt with cell-level merge
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

### Exception: decision log and session handoff

These files are **not** task trackers; they complement bd:

- **`decisions.md`** — Architectural and product decisions (see also Definition of Done there).
- **`session.md`** — Short narrative: what changed, current focus, next steps; update at session end.

Do not replace bd issues with these; keep tasks, acceptance criteria, and closure in bd.

### Task specification files (`docs/tasks/`)

Each **task** issue includes `Spec: docs/tasks/<issue-id>.md` at the start of its **description**. Those Markdown files hold detailed implementation plans and sign-off checklists; **bd** still owns ordering via **`blocks`** dependencies. When planning discovers new cross-task dependencies, add **`bd dep add`** first, then update the spec tables.

### Git branches (mandatory)

- **Naming:** **`feature/<feature-name>`** (integration); **`task/<task-name>`** (each task).
- **Chaining (default):** the **first** task in a segment branches from **`feature/<feature-name>`**. **Each next** task branches from the **previous `task/<task-name>`** branch (linear chain). **One PR per segment** from **`task/<segment-tip>` → `feature/<feature-name>`** when that segment’s tasks are done—not a PR per task. Next segment starts from **updated** `feature/<feature-name>`.
- **Never commit directly to `main`.** When the feature is ready on **`feature/<feature-name>`**, open **one** PR **`feature/<feature-name>` → `main`**.
- **Before sign-off:** unit tests pass (minimum); checklist complete; **`bd close`**; **PR to `feature`** only on **segment tip** (see `docs/tasks/<issue-id>.md`).

For more details, see `docs/tasks/README.md` and `decisions.md`.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until the **current task branch** is pushed to `origin` (unless nothing was implemented).

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - **Unit tests** (minimum), linters, builds
3. **Update issue status** - Close finished work only after **PR merged** and checklist in `docs/tasks/<issue-id>.md` is complete
4. **PUSH THE TASK BRANCH** - This is MANDATORY when commits exist:
   ```bash
   git fetch origin
   # Rebase onto parent: previous task branch or feature (see task spec)
   git push -u origin HEAD
   git status
   ```
   Do **not** push to `main`. If this task is the **segment tip**, open **one** PR **`task/<tip> → feature/<feature-name>`**. If using `bd` with git export, run your usual **`bd` sync** workflow if the project documents it.
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed to the **task branch**; next task branches from here, **or** open segment PR if this is the tip
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until the **task branch** is pushed when there are commits
- NEVER commit directly to **`main`**
- NEVER merge a task PR to **`main`**; merge **segment tip** to **`feature/<feature-name>`**; merge **`feature` → `main`** only at release
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->

## Key Decisions (Locked)

- Single user, no auth (MVP)
- SQLite on Docker volume (Postgres expansion path)
- Docker for all runtime — never run API/web locally
- No hardcoded model IDs — provider + model + API key are user-configurable
- Built-in system tools — bash, read/write/list files with risk tiers, PathJail, bash guard, and HITL approval
- Frontend UI paused until `docs/planning/frontend-ui-phases.md` planning completes
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
