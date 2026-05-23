# Task: Add recent Projects list and reopen flow

**Beads issue:** `agent-platform-electron-project-access.4`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.4.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.4.md`

## Summary

Show desktop Projects the user can reopen from stored Project metadata.

## Requirements

- List Projects available to the user.
- Show Project names and safe folder labels.
- Reopen a Project into its Project-bound session.
- Handle missing or moved folders with clear user-facing states.
- Keep controls in the left-side Project/chat navigation pattern.

## Implementation plan

1. Add/extend Project list API for recent desktop Projects.
2. Add UI state for recent Projects and reopen action.
3. Reuse Project session binding when a Project is reopened.
4. Add tests for list ordering, missing folder state, and reopen behavior.
5. Update user-facing copy to avoid implementation paths.

## Implementation notes

- Recent desktop Projects use `GET /v1/projects/desktop/recent`.
- The response returns safe desktop Project records only: Project name, safe folder label,
  onboarding state, capability state, and instruction count.
- The recent list omits `workspaceKey` and absolute host paths. Missing or moved folders are
  reported as `metadata.capabilityState: "unavailable"` rather than exposing the stored path.
- The IDE uses the Electron preload bridge for native folder selection, then calls trusted desktop
  registration and binds chat through `POST /v1/sessions/project`.
- Backend-backed file tree and file reads remain owned by
  `agent-platform-electron-project-access.5`.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-project-access.3` | `agent-platform-electron-project-access.4` |
| `agent-platform-electron-project-access.4` | `agent-platform-electron-project-access.5` |

## Tests and verification

- API tests for recent Projects list.
- Renderer tests for recent Projects UI states.
- Integration tests for reopen into Project-bound session.
- Root gates and PR checks before closure.

## Definition of done

- [x] User can see recent Projects.
- [x] User can reopen a Project from stored metadata.
- [x] Missing/moved folders have a clear state and do not crash the flow.
- [x] UI avoids `/workspace` and host absolute paths by default.
- [x] Relevant tests and root gates pass.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
