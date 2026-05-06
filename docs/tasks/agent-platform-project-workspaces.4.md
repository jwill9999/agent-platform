# Task: Resolve `/workspace` and scope runtime tools to the Project

**Beads issue:** `agent-platform-project-workspaces.4`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.4.md`

## Summary

Make `/workspace` resolve to the active Project root for each code-agent session, and ensure runtime
tools cannot read or write outside the Project boundary.

## Requirements

- Runtime tools must receive session/project-aware workspace resolution.
- `/workspace` must map to the active Project root, not a global/default container directory.
- The resolver must not expose host absolute paths to the model when a canonical `/workspace` path is
  sufficient.
- PathJail must enforce the active Project root for file tools and terminal cwd.
- Git helpers, test runners, Docker/container commands, and feedback sensors must use the same
  Project root or repository root according to the Project metadata.
- Tool errors must clearly distinguish:
  - no Project bound.
  - Project unavailable.
  - onboarding not approved.
  - path outside Project boundary.
  - attempted write in read-only state.
- Wrong-root writes are a regression and must be covered automatically.

## Implementation Plan

1. Add a workspace resolver that accepts session id plus Project metadata and returns canonical
   `/workspace` mapping and concrete backend path.
2. Wire the resolver into PathJail and tool dispatch.
3. Apply the same resolver to terminal cwd, Git command roots, test runner roots, Docker command
   roots, and sensor roots where those tools exist.
4. Normalize errors into user-facing messages and machine-readable codes.
5. Add regression tests proving writes cannot land in unrelated Docker `/workspace`.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.3` | `agent-platform-project-workspaces.5` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Unit tests for `/workspace` resolution.
- PathJail tests for allowed and rejected paths.
- Tool dispatch tests proving file writes, Git commands, terminal commands, test commands, Docker
  commands, and sensors receive the active Project root.
- Negative tests for no Project, unavailable Project, read-only Project, and outside-boundary paths.
- Playwright-backed API/UI regression: ask the coding agent to write a file and verify it appears in
  the opened Project fixture, not a default workspace.

## Definition Of Done

- [ ] `/workspace` resolves to the active Project root for code-agent sessions.
- [ ] Runtime tools use the Project resolver instead of a global/default workspace path.
- [ ] PathJail rejects paths outside the active Project boundary.
- [ ] Git, terminal, tests, Docker, and sensors share the same Project root semantics.
- [ ] Wrong-root writes are covered by automated regression tests.
