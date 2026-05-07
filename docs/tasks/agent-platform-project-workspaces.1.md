# Task: Define Project mode, capability, and onboarding state model

**Beads issue:** `agent-platform-project-workspaces.1`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.1.md`

## Summary

Define the shared model for Project mode, Chat mode, project working trees, capability states,
onboarding states, and instruction-file scope. Follow-on tasks must be able to depend on explicit
semantics instead of guessing what a "workspace" means.

## Requirements

- Define distinct user modes:
  - `project`: code/project interface, default coding agent, project-scoped tools.
  - `chat`: general chat interface, default personal assistant, no project/code tools by default.
- Define a Project as a backend-accessible working tree, not merely a browser-selected folder.
- Capture Project identity, display name, project root, repository root, active branch/worktree
  identity, optional active subproject scope, capability state, onboarding state, and default agent.
- Define capability states for Epic 1:
  - `backend_accessible`: backend can inspect and run commands in the working tree.
  - `readonly`: backend can inspect but writes/destructive commands are blocked.
  - `unavailable`: backend cannot access the requested working tree.
- Define onboarding states:
  - `missing`: root `AGENTS.md` was not found.
  - `in_progress`: onboarding started or needs human/agent review.
  - `approved`: code writes are allowed subject to capability policy.
  - `needs_review`: file exists but metadata approval is absent or stale.
- Define instruction precedence: root `AGENTS.md` applies repo-wide; nearest nested `AGENTS.md`
  refines root guidance for subproject scope.
- Define `/workspace` as the canonical agent-facing path for the active Project root.
- Define the distinction between Project working tree and general chat workspace.

## Implementation Plan

1. Review existing session, project, workspace, agent, and workbench contracts to avoid duplicate
   concepts.
2. Add or refine shared types/contracts for mode, Project metadata, capability state, onboarding
   state, and instruction-file references.
3. Add pure helper functions for deriving tool/write eligibility from capability plus onboarding
   state.
4. Document the terminology in architecture or task docs so future tasks do not reintroduce
   ambiguous "workspace" behavior.
5. Add focused unit tests for the helper functions and type guards.

## Dependency Order

| Upstream | Downstream                            |
| -------- | ------------------------------------- |
| none     | `agent-platform-project-workspaces.2` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
  - Focused tests: unit/contract tests for mode, Project metadata, capability, onboarding, and
    write-eligibility helpers.
  - Playwright: not required unless this task introduces user-visible mode/status UI; if it does,
    verify the rendered labels and unavailable states through the browser.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- Unit tests for mode/capability/onboarding helper behavior.
- Typecheck across touched packages.
- Contract tests if shared API schemas are changed.
- Spec review confirms Project working tree, Project root, repository root, subproject scope, and
  general chat workspace are not conflated.

## Definition Of Done

- [x] Project and Chat modes are named, typed, and documented.
- [x] Project metadata can represent a backend-accessible monorepo or single-app repo.
- [x] Capability and onboarding states are named and testable.
- [x] The write gate is expressible as code: writes require an eligible capability and approved
      onboarding state.
- [x] Instruction-file precedence is defined for root and nested `AGENTS.md`.
- [x] Follow-on tasks can depend on the model without guessing semantics.
