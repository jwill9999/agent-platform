# Task: Gate agent tools by workspace capability state

**Beads issue:** `agent-platform-project-workspaces.5`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.5.md`

## Summary

Derive the agent tool surface from the active workspace capability state so frontend-only projects do
not accidentally expose backend write tools, and backend-mounted projects can safely use them.

## Requirements

- Tool availability must be policy-driven, not prompt-only.
- `frontend_only` workspaces should use review/proposal flows for file changes.
- `backend_mounted` workspaces can expose file, Git, terminal, and sensor tools scoped to the project.
- `readonly` workspaces should expose read/review capability only.
- The UI should explain unavailable capabilities in user-facing language.

## Implementation Plan

1. Define a workspace capability-to-tool policy.
2. Apply the policy before tool definitions are sent to the model.
3. Avoid partial tool sets that encourage infinite utility-tool loops; prefer explicit no-tool or
   review-only modes when writes are unavailable.
4. Surface tool-mode state in the workbench panel.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.4` | `agent-platform-project-workspaces.6` |

## Tests And Verification

- Unit tests for capability-to-tool policy.
- Integration test proving backend write tools are available only in `backend_mounted` sessions.
- Manual test: frontend-only workspace returns review proposals, not backend tool writes.
- Manual test: backend-mounted workspace writes to the active project root.

## Definition Of Done

- [ ] Tool exposure follows workspace capability state.
- [ ] Frontend-only workspaces cannot write into Docker `/workspace`.
- [ ] Backend-mounted workspaces write only to the active project root.
