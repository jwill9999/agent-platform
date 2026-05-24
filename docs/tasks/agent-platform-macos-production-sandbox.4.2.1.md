# Task: Provision bootable arm64 Linux guest image

**Beads issue:** `agent-platform-macos-production-sandbox.4.2.1`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.2.1.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4.2`

## Summary

Add a reproducible path to obtain or build a bootable `arm64` Linux image compatible with Apple
Virtualization.framework and the `.4.1` VM asset contract.

## Requirements

- Select and document the Apple Virtualization.framework boot contract before boot proof begins.
  This task selects `VZLinuxBootLoader` with a raw disk image, matching kernel, matching initrd, and
  explicit kernel command line. EFI auto-discovery is not the production contract for this task.
- Update the `.4.1` asset layout, asset preparation script, helper validation, and documentation to
  require `base-linux.img`, `vmlinuz`, `initrd.img`, and `guest-bootstrap.sh` before `.4.2.2`
  starts.
- Produce a bootable `arm64` Linux disk image in raw format.
- Install or define the bootstrap path for the guest command service prerequisites, including how
  the service is installed and started after boot.
- Feed the image through `native:vm:assets:prepare` so the runtime contains `manifest.json`,
  `base-linux.img`, `vmlinuz`, `initrd.img`, and `guest-bootstrap.sh`.
- Document the local, staging, and release-packaging source of the image.
- Do not depend on user Project folders or host-specific manual setup.

## Tests And Verification

- Asset preparation smoke using the real image.
- Manifest checksum verification.
- Documentation proving how another developer, staging job, and release packaging job obtain the
  same image or build it from the same pinned inputs.
- Helper validation smoke proving missing assets from the selected boot contract fail closed with
  specific diagnostics.

## Definition Of Done

- A real bootable image exists through a reproducible path.
- The boot contract is explicit and implemented in the asset manifest/helper validation.
- The guest bootstrap/service installation model is explicit enough for `.4.3` to implement command
  execution without redesigning the image.
- The image, kernel, initrd, and bootstrap assets are staged into the runtime asset contract without
  manual guessing.
- `.4.2.2` can attempt a real VM boot from the produced assets.
