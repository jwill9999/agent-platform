# Task: Triage manual QA findings into Beads

**Beads issue:** `agent-platform-electron-stabilisation.3`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.3.md`

## Summary

Review owner manual QA findings and classify each one into tracked Beads work or an explicit
deferred limitation.

The manual QA session changed the stabilisation direction. Project work should be chat-first:
opening a Project should land in Project Chat with Project context, slash commands, and activity
visibility. The built-in IDE should not be the primary Project destination during stabilisation.

## Requirements

- Review each manual QA finding with reproduction steps.
- Classify each finding as one of:
  - already covered by an existing Beads task/spec,
  - merge-blocking regression,
  - new follow-up task,
  - acceptable known limitation,
  - product/design decision.
- Create or update Beads tasks for missing work.
- Update relevant specs/definitions of done where gaps caused false passes.
- Do not close this task while any finding is unclassified.

## Implementation Plan

1. Collect the manual QA findings from the owner.
2. Build a triage table in the relevant docs or task spec.
3. Inspect existing Beads tasks/specs for matching coverage.
4. Create missing Beads tasks where needed.
5. Mark merge blockers clearly.

## Product Direction Captured During QA

- The primary Project flow is **Home / Workspaces -> Open Project -> Project Chat**.
- Project Chat is the main working surface for existing local Projects.
- Personal Chat remains available for non-Project conversations.
- The same slash command system should work in Project Chat, including `/help` and `/init`.
- The right-side panel should show user-facing Project activity: changed files, tests, CI, review
  comments, and agent progress.
- Manual file editing should be explicit. The user should be able to choose an external/default IDE
  when they want direct editing.
- The built-in IDE should be removed from primary navigation or treated as optional/experimental
  until there is a clear local IDE integration.
- Agent-created Projects should use managed app storage internally, but the UI should show friendly
  Project names and generated files/previews rather than implementation paths.
- Chat interfaces should support rendered previews, such as landing pages, Markdown documents, PDFs,
  and HTML output, directly in the side or activity view instead of requiring users to navigate the
  file system to inspect generated output.

## Manual QA Triage

| ID     | Finding                                                                 | Severity | Classification | Beads issue                                      |
| ------ | ----------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------ |
| QA-001 | Stale unavailable test Projects appear in global Recent Projects.       | blocker  | merge blocker  | `agent-platform-electron-stabilisation.9`        |
| QA-002 | IDE Project panel duplicates Recent Projects and shows backend copy.    | high     | merge blocker  | `agent-platform-electron-stabilisation.9`, `.10` |
| QA-003 | Settings has no clear return/breadcrumb to the previous workspace.      | medium   | follow-up      | `agent-platform-electron-stabilisation.6`        |
| QA-004 | Native Open Project does not bind the selected folder as a Project.     | blocker  | merge blocker  | `agent-platform-electron-stabilisation.7`        |
| QA-005 | IDE assistant input accepts text but does not submit after bad binding. | blocker  | merge blocker  | `agent-platform-electron-stabilisation.8`        |
| QA-006 | Slash command help input accepts text but does not submit.              | blocker  | merge blocker  | `agent-platform-electron-stabilisation.8`        |
| QA-007 | `/init` input accepts text but does not submit.                         | blocker  | merge blocker  | `agent-platform-electron-stabilisation.8`        |
| QA-008 | No visible return navigation from IDE to Project Chat.                  | high     | product gap    | `agent-platform-electron-stabilisation.6`        |
| QA-009 | Recent Projects cannot be reopened reliably.                            | blocker  | merge blocker  | `agent-platform-electron-stabilisation.9`        |
| QA-010 | Workspace chooser/Open Chat/Open Project flow is unclear and broken.    | high     | product gap    | `agent-platform-electron-stabilisation.6`        |
| QA-011 | Chat navigation shows inconsistent pages and can trap the user.         | high     | product gap    | `agent-platform-electron-stabilisation.6`        |
| QA-012 | Project Chat should be primary; IDE should be de-prioritised.           | high     | decision       | `agent-platform-electron-stabilisation.6`, `.11` |
| QA-013 | Agent-created Projects need generated file and preview visibility.      | medium   | follow-up      | `agent-platform-electron-stabilisation.11`       |
| QA-014 | Chat surfaces need rendered previews for HTML/Markdown/PDF artifacts.   | medium   | follow-up      | `agent-platform-electron-stabilisation.11`       |

## Follow-Up Task Groups

- `agent-platform-electron-stabilisation.6`: navigation and chat-first Project UX.
- `agent-platform-electron-stabilisation.7`: native folder picker to Project registration.
- `agent-platform-electron-stabilisation.8`: Project Chat submission and slash command execution.
- `agent-platform-electron-stabilisation.9`: Recent Projects cleanup, dedupe, availability, and reopen.
- `agent-platform-electron-stabilisation.10`: user-facing copy and diagnostics cleanup.
- `agent-platform-electron-stabilisation.11`: external IDE handoff and generated Project side-panel
  design.
- `agent-platform-electron-stabilisation.12`: stabilisation closeout and next-epic gate.

## Parallel Worktree Plan

After this triage task closes, the follow-up work can be split across worktrees where the write sets
are independent:

- Path A, sequential: `.6` -> `.7` -> `.8`. Navigation defines the target route model, folder
  binding implements Project activation, and message/slash command submission depends on a valid
  Project context.
- Path B, parallel after `.6`: `.9`. Recent Projects can be fixed once the destination route is
  clear, and it should avoid touching the message pipeline where possible.
- Path C, parallel after `.3`: `.10`. Copy and diagnostics cleanup can proceed independently if it
  stays focused on labels/error text.
- Path D, parallel after `.3`: `.11`. IDE handoff, generated Project previews, and side-panel design
  can be specified without blocking the core Project-open fixes.
- Path E, parallel after `.4`: `.5`. Regression coverage planning can run alongside implementation,
  then feed test requirements back into the implementation tasks before they close.
- Final gate: `.12` depends on the fix/design paths and blocks follow-on Project Experience work.

## Dependencies

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-stabilisation.2`  | `agent-platform-electron-stabilisation.4`  |
| `agent-platform-electron-stabilisation.3`  | `agent-platform-electron-stabilisation.6`  |
| `agent-platform-electron-stabilisation.6`  | `agent-platform-electron-stabilisation.7`  |
| `agent-platform-electron-stabilisation.7`  | `agent-platform-electron-stabilisation.8`  |
| `agent-platform-electron-stabilisation.6`  | `agent-platform-electron-stabilisation.9`  |
| `agent-platform-electron-stabilisation.3`  | `agent-platform-electron-stabilisation.10` |
| `agent-platform-electron-stabilisation.3`  | `agent-platform-electron-stabilisation.11` |
| `agent-platform-electron-stabilisation.5`  | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.8`  | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.9`  | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.10` | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.11` | `agent-platform-electron-stabilisation.12` |

## Tests And Verification

- `bd show <issue-id>` for every created/updated task.
- `pnpm docs:lint` if documentation/spec files change.
- `git diff --check` if files change.

## Definition Of Done

- Every known manual QA finding has a classification.
- Merge blockers have Beads tasks.
- Deferred items are explicitly documented.
- Existing task/spec coverage is confirmed where applicable.
- Beads dependency/order state matches the triage decision.
