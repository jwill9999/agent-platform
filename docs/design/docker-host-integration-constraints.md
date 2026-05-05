# Docker Host Integration Constraints

This document defines the operator-facing constraints for Docker-hosted execution when workflows
need host browsers, host IDEs, local files, plugins, terminal output, or desktop application
integration.

It is design documentation only. It does not add backend contracts, frontend components, host bridge
APIs, or deployment behavior.

## Current Runtime Boundary

Agent Platform currently runs the main services through Docker Compose:

- the API/runtime container runs the agent host, tools, terminal WebSocket target, browser runtime,
  and workspace-aware file operations
- the web container runs the Next.js application
- app/runtime data is mounted separately from user workspace files
- user workspace files are visible inside the runtime at a stable container path, usually
  `/workspace`
- local development maps the workspace to a host directory, usually
  `.agent-platform/workspaces/default`

This gives the platform a predictable execution boundary. It also means the agent sees the container
environment first, not the user's full host machine.

## Deployment Modes

The product should treat deployment mode as a capability boundary.

| Mode                    | Workspace model                                           | Host integration expectation                                |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Local Docker Compose    | Host-backed bind mount into `/workspace`.                 | Limited host access through explicit mounts and browser UI. |
| Remote hosted web app   | Managed server-side repository/workspace or sandbox.      | No direct user host access.                                 |
| Desktop/Electron future | Local app can broker host filesystem and app integration. | Richer host integration possible with explicit consent.     |
| Remote sandbox future   | Ephemeral isolated workspace per task/session/repository. | Host access is replaced by repository/provider APIs.        |

Local Docker is useful for isolation and repeatability. It is not a complete host automation layer.
Remote hosting should not depend on bind mounts because the user's host filesystem is not available
to the remote runtime.

## Supported Today

| Capability                       | Supported behavior                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Managed workspace files          | Files under the configured workspace mount are visible to API tools at `/workspace`.                                 |
| Runtime data                     | SQLite/runtime state is stored separately from workspace files.                                                      |
| Browser evidence                 | The API container can launch governed Playwright/Chromium when installed.                                            |
| Local web testing from container | Browser tools should use service names such as `http://web:3001`.                                                    |
| User browser access              | The human can open `http://localhost:3001` from the host browser.                                                    |
| Workspace downloads              | Workspace-managed files can be listed/downloaded through safe API routes.                                            |
| Container terminal               | The embedded terminal connects to the API/runtime environment, not arbitrary host shells.                            |
| Provider APIs                    | GitHub, SonarQube, CodeQL, MCP, or other providers can be integrated through explicit APIs or tools when configured. |

Supported behavior should be presented as bounded. For example, "Open workspace file" is accurate;
"Open any file on your computer" is not.

## Unsupported Today

| Capability                          | Why it is unsupported in the Docker/web model                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Open host IDE directly from API     | Containers cannot reliably launch host apps such as VS Code, Cursor, or Xcode.               |
| Read host IDE diagnostics directly  | IDE Problems/Sonar/CodeQL plugins usually run on the host and are not exposed to Docker.     |
| Read arbitrary host filesystem      | Only explicitly mounted paths are visible inside the container.                              |
| Infer browser-selected folder paths | Browser File System Access handles do not expose trusted host paths to the web app.          |
| Control desktop applications        | Docker containers do not have portable access to host GUI automation or OS app APIs.         |
| Reuse host credentials implicitly   | Host GitHub/SonarQube/CLI credentials may not exist inside the container.                    |
| Treat localhost as universal        | `localhost` means different things to host browser, web container, API container, and tools. |
| Depend on bind mounts remotely      | A hosted server cannot mount the user's laptop filesystem.                                   |

When unsupported behavior is requested, the product should explain the boundary rather than failing
with raw Docker, WebSocket, or filesystem errors.

## Future Bridge Patterns

Future host integration should be capability-based and consent-driven.

| Pattern                          | Use case                                                                | Notes                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Desktop/Electron shell           | Open files, folders, browsers, terminals, and host IDEs.                | Best fit for rich local host integration; not available to hosted web. |
| Local companion daemon           | Broker host file/IDE/plugin events to the web platform.                 | Needs authentication, pairing, audit, and strict allowlists.           |
| IDE extension                    | Expose Problems, selected files, terminal excerpts, and review context. | Good for developer workflows; should not be mandatory.                 |
| Provider API integration         | GitHub checks, CodeQL alerts, SonarQube issues, reviews.                | Preferred for hosted deployments and branch feedback.                  |
| Remote sandbox/workspace service | Clone repos and run tools in isolated managed sandboxes.                | Preferred hosted model for agent code execution.                       |
| MCP capability provider          | Optional local or remote tools exposed through MCP.                     | Must be discovered, trusted, scoped, and bounded.                      |

The default web platform should work without these bridges. Bridges should enhance capability, not
become hidden requirements.

## Host Integration Cases

### Opening A Host Browser

Today:

- Users can manually open the web app in their host browser.
- Browser tools run inside the API/runtime environment and should use Docker service names for
  internal app access.

Unsupported:

- The API container should not be expected to launch the user's host browser.

Future:

- A desktop shell or local companion could open host browser URLs after explicit user consent.

