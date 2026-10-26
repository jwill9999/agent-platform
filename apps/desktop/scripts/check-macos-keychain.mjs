#!/usr/bin/env node
/* global console, process */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SECURITY_BINARY = '/usr/bin/security';
// A service name that is never stored, so the probe only searches and never reads a secret.
const PROBE_SERVICE = 'agent-platform-ci-keychain-preflight-probe';
const PROBE_TIMEOUT_MS = 15_000;
// `security` exits 44 (errSecItemNotFound) when the search ran and found nothing.
const ITEM_NOT_FOUND_STATUS = 44;
const LOCKED_PATTERNS = [/interaction is not allowed/i, /-25308/, /keychain is locked/i];

const REMEDIATION =
  'Runner environment problem, not a code failure: the self-hosted runner user must be logged in ' +
  'with the login Keychain unlocked (for example after a reboot, log in on the runner Mac, then ' +
  're-run the job).';

function usage(exitCode = 1) {
  console.error(
    [
      'Usage: node scripts/check-macos-keychain.mjs [--json]',
      '',
      'Checks that the default macOS Keychain can be searched without user interaction',
      'before the native secure-storage check runs. No Keychain item is read or created.',
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

/** Classifies a `security find-generic-password` probe result into a preflight report. */
export function classifyProbe({ status, stderr = '', timedOut = false, spawnError } = {}) {
  const detail = stderr.trim();
  if (spawnError) {
    return report(false, 'probe_unavailable', `could not run ${SECURITY_BINARY}: ${spawnError}`);
  }
  if (timedOut) {
    return report(
      false,
      'keychain_locked',
      `search did not finish within ${PROBE_TIMEOUT_MS / 1000}s; the Keychain is likely locked and waiting for an unlock prompt`,
    );
  }
  if (status === 0 || status === ITEM_NOT_FOUND_STATUS) {
    return report(true, 'keychain_accessible', 'default Keychain searched without interaction');
  }
  if (LOCKED_PATTERNS.some((pattern) => pattern.test(detail))) {
    return report(false, 'keychain_locked', detail);
  }
  return report(false, 'probe_failed', `exit status ${status}${detail ? `: ${detail}` : ''}`);
}

function report(ok, state, detail) {
  return {
    schemaVersion: 1,
    ok,
    state,
    detail,
    ...(ok ? {} : { remediation: REMEDIATION }),
  };
}

export function probeKeychain(run = spawnSync) {
  if (process.platform !== 'darwin') {
    return report(false, 'probe_unavailable', `requires macOS; platform is ${process.platform}`);
  }
  const result = run(SECURITY_BINARY, ['find-generic-password', '-s', PROBE_SERVICE], {
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: PROBE_TIMEOUT_MS,
  });
  return classifyProbe({
    status: result.status,
    stderr: result.stderr ?? '',
    timedOut: result.error?.code === 'ETIMEDOUT',
    spawnError:
      result.error && result.error.code !== 'ETIMEDOUT' ? result.error.message : undefined,
  });
}

export function formatReport(result) {
  const lines = [
    `macOS Keychain preflight: ${result.ok ? 'passed' : 'failed'} (${result.state})`,
    result.detail,
  ];
  if (result.remediation) lines.push(result.remediation);
  return lines.join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = probeKeychain();
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReport(result));
  }
  if (!result.ok) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log(`::error title=Runner Keychain unavailable::${result.detail}. ${REMEDIATION}`);
    }
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
