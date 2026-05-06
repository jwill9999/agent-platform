# Task: Verify full onboarding lifecycle with Playwright E2E

**Beads issue:** `agent-platform-project-onboarding.6`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.6.md`

## Summary

Prove the complete Project onboarding and `AGENTS.md` lifecycle through Playwright tests that act as
a human using the product: opening projects, reading assessment output, answering onboarding
questions, reviewing drafts, approving instructions, and verifying code work is unlocked only when
safe.

## Requirements

- Playwright tests must use the UI for user-facing flows.
- Tests must inspect visible state and resulting filesystem state.
- Fixture projects must cover:
  - sufficient existing `AGENTS.md`.
  - missing `AGENTS.md`.
  - insufficient/stale `AGENTS.md`.
  - monorepo with nested `AGENTS.md`.
  - ambiguous subproject request.
- E2E coverage must prove:
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

- Full relevant unit/integration suite.
- Playwright E2E against the Docker runtime.
- CI-compatible fixture cleanup so generated files do not leak into the repo.
- Final regression run proving Epics 1 and 2 together are end-to-end testable without manual human
  validation.

## Definition Of Done

- [ ] Playwright covers sufficient, missing, insufficient, nested, and ambiguous Project instruction
      states.
- [ ] Playwright acts through the UI and verifies visible outputs plus filesystem results.
- [ ] Tests prove writes are blocked before approval and allowed after approval.
- [ ] Tests prove `AGENTS.md` can be drafted, reviewed, approved, refreshed, and updated.
- [ ] Combined Epics 1 and 2 are ready for a full end-to-end Playwright run.