User-facing copy:

> I can open this page in the platform browser tools. To open it in your desktop browser, use the
> link from your local machine.

### Opening A Host IDE

Today:

- The platform can show code, artifacts, and future diffs in the web UI.
- Users can manually open their IDE against the same local repository when they are working
  locally.

Unsupported:

- Docker cannot reliably open host IDEs or navigate to host files.
- Remote hosted deployments cannot open files on the user's laptop.

Future:

- Desktop/Electron, a local companion, or an IDE extension could support "Open in IDE" safely.

User-facing copy:

> This deployment cannot open your desktop IDE directly. You can review the file in the platform, or
> open the repository manually in your local IDE.

### Reading Host IDE Diagnostics

Today:

- The platform can use container-visible checks, provider APIs, and recorded artifacts.
- Host IDE Problems are not automatically visible to the agent.

Unsupported:

- The runtime cannot inspect VS Code/Cursor Problems, local SonarQube plugin state, or IDE terminal
  buffers unless a bridge exposes them.

Future:

- An IDE extension or local companion can publish diagnostics as bounded sensor findings.

User-facing copy:

> I cannot see diagnostics from your desktop IDE in this deployment. Run the platform checks or
> connect an IDE bridge when that capability is available.

### Reading Local Files

Today:

- Files inside the configured workspace mount are visible to the runtime.
- Browser File System Access can let the web UI read/write selected files in supported browsers, but
  those handles do not automatically align with container paths.

Unsupported:

- The runtime cannot read arbitrary host files outside mounted paths.
- Browser-selected host folders are not a reliable source of container tool paths.

Future:

- Desktop/local companion could map host paths to workspace/repository paths after consent.
- Hosted deployments should use repository clones, uploads, or managed workspaces instead of host
  files.

User-facing copy:

> I can access files in the configured workspace. Files outside that workspace need to be uploaded,
> mounted, or opened through a future host bridge.

### Desktop Plugins And Applications

Today:

- Provider APIs and MCP servers can expose tool capabilities when configured.
- Desktop app plugins are not automatically visible to the container.

Unsupported:

- The runtime cannot directly inspect or control arbitrary desktop applications.
- Docker MCP gateway or local MCP tools may fail if the required daemon/socket is not available
  inside the container.

Future:

- Desktop companion, IDE extension, or explicit MCP profile can expose selected plugin capabilities.

User-facing copy:

> This tool is not available from the current runtime. Connect a supported provider, MCP server, or
> future desktop bridge to expose it.

## Security Requirements For Host Bridges

Any future host bridge must be treated as a privileged integration.

Minimum requirements:

- explicit user pairing and revocation
- allowlisted capabilities rather than broad host access
- per-action approval for sensitive reads, writes, app launches, or terminal access
- clear display of target path, URL, app, command, or provider
- audit log with trace ids and decision state
- path normalization and jail checks before exposing files
- redaction of secrets, tokens, environment variables, and credential files
- bounded payload sizes for terminal output and diagnostics
- deployment-mode detection so hosted web never implies local host access
- safe failure modes when the bridge is disconnected or stale

The bridge should never be a backdoor around PathJail, human-in-the-loop approval, or provider
authentication.

## Product Copy Guidance

Use precise capability language:

| Avoid saying                              | Prefer saying                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| "I can open your IDE."                    | "This deployment cannot open your desktop IDE directly."                          |
| "I can read your files."                  | "I can read files in the configured workspace."                                   |
| "Open localhost."                         | "Open `localhost` in your host browser, or `web:3001` from tools."                |
| "Connect your plugins."                   | "Connect a supported provider, MCP server, or future bridge."                     |
| "The agent can see your IDE diagnostics." | "Diagnostics are available only when exposed by a configured provider or bridge." |
| "This will work remotely."                | "Hosted deployments use managed workspaces, not host bind mounts."                |

Unsupported states should include:

- what was attempted
- why the current deployment cannot do it
- what is available instead
- whether a future bridge/provider could support it

## Direction For V1

For the web-first v1:

- keep Docker for local repeatability, CLI/runtime consistency, and sandboxing
- model work around managed workspaces, artifacts, provider APIs, and repository context
- do not make host IDE or desktop app access a core requirement
- add a practical internal code workbench baseline for chat-driven code review and small edits
- use branch/diff/status views for review instead of relying on host Git UI
- treat external IDE/browser handoff as optional and deployment-specific

For hosted deployments:

- avoid bind-mount assumptions
- prefer repository clone/import flows and managed sandboxes
- use provider APIs for GitHub, CodeQL, SonarQube, reviews, and CI feedback
- make local host integrations unavailable unless a trusted companion is paired

For a future desktop product:

- Electron or a local companion is the likely path for high-quality host integration
- the desktop layer should still call into the same platform concepts: workspace, artifacts, checks,
  approvals, and audit

## Relationship To Follow-Up Work

- `agent-platform-code-workbench` or equivalent should implement the practical code workbench
  baseline: proper editor engine, open files from chat, active file context, and diff review.
- `agent-platform-branch-feedback-status` should implement branch/provider feedback without relying
  on host IDE access.
- Future desktop/host bridge work should be separate from the web-first operator experience so the
  hosted product remains viable.
