# Epic: Project experience and navigation

**Beads issue:** `agent-platform-project-experience`  
**Spec file:** `docs/tasks/agent-platform-project-experience.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.md`

## Objective

Turn Project into a clear, generic work context that users can reopen, chat with, and optionally
inspect in the IDE without being forced into coding or runtime implementation details.

This epic follows `agent-platform-project-onboarding`. The onboarding epic may remain focused on
`AGENTS.md` and coding-capable Projects, while this epic implements the broader Project product
experience: profile-aware Projects, chat-first entry, left-side navigation, recent/reopen Projects,
optional IDE handoff, breadcrumbs, and user-facing labels.

## Desktop Re-scope Status

This epic remains the product experience reference, but desktop acceptance now depends on the
Electron Project model.

After Electron manual QA, the Product direction is chat-first with a narrower role for the built-in
IDE. The desktop implementation should prioritise Project Chat, Project activity, slash commands,
native Project binding, and rendered previews. Direct manual editing should be explicit, preferably
through a user-configured/default IDE handoff unless a future built-in IDE is deliberately scoped.

Do not start this epic until
[Stabilisation closeout and next-epic gate](./agent-platform-electron-stabilisation.12.md) has
confirmed the Electron stabilisation work is ready to move forward.

The desktop implementation must start with a backend-bound Project created by
[Native Project access and session binding](./agent-platform-electron-project-access.md). Browser
File System Access handles, duplicate browser `Open Folder` CTAs, and manual absolute path entry are
parked and must not be used to prove the Project experience for the downloadable product.

For desktop Product work:

- Opening/reopening a Project creates or resumes a Project-bound chat/session.
- The Project chat and optional IDE view must share the same Project id, session continuity, and
  backend-visible Project root.
- `/workspace`, host absolute paths, backend roots, and internal onboarding states remain technical
  diagnostics, not primary user copy.
- Web Playwright can cover route/component behavior, but final acceptance for Project reopen,
  Project chat, and IDE handoff requires production-like Electron E2E.

## Product Decisions

- Project means a folder/work context. It may be a code repository, docs/content folder, research
  folder, automation workspace, generated app, or mixed files.
- The coding agent is a Project profile/tooling choice, not the definition of Project.
- Opening a Project should land in project-scoped chat by default.
- The built-in IDE is no longer a primary workflow. Manual editing should be explicit and secondary,
  with external/default IDE handoff preferred unless a built-in IDE is separately scoped.
- Generated artifacts such as landing pages, Markdown documents, PDFs, and HTML/app output should be
  previewable from chat/activity surfaces instead of requiring file-system navigation.
- Primary navigation belongs in the left explorer: top-level app routes, recent/reopen Projects, and
  recent Chats/Sessions.
- User-facing copy should show Project name, folder/relevant relative path, profile/status, and
  branch only where useful. Runtime details such as `/workspace`, backend root, repository root, and
  backend accessibility are technical details.
- Font sizing should match the existing interface: sidebar rows around `text-sm`/14px, metadata
  `text-xs`, no oversized card-style navigation.

## Scope

In scope:

- Project profile/capability model for coding, docs/content, research, automation, mixed, and
  unknown Projects.
- Left explorer navigation for Projects and Chats/Sessions.
- Recent/reopen Project list backed by existing Project records and metadata.
- Open/New Project flow from the explorer.
- Native desktop Project selection and reopen semantics are implemented in the Electron Project
  access epic; this epic consumes that backend-bound Project model.
- Project-scoped chat as the default Project surface.
- Explicit file/IDE handoff from an active Project Chat, with external/default IDE handoff preferred
  over extending the built-in IDE during stabilisation.
- Session/project continuity between Project Chat and any optional file/IDE surface.
- Rendered preview surfaces for generated documents/apps where appropriate.
- Breadcrumbs or equivalent quiet location affordance for Home, Chat, Project, and IDE.
- User-facing Project labels that hide runtime implementation details.
- Playwright coverage for the navigation and context-preservation flows.
- Electron E2E coverage for desktop Project open/reopen, Project Chat, IDE handoff, and return
  navigation once the desktop runtime exists.

Out of scope:

- Full `AGENTS.md` onboarding implementation, which belongs to `agent-platform-project-onboarding`.
- Full embedded IDE implementation.
- Multi-user permissions or remote checkout management.
- Scheduled task/cron runtime implementation beyond representing automation as a Project profile.

## Proposed Task Chain

| Task                                  | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `agent-platform-project-experience.1` | Generalize Project profiles and capability metadata      |
| `agent-platform-project-experience.2` | Add left explorer Project and Chat navigation            |
| `agent-platform-project-experience.3` | Make Project Chat the default Project surface            |
| `agent-platform-project-experience.4` | Add optional file/default-IDE handoff with continuity    |
| `agent-platform-project-experience.5` | Clean Project labels and add breadcrumbs                 |
| `agent-platform-project-experience.6` | Verify Project experience navigation with Playwright E2E |

## Testing Strategy Requirements

Each child task must include concrete local and remote verification:

- mandatory local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`, unless
  the task explains why a narrower gate is sufficient.
- focused unit/contract/component tests for touched behavior.
- Playwright coverage for user-visible navigation, Project reopen, Project Chat, optional file/IDE
  handoff, preview rendering, and context preservation when the task changes those flows.
- GitHub PR checks, SonarCloud/GitGuardian/Sourcery state, and review comments must be monitored
  before closing Beads tasks.

## Epic Definition Of Done

- [ ] Project records can represent generic folder/work contexts with profile/capability metadata.
- [ ] Users can see Projects and Chats/Sessions in the left explorer without scattered CTAs.
- [ ] Users can reopen previous Projects from stored metadata.
- [ ] Opening a Project lands in project-scoped chat by default.
- [ ] Users can explicitly open files or hand off to their configured/default IDE from a Project
      without making the built-in IDE the primary workflow.
- [ ] Users can return to Home/Project Chat through breadcrumbs or equivalent quiet navigation.
- [ ] Generated artifacts can be previewed from chat/activity surfaces where supported.
- [ ] Normal UI hides `/workspace`, backend accessibility, backend root, and repository root.
- [ ] Playwright verifies Chat, Project reopen, Project Chat, optional file/IDE handoff, rendered
      previews, return navigation, and context preservation.
- [ ] Production-like Electron E2E verifies the same desktop path through native Project access;
      browser-only/manual-path opening is not an acceptance path.
