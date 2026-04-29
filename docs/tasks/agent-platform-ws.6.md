# Task: Add guarded workspace data removal flow

**Beads issue:** `agent-platform-ws.6`  
**Spec file:** `docs/tasks/agent-platform-ws.6.md` (this file)  
**Parent epic:** `agent-platform-ws` - Host workspace storage for user files

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.6.md`

## Task requirements

Provide an explicit, guarded way to remove host-side Agent Platform data when a user uninstalls the application or wants a full local reset. This must be separate from normal Docker cleanup because host workspace data can contain user-created files, uploads, exports, logs, and configuration.

## Detailed requirements

- Add a cleanup command or script that uses the workspace config resolver to identify host-side Agent Platform paths.
- Distinguish Docker cleanup from host data cleanup in the docs.
- Provide a dry-run mode that lists every path that would be removed.
- Require explicit confirmation before deletion, or a clearly named force flag for non-interactive use.
- Refuse to delete broad or unsafe paths such as `/`, a drive root, a user home root, the repository root, or an empty path.
- Support Linux, macOS, and Windows path conventions.
- Document default removal commands for each OS and custom-path cleanup behavior.
- Make destructive behavior clear in terminal output and docs.

## Dependency order

### Upstream - must be complete before this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.4` | [Spec](./agent-platform-ws.4.md) |

### Downstream - waiting on this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.5` | [Spec](./agent-platform-ws.5.md) |

### Planning notes

This task should reuse the same workspace config resolver introduced in `agent-platform-ws.1a`. The cleanup flow should not invent a second path resolution model.

## Implementation plan

1. Review the workspace setup resolver and Makefile conventions.
2. Add a guarded cleanup script, for example `scripts/workspace-clean.mjs`.
3. Add Makefile targets with explicit names, for example `make workspace-clean-dry-run` and `make workspace-clean`.
4. Implement unsafe-path refusal before any deletion occurs.
5. Require typed confirmation or an explicit force flag for deletion.
6. Update development/deployment docs with uninstall/reset guidance.

## Tests

- Unit tests or script tests for unsafe-path refusal.
- Script test for dry-run output.
- Script test for confirmation/force behavior.
- Docs lint and formatting checks.
- If deletion behavior is tested, run only against temporary directories.

## Definition of done

- [x] Dry-run cleanup lists host data paths without deleting them.
- [x] Deletion requires explicit confirmation or a force flag.
- [x] Unsafe broad paths are refused.
- [x] Cleanup uses the same workspace config resolver as setup.
- [x] Docs explain Docker resource cleanup versus host data cleanup.
- [x] Linux, macOS, Windows, and custom-path behavior is documented.

## Sign-off

- [x] Branch `task/agent-platform-ws.6` created from `task/agent-platform-ws.4`.
- [x] Cleanup safeguard tests pass.
- [x] `bd close agent-platform-ws.6 --reason "..."`
