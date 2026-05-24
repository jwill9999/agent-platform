# Task: Provision bootable arm64 Linux guest image

**Beads issue:** `agent-platform-macos-production-sandbox.4.2.1`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.2.1.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4.2`

## Summary

Add a reproducible path to obtain or build a bootable `arm64` Linux image compatible with Apple
Virtualization.framework and the `.4.1` VM asset contract.

## Requirements

- Produce a bootable `arm64` Linux disk image in raw format.
- Install or define the bootstrap path for the guest service prerequisites.
- Feed the image through `native:vm:assets:prepare` so the runtime contains `manifest.json`,
  `base-linux.img`, and `guest-bootstrap.sh`.
- Document the local and staging source of the image.
- Do not depend on user Project folders or host-specific manual setup.

## Tests And Verification

- Asset preparation smoke using the real image.
- Manifest checksum verification.
- Documentation proving how another developer or staging job obtains the same image.

## Definition Of Done

- A real bootable image exists through a reproducible path.
- The image is staged into the runtime asset contract without manual guessing.
- `.4.2.2` can attempt a real VM boot from the produced assets.
