import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import process from 'node:process';

const require = createRequire(import.meta.url);
const apiRequire = createRequire(new URL('../apps/api/package.json', import.meta.url));
const markdownlint = require.resolve('markdownlint-cli2');

function checkYamlConfig(config) {
  const root = mkdtempSync(join(tmpdir(), 'dependency-yaml-'));
  try {
    const configPath = join(root, '.markdownlint-cli2.yaml');
    const documentPath = join(root, 'document.md');
    writeFileSync(configPath, config);
    writeFileSync(documentPath, '# Fixture\n\nA valid Markdown document.\n');
    const result = spawnSync(
      process.execPath,
      [markdownlint, '--config', configPath, documentPath],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 10_000,
      },
    );
    assert.ifError(result.error);
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('patched js-yaml works through the actual Markdown CLI configuration path', () => {
  const result = checkYamlConfig('config:\n  MD013: false\n  MD041: true\n');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const [label, config] of [
  ['malformed', 'config: [unterminated\n'],
  ['duplicate key', 'config:\n  MD013: false\n  MD013: true\n'],
]) {
  test(`patched YAML configuration rejects ${label} input`, () => {
    const result = checkYamlConfig(config);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(
      result.stdout + result.stderr,
      /YAMLException|duplicated mapping key|unexpected end/i,
    );
  });
}

test('patched IP dependency preserves rate-limit IPv4 and IPv6 subnet identities', () => {
  const { ipKeyGenerator } = apiRequire('express-rate-limit');
  assert.equal(ipKeyGenerator('192.0.2.1'), '192.0.2.1');
  assert.equal(ipKeyGenerator('2001:db8:abcd:1201::1'), '2001:db8:abcd:1200::/56');
  assert.equal(ipKeyGenerator('2001:db8:abcd:12ff::2'), ipKeyGenerator('2001:db8:abcd:1201::1'));
  assert.notEqual(ipKeyGenerator('2001:db8:abcd:1300::1'), ipKeyGenerator('2001:db8:abcd:1201::1'));
});
