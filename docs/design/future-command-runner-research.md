# Future Command Runner Research

## Purpose

This note compares stronger command runner options beyond the first Project-scoped host runner.
The goal is to keep desktop command execution private and useful while making the execution
boundary stronger over time without rewriting chat, harness, approval, or audit flows.

## Current Baseline

The current runner path is:

```text
chat or tool request
  -> harness tool dispatch
  -> CommandRunner
  -> ProjectScopedCommandRunner
  -> host shell delegate
```

The baseline is intentionally a policy boundary, not a hard sandbox. It provides:

- Project-root cwd defaults.
- Project-root PathJail checks before execution.
- destructive and risky command classification.
- human approval for write/risky commands.
- bounded stdout/stderr.
- audit records for allowed, denied, failed, and approval-required command paths.
- canonical `/workspace`-style paths in user-facing output, with host paths kept out of chat.

This is acceptable for internal/private desktop testing and simple local project operations. It is
not enough for running untrusted generated code, package install scripts, unknown repository test
suites, or arbitrary shell commands in a public desktop release.

## Runner Options

| Option                                          | Security boundary                                                                                                                                                                           | Filesystem model                                                                                                                                                     | Packaging and setup                                                                                                                                                                        | Fit                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Host runner with PathJail                       | Policy checks in the app process before spawning host shell commands.                                                                                                                       | Direct user-selected Project path on the host.                                                                                                                       | Easiest. Ships with Electron and local backend.                                                                                                                                            | Keep as the private/internal baseline and fallback for low-risk commands only.                                  |
| Docker Desktop runner                           | Linux container inside Docker Desktop VM; stronger than host shell, especially with reduced caps and read/write mounts.                                                                     | Explicit bind mount of the selected Project into the container. Docker Desktop says containers can access only files shared in settings and explicitly bind-mounted. | Requires Docker Desktop installed/running and may prompt for file sharing. Not acceptable as a required public desktop dependency.                                                         | Useful optional runner for developers and CI; not the default public macOS runner.                              |
| macOS App Sandbox and security-scoped bookmarks | OS sandbox for the Electron app and its allowed resources. Helps protect app file access.                                                                                                   | User-selected folders can be persisted with security-scoped bookmarks. Apple notes sandboxed apps can extend access to selected file resources.                      | Requires correct entitlements, signing, notarization, and bookmark lifecycle.                                                                                                              | Required for app hardening and project folder persistence, but not sufficient as the command execution sandbox. |
| `sandbox-exec`-style macOS profiles             | Process-level macOS sandbox wrapper.                                                                                                                                                        | Could theoretically restrict child process paths.                                                                                                                    | Poor product fit: deprecated/unsupported direction, macOS-only, profile maintenance risk, uncertain future.                                                                                | Do not build the product around it. Consider only as a small experiment if we need evidence.                    |
| Lightweight local VM                            | Separate Linux VM using Apple Virtualization or a tool such as Lima. Apple Virtualization provides APIs for Linux/macOS VMs; Lima provides Linux VMs with file sharing and port forwarding. | Project folder shared/mounted into guest, ideally read-write only for selected paths and disposable per task/session.                                                | More implementation work: VM lifecycle, base image, file sharing, ports, logs, resource limits, updates. Can be packaged more cleanly than requiring Docker Desktop if we own the runtime. | Best long-term local-first direction for public macOS command execution.                                        |
| Remote sandbox                                  | Managed isolated environment. Vercel Sandbox, for example, runs code in Firecracker microVMs with its own filesystem and network and has SDK/CLI integration.                               | Requires upload/checkout/sync of project files or repository clone into remote workspace.                                                                            | Strong isolation and simpler local packaging, but introduces cloud trust, cost, latency, offline limits, and data egress concerns.                                                         | Optional future cloud runner, not the default for privacy-first local desktop.                                  |

## Source Findings

