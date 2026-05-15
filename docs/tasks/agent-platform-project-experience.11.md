# Task: Disambiguate duplicate Project names and restore Project session history

**Beads issue:** `agent-platform-project-experience.11`  
**Spec file:** `docs/tasks/agent-platform-project-experience.11.md`  
**Parent epic:** `agent-platform-project-experience` - Project experience and navigation

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-experience.11.md`

## Summary

Make Project reopen and session history clear when multiple Projects share the same folder name.
Project Chat should restore the last active Project session for the selected Project, while the
Project session menu shows only sessions for that Project.

## Product Rule

Use the folder name as the primary Project name. When multiple Projects share the same name, show a
short, user-safe parent-path disambiguator.

Preferred display:

```text
agent-platform
~/projects/agent-platform

agent-platform
~/work/client-a/agent-platform
```

Avoid full absolute paths by default unless needed to disambiguate or the user opens a details
surface.

## Manual QA Findings

- **Finding:** Two Projects with the same folder name cannot be distinguished in Recent Projects.
- **Finding:** Opening a Project can show no recent Project history or unclear session history.
- **Finding:** The Sessions menu does not clearly distinguish which Project a session belongs to.
- **Severity:** high.
- **Classification:** Project Experience follow-up; potential stabilisation blocker only if Project
  reopen cannot be trusted for manual QA.

## Requirements

- Recent Projects show a primary folder name and a short parent-path disambiguator when names clash.
- The disambiguator must be stable, user-facing, and not expose unnecessary host path detail.
- Opening/reopening a Project restores the last active Project Chat session for that Project when
  one exists.
- Starting a new Project Chat remains possible.
- The Project Chat Sessions menu shows only sessions for the active Project.
- Project session rows include enough context to distinguish them:
  - session title or first message,
  - last updated time,
  - Project name,
  - disambiguator when needed,
  - branch once branch support exists.
- Personal Chat sessions remain separate from Project sessions.
- Tests cover duplicate Project names in different parent folders.

## Implementation Plan

1. Review Project record metadata and session/project association contracts.
2. Add a shared Project display-name helper that computes `name` plus `disambiguator`.
3. Use the display helper in Recent Projects, Project Chat header, Workspaces, and session menus.
4. Add Project-scoped session loading for Project Chat.
5. Restore the last active Project Chat session when reopening a Project.
6. Add tests for duplicate folder names, Project-scoped sessions, and Personal Chat separation.

## Dependency Order

| Upstream                               | Downstream                             |
| -------------------------------------- | -------------------------------------- |
| `agent-platform-project-experience.3`  | `agent-platform-project-experience.11` |
| `agent-platform-project-experience.11` | `agent-platform-project-experience.6`  |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused tests for Project display-name disambiguation.
- Focused API/UI tests for Project-scoped session history.
- Electron/Playwright: open two Projects named `agent-platform` from different parent paths, verify
  the Recent Projects list distinguishes them, reopen each, and verify the correct Project Chat
  session history appears.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] Duplicate Project folder names are distinguishable in Recent Projects and Project Chat.
- [ ] Project Chat restores the last active session for the selected Project.
- [ ] Project session menu lists only sessions for the active Project.
- [ ] Personal Chat sessions remain separate.
- [ ] Tests and CI/CD gates pass before the Beads task is closed.
