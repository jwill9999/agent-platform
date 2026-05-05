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

- [x] `pnpm --filter @agent-platform/web run test`
- [x] `pnpm --filter @agent-platform/web run typecheck`
- [x] `pnpm --filter @agent-platform/web run lint`
- [x] `pnpm --filter @agent-platform/web run build`
- [x] Headless browser smoke test confirmed an opened file can be pinned, shows as `Pinned`,
      appears in the next-message context count, and exposes a remove control.

## Implementation notes

- Added a shared code-context draft model in `apps/web/lib/code-workbench-context.ts`.
- The chat context panel now shows workspace, active file state, include/exclude active-file
  control, pinned files, excluded/sanitisation warnings, and next-message context counts.
- Message submission now uses the same sanitised context draft shown to the user.
- Pinned files refresh from matching open tabs, so unsaved editor changes are reflected in the next
  message context.
- Explorer pinning now reads file content through the File System Access handle when needed instead
  of silently doing nothing for unloaded files.
- SonarQube MCP was not callable in this session, so the fallback completion gate was used.

## Definition of done

- [x] Active file context is visible in the side-panel chat.
- [x] Pinned/included files are visible and controllable.
- [x] User-visible context matches submitted sanitized context.
- [x] Unavailable/excluded file states are clear.
- [x] Existing chat behavior remains intact.

## Sign-off

- [x] Required checks pass.
- [x] `bd close agent-platform-code-workbench.3 --reason "Active and pinned file context exposed to chat"`
- [x] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
