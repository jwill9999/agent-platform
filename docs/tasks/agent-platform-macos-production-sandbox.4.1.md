# Task: Define and provision macOS VM guest image contract

**Beads issue:** `agent-platform-macos-production-sandbox.4.1`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.1.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4`

## Summary

Define the bootable Linux guest image and bootstrap contract required by the production macOS VM runner.

## Requirements

- Define the packaged VM asset layout and required files.
- Add a reproducible local/staging build or acquisition path for the bootable Linux guest image.
- Define how the guest command service is installed and started.
- Make the Swift helper validate the exact image/bootstrap assets it needs before `start`.
- Keep VM assets in app-owned runtime/package locations, never in user Project folders.

## Tests And Verification

- `pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- --source-image <raw-linux.img> --bootstrap <guest-bootstrap.sh> --out-dir <runtime>/images`
- `pnpm --filter @agent-platform/desktop native:vm:test`
- Helper smoke proving missing image/bootstrap assets fail closed with specific messages.
- Documentation showing where the image comes from and how staging obtains the same asset.

## Definition Of Done

- The image/bootstrap contract is explicit and reproducible.
- The helper validates all required assets.
- `.4.2` can implement VM boot against this contract without guessing asset names or paths.
