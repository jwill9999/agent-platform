# Task: Verify full onboarding lifecycle with Playwright E2E

**Beads issue:** `agent-platform-project-onboarding.6`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.6.md`

## Summary

Prove the complete Project onboarding and `AGENTS.md` lifecycle through Playwright tests that act as
a human using the product: opening projects, reading assessment output, answering onboarding
questions, reviewing drafts, approving instructions, and verifying code work is unlocked only when
safe.

## Desktop Re-scope Note

The existing browser/Docker Playwright coverage is no longer sufficient for desktop Product
acceptance. Final acceptance for this lifecycle must be an Electron E2E flow against a built desktop
runtime: native Project open, Project-bound chat/session, `/init`, review/approval, and filesystem
assertions against the selected Project root.

## Requirements

- Playwright tests must use the UI for user-facing flows.
- Desktop tests must open Projects through the Electron native folder picker or a production-like
  test bridge that exercises the same backend Project registration path.
- Tests must inspect visible state and resulting filesystem state.
- Fixture projects must cover:
  - sufficient existing `AGENTS.md`.
  - missing `AGENTS.md`.
  - insufficient/stale `AGENTS.md`.
  - monorepo with nested `AGENTS.md`.
  - ambiguous subproject request.
  - mixed or non-code Project folder where the user must clarify intended workflow before
    coding-specific assumptions are made.
- E2E coverage must prove:
  - `/init` runs only when a backend-bound Project is attached to the active chat/session.
  - auto-approval for sufficient existing instructions.
  - missing instructions start onboarding dialogue.
  - user answers revise a draft.
  - approving draft writes/finalizes `AGENTS.md`.
  - rejected/request-changes draft remains in progress.
  - code writes are blocked before approval and allowed after approval.
  - approved code writes land inside the Project root.
  - closeout update candidates can be reviewed/applied/rejected.
  - refresh/rescan detects no-change and material-drift states.
  - Chat mode remains independent from Project onboarding.
  - onboarding UI uses user-facing Project labels rather than `/workspace`, backend accessibility,
    backend roots, or host absolute paths as primary copy.
- Test output must be deterministic enough for CI.

## Implementation Plan

1. Add or extend Playwright fixture project generator.
2. Add helpers for opening Project mode, running onboarding assessment, answering questions,
   approving/rejecting drafts, sending code-agent messages, and reading fixture files.
3. Write happy-path onboarding E2E for missing `AGENTS.md`.
4. Write auto-approval E2E for sufficient existing `AGENTS.md`.
5. Write insufficient/stale instructions E2E with request-changes path.
6. Write closeout update and refresh/rescan E2E.
7. Update docs with the final user-facing onboarding flow.

## Dependency Order

| Upstream                              | Downstream |
| ------------------------------------- | ---------- |
| `agent-platform-project-onboarding.5` | none       |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e`
    against the Docker runtime.
  - Focused tests: fixture cleanup and any lower-level regressions required to stabilize E2E.
  - Playwright/Electron: drive the full onboarding lifecycle through the built desktop UI for
    sufficient, missing, insufficient, nested, and ambiguous Project instruction states; assert
    visible outputs and filesystem results against the selected Project root.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- Full relevant unit/integration suite.
- Electron E2E against the built desktop runtime for Product acceptance; Docker/web Playwright may
  remain as lower-level regression coverage only.
- CI-compatible fixture cleanup so generated files do not leak into the repo.
- Final regression run proving Epics 1 and 2 together are end-to-end testable without manual human
  validation.

## Definition Of Done

- [x] Playwright covers sufficient, missing, insufficient, nested, and ambiguous Project instruction
      states.
- [x] Playwright acts through the UI and verifies visible outputs plus filesystem results.
- [x] Tests prove writes are blocked before approval and allowed after approval.
- [x] Tests prove `AGENTS.md` can be drafted, reviewed, approved, refreshed, and updated.
- [x] Tests prove onboarding handles mixed/non-code Project folders without forcing coding-only
      language.
- [x] Combined Epics 1 and 2 are ready for a full end-to-end Playwright run.
- [x] Desktop Product acceptance is explicitly deferred to Electron E2E and does not rely on
      browser-only/manual-path Project opening.
