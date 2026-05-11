# ADR-0002: Electron desktop runtime for local Project access

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** Jason Williams (owner)
- **Related:**
  - Epic `agent-platform-project-onboarding`
  - Epic `agent-platform-project-experience`
  - Epic `agent-platform-ws`
  - Task `agent-platform-project-workspaces.3`
  - Task `agent-platform-project-onboarding.8`
  - Planning spec: [docs/planning/electron-desktop-runtime.md](../planning/electron-desktop-runtime.md)

## Context

The current web and Docker runtime cannot satisfy the core Product requirement for local Projects:

1. A user clicks **Open Project**.
2. The user chooses any local folder from the host operating system.
3. The app displays that Project using user-facing names and relative paths.
4. The backend and harness can inspect, edit, test, and run `/init` against the same selected folder.
5. The user does not need to know Docker, `/workspace`, backend paths, localhost ports, or absolute host paths.

The blocker is architectural, not a wording issue.

- Browser File System Access can let the renderer read a user-selected folder, but it does not provide a safe backend-usable host path.
- A Dockerized backend can inspect only folders mounted into the container.
- Requiring users to type absolute paths is not acceptable product UX.
- Copying arbitrary Projects into a container or managed workspace changes user expectations, creates write-back/sync risk, and can undermine trust.
- Browser-only folder handles can make the UI look like a Project is open while slash commands and harness tools still lack backend-bound Project context.

The existing Docker workspace model remains useful for development, CI, and managed workspaces, but it is not sufficient as the primary runtime for a downloadable desktop product that opens arbitrary local folders.

## Decision

We adopt Electron as the primary local desktop runtime for downloadable Project work.

For the desktop product:

- Electron is the user-facing application shell.
- Electron packages the React renderer and starts or supervises a local backend process.
- The backend runs on the host for normal desktop use, not inside a user-managed Docker container.
- Electron main owns native Project folder selection and passes trusted selected paths to the backend.
- The backend stores app data locally and binds sessions to backend-visible Project records.
- The renderer remains a sandboxed UI surface and does not get direct filesystem, shell, or Node access.
- Cloud model providers remain external: OpenAI, Anthropic, or later configured providers run model inference through API calls.
- Docker remains available for developer runtime, CI, and possible future sandbox runners, but is not required for normal desktop users.

The initial implementation target is macOS-first. The architecture should keep platform seams clear so Windows and Linux packaging can be added later.

The current Project onboarding implementation branch should not be merged wholesale while it contains Project-opening behavior based on browser-only folder handles or manual path entry as the normal user flow. That work is retained as reference. Architecture-neutral pieces, such as slash command infrastructure and tests, may be extracted into smaller follow-up tasks.

The desktop data lifecycle must include a supported local-data removal flow. Normal uninstall behavior may vary by operating system and installer, but the product must provide a clear way to delete local app data and credentials. This deletion must not remove user-owned Project folders unless the user explicitly chooses to delete those files.

### Alternatives considered

- **Continue with browser-only Project opening** - rejected because browser folder handles cannot reliably bind arbitrary local folders to the backend/harness.
- **Keep Docker as the normal user runtime and mount selected folders dynamically** - rejected for the first desktop product because it exposes too much runtime complexity and keeps host/container path mapping central to user-facing behavior.
- **Copy or sync Projects into managed workspace storage** - rejected as the default because users expect the app to work on the folder they selected, and wholesale copying creates security, trust, and write-back problems.
- **Manual path entry as the primary Project opener** - rejected because end users should not memorize or type local filesystem paths.
- **Cloud-host the harness for all Project work** - rejected for this product direction because local Project access and local tool execution are core requirements. Cloud model inference remains appropriate.

## Consequences

### Positive

- The product can offer a normal desktop flow: install app, open app, choose Project, work with the agent.
- The selected Project path is known to the trusted local runtime and backend, so `/init`, file tools, terminal behavior, and Project onboarding can share one context.
- Users do not need to install or operate Docker for normal use.
- Existing React UI, API, contracts, harness, and SQLite data model can be reused with a desktop runtime adapter.
- Docker can stay in the developer workflow without leaking into the product UX.
- The app can use OS-specific affordances such as native folder picker, app data directories, and secure credential storage.

### Negative / risks

- Packaging becomes more complex, especially native dependencies such as SQLite bindings.
- Public distribution requires release artifacts, signing, and eventually notarization/auto-update work.
- Electron main, preload, renderer, and backend process boundaries must be designed carefully.
- Host command execution is risky and still needs a sandbox strategy; Electron solves folder access, not agent safety.
- Current code and docs contain Docker and `/workspace` assumptions that must be audited and migrated.
- Electron end-to-end testing adds another test surface beyond web Playwright and API tests.
- macOS-first delivery may delay Windows and Linux support if platform seams are not kept explicit.

### Follow-up actions

- [ ] Create Beads epic for the Electron desktop runtime redesign.
- [ ] Audit Docker, `/workspace`, and browser-only file handle assumptions.
- [ ] Specify Electron main/preload/backend contracts.
- [ ] Build a macOS-first spike proving folder picker -> backend Project binding -> `/init`.
- [ ] Define app data, SQLite, and secret storage migration.
- [ ] Define swappable command runner and sandbox policy.
- [ ] Add production-like Electron E2E gates for desktop features.
- [ ] Update Project onboarding and Project experience epics to depend on the desktop runtime decision.
- [ ] Define app data deletion/uninstall behavior, including secure credential cleanup and explicit protection for user Project folders.
- [ ] Review the current Project onboarding branch and extract only architecture-neutral work.

## References

- Planning: [docs/planning/electron-desktop-runtime.md](../planning/electron-desktop-runtime.md)
- Existing Project specs:
  - [docs/tasks/agent-platform-project-workspaces.3.md](../tasks/agent-platform-project-workspaces.3.md)
  - [docs/tasks/agent-platform-project-onboarding.md](../tasks/agent-platform-project-onboarding.md)
  - [docs/tasks/agent-platform-project-experience.md](../tasks/agent-platform-project-experience.md)
  - [docs/tasks/agent-platform-ws.md](../tasks/agent-platform-ws.md)
- Existing architecture:
  - [docs/architecture.md](../architecture.md)
  - [docs/workspace-storage.md](../workspace-storage.md)
