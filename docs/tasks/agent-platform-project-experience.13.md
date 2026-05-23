# Task: Ask for Project write approval from new Project Chat

**Beads issue:** `agent-platform-project-experience.13`  
**Spec file:** `docs/tasks/agent-platform-project-experience.13.md`

## Summary

Fix the first-run New Project flow where Project Chat can draft or describe a simple generated
project, but file writes are diverted into `AGENTS.md` onboarding instead of creating the requested
files.

## Problem

Observed flow:

1. User starts a new Project, names it, and chooses where the Project folder should be created.
2. The desktop app creates the folder in the requested location and opens Project Chat.
3. User asks the agent to create a simple Node project.
4. The agent starts Project instructions setup and produces a generic `AGENTS.md` draft because the
   empty Project has no evidence to inspect.
5. The original file creation request is not run until the user asks again, creating a confusing
   dead-end for new Projects.

This is an application write-gate issue, not an OS filesystem permission issue. New Project
registration makes the folder backend-accessible, so ordinary Project file creation should proceed
through normal tool approval. `AGENTS.md` setup should be explicit via `/init`, not an automatic
replacement for the user's first coding request.

## Requirements

- When a user asks Project Chat to create or modify files in a newly created Project, the app must
  attempt the requested file creation directly instead of auto-starting `AGENTS.md` setup.
- `/init` must remain the explicit way to draft and approve Project instructions.
- Normal tool approval can still be requested for write or terminal actions.
- The request must be able to write files inside the selected Project folder.
- Write approval must remain scoped to the selected Project root and must not grant writes outside
  that folder.
- The UI must use user-facing language and avoid backend/runtime path labels such as `/workspace` or
  host absolute paths in normal copy.
- `AGENTS.md` onboarding must not be created unless the user explicitly runs `/init`.

## Implementation Plan

1. Reproduce the blocked write path with a focused API or Electron test for a desktop-created Project
   whose onboarding state is not approved.
2. Remove `AGENTS.md` onboarding state from the write gate for backend-accessible Projects.
3. Keep `/init` behavior intact for explicit Project instructions setup.
4. Ensure generated files land in the selected folder without host path leaks.
5. Add regression coverage for new Project creation followed by “create a simple Node project.”

## Dependency Order

| Upstream                               | Downstream |
| -------------------------------------- | ---------- |
| `agent-platform-project-experience.12` | this task  |

## Tests And Verification

- API integration test proving first-write attempts create Project files without auto-starting
  `AGENTS.md` setup.
- Electron E2E proving:
  - Start from scratch creates the folder.
  - Asking for a simple Node project creates files in the selected folder.
  - The expected files are created in the selected folder.
  - No `/workspace` or host absolute path leaks in primary UI copy.
- Required repo gates for touched packages.

## Definition Of Done

- [ ] New Project first-write attempts never end in a non-actionable permission failure.
- [ ] Project Chat does not auto-create `AGENTS.md` for ordinary file creation requests.
- [ ] Approved writes land inside the selected Project folder.
- [ ] The flow is covered by automated regression tests.
- [ ] `/init` remains available for explicit Project instructions setup.
