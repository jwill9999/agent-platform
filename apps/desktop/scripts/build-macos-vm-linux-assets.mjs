#!/usr/bin/env node
/* global console, process */
import { execFileSync } from 'node:child_process';
import { createGunzip } from 'node:zlib';
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';

const DEFAULT_IMAGE_SIZE_MB = 4096;
const DEFAULT_ALPINE_VERSION = '3.20';
const DEFAULT_BUILDER_IMAGE = `alpine:${DEFAULT_ALPINE_VERSION}`;
const DEFAULT_UBUNTU_IMAGE_BASE = 'https://cloud-images.ubuntu.com/daily/server/jammy/current';
const DEFAULT_UBUNTU_UNPACKED_BASE =
  `${DEFAULT_UBUNTU_IMAGE_BASE}/unpacked`;
const DEFAULT_ROOTFS_URL = `${DEFAULT_UBUNTU_IMAGE_BASE}/jammy-server-cloudimg-arm64-root.tar.xz`;
const DEFAULT_KERNEL_URL = `${DEFAULT_UBUNTU_UNPACKED_BASE}/jammy-server-cloudimg-arm64-vmlinuz-generic`;
const DEFAULT_INITRD_URL = `${DEFAULT_UBUNTU_UNPACKED_BASE}/jammy-server-cloudimg-arm64-initrd-generic`;
const DEFAULT_UBUNTU_KERNEL_PACKAGE_BASE = 'http://ports.ubuntu.com/ubuntu-ports/pool/main/l/linux';

const scriptArgs = process.argv.slice(2);
if (scriptArgs[0] === '--') scriptArgs.shift();

const { values } = parseArgs({
  args: scriptArgs,
  options: {
    'out-dir': { type: 'string' },
    'image-size-mb': { type: 'string', default: String(DEFAULT_IMAGE_SIZE_MB) },
    'builder-image': { type: 'string', default: DEFAULT_BUILDER_IMAGE },
    'rootfs-url': { type: 'string', default: DEFAULT_ROOTFS_URL },
    'kernel-url': { type: 'string', default: DEFAULT_KERNEL_URL },
    'initrd-url': { type: 'string', default: DEFAULT_INITRD_URL },
  },
});

const outDir = values['out-dir'];
const imageSizeMb = Number(values['image-size-mb']);
const builderImage = values['builder-image'] ?? DEFAULT_BUILDER_IMAGE;
const rootfsUrl = values['rootfs-url'] ?? DEFAULT_ROOTFS_URL;
const kernelUrl = values['kernel-url'] ?? DEFAULT_KERNEL_URL;
const initrdUrl = values['initrd-url'] ?? DEFAULT_INITRD_URL;

if (!outDir || !Number.isInteger(imageSizeMb) || imageSizeMb < 512) {
  console.error(
    [
      'Usage: node scripts/build-macos-vm-linux-assets.mjs --out-dir <dir> [--image-size-mb 4096]',
      '',
      'Builds a reproducible arm64 Linux VM asset source set:',
      '  source.raw',
      '  vmlinuz (raw ARM64 Linux Image, not an EFI-stub kernel)',
      '  initrd.img',
      '  guest-bootstrap.sh',
      '',
      'Docker is required for the build environment, but the packaged app must consume only the',
      'resulting assets and must not require Docker on an end-user machine.',
    ].join('\n'),
  );
  process.exit(2);
}

const resolvedOutDir = resolve(outDir);
mkdirSync(resolvedOutDir, { recursive: true });

downloadFile(rootfsUrl, join(resolvedOutDir, 'rootfs.tar.xz'));
const downloadedKernelPath = join(resolvedOutDir, 'vmlinuz.gz');
const rawKernelPath = join(resolvedOutDir, 'vmlinuz');
downloadFile(kernelUrl, downloadedKernelPath);
await pipeline(createReadStream(downloadedKernelPath), createGunzip(), createWriteStream(rawKernelPath));
downloadFile(initrdUrl, join(resolvedOutDir, 'initrd.img'));
assertRawArm64Kernel(rawKernelPath);
const kernelPackage = readUbuntuKernelPackage(rawKernelPath);
downloadFile(
  `${DEFAULT_UBUNTU_KERNEL_PACKAGE_BASE}/linux-modules-${kernelPackage.kernelVersion}_${kernelPackage.packageVersion}_arm64.deb`,
  join(resolvedOutDir, 'linux-modules.deb'),
);
downloadFile(
  `${DEFAULT_UBUNTU_KERNEL_PACKAGE_BASE}/linux-modules-extra-${kernelPackage.kernelVersion}_${kernelPackage.packageVersion}_arm64.deb`,
  join(resolvedOutDir, 'linux-modules-extra.deb'),
);

const buildScriptPath = join(resolvedOutDir, 'build-inside-container.sh');
writeFileSync(buildScriptPath, buildScript(), { mode: 0o755 });

