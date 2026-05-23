# Task: Define IDE handoff and generated Project side panel

**Beads issue:** `agent-platform-electron-stabilisation.11`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.11.md`

## Summary

Define the next-step design for manual file editing and agent-created Projects. The app should avoid
rebuilding a full IDE during stabilisation, while still supporting read-only file/context views,
generated file visibility, preview surfaces, and explicit handoff to the user's preferred IDE.

## Product Direction

Project work is chat-first.

The primary Project route should be a Project Chat surface that can see the selected Project and
explain or change it through governed agent actions. The built-in IDE must not be treated as the
default Project destination during stabilisation. It may remain available as an experimental or
secondary file-inspection surface while the product moves toward:

- Project Chat for normal user intent and agent coordination.
- A right-side Project activity panel for changed files, previews, checks, CI, review feedback, and
  approval state.
- External/default IDE handoff for users who want mature manual editing, extensions, diagnostics,
  and local tooling.
- Rendered previews for generated apps/documents so users do not need to navigate the file system to
  inspect outputs.

This keeps the downloadable Electron app focused on agent work and review rather than rebuilding a
full IDE.

## Requirements

- Document whether the built-in IDE is removed, hidden, or experimental for the current release.
- Define an "Open in IDE" handoff to the user's configured/default editor.
- Define how generated Projects are created, named, stored, and shown to the user.
- Define how chat surfaces render generated output, such as landing pages, Markdown documents, PDFs,
  and HTML previews, without requiring users to navigate into the file system.
- Define what the right-side activity panel should show for changed files, tests, CI, review
  comments, and previews.
- Identify implementation research still needed.

## Decisions

### Built-in IDE handling

For stabilisation, the built-in IDE is **secondary/experimental**.

- It should not be the first destination after opening a Project.
- It should not be used as the proof path for Project Chat, slash commands, generated output, or
  Recent Projects.
- It may remain behind explicit navigation while existing tests and implementation are unwound.
- Future work may remove it from primary navigation entirely or replace the menu item with Project
  Chat plus explicit "Open files" / "Open in external IDE" actions.

### External/default IDE handoff

Manual deep editing should use the user's configured/default IDE where possible.

The first macOS implementation should support a capability-detected handoff that can open:

- the active Project folder,
- a specific Project file,
- optionally a file and line number when the editor integration supports it.

The app should not require users to type absolute paths. The selected Project path comes from the
Electron native folder picker and stored Project metadata. Host paths remain implementation data and
should only be used behind the preload/main-process boundary or in explicit technical details.

The handoff must be optional. If no supported editor is configured or detectable, the UI should keep
Project Chat and preview surfaces usable and show a short unavailable state.

### Generated Projects

If a user asks Chat or Project Chat to create a new coding Project, document set, generated app, or
automation workspace, the output should become a Project-like workspace that appears in the left
Project list.

Generated Projects should use these rules:

- Store project metadata in the desktop app data/database layer, not inside the user's unrelated
  folders.
- Store generated files under the app-managed Projects area unless the user explicitly chooses a
  host folder.
- Use human-readable generated names first, with stable ids kept out of primary UI.
- Show the generated Project in Recent Projects and route to Project Chat by default.
- Preserve the same Project context for slash commands, previews, file evidence, and optional
  external IDE handoff.

### Rendered previews

Chat surfaces should show generated outputs as previews when the output type supports it:

- HTML/static app: render in a sandboxed preview frame or equivalent safe preview container.
- Markdown/document: render as a readable document preview with a source-file link/action.
- PDF: render through a PDF viewer or download/open action with a clear fallback.
- Unsupported or unsafe output: show a file card with safe actions and a plain-language reason.

Preview rendering must not rely on users manually opening files from the tree. The agent response and
right-side activity panel should surface the preview directly when an output is created or updated.

### Right-side activity panel

The right-side Project activity panel should be the primary "what changed and what needs attention"
surface. It should show:

- active Project context and selected agent/profile,
- changed files and generated files,
- preview cards for generated HTML/app, Markdown/document, PDF, and screenshots where available,
- running or recent tests/checks,
- CI status and links when branch feedback exists,
- review comments or tool findings when available,
- approval and next-action states in user-facing language.

It should not show raw backend roots, `/workspace` paths, hashes, implementation state enums, or
provider diagnostics as normal copy. Those belong in observability/debug details.

## Implementation Research Still Needed

- macOS editor handoff options: default editor discovery, VS Code/Cursor URL schemes or CLIs,
  fallback `open` behavior, file-and-line support, and signed-app permissions.
- Cross-platform extension points for Windows and Linux editor handoff.
- Safe preview sandboxing for generated HTML/app output inside Electron.
- Storage and lifecycle rules for generated Projects in app data, including cleanup/uninstall
  behavior.
- How right-side activity panel data should normalize branch checks, local tests, review comments,
  generated preview artifacts, and future sensor output.
- Whether preview rendering should reuse existing artifact viewer components or introduce a Project
  preview registry.

## Implementation Plan

1. Review current IDE surface dependencies and determine what can be removed from primary nav safely.
2. Specify local IDE handoff options and platform risks for macOS first.
3. Specify generated Project storage and display rules.
4. Specify rendered preview behavior for chat surfaces, including HTML/app previews,
   Markdown/document previews, PDF previews, and safe fallback states.
5. Specify right-side panel states for code changes, generated previews, tests, and CI.
6. Create follow-up implementation tasks for handoff, previews, activity panel, and E2E coverage.

## Follow-Up Implementation Tasks

The implementation work should continue in `agent-platform-project-experience` after stabilisation
closeout:

- `agent-platform-project-experience.4` should be narrowed from built-in IDE navigation to
  external/default IDE handoff plus optional secondary file inspection.
- `agent-platform-project-experience.7` should implement generated output previews in Project Chat.
- `agent-platform-project-experience.8` should implement the Project activity side panel for
  changed/generated files, previews, checks, CI, and review feedback.

Parallel worktree note: once Project Chat routing is stable, the preview task and activity-panel task
can be implemented in parallel if their write sets are kept separate. Preview work should own
renderer/artifact components; activity-panel work should own panel composition and status summaries.

## Tests And Verification

- Documentation/spec review.
- Follow-up Beads tasks created for implementation work.
- Manual QA checklist updated if user-facing flows change.

## Definition Of Done

- Product decision for built-in IDE handling is documented.
- External/default IDE handoff behavior is specified.
- Generated Project side-panel behavior is specified.
- Rendered preview behavior is specified for generated HTML/app, Markdown/document, and PDF output.
- Any remaining implementation research is explicitly tracked.
