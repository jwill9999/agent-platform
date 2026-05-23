# Task: Add Project activity side panel

**Beads issue:** `agent-platform-project-experience.8`  
**Spec file:** `docs/tasks/agent-platform-project-experience.8.md`  
**Parent epic:** `agent-platform-project-experience` — Project experience and navigation

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.8.md`

## Summary

Add a right-side Project activity panel that shows what changed, what was generated, what checks are
running or complete, and what needs review. This becomes the main evidence surface beside Project
Chat and reduces pressure to keep expanding the built-in IDE.

## Requirements

- The panel is available from Project Chat and follows the active Project/session.
- The panel can show:
  - changed files,
  - generated files,
  - preview cards for generated HTML/app, Markdown/document, PDF, screenshots, or other artifacts,
  - local test/check status,
  - CI status when branch feedback is available,
  - review comments and tool findings when available,
  - approval or next-action states.
- The panel uses user-facing labels and compact typography consistent with the existing interface.
- Raw implementation details such as `/workspace`, backend roots, host absolute paths, hashes,
  provider debug diagnostics, and internal state enums are hidden from normal copy.
- Empty, loading, unavailable, and disconnected states are explicit and safe.
- The data boundary is swappable: the panel should consume normalized activity/evidence data rather
  than hard-coding one provider.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.3` | `agent-platform-project-experience.6` |

Keep Beads dependencies aligned with this table.

## Parallel Worktree Notes

This task can run in parallel with generated preview rendering if it owns panel composition, layout,
and activity summaries. It should consume preview card components from
`agent-platform-project-experience.7` once available rather than duplicating rendering logic.

## Implementation Plan

1. Review current right-side assistant/workbench panels, branch summary, artifact previews, and
   review/check status surfaces.
2. Define a normalized Project activity data shape for changed files, generated files, previews,
   checks, CI, review comments, findings, and approvals.
3. Implement panel composition and compact states for empty/loading/unavailable/disconnected data.
4. Wire available existing data sources first, with placeholders only where future provider work is
   explicitly tracked.
5. Add tests for status grouping, copy, unavailable states, and implementation-detail hiding.
6. Add Electron/Playwright coverage for visible panel states in Project Chat.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`.
- Focused renderer tests for panel grouping, labels, empty/loading/unavailable states, and hidden
  implementation details.
- Electron/Playwright: open a Project, trigger or seed changed/generated file activity, verify the
  right-side panel shows the expected user-facing activity.
- Verify the panel remains usable when CI/review/provider data is unavailable.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Project Chat has a right-side Project activity panel.
- [ ] Panel shows changed/generated files and preview entries when available.
- [ ] Panel shows local checks, CI, review comments, findings, and approval states when available.
- [ ] Panel handles empty/loading/unavailable/disconnected states without leaking implementation
      details.
- [ ] Panel consumes a normalized/swappable activity boundary rather than hard-coding one provider.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
