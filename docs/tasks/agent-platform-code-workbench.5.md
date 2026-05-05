# Task: Add diff-first edit review

**Beads issue:** `agent-platform-code-workbench.5`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.5.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.5.md`

## Task requirements

Show agent-proposed code edits as reviewable diffs before the user applies or rejects them.

The task should support the current assistant code-application flow and improve it so users can
inspect changes first.

Required behavior:

- proposed file path is clear
- before/after or unified diff is visible
- apply and reject actions are explicit
- applied changes update the editor/workbench state
- rejected changes do not modify the file
- binary/unavailable/large-file cases have clear unavailable states

## Dependency order

### Upstream

| Issue                             | Spec                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.4` | [Open files from chat and workbench evidence](./agent-platform-code-workbench.4.md) |

### Downstream

| Issue                             | Spec                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.6` | [Prepare branch and Git sidebar integration](./agent-platform-code-workbench.6.md) |

## Implementation plan

1. Inventory current code block apply/create-file behavior.
2. Define frontend-only edit proposal model if possible.
3. Add diff viewer UI using existing design-system constraints.
4. Wire apply/reject decisions into existing editor state.
5. Add tests for apply, reject, missing file, and dirty-state preservation.

## Git workflow

Branch `task/agent-platform-code-workbench.5` from `task/agent-platform-code-workbench.4`.

## Tests

- [x] `pnpm --filter @agent-platform/web run test`
- [x] `pnpm --filter @agent-platform/web run typecheck`
- [x] `pnpm --filter @agent-platform/web run lint`
- [x] `pnpm --filter @agent-platform/web run build`
- [x] Focused unit tests cover diff row generation and new-file proposal metadata.

## Implementation notes

- Added a frontend-only edit-review model in
  `apps/web/lib/code-workbench-edit-review.ts`.
- Assistant code-block `Review` / `Diff` actions now create a pending proposal instead of mutating
  the editor immediately.
- The editor surface shows a review panel with path, new-file state, unified-style line diff, and
  explicit `Apply` / `Reject` actions.
- Applying a proposal updates the matching workbench tab and marks it dirty.
- Rejecting a proposal clears the review panel without changing the file.
- Missing target files are opened as empty new-file proposals before content is applied.
- SonarQube MCP was not callable in this session, so the fallback completion gate was used.

## Definition of done

- [x] Agent-proposed edits are shown as diffs before application.
- [x] Apply and reject decisions are explicit.
- [x] Applied edits update workbench/editor state correctly.
- [x] Rejected edits leave files unchanged.
- [x] Tests cover critical edit-review paths.

## Sign-off

- [x] Required checks pass.
- [x] `bd close agent-platform-code-workbench.5 --reason "Diff-first edit review added"`
- [x] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
