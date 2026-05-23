# Desktop Runtime

Agent Platform is moving toward a downloadable Electron desktop app for local Project work.
This page describes the current foundation workflow and the boundary between Docker development
and the desktop runtime.

## Current scope

The desktop runtime is macOS-first while the Electron foundation is being built. Windows and Linux
support should be added later through the same abstractions, not by hardcoding platform-specific
paths or shell behavior into product code.

The current desktop app is a development foundation, not a public packaged release. Packaging,
signing, notarization, auto-update, and installer cleanup are future release tasks.

## Runtime split

| Mode            | Owner                    | Use it for                                                                         |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| Docker runtime  | Docker Compose + Make    | Contributor development, CI, seeded demo data, browser Playwright E2E, API/web dev |
| Desktop runtime | Electron main process    | Native app shell, host folder access, local backend supervision, desktop app data  |
| Sandbox runtime | Future isolated executor | Running untrusted user commands/tests outside the Electron app and local app data  |

Docker remains the default contributor and CI workflow. The desktop runtime exists because a
browser plus Docker container cannot reliably pick arbitrary host folders or preserve the expected
native desktop user experience.

Electron solves native folder access and local app lifecycle. It does not by itself sandbox code
execution. Any future command/test execution against user Projects must still run behind a sandbox
boundary such as Docker, a VM, a macOS sandbox profile, or another approved runner.

## Docker development workflow

Use Docker when developing the API, web UI, harness, contracts, database, and normal browser E2E
flows:

```bash
make up
make restart
make reset
make logs
make status
```

