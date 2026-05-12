# Task: Native Project `AGENTS.md` Lifecycle

**Beads issue:** `agent-platform-electron-onboarding.4`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.4.md`  
**Parent epic:** `agent-platform-electron-onboarding` — Desktop Project onboarding and `/init`

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-onboarding.4.md`

## Summary

Run the `AGENTS.md` draft, review, approval, and write lifecycle against the selected native Project
root.

## Requirements

- Detect existing `AGENTS.md` in the selected Project root.
- Draft a complete first `AGENTS.md` when none exists.
- On later runs, propose updates instead of blindly replacing existing instructions.
- Require human review and approval before writing or updating files.
- Write only inside the selected Project root through the governed command/file boundary.

## Implementation Plan

1. Reconnect onboarding assessment to the active Project root.
2. Implement create-versus-update decision logic.
3. Persist draft/review state in Project/session metadata.
4. Use existing approval and write controls for the final write.
5. Add tests for create, update, approval, rejection, and outside-root denial.

## Tests And Verification

- Unit/API tests for missing and existing `AGENTS.md`.
- Integration tests for draft review and approval.
- Regression test proving approved writes land only under selected Project root.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Definition Of Done

- [x] First run drafts a complete `AGENTS.md`.
- [x] Later runs propose updates rather than destructive replacement.
- [x] User review is required before writes are enabled.
- [x] Approved writes stay inside selected Project root.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
