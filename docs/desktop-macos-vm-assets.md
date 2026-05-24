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
    guest-bootstrap.sh
  state/
    machine-id
    runner.sock
  logs/
```

User Project folders must never be placed under this tree. The runtime directory is app-owned state;
the selected Project folder is mounted into the guest later as `/workspace`.

## Manifest Contract

`images/manifest.json` must use schema version `1`:

```json
{
  "schemaVersion": 1,
  "architecture": "arm64",
  "imageFormat": "raw",
  "image": "base-linux.img",
  "imageSha256": "<sha256>",
  "bootstrap": "guest-bootstrap.sh",
  "bootstrapSha256": "<sha256>",
  "guestService": {
    "transport": "vsock",
    "port": 10240,
    "command": "/usr/local/bin/agent-platform-guest-service"
  }
}
```

The first supported guest is an `arm64` raw Linux disk image. The guest command service is installed
by the bootstrap script and listens on virtio socket port `10240`. Follow-on lifecycle work uses that
port for command execution inside the guest.

## Preparing Assets

Staging and release jobs should stage the same asset shape with:

```bash
pnpm --filter @agent-platform/desktop native:vm:assets:prepare -- \
  --source-image /path/to/raw-linux.img \
  --bootstrap /path/to/guest-bootstrap.sh \
  --out-dir /path/to/runtime/images
```

The script copies the source image and bootstrap script into the output directory and writes the
manifest with SHA-256 checksums. It intentionally fails if the source image or bootstrap script is
missing, because packaging a runner without valid assets would be misleading.

## Validation

`macos-vm-runner prepare`, `status`, `start`, and `exec` validate the manifest, image, bootstrap,
architecture, image format, service transport, and service port before reporting readiness or
attempting later VM lifecycle steps.
