# Task: Document desktop versus Docker development workflows

**Beads issue:** `agent-platform-electron-foundation.5`
**Spec file:** `docs/tasks/agent-platform-electron-foundation.5.md`
**Parent epic:** `agent-platform-electron-foundation` — Electron runtime foundation

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-foundation.5.md`

## Task requirements

Document how developers and future users should run the app after the foundation work lands.

The docs must clearly distinguish developer runtime from desktop runtime: Docker remains for development/CI and optional future sandboxing, while desktop runtime owns local backend startup, app data, and native folder access.

## Implementation plan

1. Update development docs with Electron desktop commands and prerequisites.
2. Document what Docker still does and what desktop runtime owns.
3. Document known macOS-first limitations and future Windows/Linux extension points.
4. Add troubleshooting guidance for backend startup/readiness/log locations.
5. Update the parent epic closeout checklist and session handoff.

## Definition of done

- [ ] Developer workflow docs cover Docker and Electron modes separately.
- [ ] Desktop runtime responsibilities are clear.
- [ ] Log/config/data locations are documented.
- [ ] macOS-first scope and future Windows/Linux work are documented.
- [ ] Docs lint passes.
- [ ] PR checks and review comments are resolved before closure.

## Test strategy

- `pnpm docs:lint`.
- Any command examples added to docs are checked manually or with existing scripts where feasible.
