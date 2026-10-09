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

## Native developer workflow

Native Codex is the normal developer route. Agree the task objective, requirements, definition of
done and relevant tests with the owner up front. Their authorization covers implementation choices,
file/subtask refinements, tests, repairs, retries, independent source-aware review and CI evaluation
through a concrete final owner acceptance check. Reuse recorded authorization across phases;
do not ask again solely because a file, subtask, test fix, retry or phase changes within that scope.

Use available native tools and project Beads/Git/documentation workflows within the actual permissions
of the Codex session. Repository profiles inherit those defaults. Read-only review responsibilities
are procedural assignments; do not claim they disable inherited tools. Independent reviewers may
inspect source and evidence with available tools without changing the reviewed work.

Clarify material changes to owner intent, agreed behavior/delivery or explicitly reserved actions,
and request required unavailable inputs. Report concrete blockers. Final owner acceptance, merges,
deployments, publication/spend beyond the authorized task and global settings changes require their
applicable authorization; passing tests does not grant it. For an end-to-end authorized task, plan
and implement autonomously after resolving independent critique without another routine handoff grant.

`packages/workflow-control` is a PAUSED explicit orchestration prototype. Its discovery, isolation,
gateway, budget, admission, broker routing and exact-material persisted approval are not prerequisites
for ordinary developer tickets. Its runtime enforcement and tests remain intact and apply only to
operations deliberately performed through that prototype; do not bypass its active state or mutate
its journal. Do not start/resume the prototype or old automations from historical handoffs.
Agent Platform product runtime security and user permissions remain separate and unchanged.

See [native development](development/codex-development.md) and
[ADR-0005](adr/0005-native-codex-development.md). Earlier prototype-specific policies do not narrow
this native developer route. Current owner instructions take precedence over stale worktree/global
skill or memory guidance; identify such conflicts without silently editing global files.

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

**Node version:** managed by `.nvmrc` (v24). The Makefile auto-runs `nvm install` when nvm is present.

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

Prefer the official Beads MCP for structured issue reads and mutations when its tools are available.
Pass the repository root as `workspace_root`, and call the MCP `context` tool before the first write
operation. Use the CLI when MCP is unavailable and for commands the MCP does not expose, including
`bd prime`, Dolt synchronization, diagnostics, linting, and administration.

**Explicit prototype boundary:** native developer tasks use official Beads MCP or CLI directly
within owner authorization. Only operations deliberately owned by an explicitly selected managed
prototype run use that run's journaled broker. That enforcement does not require unrelated native
tickets to perform run discovery or qualify custom execution before ordinary Beads work.

In the current embedded-Dolt workspace, the MCP `context` response may say the database is not found
even though operations with explicit `workspace_root` succeed. Do not run MCP `context init` in an
existing Beads repository; verify with a read operation and keep passing `workspace_root` explicitly.

```bash
# Native developer workflow; explicit prototype operations retain their own brokers.
bd ready              # find unblocked work
bd show <id>          # view issue details
bd update <id> --claim  # claim atomically
bd close <id>         # complete work
bd dolt push          # push Beads state to the Dolt remote
```

Run `bd prime` for the detailed command reference and session-close protocol. Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files. Task spec files live in `docs/tasks/<issue-id>.md` (requirements, implementation plan, DoD); do not delete them after completion.

Every task issue must follow the required Beads schema in `docs/tasks/README.md` under **Expected Beads Schema (required)**, including a description first line of `Spec: docs/tasks/<issue-id>.md`.

The official Beads MCP manages issue state but does not replace `bd dolt push` or provide orchestration
checkpoints, durable waits, artifact storage, or role enforcement. Those remain separate workflow
control responsibilities.

**Beads = task state** (next task, open/done, dependencies). **Git = code history** (branches, commits). When picking or finishing work, use Beads MCP or `bd ready` / `bd show` / `bd close` — do not rely on Git alone. See `decisions.md` → _Task management: Beads vs Git_.

---

## Git Workflow

Branching rules (locked):

- **`feature/<feature-name>`** — integration branch
- **`task/<task-name>`** — individual work units, chained linearly (each branches from the previous task branch)
- **Never commit directly to `main`**
- One PR per segment tip → `feature/<feature-name>`; completed features → protected `staging`; human-approved `staging` → `main`

Required branch lifecycle:

1. Create or use a **`feature/<feature-name>`** branch from current **`staging`** as the integration branch.
2. Create the first **`task/<task-name>`** branch from that feature branch.
3. Each subsequent task branch must be created from the previous task branch.
4. The final task branch in the chain contains the cumulative task changes and opens the integration PR into **`feature/<feature-name>`**.
5. After approved integration gates pass, merge **`feature/<feature-name>`** into protected **`staging`** via PR. An approved autonomous workflow may perform this merge.
6. Merge **`staging`** into **`main`** only with explicit human approval; production promotion is never implied by feature approval.

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

For documentation creation or updates, follow the
[documentation skill](../.agents/skills/documentation/SKILL.md) and its linked
[Notion publishing skill](../.agents/skills/agent-platform-documentation/SKILL.md). Update and verify
both repository and Notion copies within the authorized scope; explicitly report pending publication.

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

## iMessage notifications

The owner authorizes and expects notifications to their own conversation for these events:

- A task they asked the agent to complete is finished and verified.
- The agent is blocked and needs a decision or action from the owner.
- A significant failure requires the owner's attention.

Notification chat ID: `any;-;+447411950921`.
The owner reports that sending to this conversation has been tested successfully.
These are event triggers, not scheduled times; no time-of-day restriction was specified.

The host iMessage MCP connection exposes `chat_messages` and `reply` when available. Use the
`reply` tool with the exact chat ID above to send a notification. Keep it brief: task name, outcome,
and any action needed. Avoid routine progress updates, duplicate notifications, secrets and sensitive
file contents. Do not read unrelated conversations or broaden messaging access for this purpose.
Only claim a notification was sent after the tool confirms success. If sending fails or the tool is
unavailable, report that in Codex. If delivery is ambiguous, do not blindly resend and risk duplicates.

### Orchestration access boundary

This policy authorizes notifications; it does not install tools or grant isolated workers access to
host MCP connections. Preserve role restrictions and do not inherit host configuration or credentials.
The current orchestration notification sink is a local JSONL feed; an iMessage sink is not implemented
by this documentation change.

Recommended future integration: a trusted notification dispatcher consumes durable workflow events,
filters for the three authorized triggers, and sends through a recipient-scoped iMessage adapter.
Workers report outcomes and blockers through existing workflow channels; they do not each need
messaging access. Record delivery receipts and deduplicate by event/task identity, reconcile uncertain
sends before retrying, and surface delivery failure in Codex or the operator status channel. Verify
recipient enforcement, allowed and denied triggers, restart/retry behavior and unavailable-tool handling
before claiming autonomous notification support. Do not let incoming messages implicitly grant tools,
change approved scope or bypass the existing approval-validation path.

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

   Native developer work uses these commands directly within owner authorization. An explicitly
   selected prototype run uses its own journaled equivalent for operations it owns; that does not
   make the prototype a default developer dependency.

5. **Clean up** — clear stashes, prune remote branches
6. **Verify** — all changes committed AND pushed
7. **Hand off** — provide context for next session via `session.md`

**Critical rules:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing — that leaves work stranded locally
- NEVER say "ready to push when you are" — YOU must push
- If push fails, resolve and retry until it succeeds
