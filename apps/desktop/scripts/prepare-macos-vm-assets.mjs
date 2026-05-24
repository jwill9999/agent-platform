#!/usr/bin/env node
/* global console, process */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
    'bootstrap': { type: 'string' },
    'out-dir': { type: 'string' },
    architecture: { type: 'string', default: 'arm64' },
  },
});

const sourceImage = values['source-image'];
const bootstrap = values.bootstrap;
const outDir = values['out-dir'];
const architecture = values.architecture ?? 'arm64';

if (!sourceImage || !bootstrap || !outDir) {
  console.error(
    [
      'Usage: node scripts/prepare-macos-vm-assets.mjs --source-image <raw-linux.img> --bootstrap <guest-bootstrap.sh> --out-dir <dir>',
      '',
      'Creates the macOS VM asset contract expected by macos-vm-runner:',
      '  manifest.json',
      '  base-linux.img',
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
assertReadableFile(bootstrap, 'guest bootstrap');
mkdirSync(outDir, { recursive: true });

const imagePath = join(outDir, 'base-linux.img');
const bootstrapPath = join(outDir, 'guest-bootstrap.sh');
copyFileSync(sourceImage, imagePath);
copyFileSync(bootstrap, bootstrapPath);

const imageSha256 = sha256File(imagePath);
const bootstrapSha256 = sha256File(bootstrapPath);
const manifest = {
  schemaVersion: 1,
  architecture,
  imageFormat: 'raw',
  image: basename(imagePath),
  imageSha256,
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

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
