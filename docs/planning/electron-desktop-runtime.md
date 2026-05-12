# Electron Desktop Runtime High-Level Spec

## Purpose

This spec captures the current redesign direction before breaking the work into Beads epics and tasks.

The goal is to move from a browser/Docker-first local Project flow to a downloadable desktop application that can safely open arbitrary local folders and bind them to the backend/harness.

Proposed epic sequencing lives in [Electron redesign epic roadmap](electron-epic-roadmap.md).

## Product Goal

Users should be able to:

1. Download and install the app.
2. Open the app.
3. Configure model providers and agents.
4. Click **Open Project**.
5. Select a local folder using the operating system picker.
6. Chat with the agent in a Project-bound session.
7. Run `/init` to create or update Project instructions.
8. Let the agent inspect, edit, test, and explain files within that Project, subject to permissions and sandbox policy.

Normal users should not need to:

- install or run Docker,
- type filesystem paths,
- understand `/workspace`,
- start a web server,
- manage backend processes,
- distinguish browser-only file handles from backend-visible Projects.

## Current Implementation Assessment

The current implementation has useful pieces:

- React/Next UI and IDE/chat surfaces.
- Express API and clean architecture.
- Shared contracts.
- Harness, model routing, tools, and slash command infrastructure.
- SQLite persistence.
- Docker development/runtime workflow.
- Project records, session binding, and onboarding state.
- Playwright tests for web/API flows.

The current implementation also has a critical blocker:

- A browser-selected folder can be visible to the frontend while the backend cannot inspect it.
- Slash commands such as `/init` require backend Project context.
- Docker can only access mounted folders.
- Requiring manual path entry is not acceptable UX.
- Showing Project-open UI without backend binding creates false success states.

Therefore, Project opening and onboarding should not continue to build on browser-only folder access.

## Key Decisions

### 1. Electron is the desktop product runtime

Electron is the application shell for local Project work.

It provides:

- native folder picker,
- OS app lifecycle,
- local backend supervision,
- secure preload bridge,
- local app data paths,
- future packaging and update path.

### 2. Backend runs locally on the host for desktop use

The desktop app should start or supervise the backend locally.

The backend should not require user-managed Docker for normal use.

Docker remains valid for:

- developer runtime,
- CI,
- integration testing where useful,
- optional future sandbox workers.

### 3. Model inference remains cloud-provider based

Users create agents and attach model configurations.

The local backend calls cloud model providers such as OpenAI and Anthropic. The desktop app does not need to ship local model inference.

### 4. SQLite remains the default local data store

SQLite remains appropriate for a single-user local desktop app.

The SQLite file should move from container data paths to the OS app data directory.

Examples:

- macOS: `~/Library/Application Support/<App Name>/`
- Windows: `%APPDATA%/<App Name>/`
- Linux: `~/.config/<App Name>/`

Electron should use `app.getPath('userData')` or an equivalent platform abstraction.

The Electron foundation now resolves desktop runtime paths through Electron's OS path
abstraction rather than defaulting to repository-relative storage:

- app data/config/data: `app.getPath('userData')`,
- logs: `app.getPath('logs')`,
- temp/runtime scratch: `app.getPath('temp')`.

Explicit environment overrides remain available for development and tests, but the
desktop default must be OS app data rather than Docker volumes or repository paths.

### 5. Secrets require protected storage

API keys and tokens should not be stored as plain text in Project folders.

Preferred direction:

- OS secure storage where available.
- Encrypted SQLite fallback if needed.
- Existing secret storage can be adapted, but the desktop spec should explicitly define the storage boundary.

### 6. Renderer stays sandboxed

The renderer remains a UI surface.

Required principles:

- `nodeIntegration: false`
- `contextIsolation: true`
- sandboxed renderer
- narrow preload bridge
- no generic filesystem or shell API exposed to the renderer

### 7. Agent execution still needs sandboxing

Electron solves Project path access. It does not solve code execution safety.

The first implementation should include:

- Project-root PathJail,
- explicit approval for writes and commands,
- command audit logs,
- denial for outside-Project access,
- swappable command runner abstraction.

Future runners may use stronger sandboxing such as disposable containers, platform sandboxing, or remote execution.

### 8. macOS is the first release target

Initial delivery is macOS-first.

The implementation should keep platform boundaries explicit so Windows and Linux support can be added later.

### 9. Current Project onboarding branch is not merged wholesale