- Docker Desktop containers run inside a Linux VM on desktop platforms, and host file access is
  limited to paths shared in Docker Desktop settings plus explicit bind mounts. See Docker's
  [container security FAQ](https://docs.docker.com/security/faqs/containers/).
- Docker Enhanced Container Isolation adds user namespace isolation, protected bind mounts, and
  additional syscall protections, but it is a Docker Business feature. See Docker's
  [Enhanced Container Isolation](https://docs.docker.com/enterprise/security/hardened-desktop/enhanced-container-isolation)
  documentation.
- Apple App Sandbox is useful for restricting app access to protected resources and for preserving
  user-selected folder access through security-scoped bookmarks. See Apple's
  [Accessing files from the macOS App Sandbox](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox)
  and [security-scoped bookmark](https://developer.apple.com/documentation/professional-video-applications/enabling-security-scoped-bookmark-and-url-access)
  documentation.
- Apple also documents that child processes inherit static entitlements, not dynamic file rights
  granted after launch. That means App Sandbox helps the app boundary but should not be treated as
  the complete command runner boundary. See Apple's archived
  [App Sandbox entitlement reference](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/EnablingAppSandbox.html).
- Apple Virtualization provides APIs for creating and managing Linux and macOS VMs on Mac. See
  Apple's [Virtualization framework](https://developer.apple.com/documentation/virtualization)
  documentation.
- Lima provides Linux VMs with automatic file sharing and port forwarding and supports macOS hosts.
  See the [Lima documentation](https://lima-vm.io/docs/).
- Vercel Sandbox provides remote isolated Linux microVMs with SDK/CLI support for command and file
  workflows. See [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox).
- Electron renderer sandboxing is still required, but it protects renderer privileges rather than
  arbitrary command execution. Electron warns that Node integration disables renderer sandboxing.
  See Electron's [process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox) and
  [security](https://www.electronjs.org/docs/latest/tutorial/security) guides.

## Recommendation

Use a staged runner strategy:

1. Keep the current Project-scoped host runner for internal/private desktop builds and low-risk
   commands. It must remain behind PathJail, approval, deny rules, output bounds, and audit.
2. Do not require Docker Desktop for the public macOS app. Keep Docker as a development, CI, and
   optional advanced/developer runner because it creates user setup burden and file-sharing prompts.
3. Treat macOS App Sandbox, security-scoped bookmarks, signing, and notarization as desktop app
   hardening requirements, not as the command runner isolation mechanism.
4. Make a lightweight local VM runner the preferred next stronger default for macOS-first public
   command execution. Prototype against Apple Virtualization directly or through a small Lima-style
   runner adapter before committing to a bundled runtime.
5. Keep remote sandboxing as an optional future runner for users who accept cloud execution and
   repository/file sync.

The next implementation direction should therefore be a `CommandRunner` adapter spike for a local
VM-backed runner, with Docker retained as the easiest optional adapter and remote sandbox retained
as a later cloud adapter.

## Migration Path

The existing `CommandRunner` interface can support stronger runners because it already receives:

- `command`
- `cwd`
- environment policy
- timeout
- output bounds
- approval state
- workspace metadata
- audit metadata

The migration should happen behind that interface:

1. Keep `ProjectScopedCommandRunner` as the policy wrapper that validates cwd, paths, command risk,
   and approval.
2. Replace only the delegate:
   - current: `createHostShellCommandRunner()`
   - optional developer runner: `createDockerCommandRunner()`
   - future local-first runner: `createVmCommandRunner()`
   - future cloud runner: `createRemoteSandboxCommandRunner()`
3. Add runner capability metadata so the app can explain limitations without leaking implementation
   detail:
   - `supportsNetworkPolicy`
   - `supportsFilesystemSnapshot`
   - `supportsResourceLimits`
   - `supportsProjectBindMount`
   - `requiresExternalDependency`
   - `privacyMode: local | remote`
4. Keep audit records runner-neutral but include runner kind, policy version, command class, approval
   id, and workspace id.
5. Keep the UI wording user-centered: "Running in this Project" or "Needs approval" rather than
   implementation terms such as container, VM, backend path, or host mount unless the user opens a
   diagnostics view.

## Open Implementation Questions

- What minimum VM startup time is acceptable for interactive chat commands?
- Should the VM be per Project, per session, per command, or reusable with snapshots?
- How should dependency caches be stored without exposing unrelated host files?
- How should network policy be expressed: off by default, prompt per command, or allowlist by tool?
- How should Windows and Linux runners map onto the same interface?
  - Windows likely needs WSL2 or a remote sandbox option.
  - Linux can use native containers or namespaces more directly than macOS.
- Can we package a local VM runner without making the app feel like a multi-step developer tool?
- What is the uninstall behavior for VM images, caches, logs, and snapshots?

## Follow-Up Work

No immediate Beads scope change is required for this epic because the current epic already delivered
the swappable interface and this research note. Follow-up epics should add implementation tasks only
after the team chooses the next runner:

- Prototype a local VM-backed `CommandRunner` adapter for macOS.
- Add runner capability metadata to API contracts and diagnostics.
- Add policy-controlled network modes for command execution.
- Design cleanup/uninstall behavior for runner images, caches, logs, and snapshots.
- Research Windows/Linux runner mapping once macOS-first behavior is validated.
