# Copilot Instructions — Agent Platform

Entry point for GitHub Copilot in this repository.

## Shared agent instructions

All operating rules — commands, architecture, conventions, env vars, beads workflow, git workflow, shell rules, key decisions, the SonarQube/Problems completion gate, and the session-completion protocol — live in **[docs/agent-instructions-shared.md](../docs/agent-instructions-shared.md)**.

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

## Copilot-specific notes

- The SonarQube MCP is the preferred analyser; see `.github/instructions/sonarqube_mcp.instructions.md` for the tool-call rules.
- Prefer Problems + terminal quality commands as the authoritative fallback when MCP is unavailable.
- Never claim done if the completion-gate status is failed.
- For frontend or UI work validation, first run `make restart`, confirm containers rebuilt successfully, then run Playwright user-flow actions to verify the UI is working as expected.
- Local-only work is not complete: after creating or updating local files/branches, you must commit and push to `origin`, then verify the remote ref exists (for example with `git ls-remote --heads origin <branch>` or `git status -sb` showing `origin/<branch>` tracking).
- Treat `git push --no-verify` as a high-risk exception: it bypasses Husky/local verification checks and can allow broken builds/tests to be pushed. Use only as a last resort and run the skipped checks manually before declaring work complete.
