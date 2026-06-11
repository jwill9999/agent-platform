# Command Runner Platform Adapters

The harness `CommandRunner` contract is the stable boundary for command execution. Platform-specific
production runners must sit behind that contract and must not change the policy layers that run
before command execution:

- command classification,
- human approval for risky commands,
- Project path jail,
- workspace access validation,
- timeout and output limits,
- runner health reporting.

Host execution is development-only on every platform. Docker is also development-only unless a
future release explicitly ships and owns the required runtime boundary without asking the end user
to install or configure Docker.

## Shared Contract

Every production adapter must implement the existing `CommandRunner` request/result model:

| Contract area | Required behavior                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Workspace     | Map the selected Project into the guest/sandbox at a stable workspace path.                     |
| CWD           | Reject or remap CWDs outside the selected Project before execution.                             |
| Environment   | Use explicit environment variables by default; do not inherit the host shell environment.       |
| Timeout       | Enforce requested timeout at the adapter and inside the guest/sandbox where possible.           |
| Output        | Enforce bounded stdout/stderr and report truncation consistently.                               |
| Result        | Return success, command failure, denied, and approval-required through the shared result shape. |
| Health        | Report whether the adapter is production, executable, ready, unavailable, failed, or disabled.  |

Production adapters must fail closed. If the sandbox, helper, VM, guest service, packaged asset, or
signing/runtime prerequisite is missing, the adapter must deny execution rather than falling back to
host execution.

## macOS Adapter

The first production adapter is `macos-vm`:

```text
sys_bash
  -> command policy / approval / path jail
  -> CommandRunner
  -> native macOS VM helper
  -> Apple Virtualization.framework
  -> Linux guest service
  -> /workspace
```

Release requirements:

- Apple Silicon macOS only for the first release.
- Packaged helper signed with `com.apple.security.virtualization`.
- Packaged VM assets include a checksum-verified raw ARM64 Linux kernel `Image`, initrd, bootstrap,
  and root image.
- Guest command execution runs as non-root user `agentplatform`.
- Guest networking is disabled for the initial release.
- Project data is exposed only at `/workspace`; guest scratch is app-owned runtime state.
- Reset/repair may delete only app-owned VM runtime state, never user Project folders.

## Windows Adapter Target

The Windows production adapter should be a new `CommandRunner` mode, not a modification of the
macOS implementation. The likely boundary is a managed local Linux environment using one of:

- WSL2 with a packaged/imported distribution owned by Agent Platform,
- Hyper-V with a managed Linux VM,
- Windows Sandbox only if it can satisfy persistent Project mount, automation, and distribution
  requirements.

The first viable Windows design must prove:

- end users do not manually install or configure the sandbox runtime,
- Project folders are mounted into the guest at `/workspace` or an adapter-normalized equivalent,
- the guest cannot access arbitrary host paths,
- host networking and guest networking are explicitly documented and testable,
- command execution cannot silently fall back to PowerShell, `cmd.exe`, or the host shell,
- reset/repair deletes only app-owned runtime state,
- packaging/signing/update flows preserve the runner boundary.

If WSL2 is selected, the design must account for Windows editions and features where WSL2 is absent,
disabled, or blocked by policy. Missing WSL2 must report unavailable/disabled health and deny
commands.

## Linux Adapter Target

The Linux production adapter should also be a new `CommandRunner` mode. The likely boundary is one
of:

- a managed user namespace plus mount namespace sandbox,
- Bubblewrap or a similar namespace wrapper shipped or explicitly required by the package,
- a lightweight local VM such as Firecracker only if the distribution and kernel requirements can
  be packaged reliably for desktop users.

The first viable Linux design must prove:

- host execution is never the production fallback,
- Project access is limited to the selected workspace path,
- network policy is explicit and testable,
- the process user is non-root or otherwise constrained by user namespaces,
- filesystem writes are limited to Project and app-owned scratch,
- required kernel namespace features are detected before execution,
- missing sandbox prerequisites deny execution with actionable health.

If the adapter depends on a distribution package such as Bubblewrap, release documentation must state
whether it is bundled, installed by the app, or a supported-system prerequisite. A prerequisite is
acceptable only if the packaged app detects it and fails closed when it is absent.

## Testing Requirements

Each future platform adapter needs the same evidence classes as the macOS adapter:

- unit tests for mode selection, fail-closed defaults, and health states,
- adapter tests for helper invocation, path mapping, timeout/output limits, and denied failures,
- local sandbox smoke tests proving commands execute inside the intended boundary,
- packaged app E2E proving user-visible command execution and fail-closed behavior,
- release smoke proving signing/packaging/update state does not break helper execution,
- reset/repair tests proving only app-owned runtime state is removed.

No future adapter can be signed off by proving only that a command succeeds. It must prove the
sandbox properties the command runner exists to provide.
