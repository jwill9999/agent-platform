# Task: Add New Project creation flow

**Beads issue:** `agent-platform-project-experience.12`  
**Spec file:** `docs/tasks/agent-platform-project-experience.12.md`  
**Parent epic:** `agent-platform-project-experience` - Project experience and navigation

The Beads issue **description** must begin with:
`Spec: docs/tasks/agent-platform-project-experience.12.md`

## Summary

Add a clear **New Project** flow so users can create a fresh Project folder from the desktop app
instead of only opening an existing folder. Workspaces should distinguish creating a new Project,
opening an existing folder, and importing work that started in Chat.

## Product Model

Workspaces should expose three Project entry paths:

- **Start from scratch:** create a new folder on the user's machine, optionally seed it with
  instructions/files, and open it into Project Chat.
- **Use an existing folder:** open a folder that already exists on the user's machine.
- **Import from Chat:** promote a generated artifact or previous Chat work into a Project folder
  while making it clear that future Project edits do not mutate the original Chat transcript.

This keeps the core product rule intact: a Project is a user-owned folder/work context on the host
system, not an opaque internal runtime path.

The UI pattern can borrow the useful separation from other desktop agent products without copying
their backend model. The important architectural point is that **Project creation is only one part
of the work context**. The backend should keep these concerns separate:

- **Project record:** identity, folder binding, display name, profile, recent/reopen metadata.
- **Project profile:** coding, docs/content, research, automation, mixed, or unknown.
- **Capability policy:** which tools and integrations are available in that Project context.
- **Chat/session state:** conversations, drafts, attachments, selected agent/model, and restore
  behavior.
- **Scheduled work:** recurring/manual jobs linked to a Project when relevant, but not embedded in
  the Project record itself.
- **Artifacts:** generated files, previews, imports from Chat, and reviewable outputs.

That separation should keep the backend maintainable as Projects grow beyond coding folders.

## Requirements

- Add a **New Project** action from Workspaces.
- Keep the backend implementation modular: Project creation must not hard-code coding-only tools,
  scheduled jobs, branch state, or onboarding state into the Project record.
- Present choices for:
  - Start from scratch,
  - Use an existing folder,
  - Import from Chat, if chat-originated artifacts exist.
- For **Start from scratch**:
  - collect Project name,
  - let the user choose a parent location with the native OS folder picker,
  - create the folder on the host filesystem,
  - optionally add initial instructions and files,
  - open the new Project into Project Chat.
- For **Use an existing folder**, reuse the existing native folder selection flow.
- For **Import from Chat**, create a new Project folder from selected Chat artifacts while preserving
  clear separation from the original Chat session.
- Add the new Project to Recent Projects after creation.
- Hide internal paths and runtime state from normal UI.
- Ensure duplicate folder names use the disambiguation rules from
  `agent-platform-project-experience.11`.
- Keep the flow compatible with Project profiles: code, docs/content, research, automation, mixed,
  or unknown.
- Attach tools, scheduling, branch support, and generated-output handling through capability/profile
  services rather than by adding ad hoc fields to the Project creation flow.

## Implementation Plan

1. Review existing native Project open APIs and Electron main/preload capabilities.
2. Review current Project, session, capability, artifact, and scheduler boundaries before adding
   new Project creation APIs.
3. Add a desktop-safe Project folder creation IPC/API contract that returns a Project record plus
   inferred/default profile metadata.
4. Add Workspaces UI for New Project options.
5. Implement Start from scratch with Project name validation and native parent-folder selection.
6. Reuse existing folder open for Use existing folder.
7. Define the initial Import from Chat contract and implement only if chat artifacts are already
   available; otherwise show a disabled/empty state with clear copy.
8. Persist created Projects and open them into Project Chat.
9. Keep scheduled jobs, tool access, branch state, and onboarding as linked services/policies.
10. Add tests for folder creation, cancel flows, duplicate names, and Project Chat landing.

## Dependency Order

| Upstream                               | Downstream                             |
| -------------------------------------- | -------------------------------------- |
| `agent-platform-project-experience.3`  | `agent-platform-project-experience.12` |
| `agent-platform-project-experience.11` | `agent-platform-project-experience.12` |
| `agent-platform-project-experience.12` | `agent-platform-project-experience.6`  |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused contract tests for Project creation validation and persistence.
- Focused UI/component tests for the New Project modal and cancel/validation states.
- Electron/Playwright:
  - create a new Project folder in a temporary parent directory,
  - verify the folder is created on the host filesystem,
  - verify the Project opens into Project Chat,
  - verify it appears in Recent Projects,
  - verify duplicate names are disambiguated,
  - verify cancel paths do not create folders or records.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Playwright E2E Strategy

Feature: New Project creation from Workspaces

Background:

- Given the Electron desktop app starts with isolated runtime data
- And the desktop Project bridge is available
- And the test harness provides a temporary parent folder for new Projects

Scenario: Start from scratch creates a host folder and opens Project Chat

- Given I am on the Workspaces screen
- When I choose "New Project"
- And I choose "Start from scratch"
- And I enter a Project name
- And I create the Project
- Then the folder is created inside the selected parent folder
- And the app opens Project Chat for the new Project
- And the Project appears in Recent Projects
- And no absolute host path or internal runtime path is shown as normal copy

Scenario: Use an existing folder remains available

- Given I am on the Workspaces screen
- When I choose "Open Project"
- Then the native Project folder selection flow is used
- And the selected folder opens into Project Chat

Scenario: Import from Chat is safely represented before artifact support exists

- Given I am on the New Project choices dialog
- Then "Import from Chat" is visible as unavailable
- And selecting it cannot create a folder or Project record

Scenario: Cancel does not mutate state

- Given I am creating a Project
- When I cancel the native parent folder picker
- Then no Project folder is created
- And no Project record is registered
- And the user remains in control of the dialog.

## Definition Of Done

- [ ] Users can create a new Project folder without typing an absolute path.
- [ ] Users can still open an existing folder through the native folder picker.
- [ ] Import from Chat is implemented or clearly represented as unavailable until artifacts exist.
- [ ] New Projects open into Project Chat.
- [ ] New Projects appear in Recent Projects with safe disambiguation.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
