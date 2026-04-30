# Workspace Storage

Agent Platform provides a host-backed user workspace for files that agents upload, create, inspect, and download. The host directory is mounted into Docker at a stable container path so the API, tools, MCP filesystem access, and E2E tests all see the same workspace.

## Model

Workspace storage separates user files from app/runtime data:

| Area             | Default container path | Purpose                                         |
| ---------------- | ---------------------- | ----------------------------------------------- |
| User workspace   | `/workspace`           | Uploads, generated files, scratch files, export |
| App/runtime data | `/data`                | SQLite and platform runtime data                |

Agents and tools should use workspace-relative paths or the stable container workspace path. They should not depend on host-specific paths.

## Host Locations

The platform resolves a host-side app home per operating system:

| Host OS | Default home                                  |
| ------- | --------------------------------------------- |
| Linux   | `~/.agent-platform`                           |
| macOS   | `~/Library/Application Support/AgentPlatform` |
| Windows | `%LOCALAPPDATA%\\AgentPlatform`               |

Local development defaults to a repo-local `.agent-platform/` directory through the Makefile so the workspace is easy to inspect and is ignored by Git.

Default layout:

```text
AgentPlatform/
  backups/
  config/
  data/
  workspaces/
    default/
      uploads/
      generated/
      scratch/
      exports/
  logs/
```

## Configuration

| Variable                         | Default / convention                      | Description                                      |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `AGENT_PLATFORM_HOME`            | OS-specific app home                      | Host root for config, data, workspaces, and logs |
| `AGENT_WORKSPACE_HOST_PATH`      | `$AGENT_PLATFORM_HOME/workspaces/default` | Host directory mounted as the user workspace     |
| `AGENT_WORKSPACE_CONTAINER_PATH` | `/workspace`                              | Container path used by tools and APIs            |
| `AGENT_DATA_HOST_PATH`           | `$AGENT_PLATFORM_HOME/data`               | Host app/runtime data directory                  |

`make workspace-init` resolves these values, creates the required directory structure, and validates that the paths are usable before Docker starts. `make up`, `make restart`, `make reset`, and `make new` run workspace initialization automatically.

## Runtime Config Backup

Local development can keep an ignored backup of the saved runtime configuration in
`$AGENT_PLATFORM_HOME/backups/runtime-config.sqlite`.

| Command                       | Purpose                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `make runtime-config-backup`  | Back up saved model configs, encrypted API key refs, agent model assignments, MCP servers, and agent MCP assignments |
| `make runtime-config-restore` | Restore those rows into the current runtime DB after `make reset`, `make new`, or accidental DB deletion             |

The backup copies encrypted `secret_refs` rows exactly as stored in SQLite. It does not decrypt or print API keys, and the default local `.agent-platform/` directory is ignored by Git.

Recommended recovery flow after a DB wipe:

```bash
make reset
make runtime-config-restore
make restart
```

## Security

Workspace access is deliberately bounded:

- PathJail normalizes paths and rejects traversal, absolute-path escape attempts, directories where a file is expected, and symlink escapes.
- The bash workspace policy inspects shell commands for reads/writes and rejects unsafe workspace access before execution.
- Human-in-the-loop approval applies to high-risk tools, but approval does not bypass PathJail or workspace policy checks.
- The Workspace UI and API expose workspace-relative paths only; host filesystem paths are not returned to the browser.

## UI And API

The Workspace view is available in the web app under Settings > Workspace. It lists the managed areas `uploads`, `generated`, `scratch`, and `exports`, and provides download links for safe workspace files.

API endpoints:

| Method | Path                           | Purpose                                 |
| ------ | ------------------------------ | --------------------------------------- |
| `GET`  | `/v1/workspace/files`          | List files grouped by managed area      |
| `GET`  | `/v1/workspace/files/download` | Download a safe workspace-relative file |

Example download:

```text
GET /v1/workspace/files/download?path=generated/reports/summary.txt
```

See [API Reference](api-reference.md#workspace-files) for the response shapes.

## Cleanup And Uninstall

Docker cleanup and host data cleanup are separate by design:

| Command                        | Purpose                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `make clean`                   | Remove Docker containers, Docker volumes, and locally built images            |
| `make workspace-clean-dry-run` | Show host workspace/data/config/log cleanup targets without deleting anything |
| `make workspace-clean`         | Remove host workspace/data/config/log directories after typed confirmation    |
| `make workspace-clean-force`   | Remove host workspace/data/config/log directories without prompting           |

Always run `make workspace-clean-dry-run` first when using custom paths. The cleanup script refuses broad or unsafe targets such as `/`, a Windows drive root, the user home directory, the repository root, empty paths, and top-level directories.

## Verification

The workspace epic includes both local and CI verification:

- `scripts/workspace-compose-verify.mjs` checks compose-backed file listing, download, traversal denial, absolute-path denial, and persistence after an API restart.
- `.github/workflows/ci.yml` runs that verification before and after restarting the API container in the E2E workflow.
- `e2e/workspace-files.spec.ts` verifies the Settings > Workspace UI displays generated files and downloads through the BFF.
- Unit and API tests cover PathJail, bash workspace policy behavior, workspace file listing, workspace downloads, and human-readable denial output.
