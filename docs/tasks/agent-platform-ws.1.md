# Task: Define host workspace home and configuration

**Beads issue:** `agent-platform-ws.1`  
**Spec file:** `docs/tasks/agent-platform-ws.1.md` (this file)  
**Parent epic:** `agent-platform-ws` - Host workspace storage for user files

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.1.md`

## Task requirements

Define the host-side storage convention for Agent Platform. This task is a planning and configuration task: it should establish names, defaults, directory layout, and documentation before any agent tool is allowed to write files.

The result should make it clear where user files live on Linux, macOS, and Windows, how Docker discovers the path, and which paths are user workspace versus internal app data.

## Detailed requirements

- Define configuration names for the workspace home, host workspace path, container workspace path, and app data path.
- Document OS defaults:
  - Linux: `~/.agent-platform`
  - macOS: `~/Library/Application Support/AgentPlatform`
  - Windows: `%LOCALAPPDATA%\\AgentPlatform`
- Define the default host directory layout:
  - `config/`
  - `data/`
  - `workspaces/default/uploads/`
  - `workspaces/default/generated/`
  - `workspaces/default/scratch/`
  - `workspaces/default/exports/`
  - `logs/`
- Add a repo-local development fallback such as `.agent-platform/` and ensure it is ignored by Git.
- Document Docker Desktop Windows/macOS requirements, including host directory sharing where applicable.
- Do not enable new write-capable agent behavior in this task.

## Dependency order

### Upstream - must be complete before this task

None.

### Downstream - waiting on this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.2` | [Spec](./agent-platform-ws.2.md) |

### Planning notes

If the implementation chooses different env var names, update this spec and the epic spec before closing the task. Suggested names are `AGENT_PLATFORM_HOME`, `AGENT_WORKSPACE_HOST_PATH`, `AGENT_WORKSPACE_CONTAINER_PATH`, and `AGENT_DATA_HOST_PATH`.

## Implementation plan

1. Review `docs/configuration.md`, Docker compose files, Makefile targets, and any existing data volume docs.
2. Add the workspace and data path configuration docs.
3. Add or update sample env/config files if the repo has an established pattern.
4. Add `.agent-platform/` to `.gitignore` if using that as the repo-local fallback.
5. Confirm no runtime tool behavior changes are introduced.

## Tests

- Run formatting checks for changed Markdown/config files.
- If config parsing is touched, add or update unit tests for default path resolution.
- Verify `.agent-platform/` is ignored by Git.

## Definition of done

- [ ] Linux, macOS, and Windows host path conventions are documented.
- [ ] Env/config names are defined.
- [ ] Default directory layout is specified.
- [ ] Repo-local dev fallback is ignored by Git.
- [ ] No new agent write behavior is enabled.

## Sign-off

- [ ] Branch `task/agent-platform-ws.1` created from `feature/agent-platform-workspace-storage`.
- [ ] Relevant docs/config formatting checks pass.
- [ ] `bd close agent-platform-ws.1 --reason "..."`
