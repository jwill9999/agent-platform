# Agent Instructions

Entry point for OpenAI / Codex agents and any tool that reads `AGENTS.md`.

## Shared agent instructions

All operating rules — commands, architecture, conventions, env vars, beads workflow, git workflow, shell rules, key decisions, the SonarQube/Problems completion gate, and the session-completion protocol — live in **[docs/agent-instructions-shared.md](docs/agent-instructions-shared.md)**.

Read that file first. The sections it covers:

- Commands (install, build, Docker, quality gates, tests, seed)
- Architecture (apps, packages, data flow, streaming protocol)
- Conventions (TypeScript, error shape, secrets, model IDs, security modules)
- Environment variables
- Task tracking with **beads** (`bd ready` / `bd show` / `bd close`)
- Git workflow (`feature/<name>` integration; `task/<name>` chained tips; never to `main`)
- Non-interactive shell flags
- Key locked decisions
- Reference documentation index
- **SonarQube / Problems Completion Gate** (mandatory before declaring done)
- Session-completion protocol (push is mandatory)

## Tool-specific notes

- Run `bd onboard` once per machine to wire up beads.
- Run `bd prime` for the full beads command reference.
- Use `bd remember` for persistent knowledge — do **not** create `MEMORY.md` files.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

Use `bd` for ALL task tracking — no TodoWrite, TaskCreate, or markdown TODO lists.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

Run `bd prime` for detailed command reference and session-close protocol.

<!-- END BEADS INTEGRATION -->
