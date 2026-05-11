# Task: Scaffold the Electron desktop app

**Beads issue:** `agent-platform-electron-foundation.1`
**Spec file:** `docs/tasks/agent-platform-electron-foundation.1.md`
**Parent epic:** `agent-platform-electron-foundation` — Electron runtime foundation

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-foundation.1.md`

## Task requirements

Add the first desktop application package without changing the existing Docker development path.

The task should establish a minimal Electron main/preload/renderer shell that can be built and launched on macOS from the monorepo. It does not need to start the backend yet; that belongs to `.3`.

## Implementation plan

1. Review current workspace/package scripts and choose the smallest Electron build setup that fits the monorepo.
2. Add an `apps/desktop` package with Electron main and preload entry points.
3. Add scripts for development, typecheck, build, and a local smoke launch if feasible in CI/local environments.
4. Keep Electron APIs behind the preload boundary; do not expose Node directly to the renderer.
5. Wire package references so root install/build tooling recognises the new package without breaking existing apps.

## Implementation notes

- Use a plain Electron package for the first scaffold. Packaging/signing tooling is deferred to the release epic so this task stays focused on the runtime shell.
- Keep the renderer sandboxed with `contextIsolation: true`, `nodeIntegration: false`, and a preload bridge for explicit desktop APIs.
- Load a minimal bootstrap document until the real web renderer is wired in `agent-platform-electron-foundation.2`.

## Definition of done

- [ ] `apps/desktop` exists as a workspace package.
- [ ] Electron main and preload entry points compile.
- [ ] The shell can launch on macOS in development or smoke mode.
- [ ] Existing API/web Docker workflow is unchanged.
- [ ] Root/package typecheck, lint, build, relevant tests, and docs lint pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Test strategy

- Focused desktop package typecheck/build.
- Any available Electron smoke command for launching the shell.
- Root gates as required by touched packages.
