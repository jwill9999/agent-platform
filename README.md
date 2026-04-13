# Agent Platform (MVP)

Composable agent harness (Node.js, TypeScript, LangGraph, MCP). Planning and decisions live in `decisions.md` and `docs/tasks/`.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+ (`corepack enable` then `corepack prepare pnpm@9.15.4 --activate`)

## Commands

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm install`      | Install workspace dependencies       |
| `pnpm typecheck`    | Typecheck all packages (`pnpm -r`)   |
| `pnpm build`        | Build all packages                   |
| `pnpm lint`         | ESLint across workspaces             |
| `pnpm test`         | Run tests (stubs until suites exist) |
| `pnpm format`       | Prettier write                       |
| `pnpm format:check` | Prettier check                       |

## Layout

- `apps/*` — applications (e.g. `apps/api`)
- `packages/*` — shared libraries (e.g. `packages/contracts`)

## Git workflow

See `decisions.md` and `AGENTS.md`: work on `task/<task-name>` branches from `feature/<feature-name>`; Beads (`bd`) tracks task state.
