# Task: Add verification and migration coverage

**Beads issue:** `agent-platform-project-workspaces.6`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.6.md`

## Summary

Add tests, manual verification guidance, and migration notes for project workspace binding.

## Requirements

- Document how to manually test browser-only and backend-mounted project modes.
- Add regression coverage for the original failure: writes landing in Docker `/workspace` instead of
  the open project.
- Cover project switching, refresh/reconnect, and missing permission states.
- Update user-facing docs so the expected project model is clear.

## Implementation Plan

1. Add automated regression tests around workspace resolution and tool policy.
2. Add a workbench manual testing guide.
3. Update relevant architecture docs to explain `/workspace` canonicalization.
4. Confirm old sessions without project bindings have a graceful fallback.

## Dependency Order

| Upstream                              | Downstream |
| ------------------------------------- | ---------- |
| `agent-platform-project-workspaces.5` | none       |

## Tests And Verification

- Unit and integration tests from prior tasks remain passing.
- Manual test guide covers create file, edit file, folder refresh, project switch, and backend mount.
- Regression: no IDE workbench flow writes to unrelated `/workspace`.

## Definition Of Done

- [ ] Verification guide exists and is linked from the epic.
- [ ] Regression tests cover wrong-root writes.
- [ ] Architecture docs explain the project workspace model.
