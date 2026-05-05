# Task: Open files from chat and workbench evidence

**Beads issue:** `agent-platform-code-workbench.4`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.4.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.4.md`

## Task requirements

Let users open referenced files from chat, tool output, artifacts, and workbench evidence when those
files are available in the active project/workspace.

Supported sources should include:

- file paths in assistant messages
- file paths in tool summaries/details
- artifact metadata that points to workspace files
- current workbench file tree entries
- future branch/diff file rows

Unavailable states must be explicit when no project is open, no file can be resolved, the file is
outside the workspace, or the file is binary/too large.

## Dependency order

### Upstream

| Issue                             | Spec                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.3` | [Expose active and pinned file context to chat](./agent-platform-code-workbench.3.md) |

### Downstream

| Issue                             | Spec                                                               |
| --------------------------------- | ------------------------------------------------------------------ |
| `agent-platform-code-workbench.5` | [Add diff-first edit review](./agent-platform-code-workbench.5.md) |

## Implementation plan

1. Define safe file-reference detection for project/workspace paths.
2. Add an "open in workbench" action for recognized file references.
3. Resolve references against the current project/workspace only.
4. Show unavailable states instead of silently failing.
5. Add tests for recognized paths, rejected paths, and missing project state.

## Git workflow

Branch `task/agent-platform-code-workbench.4` from `task/agent-platform-code-workbench.3`.

## Tests

- [x] `pnpm --filter @agent-platform/web run test`
- [x] `pnpm --filter @agent-platform/web run typecheck`
- [x] `pnpm --filter @agent-platform/web run lint`
- [x] `pnpm --filter @agent-platform/web run build`
- [x] Markdown render tests cover openable and unavailable file-reference states.

## Implementation notes

- Added `apps/web/lib/code-workbench-file-references.ts` for safe file-reference parsing and
  supported text-file classification.
- Inline Markdown code and Markdown links that resolve to workspace paths now render as workbench
  file actions.
- Available references open through the existing workbench file selection path.
- Missing, unsupported, directory, and no-workspace states render as disabled actions with clear
  titles instead of silently failing.
- Resolution is scoped to the current workbench file tree; no backend or remote provider contracts
  were introduced.
- SonarQube MCP was not callable in this session, so the fallback completion gate was used.

## Definition of done

- [x] File references can open files in the workbench when available.
- [x] Resolution is scoped to the active project/workspace.
- [x] Unsafe or unavailable paths show clear states.
- [x] Existing artifact and chat rendering remains stable.
- [x] No remote provider contracts are introduced.

## Sign-off

- [x] Required checks pass.
- [x] `bd close agent-platform-code-workbench.4 --reason "Files can open from chat and workbench evidence"`
- [x] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
