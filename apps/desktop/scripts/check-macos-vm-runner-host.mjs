#!/usr/bin/env node
/* global console, process */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MIN_MACOS_MAJOR = 15;
const UNAME_BINARY = '/usr/bin/uname';
const SW_VERS_BINARY = '/usr/bin/sw_vers';
const SYSCTL_BINARY = '/usr/sbin/sysctl';
const XCODE_SELECT_BINARY = '/usr/bin/xcode-select';
const XCRUN_BINARY = '/usr/bin/xcrun';
const VIRTUALIZATION_FRAMEWORK = '/System/Library/Frameworks/Virtualization.framework';

function usage(exitCode = 1) {
  console.error(
    [
      'Usage: node scripts/check-macos-vm-runner-host.mjs [--json]',
      '',
      'Checks whether the current machine is suitable for the packaged macOS VM',
      'staging runner gate. This is a host preflight, not a replacement for the',
      'real packaged VM E2E boot proof.',
    ].join('\n'),
  );
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const scriptArgs = [...argv];
  if (scriptArgs[0] === '--') scriptArgs.shift();
  const options = { json: false };
  for (const arg of scriptArgs) {
    switch (arg) {
      case '--help':
      case '-h':
        usage(0);
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

function runText(binary, args) {
  try {
    return execFileSync(binary, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return undefined;
  }
}

export function parseMacosMajor(version) {
  const major = Number(version.split('.')[0]);
  return Number.isInteger(major) ? major : undefined;
}

function checkHost() {
  const platform = process.platform;
  const arch = runText(UNAME_BINARY, ['-m']) ?? process.arch;
  const macosVersion = runText(SW_VERS_BINARY, ['-productVersion']);
  const macosMajor = macosVersion ? parseMacosMajor(macosVersion) : undefined;
  const virtualizationFrameworkPresent = existsSync(VIRTUALIZATION_FRAMEWORK);
  const hypervisorSupport = runText(SYSCTL_BINARY, ['-n', 'kern.hv_support']);
  const developerDir = runText(XCODE_SELECT_BINARY, ['-p']);
  const swiftPath = runText(XCRUN_BINARY, ['--find', 'swift']);
  const codesignPath = runText(XCRUN_BINARY, ['--find', 'codesign']);
  const checks = [
    {
      name: 'platform',
      ok: platform === 'darwin',
      actual: platform,
      expected: 'darwin',
    },
    {
      name: 'architecture',
      ok: arch === 'arm64',
      actual: arch,
      expected: 'arm64',
    },
    {
      name: 'macos_version',
      ok: typeof macosMajor === 'number' && macosMajor >= MIN_MACOS_MAJOR,
      actual: macosVersion ?? 'unknown',
      expected: `macOS ${MIN_MACOS_MAJOR}.0 or newer`,
    },
    {
      name: 'virtualization_framework',
      ok: virtualizationFrameworkPresent,
      actual: virtualizationFrameworkPresent ? VIRTUALIZATION_FRAMEWORK : 'missing',
      expected: VIRTUALIZATION_FRAMEWORK,
    },
    {
      name: 'hypervisor_support',
      ok: hypervisorSupport === '1' || hypervisorSupport === undefined,
      actual: hypervisorSupport ?? 'unknown',
      expected: '1, or unavailable when sysctl is blocked by the current shell sandbox',
    },
    {
      name: 'xcode_select',
      ok: typeof developerDir === 'string' && developerDir.length > 0,
      actual: developerDir ?? 'missing',
      expected: 'configured developer directory',
    },
    {
      name: 'swift_toolchain',
      ok: typeof swiftPath === 'string' && swiftPath.length > 0,
      actual: swiftPath ?? 'missing',
      expected: 'xcrun --find swift',
    },
    {
      name: 'codesign_tool',
      ok: typeof codesignPath === 'string' && codesignPath.length > 0,
      actual: codesignPath ?? 'missing',
      expected: 'xcrun --find codesign',
    },
  ];

  return {
    schemaVersion: 1,
    ok: checks.every((check) => check.ok),
    message:
      'macOS VM runner host preflight checks the machine prerequisites only; packaged VM E2E still provides the real boot proof.',
    checks,
  };
}

export function formatReport(report) {
  const lines = [`macOS VM runner host preflight: ${report.ok ? 'passed' : 'failed'}`];
  for (const check of report.checks) {
    lines.push(
      `${check.ok ? 'OK' : 'FAIL'} ${check.name}: actual=${check.actual}; expected=${check.expected}`,
    );
  }
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = checkHost();
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }
  if (!report.ok) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
