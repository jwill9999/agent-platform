# Fix Generated Preload Open IDE Bridge

## Problem

The TypeScript preload source exposes `window.agentPlatformDesktop.projects.openInIde`, but the
custom CommonJS preload build script loaded by Electron omitted that method. In a connected Project
workspace, clicking `Open in IDE` therefore made the renderer think the desktop bridge was missing
and showed the generic availability banner.

## Scope

- Keep the generated CommonJS preload bridge aligned with the TypeScript desktop bridge contract.
- Add regression coverage for `projects.openInIde` in the generated preload path.
- Extend Electron Project access E2E so the test fails if `Open in IDE` shows the missing-bridge or
  missing-folder warning.

## Acceptance

- `Open in IDE` is available from connected Project workspaces in Electron.
- The generated preload exposes `projects.openInIde`.
- Focused desktop tests and Project access E2E pass.
