# Contributing

## Monorepo

This repo uses **pnpm workspaces** (`apps/*`, `packages/*`). After cloning:

```bash
pnpm install
pnpm typecheck
pnpm lint
```

## Task workflow

Issues are tracked in **Beads** (`bd`). Task specs live in `docs/tasks/<issue-id>.md`. Do not commit directly to `main`; use `feature/<feature-name>` and `task/<task-name>` branches as described in `decisions.md`.
