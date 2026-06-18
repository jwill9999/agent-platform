#!/usr/bin/env node

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const requireFromDesktop = createRequire(path.join(process.cwd(), 'apps/desktop/package.json'));
const electronPackagePath = requireFromDesktop.resolve('electron/package.json');
const electronRoot = path.dirname(electronPackagePath);
const requireFromElectron = createRequire(electronPackagePath);

const { downloadArtifact } = requireFromElectron('@electron/get');
const extract = requireFromElectron('extract-zip');
const { version } = requireFromElectron('./package.json');
const checksums = requireFromElectron('./checksums.json');

const platform =
  process.env.ELECTRON_INSTALL_PLATFORM ?? process.env.npm_config_platform ?? process.platform;
const arch = resolveArch(platform);
const platformPath = getPlatformPath(platform);
const markerPath = path.join(electronRoot, 'path.txt');
const distPath = process.env.ELECTRON_OVERRIDE_DIST_PATH ?? path.join(electronRoot, 'dist');

if (isInstalled()) {
  console.log(`Electron binary ready: ${platformPath}`);
  process.exit(0);
}

if (hasMatchingDist()) {
  await fs.promises.writeFile(markerPath, platformPath);
  console.log(`Electron binary ready: ${platformPath}`);
  process.exit(0);
}

const zipPath = await downloadArtifact({
  version,
  artifactName: 'electron',
  force: process.env.force_no_cache === 'true',
  cacheRoot: process.env.electron_config_cache,
  checksums:
    process.env.electron_use_remote_checksums ||
    process.env.npm_config_electron_use_remote_checksums
      ? undefined
      : checksums,
  platform,
  arch,
});

await fs.promises.rm(distPath, { force: true, recursive: true });
await extractWithKeepAlive(zipPath, distPath);

const extractedTypes = path.join(distPath, 'electron.d.ts');
if (fs.existsSync(extractedTypes)) {
  fs.renameSync(extractedTypes, path.join(electronRoot, 'electron.d.ts'));
}

await fs.promises.writeFile(markerPath, platformPath);

if (!isInstalled()) {
  throw new Error(`Electron binary missing after install: ${path.join(distPath, platformPath)}`);
}

console.log(`Electron binary ready: ${platformPath}`);

function isInstalled() {
  if (!hasMatchingDist()) {
    return false;
  }

  try {
    if (fs.readFileSync(markerPath, 'utf8') !== platformPath) {
      return false;
    }
  } catch {
    return false;
  }

  return fs.existsSync(
    process.env.ELECTRON_OVERRIDE_DIST_PATH ?? path.join(distPath, platformPath),
  );
}

function hasMatchingDist() {
  try {
    if (fs.readFileSync(path.join(distPath, 'version'), 'utf8').replace(/^v/, '') !== version) {
      return false;
    }
  } catch {
    return false;
  }

  return fs.existsSync(
    process.env.ELECTRON_OVERRIDE_DIST_PATH ?? path.join(distPath, platformPath),
  );
}

function resolveArch(targetPlatform) {
  let targetArch = process.env.ELECTRON_INSTALL_ARCH ?? process.env.npm_config_arch ?? process.arch;

  return targetArch;
}

async function extractWithKeepAlive(zipPath, targetDirectory) {
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await extract(zipPath, { dir: targetDirectory });
  } finally {
    clearInterval(keepAlive);
  }
}

function getPlatformPath(targetPlatform) {
  switch (targetPlatform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron';
    case 'win32':
      return 'electron.exe';
    default:
      throw new Error(`Electron builds are not available on platform: ${targetPlatform}`);
  }
}
