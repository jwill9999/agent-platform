# Task: Expose browser observability and artifacts

**Beads issue:** `agent-platform-browser-tools.4`  
**Spec file:** `docs/tasks/agent-platform-browser-tools.4.md` (this file)  
**Parent epic:** `agent-platform-browser-tools` - Browser automation tool pack

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-browser-tools.4.md`

## Task requirements

Expose browser sessions, action history, screenshots, snapshots, traces, and runtime failures through API/UI surfaces so users and agents can inspect browser evidence without flooding the chat transcript.

Required outcomes:

- Add API surfaces to list browser sessions for a chat session/run.
- Add API surfaces to fetch bounded evidence metadata and artifacts.
- Show browser activity in the UI with compact status:
  - active/closed/timed out
  - current URL/title
  - last action
  - captured screenshots/snapshots
  - policy-denied actions
  - approval-required actions
  - runtime limitation states
- Provide artifact previews for screenshots and textual snapshots.
- Keep raw logs/traces behind explicit expandable views or downloadable artifacts.
- Add retry/close controls where appropriate.
- Feed normalized browser evidence into the existing observability/sensor surfaces for later UI-quality work.

## Dependency order

### Upstream - must be complete before this task

| Issue                            | Spec                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `agent-platform-browser-tools.3` | [Add governed navigation and input actions](./agent-platform-browser-tools.3.md) |

### Downstream - waiting on this task

| Issue                            | Spec                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| `agent-platform-browser-tools.5` | [Validate browser tools end to end](./agent-platform-browser-tools.5.md) |

## Implementation plan

1. Review current observability, artifact, workspace, and chat-output UI patterns.
2. Add API contracts/routes for browser session state and evidence metadata.
3. Add UI components for browser activity and artifact previews, using a drawer/panel pattern rather than inline chat spam.
4. Wire browser evidence summaries into observability where useful.
5. Add focused API and web tests.
6. Update API and development docs.

## Git workflow

Branch `task/agent-platform-browser-tools.4` from `task/agent-platform-browser-tools.3`.

## Tests

- `pnpm --filter @agent-platform/api run test`
- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm typecheck`
- Add tests for:
  - browser session listing
  - artifact metadata fetch
  - screenshot/snapshot preview rendering
  - policy-denied and approval-required states
  - runtime limitation display
  - no raw artifact spam in chat transcript

## Definition of done

- [x] Browser sessions and artifacts are inspectable through API/UI.
- [x] Evidence previews are bounded and explicit.
- [x] Policy and runtime failures are visible to users and agents.
- [x] Browser evidence can be consumed later by UI-quality sensors.
- [x] Quality gates pass for touched packages.

## Sign-off

- [x] Task branch created from `task/agent-platform-browser-tools.3`
- [x] Required tests executed and passing
- [x] Checklists in this document are complete
- [x] PR: N/A - merge at segment end
- [x] `bd close agent-platform-browser-tools.4 --reason "Browser observability and artifacts exposed"`
- [x] `decisions.md` updated only if architectural decision changed (not required)
- [x] `session.md` updated if handoff needed (not required)

**Reviewer / owner:** Jason Williams **Date:** 2026-05-04
