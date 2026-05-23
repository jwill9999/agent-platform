# Task: Fix Project Chat init approval continuity

**Beads issue:** `agent-platform-electron-stabilisation.13`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.13.md`

## Summary

Fix the manual QA blocker where Project Chat becomes unusable after `/init` approval and make the
instruction-file review flow usable from Project Chat without relying on the integrated IDE.

## Manual QA Failure

After opening a Project, running `/init`, approving the generated instructions, and asking a
follow-up question, the assistant can fail with:

```text
Invalid parameter: messages with role 'tool' must be a response to a preceding message with
'tool_calls'.
```

The current flow also pushes too much onboarding state into the IDE/file-tree area. For this task,
the critical fix is chat continuity: the user must be able to review the draft from Project Chat,
approve it there, and immediately continue chatting.

## Requirements

- `/init` starts from Project Chat.
- The proposed `AGENTS.md` content is visible for review in the main Project Chat surface.
- Approval from Project Chat writes `AGENTS.md`.
- Rejecting the draft from Project Chat clears the pending approval state and leaves no stale draft
  available to approve.
- Re-running `/init` refreshes the draft from current Project evidence instead of reusing stale
  commands or outdated metadata.
- The next Project Chat message after approval succeeds.
- Persisted chat history sent to the model must not contain orphan `tool` role messages.
- The integrated IDE may reflect the resulting file, but it is not required for review/approval.

## Implementation Plan

1. Trace the current `/init` approval message flow and identify where orphan tool messages enter the
   model request.
2. Add a failing regression test for `/init -> approve -> follow-up chat`.
3. Fix the message-history serialization or approval recording at the root cause.
4. Ensure Project Chat renders the generated `AGENTS.md` draft content in the approval/review card.
5. Add a reject action for the review card so users can discard an unsuitable draft.
6. Refresh onboarding drafts on each `/init` run so changed Project evidence produces a new review
   version.
7. Add or update focused UI/E2E coverage if the visible review card behavior is missing.

## Tests And Verification

- Focused API/chat regression for `/init -> approve -> follow-up chat`.
- Focused web/component test for Project Chat draft review rendering if changed.
- Electron E2E should cover the full Project Chat `/init -> approve -> follow-up` path before final
  closeout.
- `pnpm docs:lint`
- `git diff --check`

## Definition Of Done

- Manual QA can run `/init`, approve the draft in Project Chat, then ask
  `did you create the AGENTS.md file?` without a tool-message error.
- The draft file can be read before approval without opening the integrated IDE.
- `AGENTS.md` is written only after approval.
- Rejected drafts are not written and are not left available for accidental approval.
- A repeated `/init` produces a refreshed draft with the currently detected project commands.
- Regression coverage fails on the previous bug and passes with the fix.
- No feature-branch push occurs until owner review of the local change is requested.
