#!/usr/bin/env node
/* global console, process */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultRuntimeDir = join(desktopDir, 'resources/macos-vm');
const CODESIGN_BINARY = '/usr/bin/codesign';
const XATTR_BINARY = '/usr/bin/xattr';
const REQUIRED_ENTITLEMENT = 'com.apple.security.virtualization';

function usage(exitCode = 1) {
  console.error(
    [
      'Usage: node scripts/verify-macos-vm-signing.mjs [--runtime-dir <dir> | --helper <path> | --app <Agent Platform.app>] [options]',
      '',
      'Options:',
      '  --runtime-dir <dir>             Directory containing macos-vm-runner. Default: apps/desktop/resources/macos-vm',
      '  --helper <path>                 Exact helper binary path to verify.',
      '  --app <path>                    Packaged .app path; helper is read from Contents/Resources/macos-vm.',
      '  --require-hardened-runtime      Require hardened runtime metadata in the helper signature.',
      '  --json                          Print a machine-readable verification report.',
      '',
      'Fails closed when the packaged macOS VM helper is missing, non-executable, unsigned,',
      'quarantined, or missing the Virtualization.framework entitlement.',
    ].join('\n'),
  );
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const scriptArgs = stripForwardedSeparator(argv);
  const options = {
    runtimeDir: defaultRuntimeDir,
    requireHardenedRuntime: false,
    json: false,
  };

  for (let index = 0; index < scriptArgs.length; index += 1) {
    const arg = scriptArgs[index];
    switch (arg) {
      case '--help':
      case '-h':
        usage(0);
        break;
      case '--runtime-dir':
      case '--helper':
      case '--app': {
        applyPathOption(options, arg, readOptionValue(scriptArgs, index));
        index += 1;
        break;
      }
      case '--require-hardened-runtime':
        options.requireHardenedRuntime = true;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        usage();
    }
  }

  return options;
}

function stripForwardedSeparator(argv) {
  const scriptArgs = [...argv];
  if (scriptArgs[0] === '--') scriptArgs.shift();
  return scriptArgs;
}

function readOptionValue(args, index) {
  const value = args[index + 1];
  if (!value) usage();
  return value;
}

function applyPathOption(options, arg, value) {
  if (arg === '--runtime-dir') {
    options.runtimeDir = resolve(value);
    delete options.helper;
    delete options.app;
    return;
  }
  if (arg === '--helper') {
    options.helper = resolve(value);
    delete options.app;
    return;
  }
  options.app = resolve(value);
  delete options.helper;
}

export function resolveHelperPath(options) {
  if (options.helper) return options.helper;
  if (options.app) return join(options.app, 'Contents/Resources/macos-vm/macos-vm-runner');
  return join(options.runtimeDir, 'macos-vm-runner');
}

function isXmlWhitespace(char) {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function skipXmlWhitespace(value, index) {
  let cursor = index;
  while (cursor < value.length && isXmlWhitespace(value[cursor] ?? '')) {
    cursor += 1;
  }
  return cursor;
}

export function hasTrueEntitlement(plist, entitlement) {
  const keyToken = `<key>${entitlement}</key>`;
  let searchStart = 0;

  while (searchStart < plist.length) {
    const keyIndex = plist.indexOf(keyToken, searchStart);
    if (keyIndex === -1) return false;

    const valueIndex = skipXmlWhitespace(plist, keyIndex + keyToken.length);
    if (plist.startsWith('<true/>', valueIndex) || plist.startsWith('<true />', valueIndex)) {
      return true;
    }
    if (plist.startsWith('<false/>', valueIndex) || plist.startsWith('<false />', valueIndex)) {
      return false;
    }

    searchStart = keyIndex + keyToken.length;
  }

  return false;
}

function run(binary, args) {
  return spawnSync(binary, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function assertHelperFile(helperPath) {
  if (!existsSync(helperPath)) {
    throw new Error(`macOS VM helper is missing: ${helperPath}`);
  }
  const stats = statSync(helperPath);
  if (!stats.isFile()) {
    throw new Error(`macOS VM helper is not a file: ${helperPath}`);
  }
  if ((stats.mode & 0o111) === 0) {
    throw new Error(`macOS VM helper is not executable: ${helperPath}`);
  }
}

function assertNotQuarantined(helperPath) {
  const result = run(XATTR_BINARY, ['-p', 'com.apple.quarantine', helperPath]);
  if (result.status === 0) {
    throw new Error(`macOS VM helper is quarantined and must not be released: ${helperPath}`);
  }
}

function assertCodesignAvailable() {
  if (!existsSync(CODESIGN_BINARY)) {
    throw new Error(`codesign binary is missing: ${CODESIGN_BINARY}`);
  }
}

function assertSignature(helperPath) {
  const result = run(CODESIGN_BINARY, ['--verify', '--strict', '--verbose=2', helperPath]);
  if (result.status !== 0) {
    throw new Error(
      `macOS VM helper signature verification failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
}

function readDisplayInfo(helperPath) {
  const result = run(CODESIGN_BINARY, ['--display', '--verbose=4', helperPath]);
  if (result.status !== 0) {
    throw new Error(
      `macOS VM helper signature metadata could not be read: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return `${result.stdout}${result.stderr}`;
}

function readEntitlements(helperPath) {
  const result = run(CODESIGN_BINARY, ['--display', '--entitlements', ':-', helperPath]);
  if (result.status !== 0) {
    throw new Error(
      `macOS VM helper entitlements could not be read: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return `${result.stdout}${result.stderr}`;
}

function assertHardenedRuntime(displayInfo) {
  if (!displayInfo.includes('Runtime Version=')) {
    throw new Error('macOS VM helper signature does not include hardened runtime metadata.');
  }
}

export function buildReport(helperPath, displayInfo, entitlements, options) {
  return {
    schemaVersion: 1,
    helper: helperPath,
    signature: {
      verified: true,
      hardenedRuntimeRequired: options.requireHardenedRuntime,
      hardenedRuntime: displayInfo.includes('Runtime Version='),
    },
    quarantine: {
      absent: true,
    },
    entitlements: {
      [REQUIRED_ENTITLEMENT]: hasTrueEntitlement(entitlements, REQUIRED_ENTITLEMENT),
    },
  };
}

export function verifyMacosVmSigning(options) {
  const helperPath = resolveHelperPath(options);
  assertHelperFile(helperPath);
  assertNotQuarantined(helperPath);
  assertCodesignAvailable();
  assertSignature(helperPath);
  const displayInfo = readDisplayInfo(helperPath);
  if (options.requireHardenedRuntime) assertHardenedRuntime(displayInfo);
  const entitlements = readEntitlements(helperPath);
  if (!hasTrueEntitlement(entitlements, REQUIRED_ENTITLEMENT)) {
    throw new Error(`macOS VM helper is missing required entitlement: ${REQUIRED_ENTITLEMENT}`);
  }
  return buildReport(helperPath, displayInfo, entitlements, options);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = verifyMacosVmSigning(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Verified macOS VM helper signing: ${report.helper}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
