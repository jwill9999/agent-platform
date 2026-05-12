# Command Execution Threat Model

## Purpose

This document defines the first command-execution threat model for local desktop Project work.

Electron gives Agent Platform a trusted way to select a real host folder. It does not make command
execution safe. Any shell command, package script, test runner, generated code, or future tool that
runs against a user Project must pass through a command boundary that is explicit, auditable, and
replaceable.

The first implementation may use a constrained host runner for private/internal desktop builds, but
the architecture must keep the runner swappable for stronger isolation later.

## Protected Assets

| Asset                  | Why it matters                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ |
| User Project files     | The agent should only read/write files the user selected for the active Project.     |
| Host filesystem        | Commands must not read or modify arbitrary files outside the selected Project root.  |
| App data and SQLite    | Local sessions, settings, memory, recent Projects, and audit logs belong to the app. |
| Model/API credentials  | Provider keys must not be exposed through command output, env dumps, logs, or files. |
| Desktop runtime config | Backend ports, paths, and secret metadata should not be mutated by Project commands. |
| Backend process        | Command execution must not crash or take over the local API process.                 |
| Audit trail            | Allow/deny/approval records must remain trustworthy and bounded.                     |
| User trust and UX      | The UI must not imply a command was safe, approved, or successful when it was not.   |

## Trust Boundaries

```text
Renderer
  -> preload bridge
  -> Electron main
  -> local backend/API
  -> harness/tool dispatch
  -> CommandRunner
  -> host shell or future sandbox
  -> selected Project files
```

| Boundary                      | Rule                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Renderer -> preload           | Renderer gets named desktop APIs only, not generic filesystem or shell access.         |
| Preload -> Electron main      | IPC validates sender and payload before opening dialogs or maintenance actions.        |
| Electron main -> backend      | Trusted desktop Project registration may pass host paths; normal renderer APIs do not. |
| Backend -> harness            | Project-bound sessions carry the active Project id and root metadata.                  |
| Harness -> CommandRunner      | Commands go through policy, approval, audit, cwd, timeout, and output bounds.          |
| CommandRunner -> host/sandbox | The selected Project root is the default and maximum filesystem scope.                 |

## First-Release Assumptions

- Desktop is macOS-first, but policy and interfaces must avoid macOS-only assumptions where possible.
- The local backend is single-user and supervised by Electron in desktop mode.
- The first runner may execute on the host process with strict Project-root policy, approval gates,
  timeouts, and audit logs.
- Host execution is not a strong sandbox. It is acceptable only as a staged internal/private
  milestone until a stronger runner is selected.
- Docker remains valid for development, CI, and possible future sandboxing, but normal desktop users
  should not be required to run Docker.
- Commands should default to the active Project root and should not require users to type absolute
  host paths.
- Network access is not solved by PathJail. Package installs, tests, and scripts that use the
  network need explicit policy and audit treatment.
- Temporary files must use an approved temp location and must not silently spill sensitive data into
  app data or unrelated host folders.

## Threats And Mitigations

