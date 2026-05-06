# Task: Bind Project sessions to a backend-accessible working tree

**Beads issue:** `agent-platform-project-workspaces.3`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.3.md`

## Summary

Create or select Project records only when the backend runtime can access the same working tree that
the user expects the coding agent to operate on. Browser-only folder access may help selection later,
but it is not sufficient for code-agent execution in Epic 1.

## Requirements

- Project opening must validate that the backend can inspect the requested working tree path.
- Project metadata must persist enough identity to reconnect later: display name, project root,
  repository root, current branch or worktree identity, capability state, onboarding state, and
  default coding agent.
- The system must distinguish:
  - backend-accessible Project ready for read-only inspection.
  - backend-inaccessible path with a clear unavailable state.
  - general Chat session with no Project binding.
- Project sessions must bind chat/session records to the active Project.
- Project switching must clear stale file handles, stale prompt context, and stale tool roots.
- Monorepo support must treat the opened working tree as the Git/repo boundary and allow active
  subproject scope to be selected or inferred later.
- If the requested work could apply to multiple subproject scopes, the agent must ask before running
  commands or editing files.

## Implementation Plan

1. Review existing project/session persistence and workbench state.
2. Add Project open/select API and UI behavior for backend-accessible paths.
3. Validate that the backend can list/read the Project root before enabling Project mode.
4. Discover and persist repository root/branch identity when available.
5. Bind new Project chat sessions to the Project id and mode.
6. Reset file context and tool roots when switching Projects.
7. Add unavailable-state UI for backend-inaccessible paths.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.2` | `agent-platform-project-workspaces.4` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
  - Focused tests: API/session/persistence tests for valid path, invalid path, Project metadata,
    repository root, branch identity, and Project/Chat separation.
  - Playwright: open a valid fixture Project and an invalid/inaccessible path; assert Project
    metadata appears only for the valid path and code-agent tools stay unavailable for the invalid
    path.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- API tests for creating/selecting Project records with valid and invalid backend paths.
- Repository-root/branch detection tests.
- Session tests proving Project chat sessions persist Project id and Chat sessions do not.
- UI tests for project unavailable state.
- Playwright flow: open a valid backend-accessible fixture repo and verify Project metadata is shown.
- Playwright flow: attempt to open an inaccessible path and verify code-agent tools stay unavailable.

## Definition Of Done

- [ ] Project sessions are explicitly bound to a backend-accessible working tree.
- [ ] Backend-inaccessible Projects do not enter full code-agent mode.
- [ ] Project metadata persists root, repo, branch/worktree, capability, onboarding, and default-agent
      state.
- [ ] Project switching clears stale file/chat/tool context.
- [ ] Monorepo ambiguity is represented so the agent can ask instead of guessing.
