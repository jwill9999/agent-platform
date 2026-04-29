# Task: Mount workspace storage into Docker runtime

**Beads issue:** `agent-platform-ws.2`  
**Spec file:** `docs/tasks/agent-platform-ws.2.md` (this file)  
**Parent epic:** `agent-platform-ws` - Host workspace storage for user files

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.2.md`

## Task requirements

Mount the configured host workspace into the Docker runtime at `/workspace`, while keeping internal application data separate. The local development flow should create required directories automatically and be repeatable on a fresh machine.

## Detailed requirements

- Mount the host workspace path to `/workspace` in relevant Docker services.
- Mount app data to a separate container path, for example `/data`.
- Ensure setup scripts or Makefile targets from `agent-platform-ws.1a` create required host directories before compose starts.
- Confirm the normal first-run command path requires no manual workspace setup beyond documented env overrides.
- Keep source code mounts separate from user workspace mounts.
- Document how to override the workspace host path for Linux, macOS, and Windows.
- Preserve the existing SQLite/runtime behavior unless intentionally moved and tested.

## Dependency order

### Upstream - must be complete before this task

| Issue                  | Spec                              |
| ---------------------- | --------------------------------- |
| `agent-platform-ws.1a` | [Spec](./agent-platform-ws.1a.md) |

### Downstream - waiting on this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.3` | [Spec](./agent-platform-ws.3.md) |

### Planning notes

Approval and PathJail behavior are not implemented here. This task only makes the storage available to the runtime in a predictable way.

## Implementation plan

1. Review `docker-compose.yml`, Dockerfiles, Makefile targets, and seed/reset scripts.
2. Verify lifecycle targets run the workspace setup prerequisite before compose starts.
3. Add compose mounts for `/workspace` and separated app data.
4. Update docs for local startup and path overrides.
5. Test persistence by creating a file in `/workspace`, restarting Docker, and confirming it remains.

## Tests

- Run Docker compose config validation.
- Run the documented startup path, preferably `make up` or the closest focused target.
- Verify a fresh checkout can run the normal startup command without manually creating workspace directories.
- Verify `/workspace` exists in the API container and persists across restart.
- Verify app data remains separate from workspace data.

## Definition of done

- [ ] Host workspace mounts to `/workspace`.
- [ ] App data mounts separately from user files.
- [ ] Setup creates required directories.
- [ ] First-run startup commands perform workspace setup automatically.
- [ ] Local dev flow is documented and repeatable.
- [ ] Docker restart preserves files written under `/workspace`.

## Sign-off

- [ ] Branch `task/agent-platform-ws.2` created from `task/agent-platform-ws.1a`.
- [ ] Docker/config checks pass.
- [ ] `bd close agent-platform-ws.2 --reason "..."`
