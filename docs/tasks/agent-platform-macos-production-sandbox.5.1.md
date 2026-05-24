# Task: Package native helper and VM assets

**Beads issue:** `agent-platform-macos-production-sandbox.5.1`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.5.1.md`  
**Parent task:** `agent-platform-macos-production-sandbox.5`

## Summary

Include the native macOS VM helper and required VM assets in the packaged Electron macOS artifact.

## Requirements

- Build the Swift helper as part of the macOS packaging pipeline.
- Place the helper in an app-owned packaged path with stable lookup from the desktop backend.
- Include or install the guest image/bootstrap assets into app-owned package/runtime locations.
- Use the same pinned image source/build output selected in `.4.2.1`; packaging must not depend on
  an engineer's local VM image or untracked files.
- Keep user Project folders outside the VM asset/runtime layout.
- Fail packaging if required runner assets are missing.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop native:vm:build`
- Packaged artifact inspection proving the helper is present.
- Packaged artifact inspection proving required VM assets or bootstrap manifests are present.
- Verification that packaged asset checksums match the `.4.2.1` manifest/source.
- `git diff --check`

## Definition Of Done

- A packaged macOS artifact contains the helper and VM asset contract required by `.4`.
- The desktop app can resolve packaged helper and asset paths without developer-only environment
  variables.
- Missing assets fail the packaging job rather than producing a misleading artifact.
- The production packaging boundary is clear: bundled assets or app-owned first-run installation,
  never user Project folders or manual Docker/host setup.
