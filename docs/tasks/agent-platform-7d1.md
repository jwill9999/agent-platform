# Task: Move sessions sidebar into collapsible menu dropdown

**Beads issue:** `agent-platform-7d1`
**Spec file:** `docs/tasks/agent-platform-7d1.md` (this file)
**Parent epic:** `agent-platform-ast` — Frontend

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-7d1.md`

## Task requirements

- Remove dedicated sessions sidebar from the UI.
- Add a collapsible sessions dropdown in agent/main menu.
- Support listing and switching sessions from the dropdown.
- Keep session management clean, discoverable, and accessible.

## Detailed requirements

1. Sessions UI placement

- Dedicated sessions rail/panel is removed from default layout.
- Sessions are exposed under a collapsible menu group.

2. Session interactions

- User can open the dropdown and see available sessions.
- User can switch sessions from the dropdown with visible active state.
- Create/delete session actions remain reachable from the new location.

3. UX and accessibility

- Maintain keyboard navigation and accessible labels.
- Keep the menu uncluttered and responsive at smaller widths.

## Implementation plan

1. Identify existing sessions sidebar component and entry points.
2. Migrate listing and action controls into dropdown/menu component.
3. Wire selection state and handlers to existing session store/hooks.
4. Add or update tests for listing, switching, and management actions.
5. Validate in Docker and Playwright user-flow checks.

## Tests (required before sign-off)

- Playwright: sessions sidebar absent in main layout.
- Playwright: sessions dropdown opens, lists sessions, and switches session.
- Unit/component tests for dropdown render and state transitions.
- `pnpm typecheck`, `pnpm lint`, and relevant tests pass.

## Definition of done

- [ ] Sessions sidebar removed.
- [ ] Sessions dropdown supports list and switch behavior.
- [ ] Session management actions remain accessible.
- [ ] Accessibility and responsive behavior validated.
- [ ] Quality gates (typecheck/lint/tests/Sonar/Problems) pass.

## Sign-off

- [ ] `make restart` run and containers rebuilt.
- [ ] Playwright user actions executed against rebuilt Docker stack.
- [ ] `bd close agent-platform-7d1 --reason "..."` after acceptance criteria met.
