# Fix Personal Chat send failure

## Problem

Opening the standalone Chat workspace can retain Project/Coding workspace state. In that state the
left sidebar can still mark Workspaces as active after programmatic navigation, and the chat composer
can show the Coding agent instead of the Personal assistant before sending a message.

## Scope

- Keep Personal Chat navigation and sidebar state in sync when entering Chat from the workspace
  landing card.
- Default Personal Chat to the seeded Personal assistant unless the user deliberately changes the
  agent selector.
- Add focused regression coverage for the Chat workspace active nav and default agent state.

## Acceptance

- Entering Chat from the workspace card marks the Chat item active in the left sidebar.
- Personal Chat defaults to Personal assistant, not Coding, when no session is being resumed.
- Project Chat still defaults to Coding.
- Focused tests cover the regression.
