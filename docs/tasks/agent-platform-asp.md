# agent-platform-asp — Fix Git panel loading and stale diff state

## Problem

The Git & GitHub panel can briefly show unavailable/non-Git copy while a Project's Git status is still loading. The Changes tab can also carry a selected file from a previous Project/status response and request a diff for a stale path, producing `Path must be repository-relative.`

## Requirements

- Show a neutral loading state while Git status for the current Project has not loaded yet.
- Treat Git status, changes, checks, and PR data as Project-scoped so stale responses cannot render against a new Project.
- Only request a file diff when the selected file is present in the current Project's loaded changes.
- Preserve existing Git overview and Changes tab behavior once the data has loaded.

## Done

- Pending Git status renders as `Loading Git state...` instead of `No local Git repository`.
- Project changes reset when switching Projects.
- Diff requests are guarded against stale selections.
- Focused regression coverage added for loading and stale-diff guards.
