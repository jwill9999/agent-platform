# Agent Platform

Composable agent harness for building, configuring, and running AI agents. Built with Node.js, TypeScript, LangGraph, and the Model Context Protocol (MCP).

## Quick Start

Prerequisites: **Node.js 20** (see `.nvmrc`), **pnpm** 9+. The Makefile loads **nvm** when present and runs **`nvm install`** from the repo root so the **`.nvmrc`** version is installed (if needed) and selected before any `node`/`pnpm` step.

### First time (install, build, seed DB, run API + web)

From the repo root:

```bash
make
```

This is the same as **`make setup`**: runs **`make install`** then **`make up`**. The **`up`** target builds the monorepo, frees ports **3000** / **3001**, runs **`pnpm seed`** (seeded **Personal assistant** + **Coding** specialist + demo data — idempotent), then starts the **API** on port **3000** and the **Next.js** app on **3001**.

Alternatively, step by step: `make install` then `make up`.

### Restart without wiping the database

Stops whatever is listening on the dev ports, then starts the stack again (rebuild, seed, run). Your **`SQLITE_PATH`** file (default `data/dev.sqlite`) is **not** deleted.

```bash
make restart
```

### Full rebuild from scratch (destructive database)

Reinstalls dependencies, deletes the local dev SQLite file, rebuilds, seeds, and starts the stack. Use when you want a clean DB or after major schema changes.

```bash
make new
```

### Other useful targets

| Command      | Purpose                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| `make up`    | Build, free ports, seed, start API + web (no `pnpm install`)                 |
| `make down`  | Stop processes on **PORT** / **WEB_PORT** (default 3000 / 3001)              |
| `make reset` | Same as `up` but after **`reset-db`** (wipe SQLite only — no `pnpm install`) |

See [Development Guide](docs/development.md) for prerequisites, env vars (**`SQLITE_PATH`**, **`SECRETS_MASTER_KEY`**), tests, and Docker.

## Documentation

| Guide                                  | Description                               |
| -------------------------------------- | ----------------------------------------- |
| [Architecture](docs/architecture.md)   | System design, package roles, data flow   |
| [API Reference](docs/api-reference.md) | REST endpoints, error shapes, schemas     |
| [Database](docs/database.md)           | Schema, migrations, secret storage        |
| [Development](docs/development.md)     | Local setup, build, test, lint commands   |
| [Deployment](docs/deployment.md)       | Docker, environment variables, production |
| [Configuration](docs/configuration.md) | Model routing, MCP servers, agent setup   |
| [Plugin Guide](docs/plugin-guide.md)   | Plugin hooks and authoring                |

## Project Layout

```
apps/api          Express REST API (port 3000)
apps/web          Next.js chat UI (port 3001)
packages/         Shared libraries (contracts, db, harness, model-router, etc.)
docs/             Documentation
e2e/              Playwright E2E tests
```

See [Architecture](docs/architecture.md) for the full package dependency graph.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, and [AGENTS.md](AGENTS.md) for AI agent workflow instructions.

Task tracking uses **bd (beads)** — see `AGENTS.md` for commands. Architectural decisions are recorded in [decisions.md](decisions.md).
