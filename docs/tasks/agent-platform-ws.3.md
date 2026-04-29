# Task: Enforce workspace PathJail and tool policy

**Beads issue:** `agent-platform-ws.3`  
**Spec file:** `docs/tasks/agent-platform-ws.3.md` (this file)  
**Parent epic:** `agent-platform-ws` - Host workspace storage for user files

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-ws.3.md`

## Task requirements

Ensure all file-capable tools and relevant shell commands are constrained to the configured workspace. Human approval must remain required for high-risk operations, but approval must not bypass PathJail or allow writes outside `/workspace`.

## Detailed requirements

- Apply workspace PathJail to file read, write, list, copy, upload, and download operations.
- Normalize paths before policy checks.
- Block `..` traversal, absolute paths outside the workspace, and symlink escapes.
- Treat `/workspace` as the default working area for user file tools.
- Keep `sys_bash` and other high-risk tools behind HITL approval.
- Deny or require explicit approved policy for shell writes outside `/workspace`.
- Produce audit entries for allowed workspace operations and denied escape attempts.
- Return human-readable errors for denials.

## Dependency order

### Upstream - must be complete before this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.2` | [Spec](./agent-platform-ws.2.md) |

### Downstream - waiting on this task

| Issue                 | Spec                             |
| --------------------- | -------------------------------- |
| `agent-platform-ws.4` | [Spec](./agent-platform-ws.4.md) |

### Planning notes

This task should reuse existing security modules in `packages/harness/src/security/`, especially PathJail, bash guard, and HITL policy helpers. Do not create a parallel policy system unless the existing modules cannot express the requirement.

## Implementation plan

1. Review current system tool definitions and security wiring in the harness.
2. Identify every file-capable tool and every path argument accepted by those tools.
3. Centralize workspace path resolution and jail checks.
4. Wire checks before tool execution and before plugin hooks that could observe unsafe execution.
5. Add audit and trace events for allowed and denied workspace operations.
6. Update human-readable tool result formatting for permission and jail failures.

## Tests

- Unit tests: writes inside `/workspace` succeed.
- Unit tests: `../`, absolute host paths, and symlink escapes are denied.
- Unit tests: shell/file tools still require HITL where risk policy says they should.
- Integration tests: denied operations produce readable output and audit records.
- Run affected harness/API tests, typecheck, lint, and format checks.

## Definition of done

- [ ] File tools enforce the workspace jail.
- [ ] Shell writes outside `/workspace` are denied or gated by explicit approved policy.
- [ ] High/critical risk operations keep HITL.
- [ ] Audit logs identify workspace operations and denials.
- [ ] Escape attempts are covered by tests.

## Sign-off

- [ ] Branch `task/agent-platform-ws.3` created from `task/agent-platform-ws.2`.
- [ ] Security and tool-policy tests pass.
- [ ] `bd close agent-platform-ws.3 --reason "..."`
