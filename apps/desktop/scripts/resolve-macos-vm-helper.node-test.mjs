import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseHelperArgument, resolveMacosVmHelper } from './resolve-macos-vm-helper.mjs';

function fixture(t, layout) {
  const root = mkdtempSync(join(tmpdir(), 'vm helper "quoted" '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const binDir = join(root, layout);
  mkdirSync(binDir, { recursive: true });
  const helper = join(binDir, 'macos-vm-runner');
  writeFileSync(helper, '#!/bin/sh\n');
  chmodSync(helper, 0o755);
  return { root, binDir, helper };
}

for (const layout of ['arm64-apple-macosx/debug', 'out/Products/Debug']) {
  test(`discovers executable in toolchain output ${layout} with literal quote/space path`, (t) => {
    const { root, binDir, helper } = fixture(t, layout);
    const run = (binary, args, options) => {
      assert.equal(binary, '/usr/bin/swift');
      assert.deepEqual(args, [
        'build',
        '--package-path',
        'native/macos-vm-runner',
        '--show-bin-path',
      ]);
      assert.equal(options.cwd, root);
      return `${binDir}\n`;
    };
    assert.equal(resolveMacosVmHelper({ run, cwd: root }), helper);
  });
}

test('explicit executable helper bypasses unavailable Swift discovery', (t) => {
  const { helper } = fixture(t, 'custom');
  assert.equal(
    resolveMacosVmHelper({ helper, run: () => assert.fail('unexpected Swift invocation') }),
    helper,
  );
});

test('Swift query failure propagates instead of guessing an output layout', () => {
  assert.throws(
    () =>
      resolveMacosVmHelper({
        run: () => {
          throw new Error('toolchain unavailable');
        },
      }),
    /toolchain unavailable/,
  );
});

for (const invalid of ['empty', 'newline', 'relative', 'multiline', 'nul']) {
  test(`invalid Swift output ${invalid} fails closed`, (t) => {
    const { binDir } = fixture(t, 'output');
    const outputs = {
      empty: '',
      newline: '\n',
      relative: 'relative/debug\n',
      multiline: `${binDir}\n${join(binDir, 'second')}\n`,
      nul: `${binDir}\0second`,
    };
    assert.throws(
      () => resolveMacosVmHelper({ run: () => outputs[invalid] }),
      /one absolute directory/,
    );
  });
}

test('missing helper, directory and non-executable file fail without discovery fallback', (t) => {
  const { binDir, helper } = fixture(t, 'output');
  const run = () => assert.fail('unexpected Swift invocation');
  assert.throws(() => resolveMacosVmHelper({ helper: join(binDir, 'missing'), run }), /missing/);
  assert.throws(() => resolveMacosVmHelper({ helper: binDir, run }), /executable file/);
  chmodSync(helper, 0o644);
  assert.throws(() => resolveMacosVmHelper({ helper, run }), /executable file/);
});

test('newline helper path cannot inject a workflow environment variable', (t) => {
  const { helper } = fixture(t, 'output');
  assert.throws(() => resolveMacosVmHelper({ helper: `${helper}\nINJECTED=value` }), /single-line/);
});

test('signing accepts only a complete structured helper override', (t) => {
  const { helper: path } = fixture(t, 'literal "quote" space');
  assert.equal(parseHelperArgument([]), undefined);
  assert.equal(parseHelperArgument(['--helper', path]), path);
  assert.equal(parseHelperArgument(['--', '--helper', path]), path);
  for (const args of [['--helper'], ['--unknown', path], ['--helper', path, 'extra']]) {
    assert.throws(() => parseHelperArgument(args), /Usage:/);
  }
});
