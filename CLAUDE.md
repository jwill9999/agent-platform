# CLAUDE.md

Entry point for Claude Code working in this repository.

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

## Claude Code specifics

- **Memory:** persist project knowledge with `bd remember` instead of writing a `MEMORY.md`.
- **Setup:** run `bd onboard` once per machine; `bd prime` to refresh the beads command reference at the start of a session.
- **Skills:** repository-scoped skills live under `.claude/skills/` if/when added.

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
