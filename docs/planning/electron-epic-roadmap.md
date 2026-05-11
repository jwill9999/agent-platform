# Electron Redesign Epic Roadmap

## Purpose

This roadmap proposes the order of epics for the Electron desktop redesign before creating Beads issues and task specs.

It is intentionally high-level. Once the epic sequence is accepted, each epic should get:

- a Beads epic,
- `docs/tasks/<epic-id>.md`,
- child task Beads issues,
- one spec file per child task,
- explicit dependencies,
- local and production-like test strategy,
- definition of done.

## Research Inputs

This roadmap is based on:

- [ADR-0002: Electron desktop runtime for local Project access](../adr/0002-electron-desktop-runtime.md)
- [Electron desktop runtime high-level spec](electron-desktop-runtime.md)
- Existing Project epics:
  - [Project workspaces](../tasks/agent-platform-project-workspaces.md)
  - [Project onboarding](../tasks/agent-platform-project-onboarding.md)
  - [Project experience](../tasks/agent-platform-project-experience.md)
- Existing workspace/security/tooling epics:
  - [Host workspace storage](../tasks/agent-platform-ws.md)
  - [Coding tools](../tasks/agent-platform-code-tools.md)
  - [Feedback sensors](../tasks/agent-platform-feedback-sensors.md)

External implementation guidance to use during task planning:

- Electron security checklist: <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron sandboxing model: <https://www.electronjs.org/docs/latest/tutorial/sandbox>
- Electron app data paths: <https://www.electronjs.org/docs/latest/api/app>
- Electron Forge build lifecycle: <https://www.electronforge.io/core-concepts/build-lifecycle>
- Electron Forge makers: <https://www.electronforge.io/config/makers>

## Sequencing Principles

1. Do not build more Project onboarding UX on top of browser-only folder access.
2. Prove the desktop runtime can launch before migrating product workflows.
3. Prove backend-bound native Project opening before resuming `/init` and `AGENTS.md` lifecycle work.
4. Keep data/security boundaries ahead of broad agent capability.
5. Add production-like Electron E2E before calling desktop features done.
6. Keep macOS first, but preserve platform seams for Windows and Linux.

## Proposed Epic Order

### Epic 0: Park And Extract Current Onboarding Work

**Goal:** Preserve useful work from `agent-platform-project-onboarding.8` without merging the broken Project-opening contract.

This is a short transition epic or task group before the Electron work begins.

Scope:

- Review the current onboarding branch/PR.
- Identify architecture-neutral work to extract.
- Park browser-only/manual-path Project opener work.
- Keep slash command parser/registry/runner pieces if cleanly separable.
- Keep `/help` and slash command dispatch tests if they do not depend on the wrong opener.
- Update existing Project onboarding specs to depend on Electron Project access.

Why first:

- Prevents accidental merge of known-wrong UX.
- Salvages useful investment.
- Makes the rest of the roadmap start from a clean baseline.

Likely child tasks:

1. Audit current `agent-platform-project-onboarding.8` diff.
2. Extract slash command infrastructure and tests.
3. Revert or park browser-only/manual-path Project opener changes.
4. Update onboarding/experience specs to depend on Electron Project access.

Definition of done:

- No browser-only/manual-path Project opening behavior is merged as the product path.
- Extracted work has focused unit/integration tests.
- Project onboarding Bead remains open or explicitly re-scoped.
- Docs state which work was parked.

### Epic 1: Electron Runtime Foundation

**Goal:** Create the macOS-first Electron shell and prove it can launch the built renderer and local backend.

Scope:

- Add `apps/desktop` or equivalent Electron package.
- Decide Electron Forge vs alternative packaging tool.
- Build React renderer for Electron.
- Start/supervise local backend from Electron main.
- Establish app runtime config.
- Use OS app data path for local runtime state.
- Keep Docker development workflow intact.

Why second:

- Everything else depends on having a desktop runtime boundary.
- Backend supervision must exist before native Project opening can bind to the API.

Likely child tasks:

1. Scaffold Electron desktop app.
2. Build renderer for desktop runtime.
3. Backend supervisor spike.
4. App data path/runtime config spike.
5. Development workflow docs for desktop vs Docker.

Definition of done:

- macOS Electron app launches locally.
- Built renderer loads without dev server assumptions.
- Backend starts, reports readiness, logs somewhere discoverable, and stops on app quit.
- SQLite path can be configured under app data, even if full migration lands later.
- Docker dev workflow still works.

### Epic 2: Desktop Security, Data, And Lifecycle

**Goal:** Lock down the Electron app boundary and define local data/secrets lifecycle before broad Project access.

