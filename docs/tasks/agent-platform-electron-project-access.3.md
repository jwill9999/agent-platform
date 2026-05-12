# Task: Bind Project chat sessions to desktop Projects

**Beads issue:** `agent-platform-electron-project-access.3`
**Spec file:** `docs/tasks/agent-platform-electron-project-access.3.md`
**Parent epic:** `agent-platform-electron-project-access` — Native Project access and session binding

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-project-access.3.md`

## Summary

Ensure opening a desktop Project creates or resumes a chat session with `projectId` set.

## Requirements

- Create or select a Project-bound session after Project registration.
- Persist `projectId` on the session.
- Ensure ordinary chat requests load the Project context from the bound session.
- Keep non-Project chats working unchanged.
- Provide user-facing Project name context without implementation paths.

## Implementation plan

1. Review session creation and Project relationship code.
2. Add a Project-session creation/resume service or route.
3. Update chat/session loading so Project-bound sessions consistently carry `projectId`.
4. Add API tests for new Project session, resume existing Project session, and normal chat isolation.
5. Update docs/spec notes for Project session binding.

## Implementation notes

- Project session binding uses `POST /v1/sessions/project` with `agentId` and `projectId`.
- The route validates both the Agent and Project before creating a session.
- If the Agent already has a Project-mode session for the same Project, the route returns that
  session with `created: false`; otherwise it creates a new Project-mode session with
  `projectId` set.
- Existing non-Project session creation remains unchanged through `POST /v1/sessions`.
- Ordinary chat already resolves Project workspace and instruction context from `session.projectId`;
  this task adds regression coverage proving sessions created by the binding route receive that
  context.

## Dependency order

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-project-access.2` | `agent-platform-electron-project-access.3` |
| `agent-platform-electron-project-access.3` | `agent-platform-electron-project-access.4` |

## Tests and verification

- API/session tests proving `projectId` is set.
- Chat route tests proving Project context is loaded from the session.
- Regression tests proving non-Project sessions are unaffected.
- Root gates and PR checks before closure.

## Definition of done

- [ ] Opening a registered desktop Project creates or resumes a Project-bound session.
- [ ] Project-bound sessions persist `projectId`.
- [ ] Ordinary chat requests receive the same Project context from the session.
- [ ] Non-Project chat behavior is unchanged.
- [ ] Relevant tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
