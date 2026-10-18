import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  fixtureEnvironment,
  gitBlobId,
  vendorDirectory,
  receiptDirectory,
  parseOutputs,
  readRegularBounded,
  verifyRuntime,
  runCase,
} from './dependency-vendor-fixture.mjs';

const framed = (key, value) => `${key}<<ghadelimiter_1234-abcd\n${value}\nghadelimiter_1234-abcd\n`;

test('strict official file-command parser preserves complete inventory and rejects malformed outputs', () => {
  const inventory = JSON.stringify([
    {
      name: 'vitest',
      scope: 'development',
      vulnerabilities: [{ advisory_ghsa_id: 'GHSA-5xrq-8626-4rwp' }],
    },
  ]);
  const parsed = parseOutputs(
    Buffer.from(framed('dependency-changes', inventory) + framed('vulnerable-changes', inventory)),
  );
  assert.equal(parsed['dependency-changes'], inventory);
  assert.equal(parsed['vulnerable-changes'], inventory);
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.deepEqual(Object.keys(parseOutputs(Buffer.alloc(0))), []);
  for (const invalid of [
    framed('dependency-changes', inventory).repeat(2),
    'dependency-changes<<ghadelimiter_1234-abcd\n[]\n',
    'dependency-changes=[]\n',
    '__proto__<<ghadelimiter_1234-abcd\n[]\nghadelimiter_1234-abcd\n',
    framed('dependency-changes', inventory).trimEnd(),
    `${framed('dependency-changes', inventory)}\n`,
  ])
    assert.throws(() => parseOutputs(Buffer.from(invalid)));
  assert.throws(() => parseOutputs(Buffer.from([0xff])));
  assert.throws(() => parseOutputs(Buffer.alloc(1024 * 1024 + 1)));
});

test('bounded regular-file reads reject symlinks, directories, missing and oversized files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vendor-file-controls-'));
  try {
    const file = join(directory, 'input');
    writeFileSync(file, 'exact', { mode: 0o600 });
    assert.equal(readRegularBounded(file, 5).toString(), 'exact');
    assert.throws(() => readRegularBounded(file, 4));
    symlinkSync(file, join(directory, 'link'));
    assert.throws(() => readRegularBounded(join(directory, 'link'), 5));
    assert.throws(() => readRegularBounded(directory, 5));
    assert.throws(() => readRegularBounded(join(directory, 'missing'), 5));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('runtime verification rejects wrong bytes before any vendor execution', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vendor-runtime-controls-'));
  try {
    assert.throws(() => verifyRuntime(directory));
    writeFileSync(join(directory, 'index.js'), 'throw new Error("MUST NOT EXECUTE");');
    assert.throws(() => verifyRuntime(directory));
    writeFileSync(join(directory, 'index.js'), Buffer.alloc(5655958));
    assert.throws(() => verifyRuntime(directory), /SHA-256 mismatch/);
    rmSync(join(directory, 'index.js'));
    mkdirSync(join(directory, 'index.js'));
    assert.throws(() => verifyRuntime(directory));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('fixture child environment has synthetic credentials and no inherited process settings', () => {
  const environment = fixtureEnvironment('/private-fixture', 43210);
  assert.equal(environment.GITHUB_API_URL, 'http://127.0.0.1:43210');
  assert.equal(environment['INPUT_REPO-TOKEN'], 'fixture-not-a-real-token');
  assert.equal(environment['INPUT_RETRY-ON-SNAPSHOT-WARNINGS'], 'false');
  for (const key of [
    'NODE_OPTIONS',
    'NODE_PATH',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'OPENAI_API_KEY',
    'HTTP_PROXY',
    'HTTPS_PROXY',
  ]) {
    assert.equal(Object.hasOwn(environment, key), false);
  }
});

test('inert unit process failure retains capped logs and a non-qualifying failure receipt', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vendor-failure-controls-'));
  try {
    const fixture = join(directory, 'inert-unit-process.cjs');
    writeFileSync(
      fixture,
      'process.stderr.write("inert stderr marker"); process.stdout.write("inert stdout marker" + "x".repeat(300000)); setInterval(() => {}, 1000);',
    );
    await assert.rejects(
      runCase({ name: 'overflow', rows: [], vulnerable: [], exit: 0 }, fixture, directory),
      /Vendor stream exceeded bound/,
    );
    const stdout = readFileSync(join(directory, 'overflow/stdout.log'));
    assert.equal(stdout.length, 256 * 1024);
    assert.ok(stdout.toString().startsWith('inert stdout marker'));
    assert.ok(
      readFileSync(join(directory, 'overflow/stderr.log'), 'utf8').includes('inert stderr marker'),
    );
    const receipt = JSON.parse(readFileSync(join(directory, 'overflow/failure.json'), 'utf8'));
    assert.equal(receipt.qualified, false);
    assert.equal(receipt.phase, 'execution');
    assert.equal(receipt.category, 'Vendor stream exceeded bound');
    assert.equal(receipt.signal, 'SIGKILL');
    assert.deepEqual(receipt.requests, []);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('inert malformed-output unit control retains logs before rejecting output framing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vendor-malformed-controls-'));
  try {
    const fixture = join(directory, 'inert-unit-process.cjs');
    writeFileSync(
      fixture,
      'require("node:fs").appendFileSync(process.env.GITHUB_OUTPUT,"malformed\\n"); process.stdout.write("framing marker");',
    );
    await assert.rejects(
      runCase({ name: 'malformed', rows: [], vulnerable: [], exit: 0 }, fixture, directory),
      /Unexpected action output framing/,
    );
    assert.equal(readFileSync(join(directory, 'malformed/stdout.log'), 'utf8'), 'framing marker');
    const receipt = JSON.parse(readFileSync(join(directory, 'malformed/failure.json'), 'utf8'));
    assert.equal(receipt.qualified, false);
    assert.equal(receipt.phase, 'output-parse');
    assert.equal(receipt.exit, 0);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('canonical fixed Git command computes exact blob identities', () => {
  assert.equal(gitBlobId(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.equal(gitBlobId(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('CLI runtime and result destinations use fixed temporary-directory basenames', () => {
  assert.equal(vendorDirectory, join(tmpdir(), 'agent-platform-dependency-vendor'));
  assert.equal(receiptDirectory, join(tmpdir(), 'agent-platform-dependency-vendor-results'));
});

test('CLI rejects caller-supplied paths before reading or writing fixture destinations', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/dependency-vendor-fixture.mjs', '/untrusted/source', '/untrusted/result'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Official dependency vendor fixtures did not qualify/);
});
