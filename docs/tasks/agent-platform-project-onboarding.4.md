# Task: Add `AGENTS.md` review, approval, and auto-approval flows

**Beads issue:** `agent-platform-project-onboarding.4`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.4.md`

## Summary

Let users review and approve initial Project instructions, and let the system auto-approve existing
instructions only when assessment concludes they are sufficient and consistent.

## Requirements

- If assessment recommends approval for existing `AGENTS.md`, the UI must show the summary/evidence
  and mark onboarding approved without requiring extra human work.
- If onboarding produced a draft, the user must be able to review it before approval.
- Draft approval should write or finalize root `AGENTS.md` in the Project working tree.
- Reject/request-changes must keep onboarding in progress and preserve user feedback.
- Approved onboarding must unlock normal code-agent write behavior from Epic 1.
- Approval metadata must include Project id, instruction file path, content hash or version,
  approver/source, and timestamp.
- The review flow must make it clear that initial instructions are required before code writes.

## Implementation Plan

1. Add review/approval UI for existing assessment approvals and drafted instructions.
2. Add approval API/use case that records approval metadata and transitions onboarding to approved.
3. Add draft finalization that writes root `AGENTS.md` when the approved draft did not already exist.
4. Add reject/request-changes path that appends feedback to onboarding dialogue.
5. Ensure tool gating observes approved state immediately after approval.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-onboarding.3` | `agent-platform-project-onboarding.5` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`, and relevant
    integration/E2E gates for approval unlock behavior.
  - Focused tests: approve, reject, request-changes, approval metadata, draft finalization, and tool
    gating immediately after approval.
  - Playwright: review a draft, reject/request changes, approve a revised draft, verify
    `AGENTS.md` is finalized, then verify a code write is allowed and lands in the Project root.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- API/use-case tests for approve, reject, request changes, and approval metadata.
- File-write tests for finalizing draft root `AGENTS.md`.
- UI tests for review/approve/reject states.
- Integration test proving approved onboarding unlocks write tools.
- Playwright flow: user reviews draft, approves it, then asks coding agent to create a file.

## Definition Of Done

- [ ] Existing sufficient `AGENTS.md` can auto-approve with visible evidence.
- [ ] Drafted `AGENTS.md` requires user review/approval before writes unlock.
- [ ] Approval metadata is persisted.
- [ ] Reject/request-changes keeps onboarding in progress.
- [ ] Approved onboarding unlocks normal Project code-agent writes and keeps all Epic 1 tool scoping.
