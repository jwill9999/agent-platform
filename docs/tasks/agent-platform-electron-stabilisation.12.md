# Task: Stabilisation closeout and next-epic gate

**Beads issue:** `agent-platform-electron-stabilisation.12`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.12.md`

## Summary

Close the Electron stabilisation effort by confirming the chat-first Project flow, rerunning the
manual QA checklist, checking automated regression coverage, and deciding whether follow-on Project
Experience or release work can start.

## Requirements

- Confirm blocker tasks for Project Chat, Project binding, slash commands, Recent Projects, and
  user-facing copy are complete or explicitly parked with owner approval.
- Confirm generated preview and external/default IDE handoff design is documented.
- Rerun the Electron manual QA checklist against the stabilisation branch.
- Confirm automated Electron/browser E2E coverage exists or has explicit follow-up tasks.
- Record the final merge/release recommendation.

## Implementation Plan

1. Review stabilisation tasks `.3` through `.11`.
2. Confirm each manual QA finding is fixed, deferred, or accepted by the owner.
3. Rerun manual QA or capture owner manual QA sign-off.
4. Review CI/CD and required local gates.
5. Record whether the staging branch can merge, remain parked, or continue fix-forward work.

## Tests And Verification

- Manual QA checklist rerun or owner sign-off.
- Required local and CI gates from the completed fix tasks.
- `bd list --parent agent-platform-electron-stabilisation` shows all stabilisation work resolved or
  explicitly deferred.

## Definition Of Done

- Stabilisation blockers are resolved, deferred with owner approval, or converted into later epics.
- Chat-first Project flow is accepted as the basis for next work.
- Project Experience follow-up work is unblocked only after this closeout gate is satisfied.
- Merge/release recommendation is documented.
