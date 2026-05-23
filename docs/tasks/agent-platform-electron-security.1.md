# Task: Audit and lock Electron security defaults

**Beads issue:** `agent-platform-electron-security.1`
**Spec file:** `docs/tasks/agent-platform-electron-security.1.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.1.md`

## Summary

Review the current Electron shell and lock the baseline `BrowserWindow`, navigation, window-open,
and content-loading security defaults before native Project access is added.

## Requirements

- Keep renderer code isolated from Node, filesystem, and shell APIs.
- Use secure `BrowserWindow` defaults for the desktop runtime.
- Block unexpected navigation and popup/window-open paths.
- Document the security baseline and any temporary development exceptions.
- Add tests where the current structure allows the defaults to be asserted without launching a full app.

## Implementation plan

1. Inspect the Electron main process and renderer loading path.
2. Extract or centralize `BrowserWindow` web preferences if needed so they can be tested.
3. Enforce secure defaults: no Node integration, context isolation enabled, no remote module, and explicit preload only.
4. Add navigation/window-open guards for untrusted destinations.
5. Document any development-only allowances and follow-up gaps in the task spec.

## Dependency order

| Upstream                               | Downstream                           |
| -------------------------------------- | ------------------------------------ |
| `agent-platform-electron-foundation.5` | `agent-platform-electron-security.1` |
| `agent-platform-electron-security.1`   | `agent-platform-electron-security.2` |

## Tests and verification

- Unit tests for exported security/default helpers where practical.
- Desktop package typecheck, lint, and tests.
- Root quality gates as required by changed file scope.

## Definition of done

- [x] Renderer has no generic Node, filesystem, or shell access by default.
- [x] `BrowserWindow` security defaults are explicit and test-covered or documented.
- [x] Unexpected navigation and window-open paths are blocked or explicitly constrained.
- [x] Development-only exceptions are documented.
- [x] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- The desktop window now makes security preferences explicit:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `nodeIntegrationInWorker: false`
  - `nodeIntegrationInSubFrames: false`
  - `sandbox: true`
  - `webSecurity: true`
  - `allowRunningInsecureContent: false`
  - `webviewTag: false`
  - `navigateOnDragDrop: false`
- DevTools are disabled by default and enabled only when
  `AGENT_PLATFORM_DESKTOP_DEVTOOLS=1` is set.
- Renderer-created windows are denied through `setWindowOpenHandler`.
- Unexpected top-level navigation is blocked unless it stays inside the active renderer origin.
- Webview attachment is blocked because this shell does not need embedded webviews.
- The bootstrap data URL includes a restrictive Content Security Policy. The Next.js renderer CSP
  remains an app-level concern for a later production hardening task.

## Verification notes

- `pnpm --filter @agent-platform/desktop test -- test/windowConfig.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/desktop build`
- `pnpm --filter @agent-platform/desktop smoke`
- `pnpm docs:lint`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- `pnpm test`
