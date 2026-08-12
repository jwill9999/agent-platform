# Task: Render generated outputs in Project Chat

**Beads issue:** `agent-platform-project-experience.7`  
**Spec file:** `docs/tasks/agent-platform-project-experience.7.md`  
**Parent epic:** `agent-platform-project-experience` — Project experience and navigation

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.7.md`

## Summary

When Chat or Project Chat creates a landing page, Markdown document, PDF, image, generated app, or
similar output, users should see a clearly clickable artifact in the main chat. Selecting it opens
an in-app viewer, preferably in a right-side panel or tab, without requiring file-tree navigation.
The same chat surface should make repository files and ready-to-review changes accessible when an
agent has created or modified them.

## Requirements

- Generated output messages include preview metadata for supported artifact types.
- Main chat renders clickable artifact/file cards for generated files and relevant repository
  changes, with clear user-facing names and actions.
- Preview metadata should be independent of one agent/model and should work for coding, docs/content,
  research, automation, and mixed Projects when those profiles produce artifacts.
- Project Chat renders preview cards for:
  - HTML/static app output,
  - Markdown/document output,
  - PDF output,
  - JPEG/PNG and other safe image output,
  - unsupported output with safe fallback actions.
- Repository files that are created or changed by the agent can be opened from chat for source
  review; code changes can open a review view with the relevant staged/unstaged diff and file
  status where available.
- The in-app viewer can open beside the conversation in a right-side panel or tab and preserves
  the active Project, branch, session, and conversation context.
- Preview cards show user-facing names and relative labels, not raw backend roots or host absolute
  paths.
- HTML/app previews use a safe preview boundary appropriate for Electron.
- Users can open the source file or hand off externally from the preview where supported.
- Git actions such as stage, commit, and push remain explicit governed actions; viewing or
  reviewing a file never performs them implicitly.
- Preview state follows the active Project/session and is available after reopening the Project
  where metadata exists.
- Preview cards should be reusable by the Project activity/evidence panel in
  `agent-platform-project-experience.8`.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.3` | `agent-platform-project-experience.6` |

Keep Beads dependencies aligned with this table.

## Parallel Worktree Notes

This task can run in parallel with external IDE handoff and breadcrumb work if it owns only
generated-output preview data/components. Avoid editing right-side panel composition owned by
`agent-platform-project-experience.8` except through an agreed preview component contract.

## Implementation Plan

1. Review existing chat artifact, browser artifact, workspace preview, and workbench evidence
   preview components.
2. Inventory existing workspace-file, Project file-read, Git changes, and Git diff APIs and map
   them into a user-facing artifact/file contract.
3. Define a small preview registry or equivalent mapping from artifact type to render behavior.
4. Define reusable preview, file-review, and diff-card contracts consumed by Project Chat and the
   future activity/evidence panel.
5. Add Project Chat cards and in-app viewer behavior for HTML/app, Markdown/document, PDF, images,
   repository files/diffs, and unsupported output.
6. Add safe preview fallback states for missing files, unavailable Project context, unsupported MIME
   types, and unsafe HTML/app previews.
7. Persist or resolve preview metadata through the existing Project/session artifact model where
   possible.
8. Add focused component tests and Electron/Playwright coverage for clickable generated files,
   repository file/diff review, and viewer context preservation.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`.
- Focused renderer tests for preview card selection, labels, and fallback states.
- Electron/Playwright: create or seed generated HTML/app, Markdown, PDF, and image outputs; verify
  clickable previews and repository file/diff review open from main Project Chat without opening
  the file tree.
- Verify primary UI does not show `/workspace`, backend roots, host absolute paths, hashes, or raw
  internal states.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Generated HTML/app output can be previewed from Project Chat or a linked preview card.
- [ ] Generated Markdown/document output can be previewed from Project Chat or a linked preview card.
- [ ] Generated PDF output can be previewed or opened through a clear safe fallback.
- [ ] Generated image output can be opened in the in-app viewer.
- [ ] Created or modified repository files can be opened from main chat for source or diff review.
- [ ] Unsupported or unsafe outputs show a user-facing unavailable/fallback state.
- [ ] Preview cards do not require users to navigate the file tree.
- [ ] File and diff cards are directly clickable from the main chat.
- [ ] Viewing files does not implicitly stage, commit, or push changes.
- [ ] Preview cards preserve active Project/session context.
- [ ] Preview cards can be reused by the Project activity/evidence panel.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
