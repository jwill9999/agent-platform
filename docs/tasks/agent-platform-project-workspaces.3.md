# Task: Add backend workspace resolver and path-jail mapping

**Beads issue:** `agent-platform-project-workspaces.3`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.3.md`

## Summary

Resolve the agent-facing `/workspace` root to the active project workspace for each session, and make
PathJail enforce that mapping.

## Requirements

- Runtime tools must receive a session/project-aware workspace resolver.
- `/workspace` must map to the active project backend mount when the project is `backend_mounted`.
- Tools must fail clearly when the active project is `frontend_only` or `readonly` and a backend file
  operation is requested.
- The resolver must not expose host absolute paths to the model.
- Git, quality gates, and sensors should use the same resolved project root.

## Implementation Plan

1. Add a backend resolver that accepts session/project context and returns a safe mount mapping.
2. Wire the resolver into PathJail/default mounts for runtime tool dispatch.
3. Ensure terminal and Git helpers can use the same root.
4. Add errors that distinguish "no project", "frontend-only project", and "backend mount missing".

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.2` | `agent-platform-project-workspaces.4` |

## Tests And Verification

- Unit tests for `/workspace` resolution.
- Tool dispatch tests proving writes stay inside the active project mount.
- Negative tests for frontend-only and readonly states.

## Definition Of Done

- [ ] Backend tool roots are project-bound.
- [ ] `/workspace` no longer means a global/default container directory in workbench sessions.
- [ ] PathJail rejects paths outside the active project mapping.