try {
  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '--platform',
      'linux/arm64',
      '-e',
      `IMAGE_SIZE_MB=${imageSizeMb}`,
      '-v',
      `${resolvedOutDir}:/out`,
      '--mount',
      'type=volume,target=/work',
      builderImage,
      '/bin/sh',
      '/out/build-inside-container.sh',
    ],
    { stdio: 'inherit' },
  );
} catch (error) {
  console.error(
    [
      'Failed to build macOS VM Linux assets with Docker.',
      'Start Docker Desktop or run this script in the staging/release builder where Docker is available.',
      `Output directory retained for diagnostics: ${resolvedOutDir}`,
    ].join('\n'),
  );
  process.exit(typeof error?.status === 'number' ? error.status : 1);
}

const required = ['source.raw', 'vmlinuz', 'initrd.img', 'guest-bootstrap.sh'];
for (const file of required) {
  const path = join(resolvedOutDir, file);
  if (!existsSync(path)) {
    console.error(`Expected VM asset was not created: ${path}`);
    process.exit(1);
  }
}

copyFileSync(join(resolvedOutDir, 'source.raw'), join(resolvedOutDir, 'base-linux.img'));
console.log(`Built macOS VM Linux asset source set in ${resolvedOutDir}`);

function downloadFile(url, path) {
  try {
    execFileSync('curl', ['-L', '--fail', '--output', path, url], { stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to download VM boot asset from ${url}`);
    process.exit(typeof error?.status === 'number' ? error.status : 1);
  }
}

function assertRawArm64Kernel(path) {
  const description = execFileSync('file', [path], { encoding: 'utf8' });
  if (!description.includes('Linux kernel ARM64 boot executable Image')) {
    console.error(
      [
        `Unsupported macOS VM kernel format: ${description.trim()}`,
        'VZLinuxBootLoader requires a raw ARM64 Linux Image.',
        'EFI-stub kernels such as PE32+ executable vmlinuz files fail at VM start with VZErrorDomain code 1.',
      ].join('\n'),
    );
    process.exit(1);
  }
}

function readUbuntuKernelPackage(path) {
  const strings = execFileSync('strings', [path], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const kernelVersion = strings.match(/Linux version (\S+)/)?.[1];
  const packageVersion = strings.match(/\(Ubuntu ([0-9][^ )]+)-generic /)?.[1];
  if (!kernelVersion || !packageVersion) {
    console.error('Unable to determine matching Ubuntu kernel module package version from vmlinuz.');
    process.exit(1);
  }
  return { kernelVersion, packageVersion };
}

function buildScript() {
  return `#!/bin/sh
set -eu

apk add --no-cache dpkg e2fsprogs kmod tar xz zstd

ROOTFS="/work/rootfs-$$"
mkdir -p "$ROOTFS"

if ! tar \\
  --exclude='dev/*' \\
  --exclude='var/lib/snapd/void' \\
  --no-same-owner \\
  --delay-directory-restore \\
  -C "$ROOTFS" \\
  -xJf /out/rootfs.tar.xz; then
  if [ ! -x "$ROOTFS/usr/bin/apt-get" ]; then
    echo "Ubuntu rootfs extraction failed before package tooling was available." >&2
    exit 1
  fi
  echo "Ubuntu rootfs extraction completed with non-fatal metadata warnings." >&2
fi
mkdir -p "$ROOTFS/dev/pts" "$ROOTFS/dev/shm"
chmod -R u+rwX "$ROOTFS"
cp /etc/resolv.conf "$ROOTFS/etc/resolv.conf"

dpkg-deb -x /out/linux-modules.deb "$ROOTFS"
dpkg-deb -x /out/linux-modules-extra.deb "$ROOTFS"
ln -sfn /usr/lib/aarch64-linux-gnu "$ROOTFS/lib/aarch64-linux-gnu"
ln -sfn /usr/lib/ld-linux-aarch64.so.1 "$ROOTFS/lib/ld-linux-aarch64.so.1"
ln -sfn /usr/lib/systemd "$ROOTFS/lib/systemd"
ln -sfn /usr/lib/udev "$ROOTFS/lib/udev"
kernel_version="$(grep -a -m1 -o 'Linux version [^ ]*' /out/vmlinuz | awk '{print $3}')"
depmod -b "$ROOTFS" "$kernel_version"

mkdir -p \\
  "$ROOTFS/etc/systemd/system/multi-user.target.wants" \\
  "$ROOTFS/usr/local/bin" \\
  "$ROOTFS/run/agent-platform/commands" \\
  "$ROOTFS/workspace"

cat > "$ROOTFS/usr/local/bin/agent-platform-guest-service" <<'SERVICE'
#!/bin/sh
set -eu
exec >/dev/hvc0 2>&1

WORKSPACE_MOUNT="/workspace"
COMMAND_MOUNT="/run/agent-platform/commands"
JOBS_DIR="$COMMAND_MOUNT/jobs"

is_mounted() {
  grep -q " $1 " /proc/mounts
}

mount_share() {
  tag="$1"
  target="$2"
  mkdir -p "$target"
  if ! is_mounted "$target"; then
    echo "agent-platform: mounting $tag at $target"
    modprobe virtiofs || insmod "/lib/modules/$(uname -r)/kernel/fs/fuse/virtiofs.ko" || true
    mount -t virtiofs "$tag" "$target"
  fi
}

shell_quote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

run_job() {
  job="$1"
  rm -f "$job/ready"
  cwd="$(cat "$job/cwd")"
  timeout_ms="$(cat "$job/timeout-ms")"
  max_output_bytes="$(cat "$job/max-output-bytes")"

  case "$cwd" in
    /workspace|/workspace/*) ;;
    *)
      printf "Rejected cwd outside /workspace\\n" > "$job/stderr"
      printf "126\\n" > "$job/exit-code"
      printf "done\\n" > "$job/done"
      return
      ;;
  esac

  timeout_seconds=$(( (timeout_ms + 999) / 1000 ))
  [ "$timeout_seconds" -gt 0 ] || timeout_seconds=1

  command_line="if [ -f $(shell_quote "$job/env.sh") ]; then . $(shell_quote "$job/env.sh"); fi; cd $(shell_quote "$cwd") && timeout $(shell_quote "$timeout_seconds") /bin/sh $(shell_quote "$job/command.sh")"
  tmp_stdout="$job/stdout.tmp"
  tmp_stderr="$job/stderr.tmp"
  if su agentplatform -s /bin/sh -c "$command_line" > "$tmp_stdout" 2> "$tmp_stderr"; then
    exit_code=0
  else
    exit_code=$?
  fi
  head -c "$max_output_bytes" "$tmp_stdout" > "$job/stdout" || true
  head -c "$max_output_bytes" "$tmp_stderr" > "$job/stderr" || true
  rm -f "$tmp_stdout" "$tmp_stderr"
  printf "%s\\n" "$exit_code" > "$job/exit-code"
  printf "done\\n" > "$job/done"
}

echo "agent-platform: guest service starting"
mount_share agentworkspace "$WORKSPACE_MOUNT"
mount_share agentcommands "$COMMAND_MOUNT"
mkdir -p "$JOBS_DIR"
echo "agent-platform: guest service ready"

while true; do
  for job in "$JOBS_DIR"/*; do
    [ -d "$job" ] || continue
    [ -f "$job/ready" ] || continue
    run_job "$job"
  done
  sleep 0.1
done
SERVICE
chmod 0755 "$ROOTFS/usr/local/bin/agent-platform-guest-service"

cat > "$ROOTFS/etc/systemd/system/agent-platform-guest-service.service" <<'SERVICE_UNIT'
[Unit]
Description=Agent Platform guest command service
After=local-fs.target

[Service]
Type=simple
ExecStart=/usr/local/bin/agent-platform-guest-service
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
SERVICE_UNIT

if ! grep -q '^agentplatform:' "$ROOTFS/etc/group"; then
  printf 'agentplatform:x:1000:\\n' >> "$ROOTFS/etc/group"
fi
if ! grep -q '^agentplatform:' "$ROOTFS/etc/passwd"; then
  printf 'agentplatform:x:1000:1000:Agent Platform:/home/agentplatform:/bin/sh\\n' >> "$ROOTFS/etc/passwd"
fi
if [ -f "$ROOTFS/etc/shadow" ] && ! grep -q '^agentplatform:' "$ROOTFS/etc/shadow"; then
  printf 'agentplatform:!:20498:0:99999:7:::\\n' >> "$ROOTFS/etc/shadow"
fi
if [ -f "$ROOTFS/etc/gshadow" ] && ! grep -q '^agentplatform:' "$ROOTFS/etc/gshadow"; then
  printf 'agentplatform:!::\\n' >> "$ROOTFS/etc/gshadow"
fi
mkdir -p "$ROOTFS/home/agentplatform"
chown 1000:1000 "$ROOTFS/home/agentplatform"
ln -sf /etc/systemd/system/agent-platform-guest-service.service \\
  "$ROOTFS/etc/systemd/system/multi-user.target.wants/agent-platform-guest-service.service"

cat > /out/guest-bootstrap.sh <<'BOOTSTRAP'
#!/bin/sh
set -eu
install -m 0755 /usr/local/bin/agent-platform-guest-service /usr/local/bin/agent-platform-guest-service
systemctl enable agent-platform-guest-service.service
BOOTSTRAP
chmod 0755 /out/guest-bootstrap.sh

truncate -s "$IMAGE_SIZE_MB"M /out/source.raw
mke2fs -q -t ext4 -L AGENTROOT -d "$ROOTFS" /out/source.raw
chmod -R u+rwX "$ROOTFS" 2>/dev/null || true
rm -rf "$ROOTFS" 2>/dev/null || true
`;
}
