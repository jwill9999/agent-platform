# Task: Add active project workspace binding

**Beads id:** `agent-platform-active-project`  
**Priority:** P2

## Summary

Define and implement an active project binding inside the managed `/workspace` so coding tools can operate on the current application without the user manually providing container paths.

## Problem

The coding tools now work correctly when a project exists inside the agent runtime workspace, but manual testing still requires prompts such as `/workspace/scratch/demo-app`. That is acceptable for validation, but not for the product workflow.

Users should be able to ask for repository maps, code search, git diffs, related tests, and quality gates in natural language. The platform should resolve those requests to the active project path automatically.

## Requirements

- Define the project storage convention under `/workspace`.
- Provide a way to select, restore, or infer the active project for a session.
- Persist the active project binding in platform state where appropriate.
- Make coding tools default to the active project for `repoPath` / project-level operations.
- Keep explicit path overrides available for advanced cases.
- Preserve PathJail and workspace boundary enforcement.
- Avoid requiring users to type `/workspace/...` paths for normal project work.

## Proposed Direction

- Use `/workspace/projects/<project-name>` or an equivalent managed area for real application repositories.
- Track active project metadata separately from transient folders:
  - `uploads`: user-provided files
  - `generated`: generated outputs
  - `scratch`: temporary experiments and disposable apps
  - `exports`: packaged downloadable artifacts
  - `projects`: durable application repositories or mounted projects
- Expose the active project to chat/session context so tools can default safely.

## Tests And Verification

- Unit coverage for active project resolution and workspace-bound path validation.
- API or integration coverage proving coding tools default to the active project when `repoPath` is omitted.
- UI/manual verification that a user can select or restore a project and then ask natural-language coding-tool requests without specifying a path.

## Definition Of Done

- Active project path is explicit, persisted or restorable, and workspace-bounded.
- Coding tools use the active project by default where appropriate.
- User prompts no longer need container paths for normal coding workflows.
- Documentation explains workspace folders and project defaults.
