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

## Definition of done

- [ ] Electron can load the built renderer locally.
- [ ] Desktop production mode does not require the normal web dev server.
- [ ] Development mode remains usable.
- [ ] Any renderer build constraints are documented.
- [ ] Relevant desktop/web tests and root gates pass.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.

## Test strategy

- Desktop build and smoke launch.
- Web build/typecheck.
- Focused test or script proving the renderer entry is reachable.
