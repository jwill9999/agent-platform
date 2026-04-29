# Epic: Host workspace storage for user files

**Beads issue:** `agent-platform-ws`  
**Spec file:** `docs/tasks/agent-platform-ws.md` (this file)

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.md`

## Epic requirements

Add a durable user workspace that is hosted on the machine running Docker and mounted into the agent runtime at a stable container path. The workspace is where users can ask agents to create, read, upload, inspect, and export files without granting access to arbitrary host paths or the application source tree.

The design must work across Linux, macOS, and Windows. The host path may differ by operating system, but the container-facing path must be stable so tools and tests can rely on it.

## Scope

This epic covers:

- A documented host workspace home and configuration convention.
- Platform-owned config resolution, setup scripts, and initial PathJail workspace boundaries.
- Docker runtime mounts for user files and app data.
- File and shell tool policy that keeps user file operations jailed to the workspace.
- Human-in-the-loop approval where file or shell operations are high risk.
- UI/API affordances for inspecting and exporting workspace files.
- Security, persistence, and end-to-end tests.

This epic does not grant agents broad access to the developer's host filesystem. Access is limited to the configured workspace mount unless a later ADR explicitly expands the policy.

## Architecture principles

- Use a stable container path, `/workspace`, for user files.
- Keep app data separate from user files, for example `/data`.
- Keep repository source separate from user-writeable workspace storage.
- Default host paths should be conventional for each OS:
  - Linux: `~/.agent-platform`
  - macOS: `~/Library/Application Support/AgentPlatform`
  - Windows: `%LOCALAPPDATA%\\AgentPlatform`
- Provide a repo-local development fallback such as `.agent-platform/`, but keep it ignored by Git.
- First-run Makefile lifecycle commands must prepare the workspace automatically before Docker starts.
- Enforce PathJail checks before every file operation, including path normalization and symlink traversal.
- Keep high-risk and explicitly approval-required tools behind HITL. Approval allows the attempted operation; it does not bypass the workspace jail.
- Audit workspace reads, writes, denials, and approval decisions in human-readable terms.
- Skills may guide file organization later, but skills must not own host path mapping, setup, or security enforcement.

## Child tasks

| Issue                  | Title                                                               | Spec                              |
| ---------------------- | ------------------------------------------------------------------- | --------------------------------- |
| `agent-platform-ws.1`  | Define host workspace home and configuration                        | [Spec](./agent-platform-ws.1.md)  |
| `agent-platform-ws.1a` | Add workspace config, setup scripts, and PathJail platform behavior | [Spec](./agent-platform-ws.1a.md) |
| `agent-platform-ws.2`  | Mount workspace storage into Docker runtime                         | [Spec](./agent-platform-ws.2.md)  |
| `agent-platform-ws.3`  | Enforce workspace PathJail and tool policy                          | [Spec](./agent-platform-ws.3.md)  |
| `agent-platform-ws.4`  | Expose workspace files in the UI and API                            | [Spec](./agent-platform-ws.4.md)  |
| `agent-platform-ws.5`  | Verify workspace security, HITL, and e2e flows                      | [Spec](./agent-platform-ws.5.md)  |

## Dependency order

Execution order is enforced in Beads:

```text
agent-platform-ws.1
  -> agent-platform-ws.1a
  -> agent-platform-ws.2
  -> agent-platform-ws.3
  -> agent-platform-ws.4
  -> agent-platform-ws.5
```

If implementation discovers safe parallelism, update this spec and Beads dependencies together.

## Feature branch

Use `feature/agent-platform-workspace-storage` for the integration branch. Each task should use `task/<issue-id>` branches chained in Beads dependency order unless a later spec update deliberately splits the epic into multiple segments.

## Definition of done

- [ ] All child tasks are closed in Beads.
- [ ] Host workspace and app data locations are documented for Linux, macOS, and Windows.
- [ ] Config/setup scripts create the workspace structure without requiring an agent skill.
- [ ] Normal startup commands perform workspace setup automatically on first run.
- [ ] Docker mounts the host workspace into `/workspace` and app data into a separate container path.
- [ ] File-capable tools cannot escape the configured workspace through relative paths, absolute paths, or symlinks.
- [ ] High-risk shell/file operations keep explicit HITL approval.
- [ ] Users can inspect and export workspace files from the UI/API.
- [ ] Security, persistence, and e2e tests are green on the feature branch before merge to `main`.
