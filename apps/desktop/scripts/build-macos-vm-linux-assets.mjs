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

const DEFAULT_IMAGE_SIZE_MB = 2048;
const DEFAULT_ALPINE_VERSION = '3.20';
const DEFAULT_BUILDER_IMAGE = `alpine:${DEFAULT_ALPINE_VERSION}`;
const DEFAULT_UBUNTU_UNPACKED_BASE =
  'https://cloud-images.ubuntu.com/daily/server/jammy/current/unpacked';
const DEFAULT_KERNEL_URL = `${DEFAULT_UBUNTU_UNPACKED_BASE}/jammy-server-cloudimg-arm64-vmlinuz-generic`;
const DEFAULT_INITRD_URL = `${DEFAULT_UBUNTU_UNPACKED_BASE}/jammy-server-cloudimg-arm64-initrd-generic`;

const scriptArgs = process.argv.slice(2);
if (scriptArgs[0] === '--') scriptArgs.shift();

const { values } = parseArgs({
  args: scriptArgs,
  options: {
    'out-dir': { type: 'string' },
    'image-size-mb': { type: 'string', default: String(DEFAULT_IMAGE_SIZE_MB) },
    'builder-image': { type: 'string', default: DEFAULT_BUILDER_IMAGE },
    'kernel-url': { type: 'string', default: DEFAULT_KERNEL_URL },
    'initrd-url': { type: 'string', default: DEFAULT_INITRD_URL },
  },
});

const outDir = values['out-dir'];
const imageSizeMb = Number(values['image-size-mb']);
const builderImage = values['builder-image'] ?? DEFAULT_BUILDER_IMAGE;
const kernelUrl = values['kernel-url'] ?? DEFAULT_KERNEL_URL;
const initrdUrl = values['initrd-url'] ?? DEFAULT_INITRD_URL;

if (!outDir || !Number.isInteger(imageSizeMb) || imageSizeMb < 512) {
  console.error(
    [
      'Usage: node scripts/build-macos-vm-linux-assets.mjs --out-dir <dir> [--image-size-mb 2048]',
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

const downloadedKernelPath = join(resolvedOutDir, 'vmlinuz.gz');
const rawKernelPath = join(resolvedOutDir, 'vmlinuz');
downloadFile(kernelUrl, downloadedKernelPath);
await pipeline(createReadStream(downloadedKernelPath), createGunzip(), createWriteStream(rawKernelPath));
downloadFile(initrdUrl, join(resolvedOutDir, 'initrd.img'));
assertRawArm64Kernel(rawKernelPath);

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

function buildScript() {
  return `#!/bin/sh
set -eu

apk add --no-cache alpine-base e2fsprogs linux-virt openrc shadow sudo

rm -rf /tmp/agent-platform-rootfs
mkdir -p /tmp/agent-platform-rootfs

apk add --root /tmp/agent-platform-rootfs --initdb --no-cache \\
  --repositories-file /etc/apk/repositories \\
  --keys-dir /etc/apk/keys \\
  alpine-base \\
  linux-virt \\
  openrc \\
  shadow \\
  sudo

mkdir -p \\
  /tmp/agent-platform-rootfs/etc/init.d \\
  /tmp/agent-platform-rootfs/usr/local/bin \\
  /tmp/agent-platform-rootfs/workspace

cat > /tmp/agent-platform-rootfs/usr/local/bin/agent-platform-guest-service <<'SERVICE'
#!/bin/sh
echo "agent-platform guest service placeholder"
sleep infinity
SERVICE
chmod 0755 /tmp/agent-platform-rootfs/usr/local/bin/agent-platform-guest-service

cat > /tmp/agent-platform-rootfs/etc/init.d/agent-platform-guest-service <<'SERVICE_INIT'
#!/sbin/openrc-run
name="agent-platform-guest-service"
command="/usr/local/bin/agent-platform-guest-service"
command_user="agentplatform"
command_background="yes"
pidfile="/run/agent-platform-guest-service.pid"
SERVICE_INIT
chmod 0755 /tmp/agent-platform-rootfs/etc/init.d/agent-platform-guest-service

chroot /tmp/agent-platform-rootfs /usr/sbin/adduser -D -h /home/agentplatform -s /bin/sh agentplatform
ln -sf /etc/init.d/agent-platform-guest-service \\
  /tmp/agent-platform-rootfs/etc/runlevels/default/agent-platform-guest-service
ln -sf /etc/init.d/devfs /tmp/agent-platform-rootfs/etc/runlevels/sysinit/devfs
ln -sf /etc/init.d/procfs /tmp/agent-platform-rootfs/etc/runlevels/sysinit/procfs
ln -sf /etc/init.d/sysfs /tmp/agent-platform-rootfs/etc/runlevels/sysinit/sysfs

cat > /out/guest-bootstrap.sh <<'BOOTSTRAP'
#!/bin/sh
set -eu
install -m 0755 /usr/local/bin/agent-platform-guest-service /usr/local/bin/agent-platform-guest-service
rc-update add agent-platform-guest-service default
BOOTSTRAP
chmod 0755 /out/guest-bootstrap.sh

truncate -s "$IMAGE_SIZE_MB"M /out/source.raw
mke2fs -q -t ext4 -L AGENTROOT -d /tmp/agent-platform-rootfs /out/source.raw
`;
}
