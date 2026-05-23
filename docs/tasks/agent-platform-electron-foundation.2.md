# Task: Build and load the renderer for desktop runtime

**Beads issue:** `agent-platform-electron-foundation.2`
**Spec file:** `docs/tasks/agent-platform-electron-foundation.2.md`
**Parent epic:** `agent-platform-electron-foundation` — Electron runtime foundation

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-foundation.2.md`

## Task requirements

Prove the desktop shell can load the built web renderer without relying on the normal browser dev server.

This task should preserve the existing web app as the product UI source while adding a desktop loading path. It should not introduce a separate desktop-only UI unless a small wrapper is needed for boot diagnostics.

## Implementation plan

1. Identify the current web build output and any changes needed for Electron loading.
2. Add desktop runtime logic to load the built renderer in production mode.
3. Keep development ergonomics available for local work without making dev-server loading the acceptance path.
4. Add renderer load failure diagnostics that are useful to developers but not exposed as product implementation noise.
5. Document any limitations discovered for Next.js static/export/runtime loading.

## Implementation notes

- The web app is a Next.js standalone build, not a pure static export. The desktop runtime therefore loads a local loopback Next standalone server instead of `file://` assets.
- Standalone desktop renderer mode uses Electron's own binary as Node via `ELECTRON_RUN_AS_NODE=1`, starts `apps/web/.next/standalone/apps/web/server.js`, copies `.next/static` and `public` assets into the standalone tree, and then loads `http://127.0.0.1:<port>`.
- `AGENT_PLATFORM_DESKTOP_RENDERER=standalone` is the production-like acceptance path for this task.
- `AGENT_PLATFORM_DESKTOP_RENDERER=dev-server` remains available for local development and loads `AGENT_PLATFORM_DESKTOP_DEV_SERVER_URL` or `http://127.0.0.1:3001`.
- The bootstrap data URL remains the safe fallback while later tasks wire backend supervision and native Project access.

## Definition of done

- [x] Electron can load the built renderer locally.
- [x] Desktop production mode does not require the normal web dev server.
- [x] Development mode remains usable.
- [x] Any renderer build constraints are documented.
- [x] Relevant desktop/web tests and root gates pass.
- [x] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Test strategy

- Desktop build and smoke launch.
- Web build/typecheck.
- Focused test or script proving the renderer entry is reachable.
- `pnpm --filter @agent-platform/desktop smoke:renderer` is the production-like desktop smoke path for this task.
