# Epic: Command runner and sandbox policy

**Beads issue:** `agent-platform-electron-command-sandbox`  
**Spec file:** `docs/tasks/agent-platform-electron-command-sandbox.md`

## Objective

Define and implement the first desktop command execution boundary so agent tools can operate inside user Projects without unrestricted host access.

## Requirements

- Create a swappable `CommandRunner` abstraction.
- Enforce Project-root PathJail for host backend commands.
- Require approval for risky writes and commands.
- Block or gate destructive commands.
- Audit allowed and denied operations.
- Define temporary directory and network behavior.
- Research stronger future runners such as Docker, platform sandboxing, VM, or remote execution.

## Proposed Task Chain

1. Command execution threat model.
2. `CommandRunner` interface.
3. Host runner with Project-root PathJail.
4. Approval and audit integration.
5. Deny/destructive command policy.
6. Sandbox regression tests.
7. Future runner research note.

## Dependencies

| Upstream                                 | Downstream                           |
| ---------------------------------------- | ------------------------------------ |
| `agent-platform-electron-project-access` | `agent-platform-electron-onboarding` |

## Testing Strategy

- Unit tests for command policy decisions.
- Integration tests for allowed in-root commands and denied outside-root access.
- Tests for destructive command denial/approval behavior.
- Audit event tests for allowed and denied operations.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, and `pnpm docs:lint`.

## Definition Of Done

- Commands default to the active Project root.
- Outside-root reads and writes are denied.
- Destructive commands are blocked or approval-gated.
- Tool audit records allowed and denied operations.
- Runner interface can support stronger sandbox implementations without rewriting chat/harness APIs.
