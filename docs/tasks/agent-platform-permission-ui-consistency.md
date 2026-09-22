# Keep permission UI consistent with backend state

Beads: `agent-platform-permission-ui-consistency`. Priority: P1. Status: in progress; owner authorized both repairs on September 23, 2026.

## Requirements

The baseline permission journeys reproduced two independent presentation defects:

- Workspace Settings loads files and policy together. A file-listing error discards the successful
  settings response and leaves default Ask values visible, even when the backend has saved Block or
  Auto. Show the persisted policy independently of file-listing success; never present a fallback as
  the current authoritative value when loading fails.
- A high-risk shell write rejected by Block produces a denied audit and no file effect, but Tool
  activity still says Running after the chat settles. Show a terminal denial without relying on the
  model's final prose. Preserve the existing backend decision and no-execution guarantee.

## Implementation plan

The owner explicitly approved this repair boundary after reviewing both reproduced failures. Inspect WorkspaceDashboard's combined load and the
shell-policy denied path in toolDispatch. Make narrowly scoped UI/state-delivery corrections; do not
change policy precedence, permit Auto to bypass explicit approval, or add dashboards. Preserve both
failing Electron regressions from the baseline test branch and verify before/after evidence.

## Dependency order

Finding originates in `agent-platform-harness-baseline-p2`; the assessment remains in progress.
This is a linked follow-up, not a completion blocker on collecting further baseline evidence. No hard
Beads scheduling edge is required. The owner granted the separate repair decision on September 23. Coordinate with the proposed local status panel to avoid duplicate work.

## Tests and verification

```gherkin
Scenario: File-listing errors do not misstate saved permission policy
  Given I save Block in Workspace Settings
  And the workspace file listing fails
  When I reload Settings
  Then the displayed policy remains Block and matches the backend

Scenario: Blocked work has a terminal visible state
  Given Workspace writes is saved as Block
  When Project Chat requests a shell append
  Then the turn settles with a visible denial
  And no approval is offered and the file remains unchanged
  And the backend records denial rather than successful execution
```

Use real Electron/UI/managed API/SQLite/harness and SDK with declared external HTTP model and command
runner fixtures. Force the listing error using a disposable regular file as a directory parent.
Retain traces, settings reads, durable records and before/after file evidence. Run relevant unit,
type, lint, build and composed journeys, including Ask/Auto and existing approval/resume scenarios.

## Definition of done and sign-off

Both regressions pass with accurate UI state; backend enforcement and approval precedence are
unchanged. Required local and hosted quality gates pass, evidence is recorded, and the approved
feature-branch PR is integrated. No staging promotion is implied. Until the feature PR is integrated this remains in progress.
