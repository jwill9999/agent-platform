# Task: Verify Project open to session binding with Electron E2E

**Beads issue:** `agent-platform-electron-project-access.8`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.8.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.8.md`

## Summary

Add production-like Electron E2E coverage for native Project open through Project-bound chat and slash commands.

## Requirements

- Build the desktop runtime before running Electron E2E.
- Open a temporary local Project through the native Project path.
- Verify backend Project registration and Project-bound session creation.
- Verify `/help`, `/init`, and ordinary Project chat receive the same Project context.
- Verify UI shows Project name/relative paths and hides `/workspace`/host absolute paths by default.

## Implementation plan

1. Establish the Electron E2E runner pattern for this repo.
2. Add fixtures for a temporary local Project.
3. Automate native Project open and Project session checks.
4. Add slash command and ordinary chat context assertions.
5. Wire the relevant Electron E2E command into CI or document the gating path if CI support needs a follow-up.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-project-access.7` | `agent-platform-electron-project-access.8` |

## Tests and verification

- Electron E2E for native Project open, Project session binding, `/help`, `/init`, and ordinary chat.
- Root gates and PR checks before closure.
- Sonar/Problems gate and review comment resolution.

## Definition of done

- [ ] Electron E2E opens a local Project through the native desktop path.
- [ ] Electron E2E verifies the backend Project record and Project-bound session.
- [ ] Electron E2E verifies `/help`, `/init`, and ordinary Project chat share Project context.
- [ ] UI hides `/workspace` and host absolute paths by default.
- [ ] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