Docker stores runtime data through the Compose mounts documented in
[Development Guide](development.md#workspace-storage):

- user workspace files are mounted at `/workspace` inside the API container,
- app/runtime data such as SQLite is mounted at `/data`,
- local development defaults use ignored repo-local `.agent-platform/` directories.

Docker paths are implementation details for the container runtime. They should not be shown as the
normal desktop user's Project location.

## Desktop workflow

Desktop commands run from the repo root through the `@agent-platform/desktop` package.

| Command                                                    | Purpose                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm --filter @agent-platform/desktop start`              | Build Electron main/preload and launch the shell                  |
| `pnpm --filter @agent-platform/desktop start:dev-renderer` | Launch Electron against the normal web dev server                 |
| `pnpm --filter @agent-platform/desktop start:renderer`     | Build the web renderer and launch Electron against standalone web |
| `pnpm --filter @agent-platform/desktop smoke`              | Compile and smoke-test the Electron shell                         |
| `pnpm --filter @agent-platform/desktop smoke:renderer`     | Smoke-test Electron with the built standalone renderer            |
| `pnpm --filter @agent-platform/desktop smoke:backend`      | Smoke-test managed local backend startup/readiness                |
| `pnpm --filter @agent-platform/desktop test`               | Run desktop unit tests                                            |
| `pnpm --filter @agent-platform/desktop test:e2e`           | Build production-like desktop runtime and run Electron E2E        |
| `pnpm --filter @agent-platform/desktop typecheck`          | Typecheck the desktop package                                     |
| `pnpm --filter @agent-platform/desktop lint`               | Lint the desktop package                                          |

The managed backend mode is currently a foundation spike:

```bash
pnpm --filter @agent-platform/desktop smoke:backend
```

That command builds the API and desktop package, starts the compiled API as a child process on
`127.0.0.1:4310`, waits for `/health/ready`, and stops the child process when Electron exits.

During development the backend supervisor uses the active development Node executable for the API
child process. The packaging epic must decide whether the released app bundles a Node runtime,
rebuilds native dependencies for Electron's Node ABI, or packages the backend another way.

## Desktop app data

The desktop runtime resolves app-owned paths through Electron's OS path API:

| Data type       | Default resolver          | Contents                              |
| --------------- | ------------------------- | ------------------------------------- |
| App data/config | `app.getPath('userData')` | Runtime config and app-owned metadata |
| SQLite/data     | `app.getPath('userData')` | Local single-user database            |
| Logs            | `app.getPath('logs')`     | Managed backend stdout/stderr logs    |
| Temp/scratch    | `app.getPath('temp')`     | Desktop runtime scratch files         |

The current default paths are resolved in code, not hardcoded in docs, so Electron can apply the
right OS conventions. On macOS these are normally under the user's `Library` locations.

Desktop credentials still use the API's existing encrypted `secret_refs` table. The desktop
runtime owns the encryption master key:

- if `SECRETS_MASTER_KEY` is explicitly set, the managed backend uses that value for
  development/test runs and does not persist a desktop key file,
- otherwise Electron creates or reads a 32-byte master key protected by Electron `safeStorage`,
  stores only the encrypted key metadata under the desktop config directory, and injects the
  decrypted base64 key into the managed backend process environment,
- the renderer never receives the master key, and the key is not written to runtime config or
  backend logs by desktop code,
- if OS secure storage is unavailable and no explicit `SECRETS_MASTER_KEY` exists, startup fails
  closed rather than storing credentials with an unprotected persistent fallback.

Credential deletion is split by layer. Deleting a model config removes its encrypted `secret_refs`
row. The desktop local-data reset flow removes app-owned config, data, log, and temp directories,
which includes the protected desktop master-key file and the app-owned SQLite database containing
encrypted credential rows. It must not delete user Project folders.

The desktop bridge exposes local-data reset as a destructive maintenance command. The caller must
first request the exact confirmation phrase and then pass it back with the reset request. The reset
flow stops the managed backend before deletion, deletes only app-owned runtime directories, recreates
empty runtime directories, and reports that user Project folders were preserved.

Development and tests may override desktop paths with:

| Variable                              | Purpose                                      |
| ------------------------------------- | -------------------------------------------- |
| `AGENT_PLATFORM_DESKTOP_RUNTIME_DIR`  | Override the app data root for desktop mode  |
| `AGENT_PLATFORM_DESKTOP_CONFIG_DIR`   | Override config directory                    |
| `AGENT_PLATFORM_DESKTOP_DATA_DIR`     | Override data directory                      |
| `AGENT_PLATFORM_DESKTOP_LOG_DIR`      | Override log directory                       |
| `AGENT_PLATFORM_DESKTOP_TEMP_DIR`     | Override temp/scratch directory              |
| `AGENT_PLATFORM_DESKTOP_SQLITE_PATH`  | Override desktop SQLite file path            |
| `AGENT_PLATFORM_DESKTOP_CONFIG_PATH`  | Override runtime config file path            |
| `AGENT_PLATFORM_DESKTOP_BACKEND_PORT` | Override managed backend loopback port       |
| `AGENT_PLATFORM_DESKTOP_NODE_PATH`    | Override the Node executable for the backend |

Electron E2E also uses `AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIR` to bypass the native OS dialog
with a deterministic temporary Project folder. Product code must not set this variable for normal
desktop runs.

The managed desktop backend still receives `SQLITE_PATH` because the API process requires that
environment variable. Desktop code derives that value from the desktop runtime resolver; it does
not consume Docker's `/data/agent.sqlite` default as a desktop input.

On first run, the desktop runtime creates the config, data, log, and temp directories before
starting the managed backend. If no desktop SQLite database exists yet, the backend starts with the
resolved app-data SQLite path and normal seed/setup flows can initialise it. There is no automatic
migration from Docker's `/data/agent.sqlite`; Docker development data and desktop app data are
separate by design.

Do not copy user Project folders into app data. Project folders remain user-owned files outside the
app data boundary.

## Logs and troubleshooting

When managed backend mode is enabled, backend logs are written under the resolved desktop log
directory:

- `backend.stdout.log`,
- `backend.stderr.log`.

Useful checks:

- If `smoke:backend` reports that the backend build is missing, run
  `pnpm --filter @agent-platform/desktop build:backend`.
- If readiness times out, inspect `backend.stderr.log` in the resolved Electron logs directory.
- If port `4310` is already in use, set `AGENT_PLATFORM_DESKTOP_BACKEND_PORT` to another local
  port for the current run.
- If SQLite native bindings fail under Electron, use the development Node path override for the
  spike and defer release packaging decisions to the packaging task.
- If a desktop Project flow works in the browser but fails in Electron, verify whether the flow is
  still depending on Docker `/workspace` paths or browser-only file handles.

## Cleanup expectations

Normal OS uninstall behavior may remove the app binary while leaving app data behind. The product
must eventually expose a supported cleanup/reset flow that removes:

- local SQLite/app metadata,
- desktop runtime config,
- logs and temp runtime files,
- stored credentials from secure storage.

Cleanup must not delete user Project folders unless the user explicitly chooses a separate
destructive action for those files.

## Regression coverage

The desktop foundation currently protects the security and data lifecycle boundary with package
tests rather than packaged-app E2E:

| Boundary              | Current regression coverage                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer isolation    | `windowConfig.test.ts` covers sandboxed `BrowserWindow` defaults                                                                                                  |
| Bridge exposure       | `preloadContract.test.ts` covers the explicit preload API shape                                                                                                   |
| IPC validation        | `ipcValidation.test.ts` and reset request validation tests                                                                                                        |
| App data deletion     | `localDataReset.test.ts` covers app data scope and Project safety                                                                                                 |
| Credential lifecycle  | `secretStorage.test.ts` and reset tests cover master-key removal                                                                                                  |
| Managed backend paths | `runtimePaths.test.ts` and `backendSupervisor.test.ts`                                                                                                            |
| Native Project open   | `apps/desktop/e2e/project-access.e2e.ts` covers Electron Project open, backend registration, Project-bound session reuse, `/help`, `/init`, and safe path display |

Later release work must add production-like packaged Electron E2E for:

- the visible local-data reset UI once Settings exposes it,
- packaged app startup with the bundled backend/runtime strategy,
- installer uninstall/reset behavior on macOS first, then Windows and Linux.

## Current limitations

- macOS is the first supported desktop target.
- Public installers, signing, notarization, update delivery, and uninstall cleanup are not complete.
- Native Project picker and Project-bound desktop chat have development E2E coverage; packaged-app
  coverage remains future release work.
- Command/test execution still requires a sandbox design; Electron is not the sandbox.
- Windows/Linux support should reuse the runtime path resolver and add platform-specific packaging
  and E2E coverage later.
