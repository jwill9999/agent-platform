import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const hook = fileURLToPath(new URL('../.husky/pre-push', import.meta.url));
const benchmark = 'test/diagnostics.performance.test.ts';
const vitestOptions = ['--maxWorkers=1', '--minWorkers=1', '--no-file-parallelism'];

function runHook(packages, failure = '') {
  const root = mkdtempSync(join(tmpdir(), 'pre-push-measurement-'));
  const bin = join(root, 'bin');
  const calls = join(root, 'calls.jsonl');
  mkdirSync(bin);
  try {
    for (const [path, name] of packages) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, 'package.json'), JSON.stringify({ name }));
    }
    // Only discovery is stubbed; execute the real hook through /bin/sh and a recording pnpm.
    writeFileSync(
      join(bin, 'git'),
      `#!/bin/sh
case "$1 $2" in
  'rev-parse --abbrev-ref') echo origin/fixture ;;
  'rev-parse --local-env-vars') echo GIT_DIR ;;
  'diff --name-only') printf '%s\\n' "$HOOK_CHANGED_PATHS" ;;
  *) exit 91 ;;
esac
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(bin, 'pnpm'),
      `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.HOOK_CALLS, JSON.stringify({args,gitDir:process.env.GIT_DIR ?? null})+'\\n');
const stage = args[0] === 'deps:check-cycles' ? 'cycles'
  : args.includes('exec') ? 'benchmark'
  : args.includes('typecheck') ? 'typecheck'
  : args.includes('build') ? 'build'
  : args.includes('@agent-platform/api') ? 'api-suite' : 'other-suite';
process.exit(stage === process.env.HOOK_FAILURE ? 23 : 0);
`,
      { mode: 0o755 },
    );
    const result = spawnSync('/bin/sh', [hook], {
      cwd: root,
      env: {
        PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`,
        GIT_DIR: '/fixture/parent/git-dir',
        HOOK_CHANGED_PATHS: packages.map(([path]) => `${path}/changed.ts`).join('\n'),
        HOOK_CALLS: calls,
        HOOK_FAILURE: failure,
      },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.ifError(result.error);
    const invocations = readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(invocations.every(({ gitDir }) => gitDir === null));
    return { status: result.status, args: invocations.map(({ args }) => args) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const api = ['apps/api', '@agent-platform/api'];
const desktop = ['apps/desktop', '@agent-platform/desktop'];
const expectedApiSuite = [
  '--filter',
  '@agent-platform/api',
  'run',
  'test',
  ...vitestOptions,
  '--exclude',
  '**/diagnostics.performance.test.ts',
];
const expectedBenchmark = [
  '--filter',
  '@agent-platform/api',
  'exec',
  'vitest',
  'run',
  benchmark,
  ...vitestOptions,
];

test('API-only selection requires the ordinary suite and one fresh full benchmark', () => {
  const result = runHook([api]);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
  assert.equal(result.args.length, 5); // cycles, build, typecheck, suite, benchmark
});

test('mixed selection tests each package once and measures only after other suites complete', () => {
  const result = runHook([api, desktop]);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-3), [
    ['--filter', '@agent-platform/desktop', 'run', 'test'],
    expectedApiSuite,
    expectedBenchmark,
  ]);
  assert.equal(result.args.length, 6);
});

test('non-API selection preserves existing argv without adding or excluding tests', () => {
  const result = runHook([desktop]);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args, [
    ['deps:check-cycles'],
    ...['build', 'typecheck', 'test'].map((command) => [
      '--filter',
      '@agent-platform/desktop',
      'run',
      command,
    ]),
  ]);
});

test('similar package name does not activate the API-only benchmark path', () => {
  const result = runHook([['packages/api-extra', '@agent-platform/api-extra']]);
  assert.equal(result.status, 0);
  assert.ok(!result.args.some((args) => args.includes('exec') || args.includes('--exclude')));
});

for (const failure of ['cycles', 'build', 'typecheck', 'other-suite', 'api-suite']) {
  test(`${failure} failure stops the hook before the benchmark and preserves failure`, () => {
    const result = runHook([api, desktop], failure);
    // The existing cycle boundary emits its own diagnostic and normalizes failure to exit1.
    assert.equal(result.status, failure === 'cycles' ? 1 : 23);
    assert.ok(!result.args.some((args) => args.includes('exec')));
  });
}

test('benchmark failure cannot be masked by an earlier passing suite', () => {
  const result = runHook([api, desktop], 'benchmark');
  assert.equal(result.status, 23);
  assert.deepEqual(result.args.at(-1), expectedBenchmark);
});
