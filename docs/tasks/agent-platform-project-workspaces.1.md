# Task: Define project workspace model and capability states

**Beads issue:** `agent-platform-project-workspaces.1`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.1.md`

## Summary

Define the canonical project workspace data model and capability states used by the workbench,
runtime, terminal, Git status, and feedback sensors.

## Requirements

- Introduce a clear `ProjectWorkspace` concept in contracts or app-local types.
- Capture project identity, display name, root label, source type, capability state, and optional
  backend mount metadata.
- Define how sessions bind to a project.
- Define the user-facing rule that `/workspace` means the active project root inside agent/runtime
  context.
- Document unsupported states clearly, especially browser-only projects without backend mounts.

## Implementation Plan

1. Review existing project/session/workspace records and avoid duplicating concepts.
2. Add or refine shared types for workspace source and capability state.
3. Document the mapping between browser folder handles, backend-mounted paths, and remote projects.
4. Add lightweight tests for any new pure mapping helpers.

## Dependency Order

| Upstream | Downstream                            |
| -------- | ------------------------------------- |
| none     | `agent-platform-project-workspaces.2` |

## Tests And Verification

- Unit tests for capability-state helpers, if introduced.
- Typecheck across touched packages.
- Spec review confirms browser-only and backend-mounted states are explicit.

## Definition Of Done

- [ ] Project workspace model exists in code or a documented contract ready for implementation.
- [ ] Capability states are named and testable.
- [ ] Follow-on tasks can depend on the model without guessing semantics.
