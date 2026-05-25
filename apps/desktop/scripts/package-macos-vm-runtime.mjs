#!/usr/bin/env node
/* global console, process */
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const defaultHelper = join(
  desktopDir,
  'native/macos-vm-runner/.build/arm64-apple-macosx/debug/macos-vm-runner',
);
const defaultOutDir = join(desktopDir, 'resources/macos-vm');

function usage(exitCode = 1) {
  console.error(
    [
      'Usage: node scripts/package-macos-vm-runtime.mjs --assets-dir <prepared-images-dir> [options]',
      '',
      'Options:',
      '  --out-dir <dir>       Output resources directory. Default: apps/desktop/resources/macos-vm',
      '  --helper <path>       Helper binary to package. Default: native build output',
      '  --skip-build          Do not run swift build before copying the helper.',
      '',
      'Packages the macOS VM helper and verified prepared VM assets into a stable',
      'Electron resources layout:',
      '  macos-vm/macos-vm-runner',
      '  macos-vm/images/{manifest.json,base-linux.img,vmlinuz,initrd.img,guest-bootstrap.sh}',
    ].join('\n'),
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    outDir: defaultOutDir,
    helper: defaultHelper,
    skipBuild: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--skip-build') {
      options.skipBuild = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) usage();
    if (arg === '--assets-dir') {
      options.assetsDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === '--out-dir') {
      options.outDir = resolve(value);
      index += 1;
      continue;
    }
    if (arg === '--helper') {
      options.helper = resolve(value);
      index += 1;
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    usage();
  }

  if (!options.assetsDir) usage();
  return options;
}

function runSwiftBuild() {
  const result = spawnSync('swift', ['build', '--package-path', 'native/macos-vm-runner'], {
    cwd: desktopDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`${label} is missing: ${path}`);
  }
}

function assertDirectory(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`${label} is missing: ${path}`);
  }
}

function sha256File(path) {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    hash.on('error', reject);
    hash.on('finish', () => resolveDigest(hash.digest('hex')));
    stream.pipe(hash);
  });
}

async function verifyAsset(path, expectedSha256, label) {
  assertFile(path, label);
  const actualSha256 = await sha256File(path);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `${label} checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`,
    );
  }
  return actualSha256;
}

async function loadAndVerifyAssets(assetsDir) {
  assertDirectory(assetsDir, 'Prepared macOS VM asset directory');
  const manifestPath = join(assetsDir, 'manifest.json');
  assertFile(manifestPath, 'macOS VM asset manifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const required = {
    image: manifest.image,
    imageSha256: manifest.imageSha256,
    kernel: manifest.boot?.kernel,
    kernelSha256: manifest.boot?.kernelSha256,
    initrd: manifest.boot?.initrd,
    initrdSha256: manifest.boot?.initrdSha256,
    bootstrap: manifest.bootstrap,
    bootstrapSha256: manifest.bootstrapSha256,
  };

  for (const [key, value] of Object.entries(required)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`macOS VM asset manifest is missing ${key}.`);
    }
  }

  await verifyAsset(join(assetsDir, required.image), required.imageSha256, 'macOS VM image');
  await verifyAsset(join(assetsDir, required.kernel), required.kernelSha256, 'macOS VM kernel');
  await verifyAsset(join(assetsDir, required.initrd), required.initrdSha256, 'macOS VM initrd');
  await verifyAsset(
    join(assetsDir, required.bootstrap),
    required.bootstrapSha256,
    'macOS VM bootstrap',
  );

  return manifest;
}

function copyAssetSet(assetsDir, outImagesDir, manifest) {
  const assetNames = [
    'manifest.json',
    manifest.image,
    manifest.boot.kernel,
    manifest.boot.initrd,
    manifest.bootstrap,
  ];
  mkdirSync(outImagesDir, { recursive: true });
  for (const assetName of assetNames) {
    copyFileSync(join(assetsDir, assetName), join(outImagesDir, assetName));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.skipBuild) runSwiftBuild();

  assertFile(options.helper, 'macOS VM helper binary');
  const manifest = await loadAndVerifyAssets(options.assetsDir);
  const helperSha256 = await sha256File(options.helper);

  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });
  copyFileSync(options.helper, join(options.outDir, 'macos-vm-runner'));
  chmodSync(join(options.outDir, 'macos-vm-runner'), 0o755);
  copyAssetSet(options.assetsDir, join(options.outDir, 'images'), manifest);

  writeFileSync(
    join(options.outDir, 'package-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        packagedAt: new Date().toISOString(),
        repoRoot,
        helper: 'macos-vm-runner',
        helperSha256,
        assets: {
          directory: 'images',
          manifest: 'manifest.json',
          manifestSha256: await sha256File(join(options.assetsDir, 'manifest.json')),
          imageSha256: manifest.imageSha256,
          kernelSha256: manifest.boot.kernelSha256,
          initrdSha256: manifest.boot.initrdSha256,
          bootstrapSha256: manifest.bootstrapSha256,
        },
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Packaged macOS VM runtime resources in ${options.outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
