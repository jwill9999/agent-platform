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

- unit tests for file reference parsing/resolution
- web tests for opening references from chat/tool surfaces where practical
- manual check with valid, missing, binary, and outside-workspace paths

## Definition of done

- [ ] File references can open files in the workbench when available.
- [ ] Resolution is scoped to the active project/workspace.
- [ ] Unsafe or unavailable paths show clear states.
- [ ] Existing artifact and chat rendering remains stable.
- [ ] No remote provider contracts are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-code-workbench.4 --reason "Files can open from chat and workbench evidence"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
