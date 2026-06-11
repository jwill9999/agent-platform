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

## Implementation Notes

- Added `native:vm:package`, implemented by `apps/desktop/scripts/package-macos-vm-runtime.mjs`.
- The default generated resource output `apps/desktop/resources/macos-vm/` is gitignored so large VM
  images are packaged as build artifacts, not committed to source control.
- The package script:
  - runs `swift build --package-path native/macos-vm-runner` by default,
  - copies the helper to `macos-vm/macos-vm-runner`,
  - copies the prepared VM asset contract to `macos-vm/images`,
  - verifies `base-linux.img`, `vmlinuz`, `initrd.img`, and `guest-bootstrap.sh` against the
    prepared `manifest.json` checksums before copying,
  - writes `package-manifest.json` with helper and asset checksums,
  - fails closed if any required asset is missing or the checksum differs.
- Desktop runtime paths now resolve packaged VM resources under Electron `process.resourcesPath`:
  - helper: `<resources>/macos-vm/macos-vm-runner`,
  - assets: `<resources>/macos-vm/images`.
- Managed backend startup now resolves `AGENT_PLATFORM_MACOS_VM_RUNNER_PATH` from packaged resources
  when no developer override is set.
- When `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm`, managed backend startup copies packaged VM assets
  into the app-owned runtime directory at `<app data>/data/vm/images` before starting the API.

## Verification Evidence

Packaging proof:

- Fresh prepared packaging input:
  `/private/tmp/agent-platform-linux-package-input-5-1/images`
- Packaged resource output:
  `/private/tmp/agent-platform-macos-vm-package-proof-5-1`
- Command:
  `pnpm --filter @agent-platform/desktop native:vm:package -- --assets-dir /private/tmp/agent-platform-linux-package-input-5-1/images --out-dir /private/tmp/agent-platform-macos-vm-package-proof-5-1`
- Output layout inspection showed:
  - `macos-vm-runner`
  - `package-manifest.json`
  - `images/manifest.json`
  - `images/base-linux.img`
  - `images/vmlinuz`
  - `images/initrd.img`
  - `images/guest-bootstrap.sh`
- `package-manifest.json` recorded:
  - helper sha256 `a87d7395edc43cde8fa4e73c4d313d03aae786f6a864f63d0e10a85adbc81966`
  - image sha256 `952b18e5ce6829e11ad3ac458375a09eacb8350da05d9651a7caf186c6d17e59`
  - kernel sha256 `9ffae683f615230c53ced0c1f4d9aa13554fb5377d26a5fabb002a22bb078a19`
  - initrd sha256 `8cb79fdcbf90313d7a5a315a2dc90bca7435976c3603a28929bce5feefab2b1c`
  - bootstrap sha256 `246d8bece2e1c7927399cd4a7a9ef6a11bfcd49f684a83ad8d789f65d2972e14`

Fail-closed proof:

- Running `native:vm:package` against a previously booted VM runtime failed with an image checksum
  mismatch, proving packaging does not silently accept dirty or mutated runtime images.
- `test/macosVmPackaging.test.ts` covers successful packaging and checksum mismatch failure using
  small test fixtures.

Quality gate:

- `node --check apps/desktop/scripts/package-macos-vm-runtime.mjs`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`
- `pnpm --filter @agent-platform/desktop test -- test/runtimePaths.test.ts test/backendSupervisor.test.ts test/packageScripts.test.ts test/macosVmPackaging.test.ts`
