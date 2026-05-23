# Task: Add governed terminal dock

**Beads issue:** `agent-platform-project-experience.10`  
**Spec file:** `docs/tasks/agent-platform-project-experience.10.md`  
**Parent epic:** `agent-platform-project-experience` - Project experience and navigation

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.10.md`

## Summary

Add a real terminal dock to Project Chat using the standard desktop terminal stack:
`node-pty` in Electron main, `xterm.js` in the renderer, and a typed IPC bridge. The terminal should
feel like part of the Project workspace without expanding the built-in IDE.

## Requirements

- Use `node-pty` for PTY process management in Electron main.
- Use `xterm.js` for terminal rendering in the renderer.
- Use a typed preload/IPC bridge for creating, writing to, resizing, and disposing terminal
  sessions.
- Terminal sessions start scoped to the active Project root. Users must not type or see backend
  container paths as the normal working directory.
- The terminal appears as a resizable bottom dock from Project Chat and can be hidden without
  killing the session unless the user explicitly closes it.
- The design must define command governance before implementation:
  - Project-root scoping,
  - environment variable/secrets handling,
  - process lifecycle and cleanup,
  - output redaction/logging boundaries,
  - future sandbox integration.
- Non-desktop/web-only environments show a clear unavailable state rather than a fake terminal.
- The implementation must not rely on the built-in IDE as the primary surface.

## Implementation Plan

1. Research and confirm `node-pty` packaging requirements for the current Electron build and macOS
   first-release target.
2. Add an Electron main terminal service that owns PTY lifecycle and enforces active Project root
   scoping.
3. Expose typed preload IPC methods for terminal create/input/resize/dispose/status events.
4. Add an `xterm.js` renderer component in a resizable Project Chat bottom dock.
5. Add unavailable and permission/error states for web-only runtime, missing Project, spawn failure,
   and closed sessions.
6. Add tests for IPC contract, Project-root scoping, lifecycle cleanup, and renderer state.
7. Add Electron E2E coverage that opens a Project, opens the terminal dock, runs a harmless command,
   verifies output, resizes/hides the dock, and closes the session.

## Dependency Order

| Upstream                              | Downstream                             |
| ------------------------------------- | -------------------------------------- |
| `agent-platform-project-experience.3` | `agent-platform-project-experience.6`  |
| `agent-platform-project-experience.9` | `agent-platform-project-experience.10` |

Keep Beads dependencies aligned with this table.

## Parallel Worktree Notes

This task touches Electron main/preload, renderer terminal components, and Project Chat layout. It
can run in parallel with preview/activity tasks only if the bottom dock write set is isolated from
the right-side activity panel and preview card components.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused tests for terminal service lifecycle, Project-root cwd, invalid Project handling, and IPC
  schema.
- Renderer tests for dock visibility, resizing, unavailable states, and session close behavior.
- Electron E2E for opening the dock, running a harmless command, seeing output, resizing/hiding, and
  closing the session.
- Verify terminal output does not leak secrets or backend implementation paths in normal UI.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Project Chat has a resizable terminal dock.
- [ ] Terminal uses `node-pty` in Electron main and `xterm.js` in the renderer.
- [ ] Terminal IPC is typed and scoped to the active Project root.
- [ ] Web-only or unsupported runtime shows a clear unavailable state.
- [ ] Terminal lifecycle, cleanup, and command-governance boundaries are documented and tested.
- [ ] Electron E2E proves the terminal works in a production-like desktop runtime.
