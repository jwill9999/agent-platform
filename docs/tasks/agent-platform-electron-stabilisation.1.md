# Task: Document Electron development workflow

**Beads issue:** `agent-platform-electron-stabilisation.1`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.1.md`

## Summary

Create clear development documentation that explains which environment developers should use, when
Electron is required, and what must happen before Electron-related tasks can be closed.

## Requirements

- Define the standard Docker/web development workflow.
- Define the Electron development workflow.
- Explain that the current manual backend setup is developer-only until Electron backend
  supervision/release packaging is complete.
- State that end users must not be expected to run Docker, type host paths, or start separate
  servers.
- List commands for Docker/web, Electron dev renderer, built renderer, and Electron E2E.
- Define when Electron testing is mandatory.
- Document closeout gates for Electron tasks.

## Implementation Plan

1. Create or update `docs/development/electron-development-workflow.md`.
2. Add sections for developer runtime, desktop runtime target, command reference, and closeout gates.
3. Link the document from the relevant Electron planning or demo documentation if useful.
4. Run docs lint.

## Dependencies

| Upstream | Downstream                                |
| -------- | ----------------------------------------- |
| none     | `agent-platform-electron-stabilisation.2` |

## Tests And Verification

- `pnpm docs:lint`
- `git diff --check`

## Definition Of Done

- Documentation clearly separates Docker/web development from Electron development.
- Documentation says when Electron is required.
- Documentation states the current manual startup process is developer-only.
- Documentation states the intended end-user app must launch without Docker or manual host paths.
- Docs lint and whitespace checks pass.
