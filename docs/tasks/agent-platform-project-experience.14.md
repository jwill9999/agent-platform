# Task: Re-baseline Project Experience epic

**Beads issue:** `agent-platform-project-experience.14`  
**Spec file:** `docs/tasks/agent-platform-project-experience.14.md`  
**Parent epic:** `agent-platform-project-experience` — Project experience and navigation

## Summary

Review and refine the Project Experience epic after Electron stabilisation. The goal is to keep the
epic relevant to the current chat-first desktop product, preserve work that already landed during
stabilisation, and narrow remaining tasks before implementation resumes.

## Requirements

- Treat `staging` as the baseline after the Electron stabilisation merge.
- Keep Project Chat as the primary Project surface.
- Keep coding as one Project profile/capability, not the definition of Project.
- Preserve completed scope from stabilisation: Project Chat default, branch selector, terminal dock,
  duplicate Project disambiguation/session restore, New Project creation, and new Project write
  approval.
- Refine the remaining tasks so they are still actionable:
  - `.1` Project profiles/capabilities,
  - `.2` workspace/sidebar navigation audit and completion,
  - `.4` external IDE handoff polish and verification,
  - `.5` labels/location-context polish,
  - `.6` staged Project Experience E2E gate,
  - `.7` generated output previews,
  - `.8` Project activity/evidence panel.
- Keep production macOS signing/notarization evidence under
  `agent-platform-macos-production-sandbox.6.3`, outside this epic.
- Decide how `agent-platform-electron-stabilisation.20` relates to `.6`.

## Implementation Plan

1. Review the current epic and child task specs.
2. Update the epic status, task chain, and Definition of Done.
3. Rewrite remaining open child task specs around the current staging baseline.
4. Update Beads titles/descriptions where the remaining task scope changed.
5. Run documentation checks and publish the plan for owner review.

## Tests And Verification

- `pnpm docs:lint`
- `git diff --check`
- Beads shows this task as closed once the re-baseline is recorded.

## Definition Of Done

- Project Experience has a current task plan the owner can approve.
- Completed work is not duplicated in future tasks.
- Remaining tasks are ordered and scoped for implementation.
- The next implementation task is clearly `agent-platform-project-experience.1`.
