# Epic: Project experience and navigation

**Beads issue:** `agent-platform-project-experience`  
**Spec file:** `docs/tasks/agent-platform-project-experience.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.md`

## Objective

Turn Workspaces into a clear entry point for two current product surfaces: a general Chat workspace
for assistant/tooling work, and Coding Projects that users can create or reopen with branch, Git,
terminal, preview, and local/default IDE handoff support.

This epic follows `agent-platform-project-onboarding`. The onboarding epic may remain focused on
`AGENTS.md` and coding-capable Projects, while this epic implements the broader Workspaces product
experience: chat-first entry, a simplified Workspaces screen, left-side navigation, recent/reopen
Projects, branch selection, terminal access, preview rendering, external/default IDE handoff,
breadcrumbs, and user-facing labels.

## Desktop Re-scope Status

This epic remains the product experience reference, and desktop acceptance now depends on the
Electron Project model that has merged to `staging`.

After Electron manual QA, the Product direction is chat-first and the built-in IDE is not a product
investment path. The desktop implementation should prioritise Project Chat, Project activity, slash
commands, branch context, terminal access, native Project binding, and rendered previews. Direct
manual editing should be explicit through a user-configured/default IDE handoff. Any remaining
built-in file view is transitional and must not become the proof path for the product experience.

[Stabilisation closeout and next-epic gate](./agent-platform-electron-stabilisation.12.md) is
closed. Owner manual testing passed, and the Electron stabilisation branch has merged to `staging`.
Project Experience work can now resume from that baseline.

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

- Chat is the general non-Project workspace. It should support assistant conversation, model
  selection, and general tooling/app context without exposing branch, Git, terminal, or Project
  folder controls.
- Coding Project is the current Project workspace. It represents a folder/repository with branch,
  Git/GitHub, terminal, preview, activity, and external/default IDE handoff capabilities.
- Workspaces should collapse the current `New Project` and `Open Project` cards into one Coding
  Project entry with two explicit actions: create a new coding project or open an existing folder.
- Project profile/capability metadata should remain extensible, but docs/content, research,
  automation, scheduled-task, and email/application workflow surfaces are deferred until their own
  product decisions and epics make them real user-facing workspaces.
- The coding agent is a Project profile/tooling choice, not the definition of all assistant work.
- Backend Project architecture should separate Project identity/folder binding from profile
  detection, capability policy, chat/session state, scheduled work, and generated artifacts.
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
- Workspaces should initially expose Chat and Coding Project. Importing a Project from Chat
  artifacts can be added later when generated-app/document workflows are productized.
- User-facing copy should show Project name, folder/relevant relative path, profile/status, and
  branch only where useful. Runtime details such as `/workspace`, backend root, repository root, and
  backend accessibility are technical details.
- Font sizing should match the existing interface: sidebar rows around `text-sm`/14px, metadata
  `text-xs`, no oversized card-style navigation.

## Re-baseline Status

As of 2026-06-15, Electron stabilisation completed several tasks that originally belonged to this
epic. Those tasks remain part of the epic history, but the remaining implementation plan should not
rebuild them:

- Project Chat is already the default Project surface (`.3`).
- Project Chat already has branch context/selection for Git-backed Projects (`.9`).
- Project Chat already has a governed desktop terminal dock (`.10`).
- Duplicate Project names and Project-scoped session restore are implemented (`.11`).
- New Project creation is implemented (`.12`).
- New Project first-write approval behavior is fixed (`.13`).

The remaining Product work is now:

1. define a near-term workspace/profile/capability model that can drive Chat and Coding Project
   expectations while preserving future extensibility;
2. audit and finish Workspaces/sidebar navigation around current behavior;
3. polish and verify external/default IDE handoff instead of building an IDE;
4. clean remaining labels/location context;
5. add generated output previews and the Project activity/evidence panel;
6. add a staged E2E gate that tests the coding workflow deeply first and expands as other profiles
   become real product surfaces.

`agent-platform-electron-stabilisation.20` now lives under
`agent-platform-pre-production-automation` and should feed the coding-workflow matrix into `.6`.
Broader workspace matrices for future specialized profiles should stay out of this epic unless they
are needed for a specific Project Experience acceptance path.

Production macOS release readiness remains separate. Do not block this epic on
`agent-platform-macos-production-sandbox.6.3`, but do not promote a production macOS release until
that signing/notarization gate is closed.

## Scope

In scope:

- Workspace/profile/capability model for Chat and Coding Projects, with extension points for future
  docs/content, research, automation, scheduled-task, and mixed workspaces that are not product
  visible yet.
