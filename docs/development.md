# Development Guide

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+ — enable with `corepack enable && corepack prepare pnpm@9.15.4 --activate`
- [Docker](https://www.docker.com/) (optional, for containerized development)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages (required before running)
pnpm build

# Start API + Web together
make up                    # API on :3000, Web on :3001

# Or start individually
make api                   # API only (builds first)
make web                   # Next.js dev server

# Full reset (stop + wipe DB + build + seed + start)
make reset
```

## Commands Reference

| Command                 | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `pnpm install`          | Install workspace dependencies                                 |
| `pnpm build`            | Build all packages                                             |
| `pnpm typecheck`        | TypeScript check across all packages                           |
| `pnpm lint`             | ESLint (max-warnings 0)                                        |
| `pnpm format`           | Prettier write                                                 |
| `pnpm format:check`     | Prettier check (CI mode)                                       |
| `pnpm test`             | Vitest unit tests                                              |
| `pnpm test:e2e`         | Playwright end-to-end tests                                    |
| `pnpm test:e2e:install` | Install Playwright browsers (one-time)                         |
| `pnpm seed`             | Seed database (requires `SQLITE_PATH`, run after `pnpm build`) |

### Make Targets

| Target       | Description                        |
| ------------ | ---------------------------------- |
| `make up`    | Build + start API and Web          |
| `make down`  | Stop the stack cleanly             |
| `make reset` | Down + wipe DB + build + seed + up |
| `make api`   | Build + start API only             |
| `make web`   | Start Next.js dev server           |

Override ports: `make reset PORT=3000 WEB_PORT=3001 SQLITE_PATH=/path/to/dev.sqlite`

## Project Structure

```
agent-platform/
├── apps/
│   ├── api/              # Express REST API
│   └── web/              # Next.js chat UI
├── packages/
│   ├── contracts/        # Shared Zod schemas
│   ├── db/               # Drizzle ORM + SQLite
│   ├── harness/          # LangGraph agent graph
│   ├── model-router/     # LLM provider routing
│   ├── mcp-adapter/      # MCP tool bridge
│   ├── plugin-sdk/       # Plugin hooks interface
│   ├── planner/          # LLM planning layer
│   ├── logger/           # Structured logging
│   ├── agent-validation/ # Schema validation
│   ├── plugin-session/   # Session plugin
│   └── plugin-observability/ # Observability plugin
├── e2e/                  # Playwright E2E tests
├── docs/                 # Documentation
│   ├── tasks/            # Task specifications
│   └── planning/         # Architecture planning
├── docker-compose.yml
├── Makefile
└── pnpm-workspace.yaml
```

## Quality Gates

Run all quality checks before pushing:

```bash
pnpm typecheck        # TypeScript
pnpm lint             # ESLint
pnpm format:check     # Prettier
pnpm test             # Unit tests
```

The pre-push git hook runs `build + typecheck + test` on affected packages automatically.

## Running a Single Test File

```bash
pnpm --filter <package-name> run test -- <path/to/test.ts>

# Example:
pnpm --filter @agent-platform/db run test -- test/referential-integrity.test.ts
```

## Database Setup

The API requires `SQLITE_PATH` to serve `/v1` routes:

```bash
# Local development
export SQLITE_PATH=./data/dev.sqlite
pnpm build && pnpm seed    # Create and seed DB
make api                    # Start API
```

## Environment Variables

| Variable                  | Required  | Description                                      |
| ------------------------- | --------- | ------------------------------------------------ |
| `SQLITE_PATH`             | Yes (API) | Path to SQLite database file                     |
| `PORT`                    | No        | API listen port (default: 3000)                  |
| `HOST`                    | No        | API bind address (default: 0.0.0.0)              |
| `SECRETS_MASTER_KEY`      | No\*      | Base64-encoded 32-byte key for secret encryption |
| `AGENT_OPENAI_API_KEY`    | No        | OpenAI API key for chat streaming                |
| `OPENAI_ALLOW_LEGACY_ENV` | No        | Set to `1` to allow `OPENAI_API_KEY` fallback    |
| `NEXT_OPENAI_API_KEY`     | No        | OpenAI key for Next.js BFF route                 |

\* Required when writing encrypted secrets.

## Debugging Tips

- **API won't start?** Check `SQLITE_PATH` is set and the directory exists
- **No `/v1` routes?** The API only mounts v1 routes when a DB connection is established
- **Test failures?** Run `pnpm build` first — tests may depend on compiled output
- **Swagger UI:** Visit `http://localhost:3000/api-docs` when the API is running

## Task Tracking

This project uses **bd (beads)** for issue tracking. See `AGENTS.md` for the full workflow.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```
