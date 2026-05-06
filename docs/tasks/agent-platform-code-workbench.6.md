# Task: Prepare branch and Git sidebar integration

**Beads issue:** `agent-platform-code-workbench.6`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.6.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.6.md`

## Task requirements

Prepare the code workbench UI model for branch, changed-file, and Git/diff sidebar integration.

This task should align with:

- `docs/design/operator-branch-diff-workflows.md`
- `agent-platform-branch-feedback-status`
- the diff-first edit review task

Do not implement remote provider feedback, GitHub checks, CodeQL, SonarQube, or PR mapping in this
task unless explicitly refined later.

## Dependency order

### Upstream

| Issue                             | Spec                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| `agent-platform-code-workbench.5` | [Add diff-first edit review](./agent-platform-code-workbench.5.md) |

### Downstream

| Issue                             | Spec                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.7` | [Document code workbench verification guide](./agent-platform-code-workbench.7.md) |

## Implementation plan

1. Define workbench sidebar placement for changed files and branch summary.
2. Reuse the operator branch/diff workflow states where possible.
3. Surface local changed-file state from existing frontend state where available.
4. Add placeholders/unavailable states for branch feedback providers.
5. Document handoff to `agent-platform-branch-feedback-status`.

## Git workflow

Branch `task/agent-platform-code-workbench.6` from `task/agent-platform-code-workbench.5`.

## Tests

- [x] `pnpm --filter @agent-platform/web run test`
- [x] `pnpm --filter @agent-platform/web run typecheck`
- [x] `pnpm --filter @agent-platform/web run lint`
- [x] `pnpm --filter @agent-platform/web run build`
- [x] Focused unit tests cover clean, dirty, and pending-review local changed-file states.

## Implementation notes

- Added `apps/web/lib/code-workbench-branch-summary.ts` as the frontend-only branch/change summary
  model.
- Added a compact workbench branch panel to the IDE chat sidebar.
- The panel shows workspace name, explicit `Branch not connected` copy, local changed-file count,
  dirty files from open tabs, and pending review proposals from the diff-first edit flow.
- Provider rows are explicit unavailable states for Git branch discovery and remote checks.
- This task intentionally does not discover branches, PRs, GitHub checks, CodeQL, SonarQube,
  reviews, or provider auth state.
- Live branch/provider discovery remains owned by `agent-platform-branch-feedback-status`.
- SonarQube MCP was not callable in this session, so the fallback completion gate was used.

## Definition of done

- [x] Workbench sidebar model for changed files/branch summary is defined or implemented.
- [x] States align with operator branch/diff workflow docs.
- [x] Provider-unavailable states are clear.
- [x] Relationship to `agent-platform-branch-feedback-status` is explicit.
- [x] No remote provider contracts are introduced.

## Sign-off

- [x] Required checks pass.
- [x] `bd close agent-platform-code-workbench.6 --reason "Branch and Git sidebar integration prepared"`
- [x] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
