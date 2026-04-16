# Agent Platform

Composable agent harness for building, configuring, and running AI agents. Built with Node.js, TypeScript, LangGraph, and the Model Context Protocol (MCP).

## Quick Start

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
make up               # Start API (:3000) + Web (:3001)
```

See [Development Guide](docs/development.md) for prerequisites and detailed setup.

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
