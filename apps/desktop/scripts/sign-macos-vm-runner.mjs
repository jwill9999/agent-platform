#!/usr/bin/env node
/* global console, process */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHelperArgument, resolveMacosVmHelper } from './resolve-macos-vm-helper.mjs';

const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));
const helperPath = resolveMacosVmHelper({ helper: parseHelperArgument(process.argv.slice(2)) });
const entitlementsPath = join(desktopDir, 'native/macos-vm-runner/Entitlements.plist');
const CODESIGN_BINARY = '/usr/bin/codesign';

execFileSync(
  CODESIGN_BINARY,
  ['--force', '--sign', '-', '--entitlements', entitlementsPath, helperPath],
  { stdio: 'inherit' },
);

console.log(`Signed macos-vm-runner helper with development entitlements: ${helperPath}`);
