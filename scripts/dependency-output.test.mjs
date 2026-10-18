import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { afterEach, test } from 'node:test';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import {
  MAX_VENDOR_OUTPUT_BYTES,
  readVendorOutput,
  writeVendorOutput,
} from './dependency-output.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dependency-output-'));
  roots.push(directory);
  return {
    directory,
    kind: 'dependency-changes',
    path: join(directory, 'dependency-vendor-changes.json'),
  };
}
const asArray = (payload) => JSON.stringify([{ payload }]);

function expectedError(operation) {
  assert.throws(operation, /Dependency review incomplete:/);
}

test('the observed 171440-character inventory round trips in a fixed private file', () => {
  const input = fixture();
  const empty = asArray('');
  const data = asArray('a'.repeat(171_440 - empty.length));
  assert.equal(data.length, 171_440);
  assert.equal(writeVendorOutput({ ...input, data }), input.path);
  assert.equal(statSync(input.path).mode & 0o777, 0o600);
  assert.equal(readVendorOutput(input), data);
});

test('missing, non-string, malformed and non-array outputs never create a file', () => {
  for (const data of [undefined, null, [], {}, 12, '', '[', '{}', 'null', '"[]"']) {
    const input = fixture();
    expectedError(() => writeVendorOutput({ ...input, data }));
    assert.equal(existsSync(input.path), false);
  }
});

test('the UTF-8 byte limit is enforced without truncation or lossy encoding', () => {
  const exact = asArray('a'.repeat(MAX_VENDOR_OUTPUT_BYTES - asArray('').length));
  const input = fixture();
  writeVendorOutput({ ...input, data: exact });
  assert.equal(readVendorOutput(input), exact);
  for (const data of [
    exact + ' ',
    asArray('é'.repeat(MAX_VENDOR_OUTPUT_BYTES / 2)),
    '["\ud800"]',
  ]) {
    const next = fixture();
    expectedError(() => writeVendorOutput({ ...next, data }));
    assert.equal(existsSync(next.path), false);
  }
});

test('fixed filenames and exclusive creation reject collisions and symlinks without overwriting', () => {
  const input = fixture();
  writeVendorOutput({ ...input, data: '[]' });
  assert.throws(() => writeVendorOutput({ ...input, data: '[1]' }), /EEXIST/);
  assert.equal(readFileSync(input.path, 'utf8'), '[]');
  const linked = fixture();
  symlinkSync(input.path, linked.path);
  assert.throws(() => writeVendorOutput({ ...linked, data: '[1]' }), /EEXIST/);
  assert.equal(readFileSync(input.path, 'utf8'), '[]');
  expectedError(() => writeVendorOutput({ ...fixture(), kind: '../other', data: '[]' }));
  expectedError(() => writeVendorOutput({ directory: 'relative', kind: input.kind, data: '[]' }));
});

test('file reads fail closed for missing, wrong-path, linked, public or non-regular data', () => {
  const missing = fixture();
  assert.throws(() => readVendorOutput(missing), /ENOENT/);
  const input = fixture();
  writeVendorOutput({ ...input, data: '[]' });
  expectedError(() => readVendorOutput({ ...input, path: input.path + '.other' }));
  const linked = fixture();
  symlinkSync(input.path, linked.path);
  assert.throws(() => readVendorOutput(linked), /ELOOP/);
  rmSync(linked.path);
  linkSync(input.path, linked.path);
  expectedError(() => readVendorOutput(linked));
  rmSync(linked.path);
  chmodSync(input.path, 0o644);
  expectedError(() => readVendorOutput(input));
  const directory = fixture();
  mkdirSync(directory.path, { mode: 0o700 });
  expectedError(() => readVendorOutput(directory));
});

test('bounded reads reject oversized, malformed, truncated and invalid UTF-8 files', () => {
  for (const bytes of [
    Buffer.alloc(MAX_VENDOR_OUTPUT_BYTES + 1, ' '),
    Buffer.from('[{}'),
    Buffer.from('{}'),
    Buffer.from('["\xff"]', 'binary'),
    Buffer.from('\ufeff[]'),
  ]) {
    const input = fixture();
    writeFileSync(input.path, bytes, { mode: 0o600 });
    expectedError(() => readVendorOutput(input));
  }
});

test('both inventory kinds use separate fixed files with exact contents', () => {
  const input = fixture();
  writeVendorOutput({ ...input, data: '[1]' });
  const vulnerable = {
    directory: input.directory,
    kind: 'vulnerable-changes',
    path: join(input.directory, 'dependency-vendor-vulnerable-changes.json'),
  };
  writeVendorOutput({ ...vulnerable, data: '[2]' });
  assert.equal(readVendorOutput(input), '[1]');
  assert.equal(readVendorOutput(vulnerable), '[2]');
});

test('evaluated Node scripts preserve large adversarial data without environment transport or execution', () => {
  const input = fixture();
  const marker = join(input.directory, 'must-not-exist');
  const attack = `';process.mainModule?.require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad');//\n\`$(touch ${marker})\`\n\${globalThis.process.exit(99)}\u2028\u2029`;
  const data = asArray(attack + 'a'.repeat(171_440));
  const script = join(input.directory, 'evaluated-output.mjs');
  const module = pathToFileURL(
    fileURLToPath(new URL('./dependency-output.mjs', import.meta.url)),
  ).href;
  writeFileSync(
    script,
    `import {writeVendorOutput} from ${JSON.stringify(module)};\nconst data = ${JSON.stringify(data)};\nwriteVendorOutput({directory:${JSON.stringify(input.directory)},kind:'dependency-changes',data});\n`,
    { mode: 0o600 },
  );
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.error, undefined);
  assert.equal(existsSync(marker), false);
  assert.equal(readVendorOutput(input), data);
});

test('missing ordinary or negative-control files fail before any API request', () => {
  for (const negative of [false, true]) {
    const input = fixture();
    if (negative) writeVendorOutput({ ...input, data: '[]' });
    const marker = join(input.directory, 'unexpected-api-call');
    const preload = join(input.directory, 'fetch-fixture.mjs');
    writeFileSync(
      preload,
      `import {writeFileSync} from 'node:fs';globalThis.fetch=()=>{writeFileSync(${JSON.stringify(marker)},'called');throw new Error('unexpected request');};`,
      { mode: 0o600 },
    );
    const script = fileURLToPath(new URL('./dependency-review.mjs', import.meta.url));
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, script], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        PATH: process.env.PATH,
        RUNNER_TEMP: input.directory,
        GITHUB_REPOSITORY: 'fixture/repository',
        DEPENDENCY_BASE_SHA: '1'.repeat(40),
        DEPENDENCY_HEAD_SHA: '2'.repeat(40),
        GH_TOKEN: 'fixture-only-token',
        VENDOR_CHANGES_FILE: input.path,
        VENDOR_VULNERABLE_CHANGES_FILE: join(
          input.directory,
          'dependency-vendor-vulnerable-changes.json',
        ),
        DEPENDENCY_NEGATIVE_CONTROL: String(negative),
      },
    });
    assert.equal(result.status, 1);
    assert.equal(result.error, undefined);
    assert.equal(existsSync(marker), false);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /fixture-only-token/);
  }
});
