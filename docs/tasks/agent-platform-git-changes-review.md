# Task: Implement local Git changes review panel

## Summary

Add a local-only Git Changes view in Project Chat so users can inspect changed files, view diffs, and stage or unstage files without relying on GitHub authentication.

## Scope

- Extend Project Git API contracts for changed files, file diffs, and stage/unstage requests.
- Add Project Git endpoints for changed-file listing, file diff loading, staging, unstaging, and stage-all.
- Replace the placeholder Changes tab in the Git & GitHub panel with a working local review view.
- Keep this pass non-destructive: no discard, reset, delete, force push, merge, or GitHub mutation actions.

## Acceptance Criteria

- Git-backed Projects show grouped staged, unstaged, and untracked files in the Changes tab.
- Selecting a file shows a read-only diff preview.
- Users can stage one file, unstage one file, and stage all local changes.
- Clean repositories show an explicit clean state.
- Non-Git Projects continue to show unavailable state without GitHub-only controls.
- API and web quality gates pass.

## Validation

- `pnpm --filter @agent-platform/contracts test -- test/project.test.ts`
- `pnpm --filter @agent-platform/contracts typecheck`
- `pnpm --filter @agent-platform/api typecheck`
- `pnpm --filter @agent-platform/api test -- test/projectsRouter.test.ts`
- `pnpm --filter @agent-platform/web typecheck`
- `pnpm --filter @agent-platform/web lint`
- `pnpm --filter @agent-platform/web test`
- `pnpm format:check`
- `git diff --check`
