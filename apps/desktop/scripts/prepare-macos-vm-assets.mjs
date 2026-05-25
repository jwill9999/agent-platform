#!/usr/bin/env node
/* global console, process */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

const GUEST_SERVICE_PORT = 10240;
const GUEST_SERVICE_COMMAND = '/usr/local/bin/agent-platform-guest-service';

const scriptArgs = process.argv.slice(2);
if (scriptArgs[0] === '--') scriptArgs.shift();

const { values } = parseArgs({
  args: scriptArgs,
  options: {
    'source-image': { type: 'string' },
    kernel: { type: 'string' },
    initrd: { type: 'string' },
    'bootstrap': { type: 'string' },
    'kernel-command-line': {
      type: 'string',
      default: 'console=hvc0 root=/dev/vda rw systemd.unit=multi-user.target',
    },
    'out-dir': { type: 'string' },
    architecture: { type: 'string', default: 'arm64' },
  },
});

const sourceImage = values['source-image'];
const kernel = values.kernel;
const initrd = values.initrd;
const bootstrap = values.bootstrap;
const kernelCommandLine = values['kernel-command-line'];
const outDir = values['out-dir'];
const architecture = values.architecture ?? 'arm64';

if (!sourceImage || !kernel || !initrd || !bootstrap || !outDir) {
  console.error(
    [
      'Usage: node scripts/prepare-macos-vm-assets.mjs --source-image <raw-linux.img> --kernel <vmlinuz> --initrd <initrd.img> --bootstrap <guest-bootstrap.sh> --out-dir <dir>',
      '',
      'Creates the macOS VM asset contract expected by macos-vm-runner:',
      '  manifest.json',
      '  base-linux.img',
      '  vmlinuz',
      '  initrd.img',
      '  guest-bootstrap.sh',
    ].join('\n'),
  );
  process.exit(2);
}

if (architecture !== 'arm64') {
  console.error('Only arm64 Linux guest images are supported for the macOS runner.');
  process.exit(2);
}

assertReadableFile(sourceImage, 'source image');
assertReadableFile(kernel, 'Linux kernel');
assertRawArm64Kernel(kernel);
assertReadableFile(initrd, 'Linux initrd');
assertReadableFile(bootstrap, 'guest bootstrap');
mkdirSync(outDir, { recursive: true });

const imagePath = join(outDir, 'base-linux.img');
const kernelPath = join(outDir, 'vmlinuz');
const initrdPath = join(outDir, 'initrd.img');
const bootstrapPath = join(outDir, 'guest-bootstrap.sh');
copyFileSync(sourceImage, imagePath);
copyFileSync(kernel, kernelPath);
copyFileSync(initrd, initrdPath);
copyFileSync(bootstrap, bootstrapPath);

const imageSha256 = await sha256File(imagePath);
const kernelSha256 = await sha256File(kernelPath);
const initrdSha256 = await sha256File(initrdPath);
const bootstrapSha256 = await sha256File(bootstrapPath);
const manifest = {
  schemaVersion: 2,
  architecture,
  imageFormat: 'raw',
  image: basename(imagePath),
  imageSha256,
  boot: {
    loader: 'linux',
    kernel: basename(kernelPath),
    kernelSha256,
    initrd: basename(initrdPath),
    initrdSha256,
    commandLine: kernelCommandLine,
  },
  bootstrap: basename(bootstrapPath),
  bootstrapSha256,
  guestService: {
    transport: 'vsock',
    port: GUEST_SERVICE_PORT,
    command: GUEST_SERVICE_COMMAND,
  },
};

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared macOS VM assets in ${outDir}`);

function assertReadableFile(path, label) {
  try {
    const stats = statSync(path);
    if (!stats.isFile()) throw new Error(`${path} is not a file`);
  } catch (error) {
    console.error(`Unable to read ${label}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function assertRawArm64Kernel(path) {
  const description = execFileSync('file', [path], { encoding: 'utf8' });
  if (!description.includes('Linux kernel ARM64 boot executable Image')) {
    console.error(
      [
        `Unsupported Linux kernel format: ${description.trim()}`,
        'VZLinuxBootLoader requires a raw ARM64 Linux Image.',
        'EFI-stub kernels such as PE32+ executable vmlinuz files fail at VM start with VZErrorDomain code 1.',
      ].join('\n'),
    );
    process.exit(1);
  }
}

async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}
