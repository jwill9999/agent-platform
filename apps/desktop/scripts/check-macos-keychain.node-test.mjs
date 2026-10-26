import assert from 'node:assert/strict';
import process from 'node:process';
import { test } from 'node:test';
import { classifyProbe, formatReport, probeKeychain } from './check-macos-keychain.mjs';

test('treats a search that finds no item as an accessible Keychain', () => {
  const result = classifyProbe({
    status: 44,
    stderr:
      'security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.',
  });
  assert.equal(result.ok, true);
  assert.equal(result.state, 'keychain_accessible');
  assert.equal(result.remediation, undefined);
});

test('reports errSecInteractionNotAllowed as a locked runner Keychain', () => {
  const result = classifyProbe({
    status: 36,
    stderr: 'security: SecKeychainSearchCopyNext: User interaction is not allowed.',
  });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'keychain_locked');
  assert.match(formatReport(result), /Runner environment problem, not a code failure/);
});

test('reports a probe that hangs on an unlock prompt as locked', () => {
  const result = classifyProbe({ status: null, timedOut: true });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'keychain_locked');
});

test('keeps unrecognised failures distinct from a locked Keychain', () => {
  const result = classifyProbe({ status: 51, stderr: 'security: unexpected failure' });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'probe_failed');
  assert.match(result.detail, /exit status 51: security: unexpected failure/);
});

test('probes only by service name, without reading secrets, and bounds the wait', (t) => {
  if (process.platform !== 'darwin') {
    t.skip('probe command shape is only exercised on macOS');
    return;
  }
  const result = probeKeychain((binary, args, options) => {
    assert.equal(binary, '/usr/bin/security');
    assert.deepEqual(args, [
      'find-generic-password',
      '-s',
      'agent-platform-ci-keychain-preflight-probe',
    ]);
    assert.ok(!args.includes('-w') && !args.includes('-g'), 'must not request secret data');
    assert.equal(options.timeout, 15_000);
    return {
      status: null,
      stderr: '',
      error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
    };
  });
  assert.equal(result.state, 'keychain_locked');
});
