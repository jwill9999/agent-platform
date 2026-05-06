# Task: Verify Project binding, safety gate, and Playwright E2E flows

**Beads issue:** `agent-platform-project-workspaces.6`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.6.md`

## Summary

Add automated and end-to-end verification for the Project/Chat split, Project workspace binding,
`AGENTS.md` safety gate, tool scoping, and wrong-root write prevention. Playwright should act as the
human tester by interacting with the interface and validating observable outputs.

## Requirements

- Add a deterministic Playwright fixture project with:
  - root `AGENTS.md`.
  - optional nested `AGENTS.md`.
  - simple files the agent can inspect.
  - a safe write target.
  - package/config files that resemble a real repo or monorepo.
- Add a fixture project without `AGENTS.md` for onboarding-gate tests.
- Playwright must interact through the UI rather than relying only on API calls.
- Playwright must inspect UI text, visible controls, chat outputs, and resulting filesystem state.
- E2E coverage must prove:
  - Project path defaults to coding agent.
  - Chat path defaults to personal assistant.
  - Chat path has no project/code tools by default.
  - Project opening requires backend-accessible working tree.
  - missing/unapproved `AGENTS.md` allows read-only inspection but blocks writes.
  - approved Project can write only inside the Project root.
  - `/workspace` does not resolve to an unrelated default container directory.
  - ambiguous monorepo scope produces a question instead of a guessed edit.
- Update user-facing and architecture docs with the Project/Chat and `/workspace` model.

## Implementation Plan

1. Add or update deterministic fixture worktrees for Playwright.
2. Add E2E helpers for opening Project mode, opening Chat mode, selecting fixture projects, sending
   messages, and reading resulting files.
3. Write Playwright tests that behave like a human: click, type, wait for visible output, inspect UI
   states, and verify filesystem outcomes.
4. Add integration/unit tests for any behavior that is too expensive or unstable in Playwright.
5. Update architecture and user-facing docs.
6. Ensure this epic cannot be signed off until `agent-platform-project-onboarding` exists and is
   linked as the follow-up for complete `AGENTS.md` lifecycle behavior.

## Dependency Order

| Upstream                              | Downstream |
| ------------------------------------- | ---------- |
| `agent-platform-project-workspaces.5` | none       |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e`
    against the Docker runtime.
  - Focused tests: fixture setup/cleanup plus regression tests for Project/Chat split, onboarding
    gate, wrong-root write prevention, approved writes, and monorepo ambiguity.
  - Playwright: perform all user-visible flows through the UI and assert visible outputs plus
    filesystem state.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- Root typecheck, lint, format check, and relevant unit/integration tests.
- Playwright E2E against a running Docker stack.
- Regression: a code-agent write request cannot land in default Docker `/workspace` when a Project is
  active.
- Regression: a missing/unapproved `AGENTS.md` Project can be inspected but not modified.
- Regression: Chat cannot accidentally use Project tools or Project context.

## Definition Of Done

- [ ] Playwright fixture projects exist for approved and unapproved onboarding states.
- [ ] Playwright covers Project opening, Chat opening, default agents, UI tool availability,
      onboarding gate behavior, approved write behavior, wrong-root write prevention, and monorepo
      ambiguity.
- [ ] Automated tests inspect both UI outputs and resulting filesystem state.
- [ ] Architecture/user docs explain Project, Chat, `/workspace`, onboarding gate, and Epic 2
      follow-up scope.
- [ ] Epic 1 can be end-to-end tested without relying on manual human verification.
