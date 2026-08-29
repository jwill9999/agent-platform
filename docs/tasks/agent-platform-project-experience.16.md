# Task: Add multi-tab Project resource previews

**Beads issue:** `agent-platform-project-experience.16`
**Spec file:** `docs/tasks/agent-platform-project-experience.16.md`
**Parent epic:** `agent-platform-project-experience` — Project experience and navigation

The Beads issue **description** must begin with:
`Spec: docs/tasks/agent-platform-project-experience.16.md`

## Summary

Extend the shared Project resource viewer from task `.7` into a small multi-document preview
workspace. Users can keep several generated resources, source files, and diffs open as tabs, switch
between them, close them individually, minimize the viewer to a docked right-side affordance, and
restore the same tab set without losing Project Chat context.

This task covers viewer navigation and lifecycle only. Resource rendering remains owned by task
`.7`, and downloading or saving resources is owned by task `.15`.

## Requirements

- Opening a resource adds or activates one tab in the shared viewer instead of replacing the
  currently open resource.
- Reopening an already-open resource activates its existing tab rather than creating a duplicate.
- Every tab has an explicit close icon with an accessible name. Closing the active tab selects a
  predictable adjacent tab; closing the last tab closes the viewer.
- Clicking a tab activates it without changing the Project, session, branch, or conversation.
- The active tab is visually distinct, keyboard-focusable, and exposed with correct tab semantics,
  including `tablist`, `tab`, `tabpanel`, selection state, and focus relationships.
- Keyboard behavior supports moving between tabs, activating a focused tab, closing the active tab
  with an explicit shortcut where platform conventions permit, and returning focus safely when the
  viewer closes.
- The viewer can be minimized to a compact docked affordance on the right side. The affordance shows
  that previews remain open, is keyboard accessible, and restores the preserved tab set and active
  tab.
- The minimized affordance and expanded viewer do not cover critical Project Chat controls. On
  narrow screens, use a sensible full-width drawer/sheet or equivalent fallback with reachable
  close, minimize, and tab navigation controls.
- Open tabs use normalized Project resource identities and user-facing labels; raw host paths and
  internal roots remain hidden.
- Tab state is scoped to the active Project/session. Reopening the same persisted session restores
  the available tab set and active resource where practical; switching Project/session must not
  leak another context's tabs.
- Missing, deleted, renamed, or no-longer-readable resources restore to a safe unavailable state
  that can be closed without breaking the remaining tabs.
- The tab state and actions are reusable by the task `.8` activity/evidence panel.

## Dependency Order

| Upstream                              | Downstream                             |
| ------------------------------------- | -------------------------------------- |
| `agent-platform-project-experience.7` | `agent-platform-project-experience.16` |

Task `.16` extends the single-resource viewer delivered by `.7`. It is independent of the task
`.15` download/export implementation.

## Implementation Plan

1. Define project/session-scoped tab state with normalized resource identity, display metadata,
   active-tab selection, and deterministic de-duplication.
2. Refactor the shared viewer shell to render an accessible tab list and one active preview panel.
3. Add explicit per-tab close controls, predictable next-tab selection, focus restoration, and
   keyboard navigation.
4. Add minimize/restore state and the docked right-side affordance while retaining the tab set.
5. Add responsive behavior for narrow screens and overflow behavior for many tabs.
6. Persist or reconstruct safe tab state for the same Project/session and isolate it across context
   switches.
7. Reuse the shared viewer actions from Project Chat and the task `.8` activity panel.

## Gherkin E2E Strategy

