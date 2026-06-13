# agent-platform-288: PR base branch selector and WebView navigation cleanup

## Summary

Fix the Git/GitHub pull request creation panel so users can choose the base branch instead of always merging into the derived default, and remove deprecated Electron WebContents navigation calls.

## Requirements

- Show an editable base branch field in the pull request creation card.
- Suggest known local branches while excluding the current branch.
- Submit the selected base branch to the pull request creation API.
- Keep backend pull request creation compatible with non-`main` base branches.
- Replace `webContents.canGoBack()` and `webContents.canGoForward()` with `webContents.navigationHistory`.

## Tests and Verification

- `pnpm --filter @agent-platform/web test -- test/project-git-workflow-overview.test.ts`
- `pnpm --filter @agent-platform/api test -- test/projectsRouter.test.ts`
- `pnpm --filter @agent-platform/desktop test -- test/webviewService.test.ts`
- Package typecheck, lint, format, docs lint, and `git diff --check`.

## Definition of Done

- PR creation UI exposes target base branch selection.
- API tests prove a non-`main` base branch reaches the GitHub CLI.
- Desktop WebView tests pass without deprecated navigation APIs.