- Clear backend boundaries between Project records, capability/tool policy, Project sessions,
  scheduled jobs, and generated artifacts.
- Left explorer navigation for Projects and Chats/Sessions.
- Recent/reopen Project list backed by existing Project records and metadata.
- Open/New Project flow from the explorer.
- Coding Project creation/opening from Workspaces, with `New project` and `Open folder` actions
  grouped under one Coding Project entry.
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
- Scheduled task/cron, email workflow, MCP application workflow, and broader automation workspace
  implementation.
- User-facing docs/content, research, generated-app, or automation workspace cards before their
  product definitions are agreed.

## Proposed Task Chain

| Task                                   | Re-baselined purpose                                 | Status         |
| -------------------------------------- | ---------------------------------------------------- | -------------- |
| `agent-platform-project-experience.14` | Re-baseline the epic after Electron stabilisation    | Current task   |
| `agent-platform-project-experience.1`  | Define Chat/Coding Project capability metadata       | Next task      |
| `agent-platform-project-experience.2`  | Simplify Workspaces and sidebar navigation           | Refine         |
| `agent-platform-project-experience.4`  | Polish/verify external/default IDE handoff           | Refine         |
| `agent-platform-project-experience.5`  | Clean labels and location context                    | Refine         |
| `agent-platform-project-experience.7`  | Render generated outputs from Project Chat/activity  | Still relevant |
| `agent-platform-project-experience.8`  | Add Project activity/evidence panel                  | Still relevant |
| `agent-platform-project-experience.6`  | Stage the Project Experience E2E gate                | Final gate     |
| `agent-platform-project-experience.3`  | Make Project Chat the default Project surface        | Done           |
| `agent-platform-project-experience.9`  | Add Project Chat branch selector                     | Done           |
| `agent-platform-project-experience.10` | Add governed terminal dock                           | Done           |
| `agent-platform-project-experience.11` | Disambiguate duplicate Projects and restore history  | Done           |
| `agent-platform-project-experience.12` | Add New Project creation flow                        | Done           |
| `agent-platform-project-experience.13` | Ask for Project write approval from new Project Chat | Done           |

## Parallel Implementation Notes

After the re-baseline task:

- Start with `agent-platform-project-experience.1`; it defines the Chat/Coding Project capability
  vocabulary used by navigation, preview, activity, and E2E expectations.
- Run `agent-platform-project-experience.2`, `.4`, and `.5` as a small UX/navigation cleanup slice
  after `.1`; these tasks should mostly audit and polish existing staging behavior.
- Run `agent-platform-project-experience.7` and `.8` after the profile/capability boundary is clear.
  `.7` owns preview cards and preview metadata. `.8` owns panel composition and normalized activity
  data.
- Keep `agent-platform-project-experience.6` as the integration gate. It should absorb coding-flow
  coverage from completed tasks immediately, then add preview/activity assertions after `.7` and
  `.8` land.

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

- [ ] Workspace/profile contracts distinguish general Chat from Coding Project capabilities.
- [ ] Users can see Chat and Coding Projects in Workspaces/sidebar navigation without scattered
      CTAs.
- [x] Users can reopen previous Projects from stored metadata.
- [x] Users can create a new Project folder from Workspaces without typing an absolute path.
- [ ] Users can access New project and Open folder from one Coding Project entry.
- [x] Projects with the same folder name are distinguishable through short user-facing parent-path
      labels such as `~/projects/agent-platform` and `~/work/client-a/agent-platform`.
- [x] Project Chat restores the last active Project-scoped session, while Personal Chat sessions
      remain separate.
- [x] Opening a Project lands in project-scoped chat by default.
- [ ] Users can hand off to their configured/default IDE from a Project with polished fallback and
      verification, without making the built-in IDE the primary workflow.
- [x] Users can choose the active branch from Project Chat when the Project is a Git repository.
- [x] Users can open a governed Project terminal dock backed by `node-pty`/`xterm.js`.
- [ ] Users can return to Home/Project Chat through breadcrumbs or equivalent quiet navigation.
- [ ] Generated artifacts can be previewed from chat/activity surfaces where supported.
- [ ] Right-side Project activity shows changed files, previews, tests, CI, review feedback, and
      approvals without leaking raw implementation state.
- [ ] Normal UI hides `/workspace`, backend accessibility, backend root, and repository root.
- [ ] Playwright verifies Chat, Project reopen, Project Chat, branch selection, terminal dock,
      external/default IDE handoff, rendered previews, return navigation, and context preservation.
- [ ] Production-like Electron E2E verifies the same desktop path through native Project access;
      browser-only/manual-path opening is not an acceptance path.
