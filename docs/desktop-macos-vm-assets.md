# macOS VM Runner Assets

The packaged macOS production runner uses a Linux guest image managed by the Electron app. The
native helper must validate the guest asset contract before later lifecycle code attempts to boot the
VM.

## Asset Layout

The helper expects VM assets under the app-owned VM runtime directory:

```text
<runtime-dir>/
  images/
    manifest.json
    base-linux.img
    vmlinuz
    initrd.img
    guest-bootstrap.sh
  state/
    machine-id
    runner.sock
  logs/
```

User Project folders must never be placed under this tree. The runtime directory is app-owned state;
the selected Project folder is mounted into the guest later as `/workspace`.

## Manifest Contract

`images/manifest.json` must use schema version `2`:

```json
{
  "schemaVersion": 2,
  "architecture": "arm64",
  "imageFormat": "raw",
  "image": "base-linux.img",
  "imageSha256": "<sha256>",
  "boot": {
    "loader": "linux",
    "kernel": "vmlinuz",
    "kernelSha256": "<sha256>",
    "initrd": "initrd.img",
    "initrdSha256": "<sha256>",
    "commandLine": "console=hvc0 root=/dev/vda rw systemd.unit=multi-user.target"
  },
  "bootstrap": "guest-bootstrap.sh",
  "bootstrapSha256": "<sha256>",
  "guestService": {
    "transport": "vsock",
    "port": 10240,
    "command": "/usr/local/bin/agent-platform-guest-service"
  }
}
```

The selected boot contract is Apple `VZLinuxBootLoader`, not EFI auto-discovery. The runner requires
a raw `arm64` Linux disk image plus matching kernel and initrd assets. The kernel and initrd must be
from the same guest image build or release artifact as the raw disk; mixing a random installer
kernel with an unrelated root disk is not a valid production asset.

The guest command service is installed by the bootstrap script and listens on virtio socket port
`10240`. Follow-on lifecycle work uses that port for command execution inside the guest.

## Reproducible Image Source

For the macOS-first production runner, staging and release packaging use a pinned image artifact
produced by the project release pipeline:

1. Build the first asset source set with Alpine Linux `3.20` using the repository script:
   `pnpm --filter @agent-platform/desktop native:vm:assets:build-linux -- --out-dir <asset-source-dir>`.
2. The builder installs the `linux-virt` kernel and guest service prerequisites into an `arm64`
   root filesystem.
3. The builder emits a raw ext4 root disk plus the matching `vmlinuz` and `initrd.img` from that
   same root filesystem.
4. Stage `base-linux.img`, `vmlinuz`, `initrd.img`, and `guest-bootstrap.sh` through
   `native:vm:assets:prepare`.
5. Store the resulting manifest and asset checksums with the packaged release artifact.

This source/build step happens in staging and release infrastructure. End users must not need
Docker, `qemu-img`, `guestfish`, or manual image-building tools to run the packaged app.

The reproducible builder must publish these files as one immutable asset set:

```text
base-linux.img       # uncompressed raw arm64 root disk
vmlinuz              # kernel matching the root disk image
initrd.img           # initrd matching the root disk image
guest-bootstrap.sh   # guest provisioning script used for the same image build
manifest.json        # produced by native:vm:assets:prepare
```

Local development, staging, and release packaging use the same asset set. Local development may run
the builder directly or point `native:vm:assets:prepare` at a downloaded build artifact. Staging and
release packaging must pull the pinned artifact from the release pipeline or rebuild it from the
same pinned inputs.

## Guest Bootstrap Contract

The bootstrap script is responsible for installing the guest-side command service prerequisites into
the image before the VM is packaged for production. It must:

- install `/usr/local/bin/agent-platform-guest-service`,
- create a system service that starts the command service during guest boot,
- configure the service to listen on virtio socket port `10240`,
- run the service as a non-root guest user,
- ensure the service can access `/workspace` after the host Project folder is mounted by later
  lifecycle work,
- avoid copying host user data, credentials, or Project folders into the VM image.

Task `.4.3` implements the actual guest command service and transport. This asset contract only
defines where the service must be installed and how the packaged image proves the service
prerequisites are present.

## Preparing Assets

Staging and release jobs should stage the same asset shape with:

```bash
pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- \
  --source-image /path/to/raw-linux.img \
  --kernel /path/to/vmlinuz \
  --initrd /path/to/initrd.img \
  --bootstrap /path/to/guest-bootstrap.sh \
  --out-dir /path/to/runtime/images
```

The script copies the source image, kernel, initrd, and bootstrap script into the output directory
and writes the manifest with SHA-256 checksums. It intentionally fails if any required source asset
is missing, because packaging a runner without valid assets would be misleading.

## Validation

`macos-vm-runner prepare`, `status`, `start`, and `exec` validate the manifest, image, kernel,
initrd, bootstrap, boot loader, architecture, image format, service transport, and service port
before reporting readiness or attempting later VM lifecycle steps.
