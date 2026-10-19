import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { URL } from 'node:url';
import { BENCHMARK_ARGS } from './run-diagnostics-benchmark-host.mjs';

const require = createRequire(import.meta.url);
const { parse } = createRequire(require.resolve('eslint'))('yaml');
const workflow = parse(
  readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
);
const benchmark = workflow.jobs['diagnostic-performance'];
const verify = workflow.jobs.verify;
const guard = verify.steps[0];

test('the required verify check depends on benchmark success and guards before checkout', () => {
  assert.equal(verify.needs, 'diagnostic-performance');
  assert.equal(verify.if, '${{ always() }}');
  assert.equal(verify['timeout-minutes'], 30);
  assert.equal(guard.name, 'Require successful isolated diagnostic performance');
  assert.deepEqual(guard.env, {
    DIAGNOSTIC_PERFORMANCE_RESULT: '${{ needs.diagnostic-performance.result }}',
  });
  assert.equal(guard.if, undefined);
  assert.equal(guard.uses, undefined);
  assert.match(verify.steps[1].uses, /^actions\/checkout@/u);
  for (const job of [benchmark, verify]) {
    assert.equal(job['continue-on-error'], undefined);
    for (const step of job.steps) assert.equal(step['continue-on-error'], undefined);
  }
});

for (const status of [
  'success',
  'failure',
  'skipped',
  'cancelled',
  '',
  undefined,
  'SUCCESS',
  'unknown',
]) {
  test(`the actual pre-checkout shell guard handles ${status ?? 'missing'} result`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'diagnostic-gate-'));
    try {
      const env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin` };
      if (status !== undefined) env.DIAGNOSTIC_PERFORMANCE_RESULT = status;
      const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', guard.run], {
        cwd: directory,
        env,
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, status === 'success' ? 0 : 1, result.stderr);
      assert.equal(result.signal, null);
      assert.equal(existsSync(join(directory, 'scripts')), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('dependency result text cannot execute shell commands in the real guard', () => {
  const directory = mkdtempSync(join(tmpdir(), 'diagnostic-gate-data-'));
  try {
    const marker = join(directory, 'unexpected-effect');
    const result = spawnSync('/bin/bash', ['-e', '-o', 'pipefail', '-c', guard.run], {
      cwd: directory,
      env: {
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
        DIAGNOSTIC_PERFORMANCE_RESULT: `success; touch '${marker}'; $(touch '${marker}')`,
      },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the fresh benchmark job has no ordinary suite, preload or cooldown', () => {
  assert.equal(benchmark['runs-on'], 'ubuntu-latest');
  assert.equal(benchmark['timeout-minutes'], 30);
  assert.equal(benchmark.needs, undefined);
  assert.equal(benchmark.if, undefined);
  const measurementIndex = benchmark.steps.findIndex(
    ({ name }) => name === 'Diagnostic performance in a fresh process',
  );
  assert.ok(measurementIndex > 0);
  const before = benchmark.steps.slice(0, measurementIndex);
  assert.deepEqual(
    before.map(({ name }) => name),
    [
      'Checkout',
      'Setup pnpm',
      'Setup Node',
      'Install',
      'Rebuild native dependencies',
      'Build',
      'Test isolated diagnostic CI boundaries',
    ],
  );
  for (const { run = '', env = {} } of before) {
    assert.doesNotMatch(
      run,
      /diagnostics\.performance|benchmark-observer|sleep|--import|pnpm.*run test/u,
    );
    assert.equal(env.NODE_OPTIONS, undefined);
  }
  const measurement = benchmark.steps[measurementIndex];
  assert.equal(measurement.run, 'node scripts/run-diagnostics-benchmark-host.mjs');
  assert.equal(measurement.if, undefined);
  assert.deepEqual(measurement.env, {
    DIAGNOSTICS_BENCHMARK_RESULT: '${{ runner.temp }}/diagnostics-benchmark.json',
    DIAGNOSTICS_BENCHMARK_HOST_RESULT:
      '${{ runner.temp }}/diagnostics-benchmark.json.host-context.json',
  });
  assert.deepEqual(BENCHMARK_ARGS, [
    '--filter',
    '@agent-platform/api',
    'exec',
    'vitest',
    'run',
    'test/diagnostics.performance.test.ts',
    '--maxWorkers=1',
    '--no-file-parallelism',
  ]);
  assert.equal(Object.isFrozen(BENCHMARK_ARGS), true);
});

test('ordinary checks remain and warmloading observer controls follow measurement', () => {
  const names = verify.steps.map(({ name }) => name);
  for (const name of [
    'Checkout',
    'Setup pnpm',
    'Setup Node',
    'Test macOS VM build-output discovery',
    'Test historical archive trust boundaries',
    'Install',
    'Rebuild native dependencies',
    'Test dependency compatibility exceptions',
    'Format (check)',
    'Lint',
    'Typecheck',
    'Build',
    'Test Git delivery boundary fixtures',
    'Shared Stop provider fixture controls',
    'Provider SDK protocol fixture controls',
    'Test local diagnostic command boundaries',
    'Prepare private interpreter for pinned execution tests',
    'Test',
    'Seed (idempotent)',
  ]) {
    assert.ok(names.includes(name), name);
  }
  assert.equal(names.includes('Diagnostic performance in a fresh process'), false);
  const controlsIndex = names.indexOf(
    'Test retained diagnostic observer controls after measurement',
  );
  assert.ok(controlsIndex > names.indexOf('Test'));
  assert.equal(
    verify.steps[controlsIndex].run,
    'node --test scripts/diagnostics-benchmark-observer.test.mjs',
  );
  assert.equal(names.includes('Observe one declared diagnostic benchmark run'), false);
});

test('benchmark failure evidence is uploaded without a success condition', () => {
  const upload = benchmark.steps.find(
    ({ name }) => name === 'Upload diagnostic benchmark measurements',
  );
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with.name, 'diagnostics-benchmark');
  assert.equal(upload.with.path, '${{ runner.temp }}/diagnostics-benchmark.json*');
  assert.equal(upload.with['retention-days'], 7);
});
