# Task: Add Project vs Chat entry paths and default agent selection

**Beads issue:** `agent-platform-project-workspaces.2`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.2.md`

## Summary

Let users choose between opening a Project and opening a general Chat before reaching the main work
surface. The selected mode determines the default agent and available interface/tooling.

## Requirements

- Add a clear **Open Project** path that leads to the project/code interface.
- Add a clear **Open Chat** path that leads to a general chat interface.
- Project mode defaults to the coding agent.
- Chat mode defaults to the personal assistant.
- Project mode exposes project-specific surfaces only when a Project is selected: working tree,
  branch/worktree context, file tree, scoped chat, and code-agent capability status.
- Chat mode must not expose branch pickers, Git tools, terminal tools, project file trees, or
  code-write tools by default.
- General Chat may discuss code conceptually, but it must not operate on a loaded working tree unless
  a future orchestration/attachment feature explicitly adds that behavior.
- Keep future orchestration additive; do not require multi-agent routing for the Epic 1 happy path.

## Implementation Plan

1. Review current chat/workbench routes and entry points.
2. Add mode selection or split navigation that routes to Project or Chat.
3. Persist mode on session creation so backend and frontend agree on default agent/capabilities.
4. Resolve default agent by mode: coding agent for Project, personal assistant for Chat.
5. Hide or disable project-only controls in Chat mode with user-facing unavailable states.
6. Add tests that prove Chat sessions do not inherit stale Project context.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.1` | `agent-platform-project-workspaces.3` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Component tests for entry-path rendering and mode-specific default agent selection.
- API/contract tests if session creation carries mode or default-agent metadata.
- Playwright flow: choose **Open Chat**, verify personal-assistant/default-chat UI and no project
  tree/branch/Git/terminal controls.
- Playwright flow: choose **Open Project**, verify project/code UI and coding-agent default state.

## Definition Of Done

- [ ] Users can intentionally choose Project or Chat before entering the main interface.
- [ ] Project sessions default to the coding agent.
- [ ] Chat sessions default to the personal assistant.
- [ ] Project-only code controls are absent or clearly unavailable in Chat.
- [ ] Chat mode does not silently inherit Project context.
- [ ] Future orchestration remains an additive architecture concern, not required by this task.
