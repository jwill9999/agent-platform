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

- `pnpm --filter @agent-platform/desktop test -- test/projectFolderPicker.test.ts test/windowConfig.test.ts test/preloadContract.test.ts`
- `pnpm --filter @agent-platform/desktop test:e2e`
- Electron E2E for native Project open, Project session binding, `/help`, `/init`, and ordinary chat context binding.
- Root gates and PR checks before closure.
- Sonar/Problems gate and review comment resolution.

## Implementation notes

- The sandboxed Electron preload is emitted as a self-contained CommonJS file because Electron
  sandboxed preloads cannot use ESM imports or require local modules.
- Electron E2E uses `AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIR` to avoid a blocking native folder
  picker while still exercising renderer -> preload -> IPC -> main -> backend Project registration.
- The E2E verifies the backend Project record, a Project-bound session, `/help`, `/init`, relative
  file reads, and that `/workspace` plus host absolute paths are not rendered by default.
- Ordinary chat model execution is not invoked in CI because it would require provider credentials;
  the test verifies the Project-bound session that ordinary chat uses for Project context.

## Definition of done

- [x] Electron E2E opens a local Project through the native desktop path.
- [x] Electron E2E verifies the backend Project record and Project-bound session.
- [x] Electron E2E verifies `/help`, `/init`, and the ordinary chat Project binding share Project context.
- [x] UI hides `/workspace` and host absolute paths by default.
- [x] Relevant tests and root gates pass locally.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