The current Project onboarding branch contains useful work, but the Project-opening behavior is tied to an architecture we are replacing.

Decision:

- Park the current branch and PR as reference.
- Do not merge the browser-only/manual-path Project opener into `main` as the product path.
- Extract architecture-neutral pieces into smaller follow-up work where useful.

Likely extract candidates:

- slash command parser, registry, and runner boundaries,
- `/help` command,
- `/init` command contract shape,
- slash command dispatch before model execution,
- shared onboarding workflow pieces that do not assume browser-only Project opening,
- command parsing/help tests,
- user-facing copy lessons.

Likely park or redesign:

- browser-only Project opener,
- manual path entry as the primary user flow,
- hidden frontend-only Project context for slash commands,
- E2E tests that lock in the wrong Project-opening behavior,
- UI states that imply a Project is backend-bound when it is only visible to the renderer.

### 10. App data removal is required

The desktop product must provide a supported way to remove locally stored app data.

Normal operating-system uninstall behavior may remove the app binary but leave app data behind. That can be acceptable as a default desktop convention, but users must have a clear way to remove local data and credentials.

The data removal flow should delete:

- SQLite database,
- app logs,
- cached files,
- local memory,
- recent Project metadata,
- non-secret settings,
- encrypted secret fallback data if used,
- credentials stored in OS secure storage where possible.

The data removal flow must not delete user-owned Project folders by default.

User Project folders are outside the app data boundary. They should only be deleted if the user explicitly chooses a separate destructive action for those files.

## Proposed Runtime Architecture

```text
Electron main process
  - owns app lifecycle
  - opens native folder picker
  - starts and supervises local backend
  - exposes narrow IPC handlers
  - manages app data path

Electron preload bridge
  - exposes safe desktop APIs to renderer
  - hides IPC implementation details

React renderer
  - existing UI adapted for desktop
  - no direct Node/filesystem/shell access
  - calls backend and desktop bridge

Local backend/API
  - Express/API application
  - SQLite app data
  - Project records
  - sessions/messages
  - harness/tools
  - model provider calls
  - Project-root PathJail

Cloud providers
  - OpenAI
  - Anthropic
  - later provider integrations
```

## Project Open Flow

```text
User clicks Open Project
  -> renderer calls desktop bridge
  -> preload invokes Electron main
  -> main opens native folder picker
  -> user selects folder
  -> main receives host path
  -> main calls backend /v1/projects/open
  -> backend validates folder and creates/updates Project record
  -> renderer receives Project record
  -> renderer creates Project-bound chat session
  -> /init can now run with Project context
```

## User-Facing UI Rules

Show:

- Project name,
- relative paths,
- recent Projects,
- clear setup/onboarding actions,
- Project profile/capability where useful,
- user-actionable errors.

Avoid showing as primary copy:

- `/workspace`,
- container paths,
- backend root,
- repository root,
- internal onboarding state enums,
- hashes,
- implementation diagnostics such as "backend accessible".

Internal details belong in logs, observability, diagnostics, or advanced developer panels.

## Data Layer

SQLite should store:

- agents,
- model configurations excluding raw secrets,
- sessions,
- messages,
- Project records,
- recent Projects,
- onboarding state,
- local memory,
- tool and skill configuration,
- audit and observability metadata where appropriate.

Secure storage should store:

- OpenAI API keys,
- Anthropic API keys,
- GitHub tokens,
- future provider credentials.

Project folders should store only user-approved Project files, such as `AGENTS.md`, and never app secrets.

## Developer Runtime vs Desktop Runtime

### Developer runtime

Can continue to use:

- Docker,
- `make up`,
- local Next dev server,
- local API dev mode,
- fast unit and integration tests.

This is for contributors and CI support, not normal users.

### Desktop runtime

Must use:

- built renderer, currently loaded through the Next.js standalone server on a local loopback port rather than the normal web dev server,
- built local backend, currently supervised from Electron main as a child Node process in the development spike,
- Electron shell,
- OS app data,
- native Project picker,
- backend-bound Project sessions.

Desktop features are not complete until tested against this production-like path.

## Testing Policy

For desktop features, dev-server Playwright is not enough.

Required layers:

1. Unit tests for contracts, path policy, storage helpers, and slash commands.
2. API integration tests for Project open, session binding, `/init`, and PathJail behavior.
3. Renderer tests for UI states and bridge interactions.
4. Electron E2E tests against a built desktop runtime.
5. Production-like test gate: build first, then run end-to-end tests.

