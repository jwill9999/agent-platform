# Task: Electron E2E For Project Onboarding

**Beads issue:** `agent-platform-electron-onboarding.7`  
**Spec file:** `docs/tasks/agent-platform-electron-onboarding.7.md`  
**Parent epic:** `agent-platform-electron-onboarding` — Desktop Project onboarding and `/init`

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-onboarding.7.md`

## Summary

Add production-like Electron E2E coverage for opening a Project, running `/help`, running `/init`,
reviewing the generated setup, approving it, and verifying writes land in the selected Project root.

## Requirements

- Run against the built Electron desktop runtime where possible.
- Use the native Project open path or a deterministic test bridge equivalent.
- Verify `/help` and `/init` in the active Project session.
- Verify review and approval before write access is enabled.
- Verify resulting `AGENTS.md` is written only inside the selected Project root.

## Implementation Plan

1. Extend the Electron E2E fixture for Project onboarding.
2. Add a deterministic temporary Project root for the test.
3. Drive the UI from Open Project through `/help`, `/init`, review, and approval.
4. Assert filesystem result and user-facing state.
5. Keep artifacts bounded and debuggable for CI.

## Tests And Verification

- Electron E2E for the full onboarding path.
- Relevant API/unit tests remain green.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Electron E2E command used by CI.

## Definition Of Done

- [x] Built-runtime Electron E2E covers Project open to `/init` approval.
- [x] Test verifies write output inside selected Project root.
- [x] Test verifies missing or duplicate legacy open paths do not drive onboarding.
- [x] CI includes the onboarding E2E coverage.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
