# Electron Development Workflow

## Purpose

This document defines how to develop and verify Electron desktop work in this repository.

It separates three concerns that should not be confused:

- Docker/web development for normal API, web, and browser E2E work.
- Electron development for desktop-native behavior.
- The final desktop product runtime for end users.

## Runtime Model

### Standard Development Runtime

Use the Docker/web stack for normal service and browser development.

This is the right runtime for:

- API route work,
- shared contract work,
- database and migration work,
- harness/model routing work,
- web UI work that does not depend on native desktop APIs,
- browser Playwright tests,
- CI parity with the existing Docker jobs.

Commands:

```bash
make up
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm docs:lint
pnpm format:check
```

Docker remains the default developer runtime for API/web feedback and CI. It is not the intended
end-user runtime for the downloadable desktop app.

### Electron Development Runtime

Use Electron whenever the behavior depends on the desktop shell.

Electron is required for:

- native operating-system folder selection,
- host Project folder access,
- Project registration through the desktop bridge,
- Recent Projects based on local desktop metadata,
- app data/log/temp path resolution,
- local backend supervision,
- secure preload bridge behavior,
- Project chat to IDE handoff in the desktop shell,
- Electron desktop E2E,
- packaging and release smoke tests.

Commands:

```bash
pnpm --filter @agent-platform/desktop run start:renderer
pnpm --filter @agent-platform/desktop run start:dev-renderer
pnpm --filter @agent-platform/desktop run test:e2e
pnpm --filter @agent-platform/desktop run smoke
pnpm --filter @agent-platform/desktop run smoke:renderer
pnpm --filter @agent-platform/desktop run smoke:backend
```

Use `start:renderer` for the most production-like manual desktop pass because it builds the web
renderer and launches Electron against the standalone renderer.

Use `start:dev-renderer` only when actively iterating on UI and running a separate web dev server.

### Desktop Product Runtime

The intended end-user runtime is a single desktop application.

End users must not be expected to:

- run Docker,
- start a separate API server,
- start a separate web server,
- type an absolute host path to open a Project,
- understand Docker mount paths such as `/workspace`,
- copy Projects into an app-managed folder.

The desktop app should:

- launch its own local backend or supervise it,
- store app data under OS app data paths,
- use the native folder picker for Projects,
- keep user Project folders in their original host locations,
- show user-facing Project names and relative paths,
- hide implementation paths, hashes, and internal runtime states from normal UI.

The current development workflow may still require explicit commands while packaging and release
work is incomplete. That is a developer-only constraint, not acceptable product behavior.

## Choosing The Right Workflow

| Work type                              | Use Docker/web | Use Electron |
| -------------------------------------- | -------------- | ------------ |
| API route behavior                     | Yes            | No           |
| Shared contracts                       | Yes            | No           |
| Database persistence                   | Yes            | Sometimes    |
| General web UI layout                  | Yes            | Sometimes    |
| Browser Playwright tests               | Yes            | No           |
| Native Open Project picker             | No             | Yes          |
| Host Project folder access             | No             | Yes          |
| Recent Projects desktop metadata       | No             | Yes          |
| Project chat as desktop entry          | Sometimes      | Yes          |
| Slash commands with desktop Project    | Sometimes      | Yes          |
| IDE handoff from desktop Project chat  | Sometimes      | Yes          |
| App data/log/temp paths                | No             | Yes          |
| Backend supervision from desktop app   | No             | Yes          |
| Packaging, smoke, release verification | No             | Yes          |

If a task changes Project opening, Project context, `/init`, Recent Projects, desktop app data,
backend supervision, or the IDE handoff path, Electron verification is mandatory.

## Recommended Developer Flows

### Fast API/Web Feedback

Use this while changing ordinary API/web behavior:

```bash
make up
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

This does not prove desktop-native behavior.

### Electron UI Iteration

Use this while changing desktop UI flows and wanting fast renderer reloads:

```bash
make web
pnpm --filter @agent-platform/desktop run start:dev-renderer
```

This is useful during development, but it is not the final closeout gate because the renderer is
served by the dev server.

### Production-Like Electron Manual Pass

Use this before closing Electron user-experience tasks:

```bash
pnpm --filter @agent-platform/desktop run start:renderer
```

Then manually exercise the relevant desktop flow:

- launch app,
- open Project through native picker,
- confirm Project chat opens first,
- run `/help`,
- run `/help init`,
- run `/init` where applicable,
- open IDE,
- open a file,
- return to Project chat,
- reopen a previous Project from Recent Projects.

### Electron E2E

Use this before closing Electron tasks that affect desktop behavior:

```bash
pnpm --filter @agent-platform/desktop run test:e2e
```

This command builds the backend, renderer, and Electron main/preload code before running the desktop
Playwright suite.

## Closeout Rules For Electron Work

An Electron task is not done until the verification level matches the behavior changed.

Minimum documentation-only closeout:

```bash
pnpm docs:lint
git diff --check
```

Minimum code closeout:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm docs:lint
pnpm format:check
git diff --check
```

Desktop behavior closeout:

```bash
pnpm --filter @agent-platform/desktop run test:e2e
```

Add browser E2E when the same change affects browser/web behavior:

```bash
pnpm test:e2e
```

PR closeout still requires remote GitHub checks to pass and actionable review comments to be
resolved.

## What Browser Tests Cannot Prove

Browser-only Playwright tests cannot prove:

- the native folder picker opens,
- the selected host folder is visible to the backend,
- Electron IPC validates payloads correctly,
- app data paths resolve to OS app data,
- backend supervision starts the local API,
- packaged desktop startup works,
- the desktop preload bridge exposes only approved APIs.

Those paths require Electron tests or manual Electron verification.

## Current Stabilisation Rule

During the Electron stabilisation phase, use
`feature/agent-platform-electron-stabilisation` as the integration branch.

Do not merge stacked Electron/Project work directly into `main` while regressions are being
triaged. Fix forward from the staging branch, verify with Electron manual QA and E2E, then open a
single final merge path to `main` when stable.

## End-User Expectation

The final desktop release should feel like an ordinary app:

1. Install the app.
2. Open the app.
3. Configure model/provider settings.
4. Click **Open Project**.
5. Pick a folder with the OS picker.
6. Chat with the agent.
7. Open the IDE only when desired.

Any setup that asks a normal user to run Docker, start services, or type host paths is a temporary
developer workflow and should be treated as unfinished product work.
