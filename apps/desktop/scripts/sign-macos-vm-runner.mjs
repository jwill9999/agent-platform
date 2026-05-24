#!/usr/bin/env node
/* global console, process */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));
const helperPath = join(
  desktopDir,
  'native/macos-vm-runner/.build/arm64-apple-macosx/debug/macos-vm-runner',
);
const entitlementsPath = join(desktopDir, 'native/macos-vm-runner/Entitlements.plist');

if (!existsSync(helperPath)) {
  console.error(`macos-vm-runner helper binary was not found: ${helperPath}`);
  process.exit(1);
}

execFileSync(
  'codesign',
  ['--force', '--sign', '-', '--entitlements', entitlementsPath, helperPath],
  { stdio: 'inherit' },
);

console.log(`Signed macos-vm-runner helper with development entitlements: ${helperPath}`);
