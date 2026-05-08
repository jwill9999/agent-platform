# Task: Add collaborative onboarding dialogue and draft revisions

**Beads issue:** `agent-platform-project-onboarding.3`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.3.md`

## Summary

When assessment finds missing or insufficient instructions, guide the user through focused Q&A and
revise a proposed `AGENTS.md` until the project context is clear enough to approve.

## Requirements

- Onboarding dialogue must be scoped to the Project and its current assessment result.
- The agent should ask focused questions one at a time when important context is missing.
- The user can answer in normal chat.
- The agent must use the answers plus read-only evidence to revise the draft instructions.
- The draft must be human-readable Markdown.
- The draft must cover, when applicable:
  - project structure.
  - Project profile or purpose when it is not purely a code repository.
  - monorepo apps/packages/services.
  - architecture overview.
  - run/build/test/lint commands.
  - Docker/container workflow.
  - environment variables and secrets cautions.
  - coding conventions.
  - agent safety rules and known pitfalls.
- For non-code or mixed Projects, the dialogue should ask about the user's intended workflow before
  assuming coding-specific commands or conventions.
- The agent must ask rather than presume when active subproject scope is ambiguous.
- The dialogue must not unlock code writes until approval happens in task `.4`.

## Implementation Plan

1. Add onboarding-chat mode or message metadata that distinguishes onboarding dialogue from normal
   code work.
2. Add prompt instructions for focused Q&A and draft revision.
3. Store draft `AGENTS.md` content and revision history.
4. Render draft preview and current open questions in the Project UI.
5. Keep write/destructive tools disabled during onboarding dialogue.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-onboarding.2` | `agent-platform-project-onboarding.4` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
  - Focused tests: onboarding dialogue state, question/answer handling, draft revision persistence,
    and write-tool denial during onboarding.
  - Playwright: start onboarding for a missing-instructions fixture, answer the agent's questions,
    and assert the visible draft updates without unlocking code writes.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- Unit/integration tests for onboarding dialogue state and draft revisions.
- Prompt/context tests proving onboarding dialogue cannot receive write/destructive tools.
- UI tests for question, answer, draft preview, and revision history states.
- Playwright partial flow: missing `AGENTS.md` triggers a question; user answers; draft updates.

## Definition Of Done

- [x] Missing/insufficient instructions start a collaborative onboarding Q&A flow.
- [x] The agent asks focused questions instead of guessing critical project facts.
- [x] The agent asks about intended Project use when the folder is non-code, mixed, or ambiguous.
- [x] User answers can revise a human-readable `AGENTS.md` draft.
- [x] Draft state is persisted and visible for review.
- [x] Code writes remain blocked throughout onboarding dialogue.
