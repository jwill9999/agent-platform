# Task: Define onboarding assessment contracts and state transitions

**Beads issue:** `agent-platform-project-onboarding.1`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.1.md`

## Summary

Define the contracts and state machine for Project onboarding assessment, gap analysis, draft
instructions, review, approval, and refresh/rescan.

## Requirements

- Define structured assessment output:
  - status: `approved`, `in_progress`, or `needs_review`.
  - summary of inferred Project shape.
  - evidence files/config/docs inspected.
  - detected apps/packages/services/subproject scopes.
  - run/test/build/container commands inferred.
  - gaps or contradictions.
  - questions for the user.
  - recommended `AGENTS.md` updates.
- Define state transitions from Epic 1 onboarding states:
  - `missing` -> `in_progress`.
  - `needs_review` -> `approved` or `in_progress`.
  - `in_progress` -> `approved` after user approval.
  - `approved` -> `needs_review` after refresh detects material drift.
- Define persistence for assessment results, draft content, approvals, reviewer identity/time, and
  refresh history.
- Define which assessment outputs are shown to the user and which are retained for audit/debug.
- Define deterministic fixture states for Playwright tests.

## Implementation Plan

1. Review Epic 1 Project metadata and onboarding state.
2. Add contracts/schemas for assessment output, onboarding draft, approval decision, and refresh
   result.
3. Add pure transition helpers for onboarding state changes.
4. Add persistence shape or migrations where needed.
5. Add tests for valid/invalid transitions and structured output parsing.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.6` | `agent-platform-project-onboarding.2` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
  - Focused tests: contract/schema tests for assessment output, draft, approval, refresh, fixture
    states, and onboarding transitions.
  - Playwright: not required unless this task introduces visible state UI; if it does, verify state
    labels and transition affordances through the browser.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- Contract/schema tests for assessment output.
- Unit tests for onboarding state transitions.
- Persistence tests if schema/migrations are added.
- Typecheck across touched packages.

## Definition Of Done

- [ ] Assessment, draft, approval, and refresh contracts are explicit and typed.
- [ ] Onboarding state transitions are testable and reject invalid jumps.
- [ ] Assessment evidence and user-visible summaries are represented separately.
- [ ] Playwright fixture states are defined for later E2E tasks.