Initial macOS E2E coverage should prove:

- app launches,
- backend starts,
- native Project open can be mocked or exercised with a temp folder,
- Project record is created,
- session receives `projectId`,
- `/help` works,
- `/init` starts Project setup,
- file tree and relative paths render,
- user-facing UI hides runtime implementation details.

## Release Strategy

### For current owner/internal use

- Build macOS app locally.
- Use unsigned/internal artifact initially.
- Validate folder open, `/init`, file reads/writes, and app data persistence.

### For GitHub users

- Publish GitHub Releases.
- Attach macOS artifacts first.
- Add checksums.
- Add signing/notarization when ready.
- Add Windows and Linux release jobs later.
- Add auto-update after the release process is stable.

Expected future artifacts:

- macOS: `.dmg` or `.zip`
- Windows: `.exe` installer
- Linux: `.AppImage`, `.deb`, or `.rpm`

## Migration Areas

The redesign should audit and update:

- `/workspace` assumptions,
- Docker-only runtime assumptions,
- `/data/agent.sqlite`,
- browser File System Access as a primary Project opener,
- Project metadata names such as `backendProjectRoot`,
- terminal working directory behavior,
- file tree loading and file save APIs,
- onboarding copy and internal-state leakage,
- Playwright tests that assume browser-only or Docker-mounted Projects,
- docs and setup instructions.

## Candidate Beads Breakdown

Potential epic:

- `agent-platform-electron-runtime`: Electron desktop runtime and local Project access.

Candidate tasks:

1. ADR and spec for Electron desktop runtime.
2. Runtime audit for Docker, `/workspace`, and browser-only file assumptions.
3. Electron shell scaffold for macOS.
4. Backend supervisor spike.
5. App data and SQLite path migration.
6. Secure secrets storage strategy.
7. Native Project picker and Project registration bridge.
8. Project-bound session and `/init` desktop flow.
9. Renderer UI cleanup for desktop Project opening.
10. Command runner and sandbox policy design.
11. macOS production-like Electron E2E smoke tests.
12. GitHub release packaging spike for macOS.
13. Data deletion and uninstall lifecycle.
14. Extract architecture-neutral slash command/onboarding work from the parked branch.

Likely dependency changes:

- Project onboarding implementation should depend on backend-bound desktop Project opening.
- Project experience and navigation should depend on the desktop Project model.
- Browser-only Project open work should be paused or reframed as web/demo mode.

## Research Needed

These areas need implementation research before detailed tasks are finalized.

### Command execution sandboxing

We need to decide the first safe runner for commands, tests, package installs, and generated code.

Research questions:

- What minimum sandbox is acceptable for macOS-first release?
- Can strict host execution with PathJail, command approval, deny rules, and audit logs be used for the first private/internal build?
- Which stronger runner should the interface anticipate: Docker, macOS sandbox-exec or app sandbox features, lightweight VM, remote runner, or another tool?
- How do we prevent shell commands from reading outside the selected Project root?
- How do we handle package manager scripts that legitimately need network access or temporary directories?
- What does the approval UI need to show before a command runs?

Output needed:

- Recommended first runner.
- Swappable `CommandRunner` interface.
- Threat model for command execution.
- Test cases for outside-root access, destructive commands, and approval-required operations.

### Electron security hardening

We need to confirm the secure Electron defaults and how they interact with our React app.

Research questions:

- Exact `BrowserWindow.webPreferences` for production.
- Preload bridge shape and allowed APIs.
- IPC validation strategy.
- Content Security Policy.
- How to prevent renderer code from gaining generic filesystem or shell access.
- How to safely expose backend status and Project APIs without exposing implementation internals.

Output needed:

- Electron security checklist.
- Preload API contract.
- Renderer/main process boundary tests.

### Backend packaging and supervision

We need to decide how Electron packages and runs the backend.

Research questions:

- Should the backend run as compiled JavaScript launched by Electron, or as a packaged binary?
- Should the packaged app bundle a Node runtime for the backend, or rebuild native dependencies for Electron's Node ABI?
- How do we choose and communicate the local API port?
- How do we handle startup failure, crash restart, shutdown, and stale processes?
- Where do backend logs live?
- How do we pass desktop runtime configuration without leaking it to the renderer?

Output needed:

- Backend supervisor design.
- Local runtime config contract.
- Logging and diagnostics location.

