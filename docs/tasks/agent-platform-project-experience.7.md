# Task: Render generated outputs in Project Chat

**Beads issue:** `agent-platform-project-experience.7`  
**Spec file:** `docs/tasks/agent-platform-project-experience.7.md`  
**Parent epic:** `agent-platform-project-experience` — Project experience and navigation

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.7.md`

## Summary

When Chat or Project Chat creates a landing page, Markdown document, PDF, generated app, or similar
output, users should see an in-app preview from the chat/activity surface instead of needing to
navigate the file tree.

## Requirements

- Generated output messages include preview metadata for supported artifact types.
- Project Chat renders preview cards for:
  - HTML/static app output,
  - Markdown/document output,
  - PDF output,
  - unsupported output with safe fallback actions.
- Preview cards show user-facing names and relative labels, not raw backend roots or host absolute
  paths.
- HTML/app previews use a safe preview boundary appropriate for Electron.
- Users can open the source file or hand off externally from the preview where supported.
- Preview state follows the active Project/session and is available after reopening the Project
  where metadata exists.

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

1. Review existing chat artifact, browser artifact, and workbench evidence preview components.
2. Define a small preview registry or equivalent mapping from artifact type to render behavior.
3. Add Project Chat preview cards for HTML/app, Markdown/document, PDF, and unsupported output.
4. Add safe preview fallback states for missing files, unavailable Project context, unsupported MIME
   types, and unsafe HTML/app previews.
5. Persist or resolve preview metadata through the existing Project/session artifact model where
   possible.
6. Add focused component tests and Electron/Playwright coverage for generated previews.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`.
- Focused renderer tests for preview card selection, labels, and fallback states.
- Electron/Playwright: create or seed generated HTML/app, Markdown, and PDF outputs; verify previews
  appear in Project Chat without opening the file tree.
- Verify primary UI does not show `/workspace`, backend roots, host absolute paths, hashes, or raw
  internal states.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Generated HTML/app output can be previewed from Project Chat or a linked preview card.
- [ ] Generated Markdown/document output can be previewed from Project Chat or a linked preview card.
- [ ] Generated PDF output can be previewed or opened through a clear safe fallback.
- [ ] Unsupported or unsafe outputs show a user-facing unavailable/fallback state.
- [ ] Preview cards do not require users to navigate the file tree.
- [ ] Preview cards preserve active Project/session context.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
