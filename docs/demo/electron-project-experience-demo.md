# Electron Project Experience Demo

## Purpose

Use this demo to review the completed `agent-platform-electron-experience` epic before the owner
manual-test closeout.

The goal is to show that Project work now behaves like a desktop product:

- users open folders with the native operating-system picker,
- Projects open into chat first,
- previous Projects can be reopened from the left explorer,
- the IDE is available only when the user explicitly opens it,
- Project/session context survives chat, slash commands, IDE handoff, and return navigation,
- internal paths and runtime states are not exposed in the normal UI.

## What Changed

### 1. Project entry is desktop-native

The Product path is now **Open Project** from the Electron app.

Expected behavior:

- Clicking **Open Project** opens the native folder picker.
- The selected host folder is registered as a Project.
- The user lands in Project chat, not the IDE.
- The UI shows the Project name and folder name, not the absolute host path.
- Browser-only folder opening and manual absolute path entry are not the primary desktop flow.

### 2. Project chat is the default surface

Opening or reopening a Project lands in chat first.

Expected behavior:

- Header shows `Project / Chat`.
- The chat input says `Ask about this Project...`.
- The empty state asks what the user wants done in the Project.
- The user can talk to the agent before choosing to inspect files in the IDE.

### 3. The IDE is an explicit deeper view

Project chat has an **Open IDE** action.

Expected behavior:

- Clicking **Open IDE** moves to `/ide` with the selected Project and session context.
- The IDE explorer shows files from the selected Project.
- The IDE Project panel shows user-facing Project state.
- The IDE has return navigation back to Project chat.
- Returning to Project chat preserves the same Project/session context.

### 4. Recent Projects are available in the left explorer

The left explorer now shows recent desktop Projects.

Expected behavior:

- Recently opened Projects appear under **Recent Projects**.
- A previous Project can be reopened without selecting the folder again.
- Reopening one Project while another Project is active switches the active Project correctly.
- Unavailable Projects show a safe unavailable state.
- Absolute host paths are not displayed in the normal Recent Projects UI.

### 5. Slash commands use the same Project context as chat

Slash commands and ordinary Project chat now use the same active Project/session resolver.

Expected behavior:

- `/help` lists available slash commands.
- `/help init` explains `/init`, its usage, scope, and state-changing behavior.
- `/init` works as the first Project chat message after opening a Project.
- `/init` starts Project instructions setup for the selected Project.
- The IDE reflects Project setup state after slash-command actions.

### 6. Generic Projects are supported

Projects are not labelled as coding-only.

Expected behavior:

- Project profile/capability labels describe what was detected.
- The UI can represent code Projects, docs/content Projects, mixed Projects, and generic file Projects.
- The coding agent is one possible mode/profile inside a Project, not the definition of Project.

## Demo Setup

For the development/runtime split and closeout rules, see
[Electron Development Workflow](../development/electron-development-workflow.md).

### Prerequisites

From the repository root:

```bash
pnpm install
pnpm build
```

For normal Docker/web development:

```bash
make up
```

For Electron development and demo:

```bash
pnpm --filter @agent-platform/desktop run start:renderer
```

This builds:

- the web renderer as a standalone production build,
- the Electron main/preload code,
- then starts the Electron app.

For a dev-renderer workflow, run the web app separately and then start Electron against it:

```bash
make web
pnpm --filter @agent-platform/desktop run start:dev-renderer
```

For production-like Electron E2E:

```bash
pnpm --filter @agent-platform/desktop run test:e2e
```

## Demo Script

### Step 1: Launch Electron

Run:

```bash
pnpm --filter @agent-platform/desktop run start:renderer
```

Expected:

- Electron opens the Agent Platform shell.
- The left navigation shows Chat, IDE, and Recent Projects.
- No user-facing `/workspace` or backend/internal path is visible.

### Step 2: Open a Project

Click **Open Project**.

Expected:

