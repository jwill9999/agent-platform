# Epic: Park and extract current onboarding work

**Beads issue:** `agent-platform-electron-extract`  
**Spec file:** `docs/tasks/agent-platform-electron-extract.md`

## Objective

Preserve useful work from the paused `agent-platform-project-onboarding.8` branch without merging the known-wrong Project-opening contract into `main`.

The current branch contains useful slash command and onboarding infrastructure, but manual testing proved that browser-only folder access and manual path entry do not satisfy the desktop Product requirement. This epic creates a clean baseline for the Electron redesign.

## Requirements

- Audit the current onboarding diff and PR state.
- Identify architecture-neutral work that remains valid under Electron.
- Extract useful slash command infrastructure, `/help`, parser/registry/runner boundaries, and tests where cleanly separable.
- Park or revert browser-only/manual-path Project opener behavior.
- Re-scope existing Project onboarding and Project experience specs so they depend on Electron-native Project access.
- Document what was extracted and what was intentionally parked.

## Task Chain

1. `agent-platform-electron-extract.1` — Audit current onboarding branch.
2. `agent-platform-electron-extract.2` — Extract slash command infrastructure.
3. `agent-platform-electron-extract.3` — Park browser-only Project opening.
4. `agent-platform-electron-extract.4` — Re-scope onboarding and experience specs.

## Dependencies

| Upstream                            | Downstream                           |
| ----------------------------------- | ------------------------------------ |
| none                                | `agent-platform-electron-extract.1`  |
| `agent-platform-electron-extract.1` | `agent-platform-electron-extract.2`  |
| `agent-platform-electron-extract.2` | `agent-platform-electron-extract.3`  |
| `agent-platform-electron-extract.3` | `agent-platform-electron-extract.4`  |
| `agent-platform-electron-extract.4` | `agent-platform-electron-foundation` |

## Testing Strategy

- Focused unit/API tests for extracted slash command behavior.
- Focused web tests only for extracted UI-neutral behavior.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm docs:lint`.
- Do not add E2E coverage that locks in browser-only Project opening as the product path.

## Definition Of Done

- No browser-only/manual-path Project opener is merged as the desktop Product path.
- Extracted work has focused automated tests.
- Existing Project onboarding/experience specs clearly depend on Electron Project access.
- Parked work is documented.
- Local gates pass and any PR checks/reviews are green before closing the epic.
