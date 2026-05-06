# Epic: Project workspace binding

**Beads issue:** `agent-platform-project-workspaces`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-project-workspaces.md`

## Objective

Make code workbench sessions operate on a single active project workspace so the IDE tree, chat
context, terminal, agent tools, Git state, and sensors all refer to the same root.

The canonical agent-facing path is `/workspace`. Internally, `/workspace` must resolve to the active
project root for the current session, not a default Docker directory unrelated to the folder the user
opened.

## Problem

The current workbench has two filesystem realities:

- the browser can open a host folder through File System Access handles
- the backend agent tools write to the API container's `/workspace`

This lets the user view one project while the agent writes somewhere else. Prompt instructions are
not sufficient because the model can still choose backend file tools. The architecture needs a
project workspace boundary that makes the correct root explicit and enforceable.

## Product Model

```text
Project
  Workspace root
  Capability state
  Git/branch state
  File tree
  Terminal cwd
  Chats
    Chat sessions bound to this project
```

Workspace capability states:

- `frontend_only`: browser can read/write selected files, backend cannot run project file tools.
- `backend_mounted`: backend tools, terminal, Git, and sensors operate on the active project root.
- `remote_managed`: hosted checkout controlled by the platform.
- `readonly`: inspect-only project.

## Proposed Task Chain

| Task                                  | Purpose                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| `agent-platform-project-workspaces.1` | Define project workspace model and capability states      |
| `agent-platform-project-workspaces.2` | Bind workbench chats and sessions to an active project    |
| `agent-platform-project-workspaces.3` | Add backend workspace resolver and path-jail mapping      |
| `agent-platform-project-workspaces.4` | Support frontend create file/folder in browser workspaces |
| `agent-platform-project-workspaces.5` | Gate agent tools by workspace capability state            |
| `agent-platform-project-workspaces.6` | Add verification and migration coverage                   |

## Definition Of Done

- [ ] Each child task has a spec linked from Beads.
- [ ] Workbench sessions have an explicit project/workspace binding.
- [ ] Agent-facing `/workspace` consistently means the active project root.
- [ ] Creating and editing files lands in the active project, not a default container path.
- [ ] Tool exposure is derived from workspace capability state.
- [ ] Manual and automated verification covers browser-only and backend-mounted projects.
