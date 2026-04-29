# Task: Refactor input bar controls into unified chat input

**Beads issue:** `agent-platform-lt6`
**Spec file:** `docs/tasks/agent-platform-lt6.md` (this file)
**Parent epic:** `agent-platform-ast` — Frontend

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-lt6.md`

## Task requirements

- Integrate model/agent selection and attachment controls into chat input bar.
- Avoid separate floating control surfaces for these actions.
- Keep layout bright, clean, minimal, and responsive.
- Preserve existing send behavior with and without attachments.

## Detailed requirements

1. Input composition

- Input bar contains text input, model/agent selector, attachment trigger, and send action.
- Controls are grouped in one cohesive component.

2. Attachments

- Common file types supported by current flow remain supported.
- Attached files are visible and removable before send.

3. Model/agent selection

- Selector remains discoverable and keyboard accessible.
- Current selection is clearly visible near the input field.

4. UX constraints

- Avoid crowding at mobile widths; collapse gracefully if needed.
- Do not regress existing keyboard shortcuts for sending messages.

## Implementation plan

1. Identify current control locations and input bar composition.
2. Merge selector and attachment controls into input bar layout.
3. Update state wiring for model selection and attachment management.
4. Add or update tests for integrated controls and send behavior.
5. Validate in Docker and Playwright user-flow checks.

## Tests (required before sign-off)

- Playwright: input bar includes selector + attachment + send controls.
- Playwright: send flow works with no attachment and with attachment.
- Unit/component tests for control composition and state wiring.
- `pnpm typecheck`, `pnpm lint`, and relevant tests pass.

## Definition of done

- [ ] Input bar integrates selector and attachment controls.
- [ ] Attachments are visible/manageable before send.
- [ ] Model/agent selection remains intuitive and accessible.
- [ ] Playwright validates interactions in rebuilt Docker environment.
- [ ] Quality gates (typecheck/lint/tests/Sonar/Problems) pass.

## Sign-off

- [ ] `make restart` run and containers rebuilt.
- [ ] Playwright user actions executed against rebuilt Docker stack.
- [ ] `bd close agent-platform-lt6 --reason "..."` after acceptance criteria met.
