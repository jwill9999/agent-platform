# Development Guide

## Prerequisites

- [Docker](https://www.docker.com/) — **required** for all development (dev/prod parity)
- [Node.js](https://nodejs.org/) 20+ — host-side quality gates only (tests, lint, typecheck)
- [pnpm](https://pnpm.io/) 9+ — `corepack enable && corepack prepare pnpm@9.15.4 --activate`

> **All runtime commands use Docker.** Never run the API or web app locally. The Makefile targets build images, start containers, and seed the database inside the running API container. Host-side Node/pnpm is only used for quality gates (tests, lint, typecheck).

## Quick Start

### 1. Configure environment

```bash
cp -f .env.example .env
# Edit .env — set AGENT_OPENAI_API_KEY (required for chat)
```

### 2. Start the stack

```bash
make up       # Build images → start containers → wait for healthy → seed DB
```

This builds both Docker images (`Dockerfile` for API, `Dockerfile.web` for Next.js), starts them via Docker Compose, waits for healthchecks, then seeds the database inside the API container. When complete:

- **API:** `http://localhost:3000` (Swagger UI at `/api-docs`)
- **Web:** `http://localhost:3001`

### 3. Verify

```bash
make status   # Check container health
make logs     # Follow all service logs
```

## Order of Operations

The `make up` target handles the correct sequence automatically:

1. **Build images** — `docker compose build` (installs deps + compiles TypeScript inside the container)
2. **Start containers** — `docker compose up -d --wait` (blocks until healthchecks pass)
3. **Seed database** — `exec api node packages/db/dist/seed/run.js` (idempotent, runs inside the API container)

> **Seeding requires a running, healthy API container.** The seed script runs inside the container where `SQLITE_PATH` points to the Docker volume (`/data/agent.sqlite`). You never need to set `SQLITE_PATH` on the host.

## Make Targets

All Docker targets handle build → start → seed in the correct order.

| Target                       | Description                                                    |
| ---------------------------- | -------------------------------------------------------------- |
| `make up`                    | Build, start, wait for healthy, seed DB **(default)**          |
| `make down`                  | Stop all services (keeps volumes / DB)                         |
| `make restart`               | Stop → rebuild → start + seed (keeps DB data)                  |
| `make reset`                 | Wipe DB & volumes → rebuild → start + seed (fresh DB)          |
| `make new`                   | Nuclear: remove volumes + images → rebuild from scratch → seed |
| `make workspace-init`        | Prepare host workspace directories without starting services   |
| `make coding-runtime-verify` | Verify required coding-agent CLI tools in the API container    |
| `make seed`                  | Re-run seed in running API container (idempotent)              |
| `make build`                 | Build Docker images only (no start)                            |
| `make rebuild`               | Build from scratch — no Docker layer cache                     |
| `make logs`                  | Follow logs for all services                                   |
| `make logs-api`              | Follow API logs only                                           |
| `make logs-web`              | Follow web logs only                                           |
| `make status`                | Show container status and health                               |
| `make shell-api`             | Open a shell in the API container                              |
| `make shell-web`             | Open a shell in the web container                              |
| `make clean`                 | Remove containers, volumes, and locally-built images           |

Override host ports: `HOST_PORT=4000 WEB_HOST_PORT=4001 make up`

### Workspace Storage

Agent Platform keeps user files in a host-side workspace and exposes that workspace inside Docker at a stable container path, `/workspace`.

See [Workspace Storage](workspace-storage.md) for the full setup, security, UI/API, cleanup, and verification reference.

Default host locations:

| Host OS | Default home                                  |
| ------- | --------------------------------------------- |
| Linux   | `~/.agent-platform`                           |
| macOS   | `~/Library/Application Support/AgentPlatform` |
| Windows | `%LOCALAPPDATA%\\AgentPlatform`               |

Default layout:

```text
AgentPlatform/
  config/
  data/
  workspaces/
    default/
      uploads/
      generated/
      scratch/
      exports/
  logs/
```

Configuration variables:

| Variable                         | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `AGENT_PLATFORM_HOME`            | Override the host-side Agent Platform home directory  |
| `AGENT_WORKSPACE_HOST_PATH`      | Override the host directory mounted as the workspace  |
| `AGENT_WORKSPACE_CONTAINER_PATH` | Container workspace path; default `/workspace`        |
| `AGENT_DATA_HOST_PATH`           | Override host app data directory, separate from files |

For local development, the Makefile and `.env.example` use `./.agent-platform/` as a repo-local fallback. That directory is ignored by Git. `make up`, `make restart`, `make reset`, and `make new` run `make workspace-init` first, so the host directories exist and are writable by the non-root API container before Docker starts. On Docker Desktop for macOS and Windows, ensure the selected host directory is available to Docker file sharing.

Docker mounts:

| Host path                   | Container path | Purpose                                |
| --------------------------- | -------------- | -------------------------------------- |
| `AGENT_WORKSPACE_HOST_PATH` | `/workspace`   | User files: uploads, generated, export |
| `AGENT_DATA_HOST_PATH`      | `/data`        | App/runtime data such as SQLite        |

### Browser Tool Runtime

The governed browser tools use Playwright from the API/harness runtime. The API
Docker image installs Chromium through Alpine packages, and the harness also
honors `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when a custom browser binary is
needed.

Browser evidence is written under the workspace at
`.agent-platform/browser/<session-id>/` with JSON sidecars for metadata. The
chat UI renders compact browser activity summaries, keeps screenshot artifacts
visible as persistent message previews, and links to stored artifacts instead
of copying raw DOM, ARIA, or screenshot payloads into the transcript.

Playwright temporary browser profiles and launch artifacts are routed to the
host-backed workspace at `.agent-platform/tmp/browser` by default. Override
`AGENT_BROWSER_TMPDIR` if the workspace mount is customized or if the browser
runtime needs a different writable temp location.

When exercising the tools from inside the Docker Compose API container, target
the web service at `http://web:3001`. The default browser URL policy allowlists
that Compose service hostname for local UI verification, while external domains
still require approval.

External browser start/navigation requests use the normal human-in-the-loop
approval flow. The first attempt should render an approval card in chat; after
approval, the session resume path reruns the browser action and captures the
requested evidence.

Troubleshooting:

- If browser tools return `BROWSER_RUNTIME_UNAVAILABLE`, rebuild the API image
  and confirm Chromium is present in the container.
- If the launch error mentions `ENOSPC` or `mkdtemp` under `/tmp`, Docker's
  overlay filesystem is full. Reclaim Docker build cache or restart/rebuild the
  API container so `AGENT_BROWSER_TMPDIR` points Playwright at the workspace
  temp directory.
- If screenshots fail or pages render blank in Docker, keep the API service
  `shm_size` at least `256mb`.
- If local host-side integration tests bind a fixture HTTP server, run them
  outside restricted sandboxes or with approval for local loopback binding.

### Host-Side Quality Gates

These run on the host (not in Docker) for fast feedback:

| Target           | Description          |
| ---------------- | -------------------- |
| `make test`      | `pnpm test` (Vitest) |
| `make lint`      | `pnpm lint` (ESLint) |
| `make typecheck` | `pnpm typecheck`     |
| `make format`    | `pnpm format:check`  |

> Host-side quality gates require `pnpm install` on the host. The pre-push git hook runs `build + typecheck + test` on affected packages automatically.

## Project Structure

```
agent-platform/
├── apps/
│   ├── api/              # Express REST API (Dockerfile → port 3000)
│   └── web/              # Next.js chat UI (Dockerfile.web → port 3001)
├── packages/
│   ├── contracts/        # Shared Zod schemas
│   ├── db/               # Drizzle ORM + SQLite + seed scripts
│   ├── harness/          # LangGraph agent graph + security guards
│   ├── model-router/     # LLM provider routing + API key resolution
│   ├── mcp-adapter/      # MCP tool bridge
│   ├── plugin-sdk/       # Plugin hooks interface
│   ├── planner/          # LLM planning layer
│   ├── logger/           # Structured JSON logging
│   ├── agent-validation/ # Schema validation
│   ├── plugin-session/   # Session plugin
│   └── plugin-observability/ # Observability plugin
├── e2e/                  # Playwright E2E tests
├── docs/                 # Documentation
├── docker-compose.yml    # Service definitions (api, web, volumes)
├── Dockerfile            # API image (multi-stage: build → runner)
├── Dockerfile.web        # Web image (multi-stage: deps → build → runner)
├── Makefile              # Docker-only workflow targets
└── pnpm-workspace.yaml
```

## Environment Variables

Docker Compose reads from `.env` in the repo root (gitignored). Copy `.env.example` to get started.

### Docker Compose variables

| Variable               | Default | Description                                            |
| ---------------------- | ------- | ------------------------------------------------------ |
| `HOST_PORT`            | `3000`  | Host port mapped to API container                      |
| `WEB_HOST_PORT`        | `3001`  | Host port mapped to web container                      |
| `AGENT_OPENAI_API_KEY` | —       | OpenAI API key (passed to both API and web containers) |

### API container (set in docker-compose.yml)

| Variable             | Default              | Description                                        |
| -------------------- | -------------------- | -------------------------------------------------- |
| `SQLITE_PATH`        | `/data/agent.sqlite` | SQLite path inside container (Docker volume)       |
| `PORT`               | `3000`               | API listen port                                    |
| `HOST`               | `0.0.0.0`            | API bind address                                   |
| `SECRETS_MASTER_KEY` | —                    | Base64-encoded 32-byte key for AES-256-GCM secrets |

### Web container (set in docker-compose.yml)

| Variable               | Default           | Description                                  |
| ---------------------- | ----------------- | -------------------------------------------- |
| `API_PROXY_URL`        | `http://api:3000` | Internal URL to API service (Docker network) |
| `AGENT_OPENAI_API_KEY` | —                 | Forwarded as `x-openai-key` header to API    |

### API Key Resolution Chain

When the API receives a chat request, it resolves the LLM API key in this order:

1. **Request header** — `x-openai-key` (sent by web BFF or curl)
2. **Provider env var** — `AGENT_OPENAI_API_KEY` (or `AGENT_ANTHROPIC_API_KEY` for Anthropic)
3. **Legacy fallback** — `OPENAI_API_KEY` only if `OPENAI_ALLOW_LEGACY_ENV=1` or `ALLOW_LEGACY_ENV=1`

Ollama (local models) does not require an API key.

### Secret Storage

MCP server credentials and other sensitive values are stored in the `secret_refs` table with **AES-256-GCM** encryption. This requires `SECRETS_MASTER_KEY` to be set. See [Database — Secret Storage](database.md#secret-storage) for details.

> **Note:** LLM API keys are resolved from environment variables / request headers, not from the secrets table. The secrets system is for MCP server credentials and other stored secrets.

## Quality Gates

Run before pushing (or let the pre-push hook handle it):

```bash
pnpm typecheck        # TypeScript across all packages
pnpm lint             # ESLint (max-warnings 0)
pnpm format:check     # Prettier
pnpm test             # Vitest unit tests
```

### Sensor Feedback Loop

Coding-profile agents run feedback sensors at repository checkpoints rather than continuously. The harness selects targeted sensors after meaningful code-changing tools, then runs required repository sensors before completion or push handoff. Remote feedback such as GitHub Actions, CodeQL, SonarQube, review comments, and IDE/plugin diagnostics can also be imported after push or when an external provider reports findings.

The chat UI shows sensor state in a right-side feedback drawer. Use it to inspect:

- active agent profile and selected sensor profile
- deterministic gates such as typecheck, tests, lint, docs, and format
- inferential checks such as open-finding reflection and readiness
- local command, IDE Problems, IDE terminal-output, SonarQube, CodeQL, GitHub, and review-agent findings
- unavailable or auth-required providers and their retry/connect actions
- Docker, container, sandbox, network, and path-mapping limitations

To expose richer local feedback, enable supported IDE adapters or plugins that can provide bounded Problems data, terminal task output, SonarQube or CodeQL findings, and review-agent comments. Provider output must be bounded and redacted before it reaches the harness. If a required source is blocked by Docker mounts, sandbox policy, missing network, or host/container path mapping, the dashboard should surface the limitation and the repair action instead of silently skipping it.

Personal-assistant profile sessions do not require coding gates by default. They can still use manual sensor imports when a task explicitly involves repository or UI work.

### Running a Single Test File

```bash
pnpm --filter <package-name> run test -- <path/to/test.ts>

# Example:
pnpm --filter @agent-platform/db run test -- test/referential-integrity.test.ts
```

## Debugging

| Symptom                   | Check                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| Containers won't start    | `make status` — check health; `make logs` — check errors           |
| No `/v1` routes           | API mounts v1 routes only when DB connects — check `make logs-api` |
| Chat returns 401/500      | Verify `AGENT_OPENAI_API_KEY` in `.env`; rebuild: `make restart`   |
| Stale code after changes  | `make restart` rebuilds images; `make rebuild` for no-cache build  |
| DB corruption / bad state | `make reset` wipes volumes and reseeds                             |
| Need a clean shell inside | `make shell-api` or `make shell-web`                               |
| Swagger UI                | `http://localhost:3000/api-docs` when API is running               |

## Task Tracking

This project uses **bd (beads)** for issue tracking. See `AGENTS.md` for the full workflow.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```
