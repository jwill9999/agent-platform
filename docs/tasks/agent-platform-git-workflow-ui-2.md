# agent-platform-59i — Add upstream publish and clear actions

## Problem

When a branch tracks a missing upstream, the current UI says “Review publish options” but navigates to a generic Commits tab without a clear action.

## Requirements

- For a clean branch with no upstream, offer `Publish branch`.
- For a clean branch with missing upstream, offer `Publish branch` and `Clear stale upstream`.
- Do not hide the exact upstream name; show it as supporting detail.
- Refresh Git state after either action.
- Keep terminal usage as an escape hatch, not the required path.

## Acceptance

- Missing-upstream branches no longer route to a dead-end Commit tab.
- Publishing creates/sets the upstream branch when Git allows it.
- Clearing stale upstream removes the stale upstream configuration and updates the panel state.
- API and web tests cover success and failure states.
