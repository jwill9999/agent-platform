# Task: Verify Project experience navigation with Playwright E2E

**Beads issue:** `agent-platform-project-experience.6`  
**Spec file:** `docs/tasks/agent-platform-project-experience.6.md`

## Summary

Prove the full Project experience navigation through Playwright: open Chat, open/reopen Projects,
use Project Chat, hand off to IDE, return, and preserve context.

## Requirements

- Playwright tests must act through user-visible UI.
- Fixtures must include at least one coding Project and one mixed/non-code Project.
- E2E must verify:
  - left explorer shows Projects and Chats/Sessions.
  - a stored Project can be reopened.
  - opening a Project lands in Project Chat.
  - Project Chat and general Chat remain separate.
  - IDE opens only by explicit user action.
  - IDE preserves the active Project/session/conversation context.
  - breadcrumbs or equivalent navigation can return to Home/Project Chat.
  - primary UI hides runtime implementation details.
- Test output must be deterministic enough for CI.

## Implementation Plan

1. Add deterministic Project fixtures and seeding helpers.
2. Add Playwright helpers for explorer navigation, Project reopen, Project Chat, IDE handoff, and
   breadcrumb navigation.
3. Write E2E flows for coding and mixed/non-code Projects.
4. Verify primary UI labels do not expose runtime implementation terms.
5. Update docs with the final Project experience flow.

## Dependency Order

| Upstream                              | Downstream |
| ------------------------------------- | ---------- |
| `agent-platform-project-experience.5` | none       |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e`
  against the Docker runtime.
- Focused tests needed to stabilize fixtures and route state.
- Playwright E2E for Chat, Projects explorer, Project Chat, IDE handoff, return navigation, and label
  cleanup.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Playwright covers the complete Project experience navigation flow.
- [ ] Tests verify Project reopen and context preservation across Project Chat and IDE.
- [ ] Tests verify general Chat remains independent.
- [ ] Tests verify runtime implementation labels are hidden from primary UI.
