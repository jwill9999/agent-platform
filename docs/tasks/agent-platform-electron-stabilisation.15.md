# Task: Format slash command help output

**Beads issue:** `agent-platform-electron-stabilisation.15`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.15.md`  
**Parent epic:** `agent-platform-electron-stabilisation` - Electron stabilisation and manual QA triage

The Beads issue **description** must begin with:
`Spec: docs/tasks/agent-platform-electron-stabilisation.15.md`

## Summary

Fix the manual QA finding where `/help` output streams slash commands into a single line. Slash
command help should render as structured, readable UI that can scale as more commands are added.

## Manual QA Finding

- **Finding:** `/help` currently streams command descriptions into one line.
- **Severity:** medium.
- **Classification:** stabilisation UX follow-up.
- **Expected:** Slash commands appear as a readable list or table, with each command separated from
  its description and any arguments or side effects explained in user-facing language.

## Requirements

- Render `/help` as structured command help, not a single run-on paragraph.
- Use a format that scales beyond one command:
  - command name,
  - short description,
  - optional usage,
  - whether the command changes Project state.
- Render `/help init` as focused help for the `/init` command.
- Keep the command registry/interface presentation-agnostic so the same metadata can be reused by a
  future CLI or API.
- Preserve streaming safety: partial output must not collapse the final help into one line.
- Avoid internal implementation details in normal help copy.

## Implementation Plan

1. Review the slash command registry metadata and chat rendering path.
2. Add or extend command metadata so help output can be rendered as structured data.
3. Update `/help` to return a structured help payload or markdown format with stable line breaks.
4. Update the chat renderer to display slash command help as a list/table/card.
5. Add regression tests for `/help` and `/help init` as first Project messages.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused tests for slash-command metadata and help formatting.
- Playwright/Electron: send `/help`, verify commands are displayed as separate rows/items; send
  `/help init`, verify focused usage copy renders cleanly.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] `/help` renders available slash commands as separate readable entries.
- [ ] `/help init` renders focused `/init` usage and state-change guidance.
- [ ] Help metadata is reusable outside the current chat renderer.
- [ ] Help output does not leak implementation details.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
