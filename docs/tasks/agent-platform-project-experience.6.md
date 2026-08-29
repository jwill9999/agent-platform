# Task: Stage Project Experience Playwright/Electron E2E gate

**Beads issue:** `agent-platform-project-experience.6`  
**Spec file:** `docs/tasks/agent-platform-project-experience.6.md`

## Summary

Create a staged Project Experience automation gate. Coding Project workflow gets the deepest
coverage first because it is the primary desktop use case; Personal Chat and non-code Project
profiles get explicit lighter expectations until their product surfaces are implemented.

## Desktop Re-scope Note

Final Product acceptance for this navigation flow must run against a built Electron runtime. Web
Playwright can keep regression coverage for shared UI behavior, but it must not prove Project
opening through browser File System Access handles, duplicate browser `Open Folder` CTAs, or manual
absolute path entry.

## Requirements

- Playwright tests must act through user-visible UI.
- Electron E2E must exercise the native Project opener or a production-like test bridge that creates
  the same backend-bound Project/session records.
- Fixtures must include at least one coding Project and one mixed/non-code Project once profile
  metadata exists.
- Phase 1 E2E must verify the coding workflow:
  - left explorer shows Projects and Chats/Sessions.
  - a stored Project can be reopened.
  - opening a Project lands in Project Chat.
  - Project Chat has backend Project context before `/init` or Project-aware slash commands run.
  - Project Chat and general Chat remain separate.
  - external/default IDE handoff opens only by explicit user action.
  - external/default IDE handoff or any secondary file view preserves the active
    Project/session/conversation context.
  - branch selection works from Project Chat for Git-backed Projects and shows safe unavailable
    states for non-Git Projects.
  - the terminal dock can open, run a harmless command, resize/hide, and close in the Electron
    runtime.
  - breadcrumbs or equivalent navigation can return to Home/Project Chat.
  - primary UI hides runtime implementation details, including `/workspace`, backend roots, host
    absolute paths, and internal state names.
- Phase 2 E2E adds generated HTML/app, Markdown/document, and PDF preview assertions after `.7`.
- Phase 2 also verifies generated images and repository-created/modified files are clickable from
  main chat and open source, preview, or diff review in the in-app viewer without losing Project,
  branch, session, or conversation context.
- Phase 3 E2E adds right-side Project activity/evidence panel assertions after `.8`.
- Phase 4 E2E adds profile-specific expectations for docs/content, research, automation, mixed, and
  unknown Projects after those workflows have product behavior beyond fallback states.
- Fold the coding-workflow parts of `agent-platform-electron-stabilisation.20` into this task.
- Test output must be deterministic enough for CI.

## Implementation Plan

1. Inventory existing Electron/browser E2E coverage from stabilisation.
2. Add deterministic Project fixtures and seeding helpers for coding and mixed/non-code Projects.
3. Add Playwright helpers for explorer navigation, Project reopen, Project Chat, branch selection,
   terminal dock, external/default IDE handoff, preview cards, activity-panel states, and location
   navigation.
4. Write Phase 1 coding-workflow E2E first.
5. Add preview/activity/profile phases as their product tasks land.
6. Verify primary UI labels do not expose runtime implementation terms.
7. Update docs with the final Project experience flow.

## Dependency Order

| Upstream                               | Downstream |
| -------------------------------------- | ---------- |
| `agent-platform-project-experience.5`  | none       |
| `agent-platform-project-experience.7`  | none       |
| `agent-platform-project-experience.8`  | none       |
| `agent-platform-project-experience.9`  | none       |
| `agent-platform-project-experience.10` | none       |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e`
  against the Docker runtime.
- Focused tests needed to stabilize fixtures and route state.
- Electron E2E for native Project open/reopen, Projects explorer, Project Chat, slash command
  context, branch selection, terminal dock, external/default IDE handoff, rendered previews,
  activity-panel states, clickable file/diff review, return navigation, and label cleanup.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Gherkin E2E Strategy

```gherkin
Feature: Protect the complete Project Experience with a staged desktop gate

  Background:
    Given a built Electron app is running with isolated deterministic fixtures
    And fixtures include a coding Project and a mixed or non-code Project

  Scenario: Complete the primary coding Project workflow
    When the user reopens the coding Project and works from Project Chat
    Then Project-aware commands, branch selection, terminal, IDE handoff, and return navigation work
    And the active Project, session, and conversation context are preserved

  Scenario: Keep general Chat independent
    Given a coding Project session exists
    When the user opens general Chat
    Then Project-only context and previous Project conversation content are absent
    And normal UI does not expose runtime implementation paths or state labels

  Scenario: Review generated resources and activity
    Given generated resources and normalized activity evidence exist for the coding Project
    When the user opens previews, export actions, tabs, and the activity panel
    Then each surface remains usable through visible controls
    And returning to Project Chat preserves the active context

  Scenario: Show safe fallback behavior for a non-code Project
    When the user opens the mixed or non-code Project
    Then unsupported profile-specific surfaces show explicit safe fallback states
    And coding evidence from another Project is not shown
```

## Definition Of Done

- [ ] Playwright/Electron defines a staged Project Experience automation gate.
- [ ] Phase 1 covers the coding Project workflow deeply.
- [ ] Tests verify Project reopen and context preservation across Project Chat and external/default
      IDE handoff.
- [ ] Tests verify branch selection and terminal dock behavior from Project Chat.
- [ ] Tests verify `/help` and `/init` run with the same Project context as ordinary Project chat.
- [ ] Tests verify general Chat remains independent.
- [ ] Tests verify rendered preview and right-side activity-panel behavior once `.7` and `.8` land.
- [ ] Tests verify runtime implementation labels are hidden from primary UI.
- [ ] Playwright/Electron tests cover the Gherkin scenarios through accessible user-facing controls.
