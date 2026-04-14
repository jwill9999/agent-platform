# Agent Platform (MVP)

Composable agent harness (Node.js, TypeScript, LangGraph, MCP). Planning and decisions live in `decisions.md` and `docs/tasks/`.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+ (`corepack enable` then `corepack prepare pnpm@9.15.4 --activate`)

## Commands

| Command             | Description                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm install`      | Install workspace dependencies                                                                        |
| `pnpm typecheck`    | Typecheck all packages (`pnpm -r`)                                                                    |
| `pnpm build`        | Build all packages                                                                                    |
| `pnpm lint`         | ESLint across workspaces                                                                              |
| `pnpm test`         | Run Vitest suites (contracts, db, api integration)                                                    |
| `pnpm format`       | Prettier write                                                                                        |
| `pnpm format:check` | Prettier check                                                                                        |
| `pnpm seed`         | After **`pnpm build`**: run idempotent DB seed (needs **`SQLITE_PATH`**) — default agent + demo skill |

## HTTP API (`/v1`)

Requires **`SQLITE_PATH`** at process start (same DB file as migrations/seed). JSON request/response bodies; errors: `{ "error": { "code", "message", "details?" } }`. **Single-user** — no auth yet (stub middleware).

| Resource    | Endpoints                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Health      | `GET /health` (no DB)                                                                                                                           |
| Skills      | `GET/POST /v1/skills`, `GET/PUT/DELETE /v1/skills/:id` — body **`SkillSchema`**                                                                 |
| Tools       | `GET/POST /v1/tools`, `GET/PUT/DELETE /v1/tools/:id` — **`ToolSchema`**                                                                         |
| MCP servers | `GET/POST /v1/mcp-servers`, `GET/PUT/DELETE /v1/mcp-servers/:id` — **`McpServerSchema`**                                                        |
| Agents      | `GET/POST /v1/agents`, `GET/PUT/DELETE /v1/agents/:id` — **`AgentSchema`** (allowlists via `replaceAgent`)                                      |
| Sessions    | `GET /v1/sessions?agentId=`, `POST /v1/sessions`, `GET/PUT/DELETE /v1/sessions/:id` — **`SessionCreateBodySchema`** / **`SessionRecordSchema`** |

## Layout

- `apps/*` — applications (e.g. `apps/api`)
- `packages/*` — shared libraries (e.g. `packages/contracts`)

## Docker

- Copy `.env.example` to `.env` and adjust `HOST_PORT` / `SQLITE_PATH` as needed.
- For API chat streaming, set `AGENT_OPENAI_API_KEY` (preferred). `OPENAI_API_KEY` is intentionally blocked by default to prevent stale exported keys from taking precedence; allow it only with `OPENAI_ALLOW_LEGACY_ENV=1`.
- For the Next.js chat route (`apps/web/app/api/chat/route.ts`), set `NEXT_OPENAI_API_KEY` in `apps/web/.env` (legacy `OPENAI_API_KEY` fallback is also blocked by default unless `OPENAI_ALLOW_LEGACY_ENV=1`).
- `docker compose up --build` builds the API image, maps `HOST_PORT` → container `3000`, mounts a **named volume** at `/data` for SQLite (`SQLITE_PATH` defaults to `/data/agent.sqlite` in Compose), and runs a **health check** on `GET /health`.
- To load the **default agent** into that database: **(a)** on the host, run `pnpm build` and `pnpm seed` with **`SQLITE_PATH`** pointing at the same SQLite file the API uses; **(b)** in Docker, after the image has been built with the entrypoint that `chown`s `/data` to the app user, run  
  `docker compose run --rm api node packages/db/dist/seed/run.js`  
  (or stop the API first if you prefer: `docker compose stop api`, then that command, then `docker compose start api`). The seed is idempotent.
- **Future filesystem MCP:** see commented volume examples in `docker-compose.yml` (e.g. bind-mount a host directory to `/workspace` for tooling).

## Git workflow

See `decisions.md` and `AGENTS.md`: work on `task/<task-name>` branches from `feature/<feature-name>`; Beads (`bd`) tracks task state.
