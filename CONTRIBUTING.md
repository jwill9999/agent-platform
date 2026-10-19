# Contributing

## Monorepo

This repo uses **pnpm workspaces** (`apps/*`, `packages/*`). After cloning:

```bash
pnpm install
pnpm typecheck
pnpm lint
```

## Task workflow

Issues are tracked in **Beads** (`bd`). Task specs live in `docs/tasks/<issue-id>.md`.
For bounded MVP work, group related fixes, tests and documentation into one task-branch PR directly
into protected `staging`, after local checks and independent review. Keep review repairs in that PR;
use a separate PR only for an urgent blocker. Feature integration branches are optional for
owner-agreed larger/parallel work. Never commit directly to `main` or `staging`. See the current
[Git workflow](docs/agent-instructions-shared.md#git-workflow).