- Native folder picker opens.
- Select a folder from the host system.
- App lands in Project chat.
- Header shows `Project / Chat`.
- Project name is visible.
- Chat input says `Ask about this Project...`.

### Step 3: Use slash-command help

In Project chat, send:

```text
/help
```

Expected:

- The assistant lists available slash commands.
- `/init` is included.

Then send:

```text
/help init
```

Expected:

- Help shows `Usage: /init`.
- Help shows `Scope: project`.
- Help indicates that `/init` may change Project state.

### Step 4: Run Project initialization

Send:

```text
/init
```

Expected:

- The assistant starts Project setup.
- A Project instructions draft is prepared.
- The Project state indicates setup is in progress.
- The user is asked to review/approve before file edits are enabled.

### Step 5: Open the IDE

Click **Open IDE**.

Expected:

- The IDE opens for the same Project.
- The Project binding panel shows the selected Project.
- The explorer shows the selected Project files.
- The absolute host folder path is not displayed as normal UI copy.
- The setup state from `/init` is visible.

### Step 6: Open a file

Click a file in the explorer.

Expected:

- File opens in the editor.
- Relative file path is shown.
- Host absolute path is not shown.
- Chat context can include the active file.

### Step 7: Return to Project chat

Use the Project/IDE breadcrumb or return link.

Expected:

- The app returns to Project chat.
- The same Project remains selected.
- The same Project session context is preserved.

### Step 8: Reopen from Recent Projects

Return to the main Workspaces screen or use the left explorer.

Open a second Project, then click the first Project under **Recent Projects**.

Expected:

- The active Project switches to the selected recent Project.
- The URL and UI agree on the active Project.
- Project chat is still the default entry surface.
- The IDE handoff still opens the selected recent Project, not the previously active Project.

## Developer Workflow Notes

### Docker remains useful for development

Docker remains the main repo development and browser E2E workflow:

```bash
make up
pnpm test:e2e
```

It is still useful for CI and service-level testing.

### Electron is the desktop runtime

Electron owns:

- native folder selection,
- host Project access,
- local desktop runtime paths,
- backend supervision,
- secure preload bridge,
- desktop E2E.

The end user should not need to run Docker or type absolute paths.

### Local app data

Electron runtime data should live under OS app data paths, not Project folders.

The app must not copy user Projects into app data as the normal Project-open behavior. Project folders
remain user-owned host folders.

### Security boundary

Electron gives host folder access. It does not make code execution safe by itself.

Project file access and command execution still need:

- Project-root PathJail,
- explicit write/command approvals,
- audit logs,
- command policy,
- future swappable sandbox runners.

## Verification Commands

Use these before closing or merging related Electron Project experience work:

```bash
pnpm --filter @agent-platform/desktop run test:e2e
pnpm lint
pnpm typecheck
pnpm test
pnpm docs:lint
pnpm format:check
git diff --check
```

CI/PR must also be green:

- `verify`
- `docker`
- browser `e2e`
- `desktop-e2e`
- `markdownlint`
- `lychee`
- GitGuardian
- SonarCloud
- no actionable review comments

## Manual-Test Closeout Checklist

- [ ] Open Project uses the native picker.
- [ ] Project opens into Project chat by default.
- [ ] Project chat shows Project name and user-facing labels.
- [ ] `/help` and `/help init` work.
- [ ] `/init` works as the first Project chat message.
- [ ] IDE opens the same Project/session from Project chat.
- [ ] IDE return navigation preserves Project/session context.
- [ ] Recent Projects can reopen a previous Project.
- [ ] Reopening a recent Project while another Project is active switches correctly.
- [ ] Normal UI does not expose `/workspace`, backend roots, internal hashes, or implementation states.
- [ ] User-owned Project folders are not copied into app data.

## Known Follow-Up Areas

- macOS packaging and release readiness live in `agent-platform-electron-release`.
- Stronger command/code-execution sandboxing remains a separate implementation concern.
- Secure storage and uninstall/local-data removal need release-quality validation.
- Windows and Linux support are future platform extensions after the macOS-first path.
