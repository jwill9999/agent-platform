# Task: Add data lifecycle and security regression tests

**Beads issue:** `agent-platform-electron-security.6`
**Spec file:** `docs/tasks/agent-platform-electron-security.6.md`
**Parent epic:** `agent-platform-electron-security` — Desktop security, data, and lifecycle

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-security.6.md`

## Summary

Add regression coverage that proves the security and data lifecycle decisions from this epic remain
intact.

## Requirements

- Cover renderer isolation and bridge exposure.
- Cover IPC validation failure paths.
- Cover app data deletion without deleting Project folders.
- Cover credential deletion behavior.
- Document any areas that require later production-packaged Electron E2E coverage.

## Implementation plan

1. Review tests added by earlier security tasks and identify gaps.
2. Add missing unit, contract, smoke, or Playwright/Electron coverage where practical.
3. Ensure coverage runs in normal CI without requiring host-specific secrets.
4. Update docs and task specs with the final verification matrix.
5. Close the parent epic only after all child tasks and CI gates are complete.

## Dependency order

| Upstream                             | Downstream                           |
| ------------------------------------ | ------------------------------------ |
| `agent-platform-electron-security.5` | `agent-platform-electron-security.6` |

## Tests and verification

- Desktop package tests.
- Root typecheck, lint, build, and relevant test suites.
- CI PR checks, Sonar/Problems gate, and review comment resolution.

## Definition of done

- [x] Security regression tests cover renderer isolation and bridge exposure.
- [x] IPC validation failure paths are covered.
- [x] App data deletion tests prove Project folders are preserved.
- [x] Credential deletion behavior is covered.
- [x] Remaining packaged-app E2E gaps are documented.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- Expanded desktop security regression coverage for:
  - runtime navigation/webview guard behavior,
  - explicit preload bridge API shape and scoped maintenance IPC channels,
  - malformed local-data reset payloads,
  - app-owned data reset when paths are missing,
  - protected credential master-key deletion through local-data reset,
  - malformed explicit secret master keys.
- Documented the current package-test coverage matrix and the packaged Electron E2E gaps that
  remain for release work in [Desktop Runtime](../desktop-runtime.md).

## Verification notes

- `pnpm --filter @agent-platform/desktop test -- test/windowConfig.test.ts test/preloadContract.test.ts test/ipcValidation.test.ts test/localDataReset.test.ts test/secretStorage.test.ts`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop test`
- `pnpm --filter @agent-platform/desktop smoke:backend`
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- PR #174 passed GitHub `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`,
  GitGuardian, and SonarCloud.
- SonarCloud reported 0 new issues and 0 security hotspots.
- Sourcery skipped because the PR diff exceeded the account review limit and posted no actionable
  inline comments.
