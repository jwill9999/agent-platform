# Task: Clean onboarding entry and user-facing state

**Beads issue:** `agent-platform-project-onboarding.7`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.7.md`

## Summary

Fix the manual-test UX issues found after the onboarding task chain: users should see one normal
folder/project opening path, and Project onboarding should present user-actionable copy rather than
internal runtime or assessment state.

## Requirements

- Remove the competing normal-user paths for opening a folder/project from the IDE explorer.
- Keep one primary user-facing open action in the Project area.
- Do not expose internal state labels such as `in_progress`, `needs_review`, backend capability, raw
  assessment state, hashes, backend roots, or repository roots in normal UI.
- Present onboarding needs as user-actionable CTA/chat-style copy:
  - explain that Project setup needs review before file edits are enabled.
  - ask for missing information through the onboarding draft flow.
  - show approved state as "Project ready" or equivalent plain language.
- Preserve the backend Project binding required for current onboarding validation.
- Keep any typed/manual path affordance out of the primary UI, or make it clearly secondary.
- Technical state remains available to agents, API metadata, logs, and observability, not primary user
  copy.

## Implementation Plan

1. Update the IDE Project binding panel to make the Project open control the single visible primary
   open action.
2. Remove or demote the standalone browser file picker CTA when Project onboarding is active.
3. Replace technical onboarding panel copy with user-actionable setup/review/ready language.
4. Keep detailed assessment evidence out of the normal first-level UI unless it is needed for the
   onboarding question/draft flow.
5. Update Playwright assertions for the revised entry and copy.

## Dependency Order

| Upstream                              | Downstream |
| ------------------------------------- | ---------- |
| `agent-platform-project-onboarding.6` | none       |

## Tests And Verification

- Focused Playwright for Project onboarding entry and setup copy.
- Relevant component/unit tests for any extracted UI copy helpers.
- Local gates: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and focused/full
  Playwright where the runtime is available.
- PR checks and review comments must be green before closing the Bead.

## Definition Of Done

- [x] Normal UI exposes one primary Project/folder open action in the IDE explorer.
- [x] Internal onboarding/backend states are not shown as primary user-facing copy.
- [x] Missing/insufficient onboarding is presented through clear setup review CTA/chat-style copy.
- [x] Approved onboarding is presented as plain Project-ready language.
- [x] Existing onboarding API behavior and write gating remain intact.
- [x] Playwright covers the revised entry and copy.
