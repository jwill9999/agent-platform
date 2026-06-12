# Task: Backfill Electron first-load responsive layout E2E

**Beads issue:** `agent-platform-electron-stabilisation.19`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.19.md`

## Summary

Add Electron Playwright coverage for the first-loaded Workspaces screen's responsiveness at the
configured minimum window size and an expanded desktop size.

## Requirements

- Verify the first-loaded Workspaces screen at `960x640`, matching the configured Electron minimum.
- Verify the first-loaded Workspaces screen at an expanded desktop size.
- Confirm primary navigation, Settings, and Open Project remain visible.
- Fail on page-level horizontal overflow.
- Update the automation/manual QA matrix so manual QA knows this is automated.

## Implementation Plan

1. Extend `apps/desktop/e2e/stabilisation-backfill.e2e.ts` with a first-loaded layout test.
2. Resize the Electron `BrowserWindow` at each size and assert the initial Workspaces surface is
   usable.
3. Record the coverage in `docs/qa/electron-stabilisation-automation-matrix.md`.
4. Run focused and relevant full quality gates.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/stabilisation-backfill.e2e.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`

## Definition Of Done

- First-load responsive layout coverage exists for compact and expanded Electron window sizes.
- The QA matrix references the automated coverage.
- Relevant checks pass.
