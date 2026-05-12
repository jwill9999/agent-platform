# Task: Add native Project folder picker bridge

**Beads issue:** `agent-platform-electron-project-access.1`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.1.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.1.md`

## Summary

Expose a narrow Electron-native Project folder picker through the preload bridge.

## Requirements

- Add a typed desktop Project API to the preload bridge.
- Open the OS folder picker from Electron main, not from the renderer.
- Return only the selected folder metadata needed by the renderer.
- Support user cancellation without creating errors.
- Do not expose generic filesystem, shell, path, or IPC capabilities.

## Implementation plan

1. Extend the desktop bridge contract with a Project folder selection API.
2. Add main-process IPC that validates the sender and opens the native folder picker.
3. Normalize the selected folder result into a typed DTO.
4. Add tests for bridge shape, IPC payload validation, cancellation, and successful selection.
5. Document the desktop-only folder picker boundary.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-security.6`       | `agent-platform-electron-project-access.1` |
| `agent-platform-electron-project-access.1` | `agent-platform-electron-project-access.2` |

## Tests and verification

- Desktop unit tests for picker result normalization and cancellation.
- Preload contract tests proving only the named Project API is exposed.
- IPC validation tests for untrusted sender and unexpected payloads.
- Root gates and PR checks before closure.

## Definition of done

- [x] Renderer can request native Project folder selection through a named desktop bridge API.
- [x] Native folder selection runs in Electron main.
- [x] Cancellation is handled as a non-error result.
- [x] No generic filesystem, path, shell, or IPC APIs are exposed.
- [x] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- Added `projects.selectFolder()` to the typed desktop preload bridge.
- Added `agent-platform:select-project-folder` as the dedicated IPC channel for native Project
  folder selection.
- Added a main-process folder picker service that opens Electron's native directory picker and
  normalizes the selected folder into `{ path, name }` metadata.
- Registered the Project picker IPC handler with trusted-sender and no-payload validation.
- Kept the bridge surface narrow; no generic filesystem, shell, path, or raw IPC APIs were exposed.

## Verification notes

- `pnpm --filter @agent-platform/desktop test -- test/projectFolderPicker.test.ts test/preloadContract.test.ts test/ipcValidation.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/desktop smoke`
- `pnpm --filter @agent-platform/desktop smoke:backend`
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
