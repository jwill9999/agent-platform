# Task: Serve backend-backed Project file tree and file reads

**Beads issue:** `agent-platform-electron-project-access.5`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.5.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.5.md`

## Summary

Render file trees and file content from the backend-bound Project root rather than browser-only folder handles.

## Requirements

- Add backend file tree/read APIs scoped to a registered Project.
- Restrict reads to the Project root.
- Return relative paths for user-facing display.
- Preserve binary/large-file safeguards.
- Keep current IDE file tree behavior working through the backend-bound Project.

## Implementation plan

1. Review existing browser/workspace file tree code.
2. Add Project-root path jail helpers for desktop Project file reads.
3. Add file tree and file read routes scoped by `projectId`.
4. Update the renderer to consume backend-backed Project files.
5. Add path traversal, binary, large-file, tree, and read tests.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-project-access.4` | `agent-platform-electron-project-access.5` |
| `agent-platform-electron-project-access.5` | `agent-platform-electron-project-access.6` |

## Tests and verification

- API/path jail tests for file tree and read.
- Renderer tests for file tree display and file open.
- Regression tests for traversal and unsupported file types.
- Root gates and PR checks before closure.

## Definition of done

- [x] File tree is loaded from the backend-bound Project root.
- [x] File reads are restricted to the Project root.
- [x] UI displays Project-relative paths.
- [x] Binary/large-file safeguards remain in place.
- [x] Relevant tests and root gates pass.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- Added Project-scoped read APIs:
  - `GET /v1/projects/:id/files/tree`
  - `GET /v1/projects/:id/files/read?path=<relative-path>`
- The API resolves Project roots from internal desktop Project metadata and never returns absolute
  host paths.
- File reads are guarded by `PathJail`, Project-relative path normalization, file size limits, and
  binary detection.
- The IDE explorer prefers backend Project file data when a desktop Project is active; browser file
  handles remain parked for the product IDE.
- PR #179 targets `feature/agent-platform-project-onboarding`.
- CI passed on the latest pushed head: `verify`, `docker`, `e2e`, docs `markdownlint`/`lychee`,
  GitGuardian, and SonarCloud.
- SonarCloud initially reported 3 new issues; the follow-up commits resolved them, and the latest
  analysis reports 0 new open issues and 0 security hotspots.
- No inline PR review comments were present. Sourcery skipped on this cumulative branch.
