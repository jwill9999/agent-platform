# Task: Refactor sidebar to Chat/IDE only with settings overflow

**Beads issue:** `agent-platform-ucg`
**Spec file:** `docs/tasks/agent-platform-ucg.md` (this file)
**Parent epic:** `agent-platform-ast` — Frontend

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ucg.md`

## Task requirements

- Primary sidebar shows only Chat and IDE entries.
- Non-primary navigation items are moved to a settings/menu surface.
- Sessions and Tools must not appear as primary sidebar entries.
- Sidebar behavior remains responsive and keyboard accessible.

## Detailed requirements

1. Navigation structure

- Keep only Chat and IDE in the left navigation rail.
- Move Settings, Sessions, and Tools into a secondary settings/menu entry.
- Preserve route behavior and deep-link support for moved items.

2. UX and accessibility

- Keep visual hierarchy clear: primary rail for core destinations only.
- Preserve focus order and ARIA labels for all moved controls.
- Ensure menu is operable by keyboard and screen reader.

3. Regression constraints

- Do not break existing session switching workflows.
- Do not change API contracts or persistence behavior.

## Implementation plan

1. Locate current sidebar navigation definitions in web UI components.
2. Move non-core entries to settings/menu component.
3. Remove Sessions/Tools from sidebar rendering path.
4. Add or update tests for menu visibility and sidebar composition.
5. Validate in Docker and Playwright user-flow checks.

## Tests (required before sign-off)

- Playwright: verify sidebar contains only Chat and IDE.
- Playwright: verify moved items are available from settings/menu.
- Unit/component tests for navigation rendering logic.
- `pnpm typecheck`, `pnpm lint`, and relevant tests pass.

## Definition of done

- [ ] Sidebar shows only Chat and IDE.
- [ ] Settings/Sessions/Tools are accessible via settings/menu.
- [ ] Accessibility checks for moved controls pass.
- [ ] Playwright validates navigation behavior.
- [ ] Quality gates (typecheck/lint/tests/Sonar/Problems) pass.

## Sign-off

- [ ] `make restart` run and containers rebuilt.
- [ ] Playwright user actions executed against rebuilt Docker stack.
- [ ] `bd close agent-platform-ucg --reason "..."` after acceptance criteria met.