| Threat                              | Example                                                       | First mitigation                                                                                         | Follow-up task |
| ----------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------- |
| Outside-root read                   | `cat ~/.ssh/id_rsa`                                           | Command policy and PathJail deny absolute or resolved paths outside Project root before execution.       | `.3`           |
| Outside-root write                  | `echo x > ~/.zshrc`                                           | Deny outside-root write targets and cwd escapes; audit denial.                                           | `.3`, `.4`     |
| Destructive Project command         | `rm -rf .`                                                    | Block or approval-gate destructive patterns with explicit reason.                                        | `.5`           |
| Shell chaining bypass               | `ls && rm -rf docs`                                           | Classify shell chaining as risky unless command policy can prove safe intent.                            | `.5`           |
| Symlink escape                      | `cat project-link/../../secret`                               | Resolve real paths before allowing filesystem targets.                                                   | `.3`, `.6`     |
| Package manager lifecycle execution | `pnpm install` runs untrusted `postinstall`                   | Treat installs/scripts as risky commands requiring approval or stronger runner.                          | `.5`, `.7`     |
| Prompt-injection command request    | README asks agent to exfiltrate files                         | Apply same policy regardless of prompt source; do not allow model text to bypass HITL or PathJail.       | `.4`, `.5`     |
| Secret leakage through env/output   | `env`, failing build logs, test output                        | Redact/omit sensitive env, bound stdout/stderr, and keep provider keys out of command environment.       | `.2`, `.4`     |
| Backend process takeover            | Long-running fork bomb or command that consumes all resources | Timeout commands, bound output, avoid shell access from renderer, and plan stronger runner isolation.    | `.2`, `.7`     |
| Misleading success state            | Denied command appears as successful tool result              | Return structured denied/approval-required results and audit them distinctly.                            | `.2`, `.4`     |
| Host path disclosure                | UI or chat prints `/Users/name/private/path` unnecessarily    | Prefer Project name and relative paths in user-facing output; keep full host paths in bounded logs only. | `.3`, `.6`     |
| App data mutation                   | Command writes into SQLite/config/log paths outside Project   | Deny outside-root paths and keep app data outside Project command scope.                                 | `.3`, `.6`     |

## Policy Requirements

### Default command scope

- A Project-bound command defaults to the selected Project root.
- A non-Project command must not silently inherit an arbitrary host cwd.
- If no safe cwd is available, the command is denied or requires explicit setup.

### Filesystem scope

- Any cwd, path argument, redirection target, or discovered filesystem target that can be resolved
  should stay inside the selected Project root.
- Realpath checks must account for symlinks.
- Denials should be deterministic and audit-recorded.

### Command classification

Commands should be classified before execution:

| Class             | Examples                                        | Behavior                                  |
| ----------------- | ----------------------------------------------- | ----------------------------------------- |
| Read-only         | `pwd`, `ls`, `cat README.md`, `git status`      | Allow if paths stay inside Project root.  |
| Project write     | `touch docs/new.md`, `pnpm test -- --update`    | Approval-gate unless already approved.    |
| Risky script      | `pnpm install`, `npm run build`, `make migrate` | Approval-gate or require stronger runner. |
| Blocked           | `rm -rf /`, `chmod -R`, outside-root writes     | Deny before execution.                    |
| Unknown/high-risk | Chained shell, curl-pipe-shell, eval-like use   | Deny or approval-gate conservatively.     |

### Environment and secrets

- Provider API keys and secrets should not be passed to Project commands by default.
- If a future task needs env injection, it must be explicit, minimal, and audited.
- Env and command output must be bounded and redacted before reaching chat or audit surfaces.

### Network

- Network access is not controlled by Project-root PathJail.
- Commands that install dependencies, download code, or contact external services need separate
  policy and approval copy.
- Future stronger runners should support network allow/deny configuration.

### Temporary files

- Temporary directories must be chosen by policy, not by the current shell's ambient cwd.
- Temp cleanup should be part of runner behavior or audit guidance.
- Project-generated temp files should stay inside the Project root when feasible.

## Test Requirements For The Epic

The remaining command-sandbox tasks should add tests for:

- command interface result shapes,
- in-root command success,
- default cwd equals active Project root,
- absolute outside-root read denial,
- absolute outside-root write denial,
- symlink escape denial,
- destructive command block or approval requirement,
- package/script execution policy,
- approval-required command lifecycle,
- allowed/denied/failed/timed-out audit records,
- bounded stdout/stderr,
- absence of unnecessary host absolute paths in user-facing output,
- no cloud provider credential requirement for command tests.

## Residual Risk

The first host runner is a policy boundary, not a hard sandbox. It reduces accidental damage and
blocks common unsafe commands, but it cannot provide the same isolation as a container, VM, platform
sandbox, or remote execution service. The `CommandRunner` interface must therefore remain swappable,
and `agent-platform-electron-command-sandbox.7` must recommend the next stronger runner path.
