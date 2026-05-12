# Task: Register selected desktop Projects with the backend

**Beads issue:** `agent-platform-electron-project-access.2`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.2.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.2.md`

## Summary

Create or update backend Project records from trusted Electron-selected host folders.

## Requirements

- Add an API path for desktop Project registration.
- Accept only trusted folder paths supplied by the Electron backend bridge.
- Persist Project name, root path, and reopen metadata.
- Avoid exposing host absolute paths in normal user-facing UI payloads by default.
- Keep browser/web fallback behavior explicit.

## Implementation plan

1. Inspect the current Project schema and API routes.
2. Add or extend Project registration services for desktop-selected folders.
3. Add validation for absolute host paths and stable Project names.
4. Add API tests for create, update/reopen, invalid path, and display-safe payloads.
5. Document the trusted registration boundary.

## Implementation notes

- Desktop Project registration uses `POST /v1/projects/desktop/register`.
- The route is intended for the Electron-controlled bridge path and requires the
  `x-agent-platform-desktop-bridge: 1` header so web/browser fallbacks remain explicit.
- The backend persists the real host folder path in internal Project metadata for later file
  access, but the desktop registration response returns a display-safe Project payload:
  Project name, safe workspace label, folder display name, capability state, onboarding state,
  default agent profile, branch label when available, and instruction-file count.
- Reopening the same host folder uses a non-reversible `desktop:<sha256>` workspace key so
  duplicate opens reuse the existing Project record without exposing the absolute host path in
  UI-facing registration responses.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-project-access.1` | `agent-platform-electron-project-access.2` |
| `agent-platform-electron-project-access.2` | `agent-platform-electron-project-access.3` |

## Tests and verification

- API/service unit tests for Project registration.
- DB tests for persisted metadata.
- Contract tests if API response types change.
- Root gates and PR checks before closure.

## Definition of done

- [x] Backend can create/update a Project from a trusted desktop folder.
- [x] Invalid or unsupported paths are rejected.
- [x] API responses expose Project name and safe metadata without leaking host paths by default.
- [x] Reopening the same folder updates/reuses the existing Project record.
- [x] Relevant tests and root gates pass.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
