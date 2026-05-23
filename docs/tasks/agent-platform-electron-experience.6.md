# Task: Project Profile And Capability Labels

**Beads issue:** `agent-platform-electron-experience.6`  
**Spec file:** `docs/tasks/agent-platform-electron-experience.6.md`  
**Parent epic:** `agent-platform-electron-experience` - Desktop Project experience

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-experience.6.md`

## Summary

Support generic Project profiles and capability labels so a Project can be a repo, docs folder,
research folder, generated app, automation workspace, or mixed files.

## Requirements

- Do not rename Projects to Coding Projects.
- Treat coding as a mode/capability, not the Project definition.
- Use human-readable profile/capability labels in UI.
- Keep the model extendable for future modes and tool profiles.
- Avoid overpromising automation for non-code folders.

## Implementation Plan

1. Inspect existing Project capability/profile fields and UI labels.
2. Add or refine display helpers for Project profile and capabilities.
3. Update Project chat/IDE labels to avoid assuming code-only Projects.
4. Add tests for coding, docs, mixed, and unknown profile copy.
5. Document extension points for future profiles.

## Tests And Verification

- Unit tests for profile/capability label helpers.
- Renderer tests for Project profile display.
- Existing Project onboarding and Electron E2E remain green.

## Definition Of Done

- [ ] UI treats Project as generic and coding as a capability/mode.
- [ ] Profile/capability labels are human-readable and extendable.
- [ ] Unknown/mixed Projects have clear fallback copy.
- [ ] Tests cover key profile label cases.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
