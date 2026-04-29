# Task: Add workspace config, setup scripts, and PathJail platform behavior

**Beads issue:** `agent-platform-ws.1a`  
**Spec file:** `docs/tasks/agent-platform-ws.1a.md` (this file)  
**Parent epic:** `agent-platform-ws` - Host workspace storage for user files

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.1a.md`

## Task requirements

Implement the platform-owned behavior that turns the workspace convention into something the runtime can use safely: configuration resolution, first-run setup scripts, stable container path defaults, and initial PathJail boundaries.

The agent should not need a skill or knowledge of the host filesystem to map files correctly. Docker/config owns the host mapping, setup scripts create the folder structure, and tools operate on workspace-relative paths under the stable container path.

## Detailed requirements

- Add configuration resolution for the workspace home and default workspace.
- Resolve OS-specific host defaults from the convention defined in `agent-platform-ws.1`.
- Preserve a stable container path default of `/workspace`.
- Add setup scripts or Makefile targets that create the documented host folder structure:
  - `config/`
  - `data/`
  - `workspaces/default/uploads/`
  - `workspaces/default/generated/`
  - `workspaces/default/scratch/`
  - `workspaces/default/exports/`
  - `logs/`
- Wire workspace setup into first-run and lifecycle Makefile commands so `make up`, `make restart`, `make reset`, and `make new` prepare the required host directories before Docker starts.
- Expose a focused setup command, for example `make workspace-init`, for users who want to prepare or inspect the workspace without starting services.
- Ensure the repo-local `.agent-platform/` fallback is ignored by Git.
- Ensure file tools accept and return workspace-relative paths where possible.
- Add initial PathJail enforcement around workspace path resolution.
- Block traversal and outside-workspace paths before the Docker mount task exposes the workspace broadly.
- Document that skills may later guide file organization, but skills must not be responsible for host path mapping, setup, or security enforcement.

## Dependency order

### Upstream - must be complete before this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.1` | [Spec](./agent-platform-ws.1.md) |

### Downstream - waiting on this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.2` | [Spec](./agent-platform-ws.2.md) |

### Planning notes

This task is the bridge between documentation and runtime wiring. Keep it focused on platform behavior: config, setup, and jail boundaries. The later security task, `agent-platform-ws.3`, should deepen policy coverage across every file-capable tool, shell operation, audit event, and HITL path.

## Implementation plan

1. Read the workspace convention from `agent-platform-ws.1` and update it if implementation needs a different config name.
2. Add a small workspace configuration resolver with deterministic defaults for Linux, macOS, Windows, and repo-local dev.
3. Add setup script or Makefile behavior that creates the required folder tree idempotently.
4. Call that setup from `make up`, `make restart`, `make reset`, and `make new` before `docker compose up`.
5. Wire workspace path normalization through the existing PathJail module.
6. Update file tool contracts or adapters so user-facing paths are workspace-relative where possible.
7. Add documentation explaining that agent skills are optional workflow guidance only.

## Tests

- Unit tests for OS-specific default path resolution.
- Unit tests for idempotent directory setup behavior.
- Makefile or script test showing first-run setup is invoked by the documented startup commands.
- Unit tests for workspace-relative path normalization.
- Unit tests for traversal and outside-workspace denial.
- Formatting and typecheck for changed files.

## Definition of done

- [ ] Config resolves OS-specific host workspace defaults and `/workspace` container default.
- [ ] Setup scripts create the documented host folder structure.
- [ ] `make up`, `make restart`, `make reset`, and `make new` run workspace setup automatically.
- [ ] A focused workspace setup command exists for manual preparation.
- [ ] `.agent-platform/` dev fallback is ignored by Git.
- [ ] File tools use workspace-relative paths where possible.
- [ ] PathJail blocks traversal and outside-workspace paths.
- [ ] No agent skill is required for host path mapping, setup, or security.

## Sign-off

- [ ] Branch `task/agent-platform-ws.1a` created from `task/agent-platform-ws.1`.
- [ ] Config/setup/PathJail tests pass.
- [ ] `bd close agent-platform-ws.1a --reason "..."`
