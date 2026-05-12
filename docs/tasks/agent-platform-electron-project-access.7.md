# Task: Define web-only Project fallback UI

**Beads issue:** `agent-platform-electron-project-access.7`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.7.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.7.md`

## Summary

Clarify browser/web fallback behavior now that native Project access is the desktop Product path.

## Requirements

- Detect when the desktop bridge is unavailable.
- Avoid showing dead native Project buttons in browser-only mode.
- Provide a clear web fallback message or development-only path.
- Preserve browser E2E fixtures without presenting them as the desktop Product path.
- Keep user-facing copy implementation-neutral.

## Implementation plan

1. Add desktop bridge availability detection if needed.
2. Update Project entry UI for desktop versus browser-only mode.
3. Remove or hide dead CTAs in web-only mode.
4. Update browser E2E tests around fallback states.
5. Document what web-only mode supports and does not support.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-project-access.6` | `agent-platform-electron-project-access.7` |
| `agent-platform-electron-project-access.7` | `agent-platform-electron-project-access.8` |

## Tests and verification

- Renderer tests for desktop bridge available/unavailable states.
- Browser Playwright tests for fallback copy and disabled/hidden native CTAs.
- Root gates and PR checks before closure.

## Implementation notes

- Browser-only IDE mode now detects the absence of the desktop Project bridge and hides native
  **Open Project** plus recent-Project reopen controls instead of rendering a dead CTA.
- Desktop-bridge mode still renders the native Project open path, and the existing Playwright bridge
  mock verifies Project file loading plus `/init` session binding.
- Web-only fallback copy explains that Project folders open from the desktop app and that Project
  files are unavailable in the browser view.
- Browser Playwright coverage remains as fallback regression coverage; Product acceptance for native
  Project opening remains owned by Electron E2E in the next task.

## Definition of done

- [x] Browser-only mode does not show dead native Project CTAs.
- [x] Desktop mode shows the native Project open path.
- [x] Fallback copy is clear and avoids implementation details.
- [x] Browser fixtures remain available for tests/development without defining Product acceptance.
- [x] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
