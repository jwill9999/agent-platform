# Task: Project Onboarding UI Cleanup

**Beads issue:** `agent-platform-electron-onboarding.6`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.6.md`  
**Parent epic:** `agent-platform-electron-onboarding` — Desktop Project onboarding and `/init`

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-onboarding.6.md`

## Summary

Clean up Project onboarding UI states so users see one coherent Project open and setup flow without
internal runtime details.

## Requirements

- Keep a single user-facing Project open flow.
- Remove or hide legacy Open Folder/File System Access affordances from desktop onboarding.
- Replace internal states such as backend, hashes, in-progress enums, or `/workspace` paths with
  user-relevant copy.
- Surface setup actions through chat or clear CTAs, not raw internal status output.
- Keep typography and layout consistent with the current IDE/chat shell.

## Implementation Plan

1. Inventory current Project/open/onboarding UI states.
2. Remove duplicated folder-opening affordances for desktop.
3. Rewrite copy around Project name, selected folder, setup needed, review, and approval.
4. Add focused component tests and browser/Electron coverage where needed.

## Tests And Verification

- Component tests for onboarding states.
- Browser or Electron coverage for visible Project open/setup flow.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Definition Of Done

- [ ] Users see one coherent Project open path in desktop.
- [ ] UI does not expose implementation details by default.
- [ ] Setup state copy is action-oriented and user-facing.
- [ ] Layout remains readable at supported desktop widths.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
