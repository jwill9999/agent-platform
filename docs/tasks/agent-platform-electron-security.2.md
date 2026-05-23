# Task: Define preload bridge contract and IPC validation

**Beads issue:** `agent-platform-electron-security.2`
**Spec file:** `docs/tasks/agent-platform-electron-security.2.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.2.md`

## Summary

Define the narrow preload API that the renderer may use and validate IPC payloads and senders in the
main process.

## Requirements

- Expose only named, typed APIs from preload.
- Avoid generic `invoke`, filesystem, shell, or path access from renderer code.
- Validate IPC payloads with shared schemas or local validators.
- Verify the sender frame/origin for IPC calls where Electron supports it.
- Keep the contract swappable so future desktop APIs can be added without broadening the trust boundary.

## Implementation plan

1. Inventory existing preload and IPC channels.
2. Define a typed desktop bridge contract for current capabilities.
3. Add payload validation for each IPC handler.
4. Add sender/origin checks around IPC handlers.
5. Add contract tests for exposed API names and representative invalid payloads.

## Dependency order

| Upstream                             | Downstream                           |
| ------------------------------------ | ------------------------------------ |
| `agent-platform-electron-security.1` | `agent-platform-electron-security.2` |
| `agent-platform-electron-security.2` | `agent-platform-electron-security.3` |

## Tests and verification

- Unit/contract tests for bridge API shape.
- Unit tests for valid and invalid IPC payloads.
- Desktop package typecheck, lint, and tests.

## Definition of done

- [x] Preload exposes only named, typed APIs.
- [x] Renderer cannot call generic IPC or filesystem/shell operations.
- [x] IPC handlers validate payloads and reject malformed requests.
- [x] IPC sender/origin validation is implemented or explicitly documented where not applicable.
- [x] Relevant tests and root gates pass.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- Added `desktopBridge.ts` as the explicit preload contract. The only exposed global is
  `window.agentPlatformDesktop`, and the only current root key is `versions`.
- The preload implementation now satisfies the named `AgentPlatformDesktopApi` contract instead of
  deriving the public API type from the implementation object.
- Added `ipcValidation.ts` with reusable helpers for:
  - no-payload channels,
  - typed payload validators,
  - trusted sender checks against the expected `WebContents`.
- There are still no main-process IPC channels in production code. These helpers establish the
  expected pattern before future desktop APIs are added.

## Verification notes

- `pnpm --filter @agent-platform/desktop test -- test/ipcValidation.test.ts test/preloadContract.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/desktop build`
- `pnpm --filter @agent-platform/desktop smoke`
- `pnpm format:check`
- `pnpm docs:lint`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- `pnpm test`

PR #170 passed `verify`, `docker`, `e2e`, docs checks, GitGuardian, and SonarCloud. SonarCloud
initially reported one minor test assertion issue; it was fixed and the rerun reported 0 new issues.
Sourcery was skipped due the account rate limit and posted no actionable inline comments.
