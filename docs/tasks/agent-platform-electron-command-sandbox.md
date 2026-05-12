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

Threat model: [Command Execution Threat Model](../design/command-execution-threat-model.md)

Future runner research:
[Future Command Runner Research](../design/future-command-runner-research.md)

Recommended next stronger runner direction: keep the current Project-scoped host runner as the
internal/private baseline, keep Docker as a development/CI and optional advanced runner, treat macOS
App Sandbox as app hardening rather than the full command runner boundary, and prototype a
lightweight local VM-backed `CommandRunner` adapter for the public macOS command execution path.

## Proposed Task Chain

1. `agent-platform-electron-command-sandbox.1` — Command execution threat model.
2. `agent-platform-electron-command-sandbox.2` — `CommandRunner` interface.
3. `agent-platform-electron-command-sandbox.3` — Host runner with Project-root PathJail.
4. `agent-platform-electron-command-sandbox.4` — Approval and audit integration.
5. `agent-platform-electron-command-sandbox.5` — Deny/destructive command policy.
6. `agent-platform-electron-command-sandbox.6` — Sandbox regression tests.
7. `agent-platform-electron-command-sandbox.7` — Future runner research note.

## Dependencies

| Upstream                                 | Downstream                           |
| ---------------------------------------- | ------------------------------------ |
| `agent-platform-electron-project-access` | `agent-platform-electron-onboarding` |

## Child Task Specs

| Task                                          | Spec                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `agent-platform-electron-command-sandbox.1`   | `docs/tasks/agent-platform-electron-command-sandbox.1.md`                |
| `agent-platform-electron-command-sandbox.2`   | `docs/tasks/agent-platform-electron-command-sandbox.2.md`                |
| `agent-platform-electron-command-sandbox.3`   | `docs/tasks/agent-platform-electron-command-sandbox.3.md`                |
| `agent-platform-electron-command-sandbox.4`   | `docs/tasks/agent-platform-electron-command-sandbox.4.md`                |
| `agent-platform-electron-command-sandbox.5`   | `docs/tasks/agent-platform-electron-command-sandbox.5.md`                |
| `agent-platform-electron-command-sandbox.6`   | `docs/tasks/agent-platform-electron-command-sandbox.6.md`                |
| `agent-platform-electron-command-sandbox.7`   | `docs/tasks/agent-platform-electron-command-sandbox.7.md`                |
| `agent-platform-electron-command-sandbox` DoD | PR checks, Sonar/Problems gate, and review comments green for all tasks. |

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
- Stronger runners can replace the `CommandRunner` delegate behind the existing Project policy
  wrapper without rewriting chat, approval, audit, or harness APIs.
