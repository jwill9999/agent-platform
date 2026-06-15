# Fix Personal Chat send failure

## Problem

Opening the standalone Chat workspace can retain Project/Coding workspace state. In that state the
left sidebar can still mark Workspaces as active after programmatic navigation, and the chat composer
can show the Coding agent instead of the Personal assistant before sending a message.

Manual desktop QA also showed local `make electron-local` runs could start against an unseeded
desktop runtime database. In that state the Personal assistant profile is missing, so new personal
chat sessions are created with the only available agent even though the user entered Chat, not a
Project.

## Scope

- Keep Personal Chat navigation and sidebar state in sync when entering Chat from the workspace
  landing card.
- Default Personal Chat to the seeded Personal assistant unless the user deliberately changes the
  agent selector.
- Seed the managed desktop/API runtime database on startup so the Personal assistant and Coding
  profiles exist outside E2E.
- Repair existing personal chat sessions that were created before the Personal assistant profile was
  available.
- Add focused regression coverage for the Chat workspace active nav and default agent state.

## Acceptance

- Entering Chat from the workspace card marks the Chat item active in the left sidebar.
- Personal Chat defaults to Personal assistant, not Coding, when no session is being resumed.
- Existing Personal Chat sessions with the wrong backend agent are normalized back to the Personal
  assistant profile.
- Local managed desktop startup runs the idempotent seed before serving API traffic.
- Project Chat still defaults to Coding.
- Focused tests cover the regression without hard-coding a provider/model selection.
