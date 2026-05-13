# Epic: macOS packaging, release, and update readiness

**Beads issue:** `agent-platform-electron-release`  
**Spec file:** `docs/tasks/agent-platform-electron-release.md`

## Objective

Make the macOS desktop app distributable for the owner/internal users first, then prepare for GitHub users.

## Requirements

- Start only after Electron stabilisation/manual QA triage is complete.
- Decide the first macOS artifact shape.
- Build a macOS Electron artifact.
- Document the release process.
- Add GitHub Releases or equivalent artifact workflow.
- Produce checksums.
- Research signing and notarization.
- Defer or specify auto-update.
- Add packaged-app smoke tests.

## Proposed Task Chain

1. macOS packaging tool decision.
2. Local `.app`, `.zip`, or `.dmg` build.
3. GitHub release artifact workflow.
4. Checksums and release notes.
5. Signing/notarization research.
6. Packaged-app smoke tests.

## Dependencies

| Upstream                                | Downstream |
| --------------------------------------- | ---------- |
| `agent-platform-electron-stabilisation` | none       |

## Testing Strategy

- Build artifact smoke tests.
- Packaged app launches without dev servers.
- Packaged app can open a Project and run `/help`.
- CI or documented local release command verifies artifact creation.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:lint`, and packaged-app smoke/E2E.

## Definition Of Done

- macOS artifact can be built through CI or a documented local release process.
- Artifact launches without dev servers.
- Packaged app can open a Project and run `/help`.
- Release process is documented.
- Signing/notarization decision is recorded, even if implementation is deferred.
