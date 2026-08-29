# Task: Export generated Project resources to user files

**Beads issue:** `agent-platform-project-experience.15`
**Spec file:** `docs/tasks/agent-platform-project-experience.15.md`
**Parent epic:** `agent-platform-project-experience` — Project experience and navigation

The Beads issue **description** must begin with:
`Spec: docs/tasks/agent-platform-project-experience.15.md`

## Summary

Add explicit, user-initiated download and save actions for generated resources shown in Project Chat
and the shared Project resource viewer. Preserve the project-scoped resource boundary introduced by
task `.7`: web clients receive safe attachments, while Electron uses a native save dialog and
writes only to the destination the user selects.

## Requirements

- Resource cards and the shared viewer expose clear Download or Save As actions for supported
  generated resources without changing the existing preview and Open externally behavior.
- Every export starts from a normalized Project resource reference. The web renderer, API callers,
  and Electron renderer must not supply arbitrary host filesystem paths.
- Server-side resource resolution remains jailed to the active Project root and rejects absolute
  paths, traversal, symlink escapes, missing files, directories, and resources outside the active
  Project.
- Web/API downloads use an attachment response with a safe display filename, correct media type
  where known, and defensive headers. Raw host paths are never included in URLs, headers, or normal
  user-facing copy.
- Electron Save As is initiated by a direct user gesture and uses the main-process native save
  dialog. The renderer passes only the project/resource identity and an optional safe suggested
  filename.
- Electron writes only after the user selects a destination. Cancellation is a no-op, and replacing
  an existing file requires the platform save dialog's explicit overwrite confirmation.
- The desktop bridge validates request and response payloads, does not expose general filesystem
  write primitives, and does not accept a renderer-supplied destination path.
- Export failures are actionable but do not leak internal roots or host paths. Previewing and
  exporting never implicitly stage, commit, or push Project changes.
- The export contract and UI action are reusable by the Project activity/evidence panel from task
  `.8`.

## Resolved Requirement Decisions

- The MVP remains single-user/no-auth. "Authenticated" in the implementation plan means the
  existing trusted API boundary plus strict Project/resource scoping; this task does not introduce
  an authentication system.
- Export is available only for file-backed resources whose normalized
  `workspace://project/<projectId>/file/<relative-path>` identity resolves to a regular file inside
  the active Project. Diffs, terminals, remote webviews, inline-only previews, and directories are
  not downloadable.
- The API accepts the normalized resource URI rather than a renderer-supplied host path, verifies
  that its Project identity matches the route, and derives the relative file target from the URI.
- Electron's renderer sends only the normalized resource URI and an optional safe display name.
  The trusted main process obtains the attachment from the scoped API endpoint, opens the native
  Save As dialog, and writes only to the destination returned by that dialog.
- Attachment responses use a normalized basename, a conservative MIME fallback, `nosniff`, and
  no-store caching. Export size is bounded so a download cannot cause unbounded process memory use.
- Native dialog cancellation is a successful no-op. Existing-file replacement remains governed by
  the platform save dialog rather than a custom renderer confirmation.

## Dependency Order

| Upstream                              | Downstream                             |
| ------------------------------------- | -------------------------------------- |
| `agent-platform-project-experience.7` | `agent-platform-project-experience.15` |

Task `.15` extends the resource contracts and viewer delivered by `.7`; it does not delay task
`.7`'s preview-rendering acceptance criteria.

## Implementation Plan

1. Define a project-scoped export request/result contract shared by web, API, and Electron.
2. Add an authenticated API attachment endpoint that resolves and validates resources inside the
   active Project jail, including realpath and symlink-escape checks.
3. Add Download or Save As actions to reusable resource cards/viewer states.
4. Add a narrow Electron preload/main-process save bridge using the native save dialog and a
   main-process-controlled resource read.
5. Add safe filename, media type, cancellation, overwrite, and redacted-error handling.
6. Reuse the action boundary from task `.8` rather than introducing panel-specific export logic.

## Tests And Verification

- Unit tests cover safe relative paths, encoded traversal, absolute paths, symlink escapes,
  directories, missing resources, safe filename normalization, MIME selection, and redacted errors.
- API tests verify attachment headers and bytes for supported resources, authorization/project
  scoping, and rejection of traversal and symlink escape attempts.
- Desktop bridge tests verify schema validation, direct-user-gesture invocation, dialog
  cancellation, successful save, overwrite confirmation behavior, and rejection of arbitrary
  renderer-supplied host paths.
- Playwright web coverage clicks Download for mocked generated resources and verifies the suggested
  filename, attachment response, and content.
- Electron Playwright coverage invokes Save As from Project Chat, exercises cancellation and a
  successful user-selected destination, and confirms the source Project resource is unchanged.
- Run `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm test`, relevant Playwright/Electron
  suites, documentation checks, and the repository SonarQube/Problems completion gate.

## Gherkin E2E Strategy

```gherkin
Feature: Export a generated Project resource

  Background:
    Given the app is running with isolated test data
    And a Project Chat contains a generated file resource inside the active Project

  Scenario: Download a generated resource in the web app
    Given the resource viewer is open for a supported generated file
    When the user chooses "Download"
    Then the browser receives an attachment with the safe suggested filename and expected bytes
    And the Project resource and Git state remain unchanged

  Scenario: Cancel Save As in the desktop app
    Given the resource viewer is open in Electron
    When the user chooses "Save As" and cancels the native save dialog
    Then no destination file is written
    And the preview remains usable without exposing a host path

  Scenario: Save a generated resource from the desktop app
    Given the native save-dialog test hook returns an isolated destination
    When the user chooses "Save As"
    Then the selected destination contains the expected resource bytes
    And the source resource remains unchanged

  Scenario: Reject an unsafe or unavailable resource
    Given a resource identity attempts traversal, a symlink escape, or names a missing file
    When export is requested
    Then the user sees an actionable redacted failure
    And no internal root or arbitrary source or destination path is exposed
```

## Definition Of Done

- [x] Generated Project resources have an explicit user-visible Download or Save As action.
- [x] Web/API exports are safe attachment responses scoped to the active Project.
- [x] Electron exports use a native user-gesture save dialog with platform overwrite confirmation.
- [x] No renderer/API request can supply an arbitrary host source or destination path.
- [x] Path jail, traversal, and symlink protections are covered by meaningful tests.
- [x] Export contracts/actions are reusable by the task `.8` activity panel.
- [x] Exporting never mutates Git state or leaks raw host paths.
- [ ] Required local, Playwright/Electron, CI, and SonarQube/Problems gates pass before closure.
- [x] Playwright tests cover the Gherkin scenarios through accessible user-facing controls.
