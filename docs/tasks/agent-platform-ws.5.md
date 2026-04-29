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
- Confirm guarded host data cleanup dry-run and refusal behavior.
- Update docs if the implementation diverged from earlier task specs.

## Dependency order

### Upstream - must be complete before this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.6` | [Spec](./agent-platform-ws.6.md) |

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
- Cleanup: dry-run lists host data paths, unsafe paths are refused, and deletion requires confirmation or force.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and relevant e2e checks.

## Definition of done

- [x] Allowed workspace writes succeed.
- [x] Outside writes and escape attempts are denied.
- [x] Shell/file operations retain HITL.
- [x] Audit records and UI output are human-readable.
- [x] Docker files persist across restart.
- [x] Guarded cleanup behavior is verified.
- [ ] Feature branch CI/CD is green before merge to `main`.

## Sign-off

- [x] Branch `task/agent-platform-ws.5` created from `task/agent-platform-ws.6`.
- [x] Full applicable quality gate passes.
- [x] PR opened: <https://github.com/jwill9999/agent-platform/pull/102>
- [ ] PR merged `task/agent-platform-ws.5` -> `feature/agent-platform-workspace-storage`.
- [ ] `bd close agent-platform-ws.5 --reason "..."`

## Verification added

- `scripts/workspace-compose-verify.mjs` writes a generated workspace file, confirms the API lists and downloads it, confirms traversal and absolute download paths are denied with human-readable messages, and can be rerun after an API restart to prove host-backed persistence.
- `.github/workflows/ci.yml` runs the compose verification before and after restarting the API container.
- `e2e/workspace-files.spec.ts` verifies the Settings > Workspace UI shows generated files and downloads them through the BFF.
- Existing harness/API coverage verifies PathJail escape denial, symlink escape denial, HITL approval gating, approved-tool resume behavior, and human-readable tool failure output.
