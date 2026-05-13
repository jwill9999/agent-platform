# Task: Backfill UI regression E2E coverage plan

**Beads issue:** `agent-platform-electron-stabilisation.5`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.5.md`

## Summary

Compare manual QA findings with existing browser and Electron E2E coverage, then create/update
tasks for any missing regression tests.

## Requirements

- Identify which UI regressions were not caught by current tests.
- Distinguish browser Playwright coverage from Electron desktop E2E coverage.
- Ensure Electron-only flows are tested in Electron.
- Cover Project chat, `/help`, `/help init`, `/init`, IDE handoff, return navigation, Recent
  Projects, and active Project switching where relevant.
- Create or update Beads tasks for missing automated coverage.
- Update definitions of done so future Electron/UI tasks require the right test level.

## Implementation Plan

1. Review existing browser and Electron E2E tests.
2. Compare tests against manual QA findings and checklist.
3. Produce a coverage gap list.
4. Add missing test work to existing tasks or create new Beads tasks.
5. Update affected specs with closeout gates.

## Dependencies

| Upstream                                  | Downstream |
| ----------------------------------------- | ---------- |
| `agent-platform-electron-stabilisation.4` | none       |

## Tests And Verification

- `pnpm --filter @agent-platform/desktop run test:e2e` when Electron E2E changes are made.
- `pnpm test:e2e` when browser E2E changes are made.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm docs:lint`
- `git diff --check`

## Definition Of Done

- E2E coverage gaps are identified.
- Each required regression test is assigned to a Beads task.
- Electron-only flows are distinguished from browser E2E flows.
- Closeout criteria are updated where needed.