```gherkin
Feature: Multi-tab Project resource previews

  Background:
    Given Project Chat is open with isolated Project and session data
    And generated HTML, Markdown, image, PDF, source, diff, and missing-file resources are visible

  Scenario: Keep several previews open and navigate them accessibly
    When the user opens two different resources from Project Chat
    Then both resources remain available as de-duplicated preview tabs
    And keyboard navigation changes the active tab without changing the Project conversation
    And closing the active tab selects its predictable neighbor and returns focus after the last tab

  Scenario: Minimize and restore the same preview workspace
    Given multiple preview tabs are open
    When the user minimizes and restores the right-side preview dock
    Then the same tab set and active resource are preserved
    And the controls remain reachable in a narrow viewport

  Scenario: Restore only the matching Project and session
    Given preview tabs were opened in one Project session
    When the browser or production-built Electron renderer reloads that session
    Then the available tab set and active resource are restored
    When a different Project and session is opened
    Then no preview tabs from the prior context are shown

  Scenario: A missing resource does not break remaining previews
    Given a valid diff preview is open
    When the user opens a resource that is no longer readable
    Then an unavailable message is visible and can be closed
    And the valid diff preview remains open without stage, commit, push, download, or save side effects
```

## Tests And Verification

- Unit tests cover add, activate, de-duplicate, close-active, close-inactive, close-last,
  deterministic neighbor selection, minimize/restore, unavailable resources, and Project/session
  isolation.
- Component tests assert correct tab semantics, accessible close/minimize/restore names, focus
  movement, keyboard navigation, active-panel linkage, and narrow-screen fallback behavior.
- Playwright web coverage opens multiple mocked resource kinds, switches tabs, closes each tab,
  minimizes/restores the viewer, and verifies the tab set and active tab are preserved.
- Electron Playwright coverage exercises the behavior from real Project Chat, reopens the same
  Project/session, verifies restoration where supported, and confirms a different Project/session
  does not inherit the tab set.
- Regression coverage verifies Markdown/HTML/source/diff rendering remains differentiated and no
  viewer action stages, commits, pushes, downloads, or saves a resource.
- Run `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`, relevant Playwright/Electron
  suites, documentation checks, and the repository SonarQube/Problems completion gate.

## Gherkin E2E Strategy

```gherkin
Feature: Keep multiple Project resources open for review

  Background:
    Given the app is running with isolated test data
    And Project Chat contains several generated file resources

  Scenario: Open and navigate de-duplicated preview tabs
    When the user opens two resources and reopens the first
    Then exactly two preview tabs remain open
    And the first resource is active without losing Project Chat context

  Scenario: Close and minimize previews predictably
    Given multiple preview tabs are open
    When the user closes the active tab and minimizes then restores the viewer
    Then a predictable adjacent tab becomes active
    And the remaining tab set is preserved after restore

  Scenario: Isolate tab state across Project sessions
    Given one Project session has open preview tabs
    When the user switches to a different Project session
    Then the previous session's resources are not visible
    And reopening the original session restores only its available resources where supported

  Scenario: Recover from an unavailable resource
    Given a previously open resource is missing or no longer readable
    When the preview workspace is restored
    Then the unavailable tab can be closed safely
    And the other tabs remain usable
```

## Definition Of Done

- [ ] Multiple Project resources can remain open in de-duplicated preview tabs.
- [ ] Tabs support explicit close controls, active switching, predictable selection, and keyboard
      and screen-reader semantics.
- [ ] The viewer minimizes to and restores from a docked right-side affordance without losing tabs.
- [ ] Narrow-screen behavior keeps viewer and Project Chat controls usable.
- [ ] Tab state follows Project/session lifecycle and does not leak across contexts.
- [ ] Missing resources fail safely without breaking other tabs.
- [ ] The shared tab boundary is reusable by the task `.8` activity panel.
- [ ] Download/export behavior remains exclusively scoped to task `.15`.
- [ ] Gherkin E2E Strategy is present and covered through accessible real-UI locators.
- [ ] Focused browser and production-built Electron Playwright scenarios pass locally.
- [ ] Required CI Playwright jobs pass, with any failure artifacts inspected and addressed.
- [ ] Required local, Playwright/Electron, CI, and SonarQube/Problems gates pass before closure.
- [ ] Playwright tests cover the Gherkin scenarios through accessible tab controls.
