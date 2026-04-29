# Task: Verify workspace security, HITL, and e2e flows

**Beads issue:** `agent-platform-ws.5`  
**Spec file:** `docs/tasks/agent-platform-ws.5.md` (this file)  
**Parent epic:** `agent-platform-ws` - Host workspace storage for user files

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.5.md`

## Task requirements

Complete the epic by verifying workspace persistence, security boundaries, HITL behavior, audit output, and UI flows end to end. This task should close gaps discovered during integration and prepare the feature branch for release.

## Detailed requirements

- Confirm allowed workspace writes succeed and persist across Docker restart.
- Confirm writes outside the workspace are denied.
- Confirm `..`, absolute-path, and symlink escape attempts are denied.
- Confirm high-risk shell/file operations retain HITL approval.
- Confirm approval allows only the approved attempted operation and does not bypass PathJail.
- Confirm audit records and UI output are human-readable.
- Update docs if the implementation diverged from earlier task specs.

## Dependency order

### Upstream - must be complete before this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.4` | [Spec](./agent-platform-ws.4.md) |

### Downstream - waiting on this task

None.

### Planning notes

This is the segment tip. After sign-off, open one PR from `task/agent-platform-ws.5` into `feature/agent-platform-workspace-storage` containing the full chain.

## Implementation plan

1. Review all previous task checklists and Beads acceptance criteria.
2. Add missing integration and e2e tests for persistence, denials, HITL, and UI flows.
3. Run the Docker stack and verify workspace files persist across restart.
4. Run the full applicable quality gate.
5. Update docs, task specs, and `session.md` with final behavior.
6. Open the segment PR into the feature branch when checks pass.

## Tests

- Unit/integration: allowed workspace write/read/list succeeds.
- Unit/integration: outside workspace, traversal, and symlink escapes are denied.
- HITL: high-risk shell/file operations require approval.
- E2E: user asks agent to create a workspace file, approves if required, sees the file in UI, and downloads/exports it.
- Docker persistence: file remains after restart.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and relevant e2e checks.

## Definition of done

- [ ] Allowed workspace writes succeed.
- [ ] Outside writes and escape attempts are denied.
- [ ] Shell/file operations retain HITL.
- [ ] Audit records and UI output are human-readable.
- [ ] Docker files persist across restart.
- [ ] Feature branch CI/CD is green before merge to `main`.

## Sign-off

- [ ] Branch `task/agent-platform-ws.5` created from `task/agent-platform-ws.4`.
- [ ] Full applicable quality gate passes.
- [ ] PR merged `task/agent-platform-ws.5` -> `feature/agent-platform-workspace-storage`.
- [ ] `bd close agent-platform-ws.5 --reason "..."`
