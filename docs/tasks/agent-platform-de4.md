# Task: Show feedback-only block for assistant responses

**Beads issue:** `agent-platform-de4`
**Spec file:** `docs/tasks/agent-platform-de4.md` (this file)
**Parent epic:** `agent-platform-ast` — Frontend

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-de4.md`

## Task requirements

- Assistant responses render as feedback block only.
- Assistant bubble/avatar is removed from assistant messages.
- User bubble/avatar remains unchanged.
- Feedback block remains clear, actionable, and visually distinct.

## Detailed requirements

1. Assistant message presentation

- Do not render assistant bubble wrapper/avatar for assistant role.
- Render critic/feedback controls as the primary assistant output surface.

2. User message preservation

- Keep user message bubble and avatar behavior unchanged.
- Ensure alignment/spacing regressions are avoided for mixed message roles.

3. Interaction and UX

- Feedback block supports current interactions (e.g., review state controls).
- Keep bright, clean UI styling aligned with current design language.

## Implementation plan

1. Identify assistant message rendering path and bubble wrappers.
2. Remove assistant bubble shell while preserving content/feedback block.
3. Keep user role rendering logic intact.
4. Add or update tests for role-specific rendering behavior.
5. Validate in Docker and Playwright user-flow checks.

## Tests (required before sign-off)

- Playwright: assistant bubble absent and feedback block present.
- Playwright: user bubble still present and unchanged.
- Unit/component tests for role-based message rendering.
- `pnpm typecheck`, `pnpm lint`, and relevant tests pass.

## Definition of done

- [ ] Assistant bubble/avatar removed from assistant responses.
- [ ] Feedback block is the visible assistant response surface.
- [ ] User bubble/avatar remains unchanged.
- [ ] Playwright validates visibility/interaction behavior.
- [ ] Quality gates (typecheck/lint/tests/Sonar/Problems) pass.

## Sign-off

- [ ] `make restart` run and containers rebuilt.
- [ ] Playwright user actions executed against rebuilt Docker stack.
- [ ] `bd close agent-platform-de4 --reason "..."` after acceptance criteria met.
