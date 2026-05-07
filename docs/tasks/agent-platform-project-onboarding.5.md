# Task: Add closeout update candidates and refresh/rescan action

**Beads issue:** `agent-platform-project-onboarding.5`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.5.md`

## Summary

Keep `AGENTS.md` useful after initial onboarding by batching durable instruction updates at
task/session closeout and by allowing users to explicitly refresh or rescan Project instructions.

## Requirements

- During work, the agent can collect candidate durable facts without interrupting the task loop.
- Candidate facts may include corrected run commands, discovered setup steps, architecture changes,
  project conventions, generated-file cautions, or repeated pitfalls.
- Candidate facts may also include non-code Project workflow facts, such as document conventions,
  research sources, automation schedules, generated artifact locations, or recurring task intent.
- Rolling writes to `AGENTS.md` should be avoided during active implementation.
- At task/session closeout, the agent should review candidates and propose low-risk factual updates.
- Later updates are reviewable but do not block ongoing work by default.
- Users can trigger a refresh/rescan action when the Project evolves.
- Refresh/rescan re-runs assessment and may mark onboarding `needs_review` if instructions materially
  diverge from the working tree.
- Broad policy changes, speculative conclusions, and removal of user-authored guidance require
  explicit review.
- Refresh/rescan must preserve the Project profile/capability framing and must not convert a
  non-code or mixed Project into a coding-only Project without user confirmation.

## Implementation Plan

1. Add candidate-instruction-update collection with source/evidence metadata.
2. Add closeout flow support for batching and rendering candidate updates.
3. Add apply/reject controls for candidate updates.
4. Add refresh/rescan action that runs the assessment from task `.2`.
5. Add state handling for material drift and `needs_review`.
6. Document default relaxed update policy and future strict mode.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-onboarding.4` | `agent-platform-project-onboarding.6` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
  - Focused tests: candidate filtering, policy classification, closeout proposal, apply/reject,
    refresh no-change, refresh proposed-update, and material-drift states.
  - Playwright: create/apply/reject closeout update candidates and run refresh/rescan through the UI;
    assert visible state and `AGENTS.md` filesystem results.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- Unit tests for candidate filtering and policy classification.
- Integration tests for closeout update proposal and apply/reject.
- Refresh/rescan tests for no-change, proposed-update, and material-drift states.
- UI tests for update candidates and refresh/rescan controls.

## Definition Of Done

- [ ] Durable instruction learnings are batched rather than written as noisy rolling updates.
- [ ] Closeout can propose reviewable `AGENTS.md` updates.
- [ ] Users can apply or reject update candidates.
- [ ] Refresh/rescan can reassess instructions and flag material drift.
- [ ] Refresh/rescan preserves non-code or mixed Project intent unless the user confirms a change.
- [ ] Later updates are reviewable by default and blocking only when policy requires it.
