# Task: Define E2E workflow expectation matrix

**Beads issue:** `agent-platform-electron-stabilisation.20`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.20.md`

## Summary

Define a durable E2E expectation matrix for each desktop workspace/workflow surface. Coding/Project
Chat remains the primary desktop use case and should keep the deepest automated coverage. Generalized
chat and future user-case workflows should gain E2E coverage as their epics mature.

## Requirements

- Identify each current desktop workspace/workflow surface:
  - Workspaces/home.
  - Project Chat/Coding workflow.
  - Personal Chat/general assistant workflow.
  - Secondary/legacy file view where still reachable.
- Define different expectations for each surface rather than applying Coding workflow assumptions to
  every mode.
- Preserve the current priority: Coding/Project Chat is the primary desktop workflow and should be
  the most heavily tested.
- Mark generalized chat and future user-case workflows as expansion points for later epics, not
  blockers for the current stabilisation closeout.
- For each surface, define expected:
  - visible controls;
  - hidden or unavailable panels;
  - session and context scope;
  - layout/responsiveness guarantees;
  - forbidden context leakage;
  - current E2E coverage;
  - next E2E coverage gaps.

## Initial Matrix Shape

| Surface or workflow             | Current priority | Expected E2E posture                                                                                                                                                            |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspaces/home                 | High             | First-load layout, navigation, Settings, Open Project, Recent Projects, and no internal path/state leakage.                                                                     |
| Project Chat/Coding             | Highest          | Deepest coverage: Project binding, slash commands, attachments, Git/branch state, terminal/VM path, session scope, Recent Projects, restart persistence, and responsive layout. |
| Personal Chat/general assistant | Medium           | Separation coverage now; expand later for generalized chat UX, model selection, non-Project history, attachments, and workflow-specific panels.                                 |
| Secondary/legacy file view      | Low              | Keep safety/regression coverage only while reachable; do not expand as a primary workflow unless product direction changes.                                                     |
| Future specialized workflows    | Deferred         | Add E2E expectations inside their owning epics once the workflow is designed and user outcomes are stable.                                                                      |

## Implementation Plan

1. Audit current Electron E2E coverage against the matrix.
2. Convert the matrix into either a QA doc or test-plan section linked from
   `docs/qa/electron-stabilisation-automation-matrix.md`.
3. Add missing Coding/Project Chat assertions first where gaps remain.
4. Add Personal Chat/generalized workflow E2E only as those epics become active.
5. Keep future workflow expectations owned by their feature epics so tests match real user outcomes.

## Tests And Verification

- Documentation/spec review.
- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`

## Definition Of Done

- The expectation matrix exists and is linked from the automation/manual QA documentation.
- Coding/Project Chat is explicitly identified as the deepest E2E coverage priority.
- Non-coding/generalized workflows have clear future expansion expectations without blocking current
  stabilisation closeout.
