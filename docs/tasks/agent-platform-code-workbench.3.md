# Task: Expose active and pinned file context to chat

**Beads issue:** `agent-platform-code-workbench.3`  
**Spec file:** `docs/tasks/agent-platform-code-workbench.3.md` (this file)  
**Parent epic:** `agent-platform-code-workbench` — Codex-style code workbench

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-code-workbench.3.md`

## Task requirements

Make the code context visible and controllable when chatting in the workbench.

Users should be able to understand:

- which project/repository/workspace the chat belongs to
- which file is active
- which files are pinned/included
- whether the active file is automatically included
- when a file is too large, unavailable, binary, or excluded
- what context will be sent with the next message

The agent should receive sanitized file context that matches what the user sees.

## Dependency order

### Upstream

| Issue                             | Spec                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| `agent-platform-code-workbench.2` | [Add proper editor engine baseline](./agent-platform-code-workbench.2.md) |

### Downstream

| Issue                             | Spec                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `agent-platform-code-workbench.4` | [Open files from chat and workbench evidence](./agent-platform-code-workbench.4.md) |

## Implementation plan

1. Review current context file behavior in the IDE chat panel.
2. Add a clear context strip or panel for active file and pinned files.
3. Let users pin/unpin active files without losing existing chat behavior.
4. Preserve sanitization, size limits, and redaction.
5. Add tests for visible context and submitted context matching.

## Git workflow

Branch `task/agent-platform-code-workbench.3` from `task/agent-platform-code-workbench.2`.

## Tests

- focused web unit tests for context mapping
- targeted manual check: active file, pinned files, excluded files, sent prompt context

## Definition of done

- [ ] Active file context is visible in the side-panel chat.
- [ ] Pinned/included files are visible and controllable.
- [ ] User-visible context matches submitted sanitized context.
- [ ] Unavailable/excluded file states are clear.
- [ ] Existing chat behavior remains intact.

## Sign-off

- [ ] Required checks pass.
- [ ] `bd close agent-platform-code-workbench.3 --reason "Active and pinned file context exposed to chat"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
