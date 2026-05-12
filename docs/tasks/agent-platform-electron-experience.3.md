# Task: Project Chat As Default Entry

**Beads issue:** `agent-platform-electron-experience.3`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.3.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.3.md`

## Summary

Make Project chat the default surface after opening or reopening a Project, with the IDE available as
an optional deeper workspace.

## Requirements

- Opening a Project lands in Project chat by default.
- Project chat uses the active Project/session context immediately.
- Chat copy should invite a task, not instruct users to manage paths.
- Existing IDE can still be opened from the Project context.
- Normal chat remains available for non-Project conversations.

## Implementation Plan

1. Identify current post-open routing from Project open/reopen.
2. Route successful Project open to Project chat instead of the IDE workspace.
3. Ensure active Project session binding is created before the first Project chat message.
4. Update empty states and composer placeholders for Project chat.
5. Add tests for first message context and chat-first landing.

## Tests And Verification

- Renderer tests for post-open surface selection.
- API/session tests for Project-bound first chat message.
- Electron E2E for Project open landing in chat.
- Regression checks that IDE still opens with the same Project context.

## Definition Of Done

- [ ] Opening or reopening a Project lands in Project chat by default.
- [ ] First Project chat message has active Project context.
- [ ] Normal chat remains separate from Project chat.
- [ ] IDE can still be opened from the active Project.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
