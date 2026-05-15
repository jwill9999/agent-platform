# Epic: Project experience and navigation

**Beads issue:** `agent-platform-project-experience`  
**Spec file:** `docs/tasks/agent-platform-project-experience.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.md`

## Objective

Turn Project into a clear, generic work context that users can reopen, chat with, run commands
against, preview generated outputs from, and optionally hand off to their local/default IDE without
being forced into coding or runtime implementation details.

This epic follows `agent-platform-project-onboarding`. The onboarding epic may remain focused on
`AGENTS.md` and coding-capable Projects, while this epic implements the broader Project product
experience: profile-aware Projects, chat-first entry, left-side navigation, recent/reopen Projects,
branch selection, terminal access, preview rendering, external/default IDE handoff, breadcrumbs, and
user-facing labels.

## Desktop Re-scope Status

This epic remains the product experience reference, but desktop acceptance now depends on the
Electron Project model.

After Electron manual QA, the Product direction is chat-first and the built-in IDE is not a product
investment path. The desktop implementation should prioritise Project Chat, Project activity, slash
commands, branch context, terminal access, native Project binding, and rendered previews. Direct
manual editing should be explicit through a user-configured/default IDE handoff. Any remaining
built-in file view is transitional and must not become the proof path for the product experience.

Do not start this epic until
[Stabilisation closeout and next-epic gate](./agent-platform-electron-stabilisation.12.md) has
confirmed the Electron stabilisation work is ready to move forward.

The desktop implementation must start with a backend-bound Project created by
[Native Project access and session binding](./agent-platform-electron-project-access.md). Browser
File System Access handles, duplicate browser `Open Folder` CTAs, and manual absolute path entry are
parked and must not be used to prove the Project experience for the downloadable product.

For desktop Product work:

- Opening/reopening a Project creates or resumes a Project-bound chat/session.
- Project Chat is the primary workspace. Branch selection, terminal sessions, previews, activity,
  slash commands, and generated-output review should attach to the active Project Chat.
- Any external/default IDE handoff must use the same Project id, session continuity, and
  backend-visible Project root without copying the Project folder.
- `/workspace`, host absolute paths, backend roots, and internal onboarding states remain technical
  diagnostics, not primary user copy.
- Web Playwright can cover route/component behavior, but final acceptance for Project reopen,
  Project chat, branch selection, terminal dock, previews, and IDE handoff requires production-like
  Electron E2E where native desktop behavior is involved.

## Product Decisions

- Project means a folder/work context. It may be a code repository, docs/content folder, research
  folder, automation workspace, generated app, or mixed files.
- The coding agent is a Project profile/tooling choice, not the definition of Project.
- Opening a Project should land in project-scoped chat by default.
- The built-in IDE is no longer a primary workflow and should not receive further feature
  investment. Manual editing should be explicit through external/default IDE handoff.
- Project Chat should expose the active branch and allow branch selection where the active Project
  is a Git repository.
- Project Chat should provide a governed terminal dock backed by a real PTY implementation:
  `node-pty` in Electron main, `xterm.js` in the renderer, and a typed IPC bridge.
- Generated artifacts such as landing pages, Markdown documents, PDFs, and HTML/app output should be
  previewable from chat/activity surfaces instead of requiring file-system navigation.
- The right-side Project panel should show changed files, generated outputs, preview cards, tests,
  CI, review comments, and approvals in user-facing language.
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
- Explicit external/default IDE handoff from an active Project Chat.
- Session/project continuity between Project Chat and any external IDE or secondary file surface.
- Branch selector from Project Chat for Git-backed Projects.
- Governed terminal dock from Project Chat using `node-pty`, `xterm.js`, typed IPC, Project-root
  scoping, and safe process lifecycle handling.
- Rendered preview surfaces for generated documents/apps where appropriate.
- Breadcrumbs or equivalent quiet location affordance for Home, Chat, Project, and any secondary
  surface.
- User-facing Project labels that hide runtime implementation details.
- Playwright coverage for the navigation and context-preservation flows.
- Electron E2E coverage for desktop Project open/reopen, Project Chat, branch selection, terminal
  dock, external/default IDE handoff, previews, and return navigation once the desktop runtime
  exists.

Out of scope:

- Full `AGENTS.md` onboarding implementation, which belongs to `agent-platform-project-onboarding`.
- Full embedded IDE implementation or further investment in the built-in IDE as a primary product
  surface.
- Multi-user permissions or remote checkout management.
- Scheduled task/cron runtime implementation beyond representing automation as a Project profile.