### SQLite and native dependency packaging

The current DB stack uses SQLite through native bindings. Packaging must be proven on macOS before we rely on it.

The foundation spike found that launching the API through Electron's `ELECTRON_RUN_AS_NODE`
path can fail when `better-sqlite3` was built for the development Node ABI rather than
Electron's Node ABI. During development, the backend supervisor uses the active Node
executable when available. Public packaging still needs an explicit decision between a
bundled Node runtime and Electron-native rebuild/signing of SQLite bindings.

Research questions:

- Does the existing SQLite dependency package cleanly in Electron on macOS?
- Are rebuild steps needed for Electron ABI compatibility?
- Where should migrations run from in a packaged app?
- How do we back up, migrate, and repair the local database?

Output needed:

- Packaging spike result.
- App data directory convention.
- Migration startup strategy.

### Secure secret storage

Provider keys must be stored safely for a downloadable app.

Research questions:

- Which library should abstract macOS Keychain first and Windows/Linux later?
- Do we keep encrypted SQLite fallback?
- How are secrets migrated from the current Docker/local dev setup?
- How do we export/import settings without leaking keys?

Output needed:

- Secret storage decision.
- API key lifecycle spec.
- Recovery/export behavior.

### Data deletion and uninstall behavior

We need to define how users remove local app data and credentials.

Research questions:

- What does the macOS installer/uninstaller path normally remove?
- Should the app expose `Settings > Data > Delete local app data` before relying on installer behavior?
- How do we delete SQLite, logs, cache, local memory, and recent Project metadata safely?
- How do we remove credentials from secure storage as part of an uninstall/reset flow?
- How do we avoid deleting user Project folders while still deleting Project metadata?
- How do we delete OS secure-storage credentials?
- How do we make it clear that Project folders are not deleted?

Output needed:

- Data lifecycle spec.
- Confirmation copy.
- Deletion implementation checklist.
- Tests proving user Project folders are preserved.

### macOS release pipeline

We need to decide the minimum public GitHub release path.

Research questions:

- Electron Forge or electron-builder?
- Which artifact for first macOS release: `.zip`, `.dmg`, or both?
- When do signing and notarization become mandatory for our audience?
- How do we produce checksums?
- What CI runner and credentials are needed?

Output needed:

- macOS packaging recommendation.
- GitHub Releases workflow outline.
- Signing/notarization plan.

### Production-like Electron E2E

Desktop features must be tested against the built app, not only a dev server.

Research questions:

- Which framework should launch and drive Electron E2E?
- How do we mock the native folder picker in repeatable tests?
- How do we create temporary Projects safely during tests?
- How do we collect screenshots, traces, logs, and app data artifacts in CI?

Output needed:

- Electron E2E test harness decision.
- First smoke-test spec.
- CI artifact policy.

### Web-only mode

We need to decide what remains available when running without Electron.

Research questions:

- Should browser-only Project opening be removed, disabled, or retained as demo/import mode?
- What UI copy appears in web-only mode?
- Which tests remain web Playwright tests versus Electron E2E tests?

Output needed:

- Web-only capability matrix.
- UI fallback rules.

## Open Questions For Retrospective

1. What is the app name and bundle identity for macOS packaging?
2. Should the backend be a child Node process or packaged binary?
3. Which secure storage library should be used?
4. What is the minimum acceptable sandbox for first macOS release?
5. Should web-only mode remain available, and if so, which features are disabled?
6. How should users review what context is sent to cloud model providers?
7. What release level is acceptable for early GitHub users: unsigned artifact, signed app, or signed and notarized app?
8. Which parts of `agent-platform-project-onboarding.8` should be extracted before parking the rest?

## Non-Goals For First Spike

- Windows/Linux packaging.
- Auto-update.
- Local model inference.
- Full IDE redesign.
- Strong disposable sandbox runner.
- Hosted multi-user sync.
- Public marketplace/plugin distribution.

## Definition Of Done For The Redesign Epic

- ADR accepted.
- Beads epic and child tasks created.
- Docker and `/workspace` assumptions audited.
- macOS Electron app can launch built UI and backend.
- Native Project picker binds a selected folder to backend Project state.
- `/init` works against the selected Project.
- SQLite persists in app data.
- Secrets storage direction is implemented or explicitly deferred with safe fallback.
- Electron E2E verifies the built desktop path.
- Existing web/Docker developer workflow remains usable for contributors.
