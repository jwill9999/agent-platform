# Agent Platform

Composable agent harness for building, configuring, and running AI agents. Built with Node.js, TypeScript, LangGraph, and the Model Context Protocol (MCP).

## Quick Start

Prerequisites: **Node.js 20** (see `.nvmrc`), **pnpm** 9+. The Makefile loads **nvm** when present and runs **`nvm install`** from the repo root so the **`.nvmrc`** version is installed (if needed) and selected before any `node`/`pnpm` step.

### First time (prepare workspace, build, seed DB, run API + web)

From the repo root:

```bash
make
```

This runs **`make up`** by default. The **`up`** target prepares the host workspace, builds the Docker images, starts the API and web containers, waits for healthchecks, then seeds demo data inside the API container.

When complete:

- **API:** `http://localhost:3000`
- **Web:** `http://localhost:3001`
- **Workspace:** host-backed under `.agent-platform/workspaces/default` for local development and mounted into the API container at `/workspace`

## Current Capabilities

- **Chat and agent runtime:** configurable agents, model configs, encrypted provider API keys, MCP server assignments, and NDJSON streaming through the API/web BFF.
- **Settings UI:** management pages for agents, models, skills, tools, workspace files, memory, scheduler jobs, sessions, plugins, and MCP servers.
- **Human-in-the-loop approvals:** risky or explicitly approval-required tools pause for user approval before execution and can resume safely after a decision.
- **Workspace-aware coding tools:** repository discovery, git inspection, structured edits, quality gates, and guarded filesystem access inside the managed `/workspace`.
- **Memory:** short-term working memory, review-gated long-term memories, memory candidates, approved prompt retrieval, Settings Memory review/export/cleanup, and a narrow self-learning evaluator.
- **Scheduler:** durable local scheduled jobs with one-off and recurring schedules, pause/resume/run-now/edit/delete controls, persisted runs/logs, notifications, and safe built-in tasks.

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

| Command                        | Purpose                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `make up`                      | Prepare workspace, build, start API + web, seed DB                         |
| `make down`                    | Stop containers while keeping Docker volumes and host workspace data       |
| `make reset`                   | Wipe Docker DB/volumes, then rebuild, start, and seed                      |
| `make workspace-init`          | Prepare host workspace/data directories without starting services          |
| `make workspace-clean-dry-run` | Preview host workspace/data/config/log cleanup targets                     |
| `make workspace-clean`         | Remove host workspace/data/config/log directories after typed confirmation |

See [Development Guide](docs/development.md) for prerequisites, env vars, tests, and Docker.

## Documentation

| Guide                                                                    | Description                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)                                     | System design, package roles, data flow                               |
| [Message Flow](docs/architecture/message-flow.md)                        | Mermaid diagrams: chat → security → LLM → tools                       |
| [API Reference](docs/api-reference.md)                                   | REST endpoints, error shapes, schemas                                 |
| [Database](docs/database.md)                                             | Schema, migrations, secret storage                                    |
| [Development](docs/development.md)                                       | Local setup, build, test, lint commands                               |
| [Deployment](docs/deployment.md)                                         | Docker, environment variables, production                             |
| [Configuration](docs/configuration.md)                                   | Env vars, model routing, limits, MCP, security                        |
| [Workspace Storage](docs/workspace-storage.md)                           | Host workspace setup, security, cleanup, and validation               |
| [Coding Runtime](docs/coding-runtime.md)                                 | Container CLI baseline and coding-agent policy                        |
| [Scheduler](docs/scheduler.md)                                           | Durable scheduled jobs, background runs, logs, and notifications      |
| [Memory Model](docs/memory.md)                                           | Implemented memory layers, review flow, retrieval, and retention      |
| [Harness Gap Analysis](docs/planning/harness-gap-analysis-2026-04-29.md) | Capability gaps and recommended roadmap for coding/general automation |
| [Memory Management](docs/planning/memory-management.md)                  | Short-term, long-term, and self-learning memory architecture          |
| [Plugin Guide](docs/plugin-guide.md)                                     | Plugin hooks and authoring                                            |

## Project Layout

```
apps/api          Express REST API (port 3000)
apps/web          Next.js chat UI (port 3001)
packages/         Shared libraries (contracts, db, harness, model-router, mcp-adapter, etc.)
  harness/src/security/  Security guards: PathJail, bash guard, injection/output/MCP trust guards
docs/             Documentation (architecture, API, config, message flow diagrams)
e2e/              Playwright E2E tests
scripts/          Workspace setup, cleanup, and compose verification helpers
```

See [Architecture](docs/architecture.md) for the full package dependency graph.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, and [AGENTS.md](AGENTS.md) for AI agent workflow instructions.

Task tracking uses **bd (beads)** — see `AGENTS.md` for commands. Architectural decisions are recorded in [decisions.md](decisions.md).