## Proposed Task Chain

| Task                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `agent-platform-project-experience.1`  | Generalize Project profiles and capability metadata       |
| `agent-platform-project-experience.2`  | Add left explorer Project and Chat navigation             |
| `agent-platform-project-experience.3`  | Make Project Chat the default Project surface             |
| `agent-platform-project-experience.4`  | Add optional external/default-IDE handoff with continuity |
| `agent-platform-project-experience.5`  | Clean Project labels and add breadcrumbs                  |
| `agent-platform-project-experience.6`  | Verify Project experience navigation with Playwright E2E  |
| `agent-platform-project-experience.7`  | Render generated outputs in Project Chat                  |
| `agent-platform-project-experience.8`  | Add Project activity side panel                           |
| `agent-platform-project-experience.9`  | Add Project Chat branch selector                          |
| `agent-platform-project-experience.10` | Add governed terminal dock                                |
| `agent-platform-project-experience.11` | Disambiguate duplicate Projects and restore history       |

## Parallel Implementation Notes

After `agent-platform-project-experience.3` has made Project Chat the default Project surface:

- `agent-platform-project-experience.4` and `.5` should remain sequential because the handoff and
  breadcrumb copy touch shared navigation.
- `agent-platform-project-experience.7` can run in parallel with `.4`/`.5` if it is limited to
  generated-output preview components and chat artifact rendering.
- `agent-platform-project-experience.8` can run in parallel after the panel data contract is agreed,
  but should avoid editing the same preview components owned by `.7`.
- `agent-platform-project-experience.9` can run in parallel with preview/activity work if it owns
  only branch discovery, branch switching UX, and Project Chat branch context.
- `agent-platform-project-experience.10` should be planned carefully before implementation because
  it touches Electron main/preload, native PTY lifecycle, command safety, Project-root scoping, and
  terminal rendering. It can run in parallel only if its write set is isolated from preview/activity
  components.
- `agent-platform-project-experience.11` should run after Project Chat is the default surface. It can
  run in parallel with branch selector, preview, and activity work if it owns only Project display
  naming, Recent Projects, and Project-scoped session history.
- `agent-platform-project-experience.6` remains the integration verification gate and should absorb
  E2E coverage from `.4`, `.5`, `.7`, `.8`, `.9`, `.10`, and `.11`.

## Testing Strategy Requirements

Each child task must include concrete local and remote verification:

- mandatory local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`, unless
  the task explains why a narrower gate is sufficient.
- focused unit/contract/component tests for touched behavior.
- Playwright coverage for user-visible navigation, Project reopen, Project Chat, branch selection,
  terminal dock behavior, optional external/default IDE handoff, preview rendering, and context
  preservation when the task changes those flows.
- GitHub PR checks, SonarCloud/GitGuardian/Sourcery state, and review comments must be monitored
  before closing Beads tasks.

## Epic Definition Of Done

- [ ] Project records can represent generic folder/work contexts with profile/capability metadata.
- [ ] Users can see Projects and Chats/Sessions in the left explorer without scattered CTAs.
- [ ] Users can reopen previous Projects from stored metadata.
- [ ] Projects with the same folder name are distinguishable through short user-facing parent-path
      labels such as `~/projects/agent-platform` and `~/work/client-a/agent-platform`.
- [ ] Project Chat restores the last active Project-scoped session, while Personal Chat sessions
      remain separate.
- [ ] Opening a Project lands in project-scoped chat by default.
- [ ] Users can hand off to their configured/default IDE from a Project without making the built-in
      IDE the primary workflow.
- [ ] Users can choose the active branch from Project Chat when the Project is a Git repository.
- [ ] Users can open a governed Project terminal dock backed by `node-pty`/`xterm.js`.
- [ ] Users can return to Home/Project Chat through breadcrumbs or equivalent quiet navigation.
- [ ] Generated artifacts can be previewed from chat/activity surfaces where supported.
- [ ] Right-side Project activity shows changed files, previews, tests, CI, review feedback, and
      approvals without leaking raw implementation state.
- [ ] Normal UI hides `/workspace`, backend accessibility, backend root, and repository root.
- [ ] Playwright verifies Chat, Project reopen, Project Chat, branch selection, terminal dock,
      external/default IDE handoff, rendered previews, return navigation, and context preservation.
- [ ] Production-like Electron E2E verifies the same desktop path through native Project access;
      browser-only/manual-path opening is not an acceptance path.
