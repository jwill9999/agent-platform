# agent-platform-electron-stabilisation.22 - Improve Git diff preview rendering

## Summary

Improve the Git & GitHub Changes tab diff preview so narrow desktop panels show readable, structured diffs instead of a cramped raw code block.

## Requirements

- Render unified diffs with distinct visual treatment for file headers, hunk headers, additions, deletions, and context lines.
- Keep the preview usable in the right-hand desktop panel with stable scrolling and no layout expansion.
- Keep selected-file metadata and actions easy to scan.
- Cover the renderer in the existing desktop Git workflow E2E.

## Implementation Plan

- Parse diff lines by prefix and render rows with stable `data-diff-line-kind` attributes.
- Add a compact diff preview header and line-number/prefix columns.
- Restyle the selected file summary with mode and change counts.
- Extend the Electron Git workflow E2E to select a modified file and assert hunk/addition rows render.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/web typecheck`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop test:e2e -- e2e/project-git-workflow.e2e.ts`

## Definition Of Done

- Diff preview is visually structured and readable in the desktop Git panel.
- Targeted Electron Git workflow E2E passes.
- Task is closed in Beads with verification evidence.
