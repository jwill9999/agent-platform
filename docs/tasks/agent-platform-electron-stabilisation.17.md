# Task: Backfill Electron stabilisation E2E coverage

**Beads issue:** `agent-platform-electron-stabilisation.17`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.17.md`

## Summary

Add Electron Playwright coverage for deterministic gaps from the `.12` manual QA checklist so owner
manual QA can focus on native/subjective checks.

## Requirements

- Cover Settings/model/API key discovery and persistence.
- Cover Recent Project and settings persistence across Electron restart.
- Cover Project-scoped versus Personal Chat session history.
- Cover missing/unavailable Recent Project behavior.
- Add a broader internal path/state leakage and layout/readability smoke.
- Record the automation/manual split in a QA matrix.

## Implementation Plan

1. Add a focused Electron Playwright backfill spec.
2. Use a production-like managed backend and standalone renderer.
3. Relaunch Electron with the same runtime directory to prove persistence.
4. Seed titled sessions directly for deterministic session-scope assertions.
5. Record coverage in `docs/qa/electron-stabilisation-automation-matrix.md`.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/stabilisation-backfill.e2e.ts`
- `pnpm --filter @agent-platform/desktop test:e2e`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`

Latest evidence on 2026-06-12:

- Focused stabilisation backfill E2E: passed.
- Full desktop Electron E2E suite: `8 passed`.
- Desktop lint/typecheck, docs lint, Prettier check, and whitespace diff check: passed.

## Definition Of Done

- The deterministic `.12` QA gaps have Electron Playwright coverage.
- The automation/manual QA matrix is updated.
- Relevant E2E checks pass or any failure is documented with a follow-up task.
