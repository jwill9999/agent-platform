# Task: Implement the backend supervisor spike

**Beads issue:** `agent-platform-electron-foundation.3`
**Spec file:** `docs/tasks/agent-platform-electron-foundation.3.md`
**Parent epic:** `agent-platform-electron-foundation` — Electron runtime foundation

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-foundation.3.md`

## Task requirements

Add a minimal Electron main-process supervisor that starts and stops the local backend for desktop runtime.

The supervisor should be conservative: explicit lifecycle, bounded logs, readiness probing, and clean shutdown on app quit. This task proves local backend ownership; sandboxed code execution remains future security work.

## Implementation plan

1. Define the backend launch command for desktop runtime.
2. Implement a supervisor module with start, readiness wait, log capture, and stop behavior.
3. Surface readiness to the renderer through a narrow preload-safe channel if needed.
4. Ensure process shutdown is reliable on app quit and failed startup does not hang the app.
5. Add tests around command construction, readiness timeout, and shutdown behavior where feasible.

## Definition of done

- [x] Electron can start the backend locally.
- [x] Backend readiness is detected before the renderer depends on API calls.
- [x] Backend logs write to a known desktop log location or bounded development log.
- [x] Backend stops when Electron quits.
- [x] Failure states are observable for developers without exposing internal implementation noise to end users.
- [x] Relevant tests and root gates pass.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Implementation notes

- `AGENT_PLATFORM_DESKTOP_BACKEND=managed` starts the compiled API from Electron main before loading the renderer.
- The supervisor waits for `GET /health/ready` on `http://127.0.0.1:4310` by default, then sets `API_PROXY_URL` so the standalone renderer's BFF targets the managed backend.
- Runtime data for this spike defaults to `.agent-platform/desktop-runtime`, including `data/agent.sqlite` and `logs/backend.stdout.log` / `logs/backend.stderr.log`.
- The backend is launched with the development Node executable when available. Launching the API through Electron's Node mode exposed a native ABI mismatch with `better-sqlite3`; packaging must later choose either a bundled Node runtime or Electron-compatible native rebuilds.
- `pnpm --filter @agent-platform/desktop smoke:backend` proves start, readiness, log writing, and shutdown without the normal Docker API.

## Test strategy

- Unit tests for supervisor command/readiness behavior.
- Smoke test for backend start/ready/stop if feasible.
- Existing API tests must remain green.