Scope:

- Secure `BrowserWindow` defaults.
- Preload bridge contract.
- IPC validation.
- Content Security Policy.
- Secret storage strategy.
- SQLite/app data migration plan.
- Local data deletion flow.
- Logs/cache cleanup policy.

Why third:

- Native Project access and agent execution increase risk.
- Broad desktop APIs should wait until the bridge and data boundaries are designed.

Likely child tasks:

1. Electron security hardening checklist.
2. Preload bridge contract and validation.
3. SQLite app data migration.
4. Secure secret storage spike.
5. Delete local app data and credentials flow.
6. Data lifecycle tests.

Definition of done:

- Renderer has no generic Node/filesystem/shell access.
- Preload exposes only named, typed APIs.
- App data path is used for SQLite/config/logs.
- Credentials are protected or a safe fallback is explicitly implemented.
- Users can delete local app data and credentials.
- User Project folders are not deleted by data cleanup.

### Epic 3: Native Project Access And Session Binding

**Goal:** Replace browser-only Project opening with native folder selection that creates a backend-bound Project.

Scope:

- Electron native folder picker.
- Recent Project registry.
- Backend Project open/register from trusted local path.
- Project-bound session creation.
- File tree reads from backend-bound Project.
- UI shows Project names and relative paths only.
- Web-only fallback posture.

Why fourth:

- This directly resolves the blocker.
- `/init`, Project onboarding, and Project experience all depend on it.

Likely child tasks:

1. Native folder picker bridge.
2. Backend Project registration for desktop paths.
3. Project-bound session creation.
4. Recent Projects list/reopen.
5. Backend-backed file tree/read APIs for desktop Projects.
6. Web-only fallback UI.
7. Electron E2E for Project open to session binding.

Definition of done:

- User can click Open Project and select a local folder.
- Backend receives a real host path through the trusted desktop bridge.
- Session has `projectId`.
- `/help` works in the Project session.
- UI does not show `/workspace` or host absolute paths by default.
- Electron E2E proves Project open and session binding in a built desktop runtime.

### Epic 4: Command Runner And Sandbox Policy

**Goal:** Make local tool/command execution safe enough for user Projects and extensible for stronger sandboxing later.

Scope:

- Swappable `CommandRunner` interface.
- Project-root PathJail for host backend.
- Approval policy for writes and commands.
- Deny rules for destructive or outside-root operations.
- Audit events.
- Temporary directory/network policy.
- Research stronger future runner options.

Why fifth:

- Project opening can exist before command execution.
- Agent writes/tests/scripts should not be enabled until command safety is designed.

Likely child tasks:

1. Command execution threat model.
2. `CommandRunner` interface.
3. Host runner with Project-root PathJail.
4. Approval and audit integration.
5. Deny/destructive command policy.
6. Sandbox regression tests.
7. Future runner research note.

Definition of done:

- Commands default to the active Project root.
- Outside-root reads/writes are denied.
- Destructive commands require approval or are blocked.
- Tool audit shows allowed/denied operations.
- Runner interface can later support Docker, VM, or remote sandbox without rewriting chat/harness APIs.

### Epic 5: Desktop Project Onboarding And `/init`

**Goal:** Resume Project onboarding on the correct desktop Project foundation.

Scope:

- Reintegrate extracted slash command infrastructure.
- `/init` starts or resumes onboarding only for backend-bound Projects.
- `AGENTS.md` lifecycle uses selected Project root.
- Approval flow writes to the selected Project only.
- Instruction update/refresh flows continue to work.
- User-facing copy stays generic and hides runtime details.

Why sixth:

- Depends on backend-bound Project sessions.
- Depends on write/sandbox policy if `/init` or approval writes files.

Likely child tasks:

1. Rebase/extract slash infrastructure.
2. `/init` desktop Project context integration.
3. `AGENTS.md` draft/review/write path for native Projects.
4. Refresh/rescan and update candidates.
5. Project onboarding UI cleanup.
6. Electron E2E for Open Project to `/init` to review to approval.

Definition of done:

- `/init` does not run without a backend-bound Project.
- `/init` works after Electron Project open.
- Approved instructions write to the selected Project root only.
- User can review before writes are enabled.
- E2E runs against built Electron runtime.

### Epic 6: Desktop Project Experience

**Goal:** Deliver the chat-first Project experience on top of the desktop runtime.

Scope:

- Project list in left explorer.
- Recent/reopen Projects.
- Project chat as default surface.
- Optional IDE handoff.
- Breadcrumbs/location affordance.
- Generic Project profiles beyond coding.
- Clean labels hiding implementation details.

Why seventh:

- Project experience depends on a stable Project model.
- It should reuse onboarding state rather than defining new Project semantics.

Likely child tasks:

1. Desktop Project navigation model.
2. Recent Projects in left explorer.
3. Project chat as default entry.
4. Open IDE from Project chat.
5. Breadcrumbs/return navigation.
6. Project profile/capability labels.
7. Electron E2E for navigation and reopen.

Definition of done:

- Users can reopen previous Projects.
- Opening a Project lands in chat by default.
- IDE preserves Project/session context.
- UI does not scatter CTAs or expose implementation paths/states.
- Electron E2E covers Project reopen, Project chat, and IDE handoff.

### Epic 7: macOS Packaging, Release, And Update Readiness

**Goal:** Make the desktop app distributable for the owner/internal users first, then GitHub users.

Scope:

- macOS packaging.
- Release artifact shape.
- GitHub Releases workflow.
- Checksums.
- Signing/notarization plan.
- Auto-update research, likely deferred.
- Production-like packaging smoke tests.

Why last in the first sequence:

- Packaging depends on runtime, data, backend, and Project flows being stable enough to ship.
- Early local builds can happen before this, but public release should wait.

Likely child tasks:

1. macOS packaging tool decision.
2. Local `.app`, `.zip`, or `.dmg` build.
3. GitHub release artifact workflow.
4. Checksums and release notes.
5. Signing/notarization research.
6. Packaged-app smoke tests.

Definition of done:

- macOS artifact can be built from CI or documented local release process.
- Artifact launches without dev servers.
- Packaged app can open a Project and run `/help`.
- Release process is documented.
- Signing/notarization decision is recorded, even if deferred.

## Recommended Dependency Graph

```text
Epic 0: Park/extract current onboarding work
  -> Epic 1: Electron runtime foundation
  -> Epic 2: Desktop security/data/lifecycle
  -> Epic 3: Native Project access/session binding
  -> Epic 4: Command runner/sandbox policy
  -> Epic 5: Desktop Project onboarding and /init
  -> Epic 6: Desktop Project experience
  -> Epic 7: macOS packaging/release readiness
```

Some research can run in parallel:

- Command sandbox research can start during Epic 1 or 2.
- Secure storage research can start during Epic 1.
- Packaging research can start early, but packaging implementation should land after the runtime shape stabilizes.

## Existing Epics To Reframe

### Project onboarding

Status:

- Keep open or re-scope.
- Do not continue Project-opening work until Epic 3 exists.
- Reuse only architecture-neutral slash/onboarding work.

Future dependency:

- Depends on Epic 3 and relevant parts of Epic 4.

### Project experience

Status:

- Keep as future product UX epic.
- Rebase assumptions on Electron Project model.

Future dependency:

- Depends on Epic 3.
- Most useful after Epic 5 has restored `/init`/onboarding.

### Workspace storage

Status:

- Remains useful for Docker/dev/managed files.
- No longer the main user-facing arbitrary Project access model for desktop.

Future dependency:

- Inform PathJail and cleanup patterns.
- Do not expose `/workspace` as primary desktop UI copy.

## Decisions Needed Before Creating Beads Issues

1. Accept, amend, or reorder this epic sequence.
2. Decide whether Epic 0 is one cleanup task or a short epic.
3. Choose stable Beads IDs.
4. Decide whether Electron runtime work should supersede existing Project onboarding/experience dependencies.
5. Decide whether command sandbox research should be its own first epic or part of Epic 4.
6. Decide how much packaging research is needed before Epic 1 starts.

## First Beads Creation Recommendation

Create one parent epic:

- `agent-platform-electron-runtime`

Then create ordered child epics or tasks depending on preferred granularity.

Recommended near-term Beads items:

1. `agent-platform-electron-runtime.0` - Park and extract current onboarding work.
2. `agent-platform-electron-runtime.1` - Scaffold macOS Electron runtime foundation.
3. `agent-platform-electron-runtime.2` - Define desktop security, data, and lifecycle.
4. `agent-platform-electron-runtime.3` - Implement native Project access and session binding.
5. `agent-platform-electron-runtime.4` - Define command runner and sandbox policy.

After those are accepted, continue with:

6. `agent-platform-electron-runtime.5` - Restore desktop Project onboarding and `/init`.
7. `agent-platform-electron-runtime.6` - Implement desktop Project experience.
8. `agent-platform-electron-runtime.7` - Package macOS release artifact.

This keeps the first Beads wave focused on the architectural blocker and delays broader UX polish until the foundation is proven.
