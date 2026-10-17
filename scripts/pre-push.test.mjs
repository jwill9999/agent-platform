import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
  symlinkSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const hook =
  process.env.PRE_PUSH_TEST_HOOK_PATH ??
  fileURLToPath(new URL('../.husky/pre-push', import.meta.url));
const benchmark = 'test/diagnostics.performance.test.ts';
const vitestOptions = ['--maxWorkers=1', '--minWorkers=1', '--no-file-parallelism'];

function runHook(packages, failure = '', options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pre-push-measurement-'));
  const bin = join(root, options.binName ?? 'bin');
  const calls = join(root, 'calls.jsonl');
  mkdirSync(bin);
  symlinkSync(process.execPath, join(bin, 'node'));
  symlinkSync('/usr/bin/dirname', join(bin, 'dirname'));
  try {
    for (const [path, name] of packages) {
      mkdirSync(join(root, path), { recursive: true });
      if (options.manifestDirectory) mkdirSync(join(root, path, 'package.json'));
      else
        writeFileSync(
          join(root, path, 'package.json'),
          options.manifest ?? JSON.stringify({ name }),
        );
    }
    // Only discovery is stubbed; execute the real hook through /bin/sh and a recording pnpm.
    writeFileSync(
      join(bin, 'git'),
      `#!${options.gitAbsoluteInterpreter ? process.execPath : '/usr/bin/env node'}
const args = process.argv.slice(2);
if (process.env.GIT_DIR !== '/fixture/parent/git-dir' || process.env.GIT_WORK_TREE !== '/fixture/parent/tree' || process.env.GIT_INDEX_FILE !== '/fixture/parent/index') process.exit(96);
if (args.slice(0,2).join(' ') === process.env.HOOK_GIT_FAILURE) process.exit(94);
if (args[0] === 'rev-parse' && args[1] === '--abbrev-ref') console.log(process.env.HOOK_REMOTE || 'origin/fixture');
else if (args[0] === 'rev-parse' && args[1] === '--local-env-vars') console.log('GIT_DIR\\nGIT_WORK_TREE\\nGIT_INDEX_FILE');
else if (args[0] === 'diff' && args[1] === '--name-only') {
 if (process.env.HOOK_EXPECT_DIFF && JSON.stringify(args) !== process.env.HOOK_EXPECT_DIFF) process.exit(95);
 const paths = JSON.parse(process.env.HOOK_CHANGED_PATHS);
 process.stdout.write(paths.join(args.includes('-z') ? '\\0' : '\\n') + (args.includes('-z') ? '\\0' : '\\n'));
} else process.exit(91);
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(bin, 'pnpm'),
      options.spawnError
        ? '#!/does-not-exist\n'
        : `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.HOOK_CALLS, JSON.stringify({args,path:process.env.PATH,launchedAs:process.argv[1],gitDir:process.env.GIT_DIR ?? null,gitWorkTree:process.env.GIT_WORK_TREE ?? null,gitIndex:process.env.GIT_INDEX_FILE ?? null})+'\\n');
if (process.env.HOOK_PNPM_SIGNAL) process.kill(process.pid, 'SIGTERM');
const stage = args[0] === 'deps:check-cycles' ? 'cycles'
  : args.includes('exec') ? 'benchmark'
  : args.includes('typecheck') ? 'typecheck'
  : args.includes('build') ? 'build'
  : args.includes('@agent-platform/api') ? 'api-suite' : 'other-suite';
process.exit(stage === process.env.HOOK_FAILURE ? 23 : 0);
`,
      { mode: 0o755 },
    );
    const malicious = `#!${process.execPath}
require('node:fs').writeFileSync('injection-marker','yes');
`;
    const shadow = join(root, 'shadow');
    mkdirSync(shadow);
    for (const name of ['git', 'pnpm']) {
      writeFileSync(join(shadow, name), malicious, { mode: 0o755 });
      if (options.pathPrefix === 'empty')
        writeFileSync(join(root, name), malicious, { mode: 0o755 });
    }
    if (options.pnpmEntry === 'missing') rmSync(join(bin, 'pnpm'));
    if (options.pnpmEntry === 'non-executable') chmodSync(join(bin, 'pnpm'), 0o644);
    if (options.pnpmEntry === 'directory') {
      rmSync(join(bin, 'pnpm'));
      mkdirSync(join(bin, 'pnpm'));
    }
    if (options.pnpmSymlink) {
      renameSync(join(bin, 'pnpm'), join(bin, 'manager-shim'));
      symlinkSync('manager-shim', join(bin, 'pnpm'));
    }
    if (options.cwdCommand) {
      const output =
        options.cwdCommand === 'dirname' ? `console.log(${JSON.stringify(dirname(hook))});` : '';
      writeFileSync(join(root, options.cwdCommand), `${malicious}${output}\n`, { mode: 0o755 });
    }
    const prefix =
      options.pathPrefix === 'relative' ? 'shadow:.:' : options.pathPrefix === 'empty' ? ':' : '';
    const path = options.strictPath ? bin : `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`;
    const entry = options.direct ? process.execPath : '/bin/sh';
    const entryArgs = options.direct ? [join(dirname(hook), '../scripts/pre-push.mjs')] : [hook];
    const result = spawnSync(entry, entryArgs, {
      cwd: root,
      env: {
        PATH: options.noAbsolutePath
          ? '.'
          : `${options.cwdCommand ? '.:' : ''}${prefix}${path}${options.shadowSuffix ? `:${shadow}` : ''}`,
        GIT_DIR: '/fixture/parent/git-dir',
        GIT_WORK_TREE: '/fixture/parent/tree',
        GIT_INDEX_FILE: '/fixture/parent/index',
        HOOK_GIT_FAILURE: options.gitFailure ?? '',
        HOOK_REMOTE: options.remote ?? '',
        HOOK_EXPECT_DIFF: options.expectedDiff ? JSON.stringify(options.expectedDiff) : '',
        HOOK_PNPM_SIGNAL: options.signal ? 'yes' : '',
        HOOK_CHANGED_PATHS: JSON.stringify(
          options.paths ?? packages.map(([path]) => `${path}/changed.ts`),
        ),
        HOOK_CALLS: calls,
        HOOK_FAILURE: failure,
      },
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.ifError(result.error);
    const invocations = existsSync(calls)
      ? readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse)
      : [];
    assert.ok(
      invocations.every(
        ({ gitDir, gitWorkTree, gitIndex }) =>
          gitDir === null && gitWorkTree === null && gitIndex === null,
      ),
    );
    return {
      status: result.status,
      args: invocations.map(({ args }) => args),
      marker: existsSync(join(root, 'injection-marker')),
      launchedAs: invocations.map(({ launchedAs }) => launchedAs),
      childPaths: invocations.map(({ path }) => path),
    };
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

for (const name of [
  '@agent-platform/api$(touch injection-marker)',
  '@agent-platform/api;touch injection-marker;#',
  '--filter',
  '@agent-platform/api...',
  '...api',
  '@agent-platform/api\n',
  '@agent-platform/api\r',
  '@agent-platform/*',
  '@agent-platform/api\n@agent-platform/desktop',
  '@agent-platform/api @agent-platform/desktop',
  42,
  null,
  '',
]) {
  test(`invalid package name ${JSON.stringify(name)} fails closed without command execution`, () => {
    const result = runHook([['apps/unsafe', name], api]);
    assert.equal(result.marker, false);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.args, []);
  });
}

for (const path of [
  'apps/space directory',
  'apps/new\nline',
  "apps/x'+(require('fs').writeFileSync('injection-marker','yes'),'')+'",
]) {
  test(`changed path ${JSON.stringify(path)} stays data and retains required checks`, () => {
    const result = runHook([[path, '@agent-platform/safe'], api]);
    assert.equal(result.marker, false);
    assert.equal(result.status, 0);
    assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
    assert.ok(result.args[1].includes('@agent-platform/safe'));
  });
}

test('malformed present JSON fails closed rather than silently skipping a required package', () => {
  const result = runHook([api], '', { manifest: '{broken' });
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.args, []);
});

test('duplicate changed paths and package identities produce only one argument per package', () => {
  const result = runHook([api, ['packages/alias', api[1]]], '', {
    paths: ['apps/api/one.ts', 'apps/api/two.ts', 'packages/alias/changed.ts'],
  });
  assert.equal(result.status, 0);
  assert.deepEqual(result.args[1], ['--filter', api[1], 'run', 'build']);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

test('deleted or non-package directories are skipped explicitly while remaining packages run', () => {
  const result = runHook([api], '', { paths: ['apps/deleted/file.ts', 'apps/api/changed.ts'] });
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

for (const gitFailure of ['diff --name-only', 'rev-parse --local-env-vars']) {
  test(`${gitFailure} discovery failure is never treated as no changes`, () => {
    const result = runHook([api], '', { gitFailure });
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.args, []);
  });
}

test('upstream discovery failure preserves the origin/main fallback and required checks', () => {
  const result = runHook([api], '', { gitFailure: 'rev-parse --abbrev-ref' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

test('present but unreadable-as-file manifest fails closed', () => {
  const result = runHook([api], '', { manifestDirectory: true });
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.args, []);
});

test('a newline inside an unrelated file cannot introduce a spurious package boundary', () => {
  const result = runHook([api], '', { paths: ['notes/prefix\napps/api/file.ts'] });
  assert.equal(result.status, 0);
  assert.deepEqual(result.args, []);
});

test('only deleted package manifests preserve the cycles check then skip package commands', () => {
  const result = runHook([], '', { paths: ['packages/deleted/old.ts'] });
  assert.equal(result.status, 0);
  assert.deepEqual(result.args, [['deps:check-cycles']]);
});

test('option-looking upstream stays behind the Git option boundary', () => {
  const result = runHook([api], '', {
    remote: '-R',
    expectedDiff: ['diff', '--name-only', '-z', '--end-of-options', '-R...HEAD', '--'],
  });
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

test('a required command spawn failure cannot qualify the hook', () => {
  const result = runHook([api], '', { spawnError: true });
  assert.equal(result.status, 1);
  assert.deepEqual(result.args, []);
});

test('a signalled required command stops the hook', () => {
  const result = runHook([api], '', { signal: true });
  assert.equal(result.status, 1);
  assert.deepEqual(result.args, [['deps:check-cycles']]);
});

for (const pathPrefix of ['relative', 'empty']) {
  test(`${pathPrefix} PATH entries cannot launch working-directory commands`, () => {
    const result = runHook([api], '', { pathPrefix, strictPath: true });
    assert.equal(result.marker, false);
    assert.equal(result.status, 0);
    assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
  });
}

test('absolute executable directories with spaces preserve every required argument', () => {
  const result = runHook([api], '', { binName: 'tools with spaces', strictPath: true });
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

for (const pnpmEntry of ['missing', 'non-executable', 'directory']) {
  test(`${pnpmEntry} pnpm cannot silently qualify an affected package`, () => {
    const result = runHook([api], '', { pnpmEntry, strictPath: true });
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.args, []);
  });
}

test('absolute symlink executable keeps the pnpm dispatch basename', () => {
  const result = runHook([api], '', { pnpmSymlink: true, strictPath: true });
  assert.equal(result.status, 0);
  assert.ok(result.launchedAs.every((path) => path.endsWith('/pnpm')));
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

test('resolver preserves the first absolute executable match', () => {
  const result = runHook([api], '', { shadowSuffix: true, strictPath: true });
  assert.equal(result.marker, false);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

test('package-directory comparison preserves default UTF-16 lexical ordering', () => {
  const result = runHook([
    ['packages/ä', 'unicode'],
    ['packages/z', 'zed'],
    ['packages/A', 'upper'],
  ]);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args[1], [
    '--filter',
    'upper',
    '--filter',
    'zed',
    '--filter',
    'unicode',
    'run',
    'build',
  ]);
});

for (const cwdCommand of ['node', 'dirname']) {
  test(`wrapper never launches cwd ${cwdCommand} before sanitizing PATH`, () => {
    const result = runHook([api], '', { cwdCommand, strictPath: true });
    assert.equal(result.marker, false);
    assert.equal(result.status, 0);
    assert.ok(
      result.childPaths.every((path) => path.split(':').every((entry) => entry.startsWith('/'))),
    );
    assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
  });
}

test('direct helper sanitizes Git shebang interpreter lookup', () => {
  const result = runHook([api], '', { cwdCommand: 'node', strictPath: true, direct: true });
  assert.equal(result.marker, false);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

test('direct helper sanitizes Corepack-style pnpm env-node interpreter lookup', () => {
  const result = runHook([api], '', {
    cwdCommand: 'node',
    strictPath: true,
    direct: true,
    gitAbsoluteInterpreter: true,
  });
  assert.equal(result.marker, false);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});

for (const direct of [false, true]) {
  test(`${direct ? 'direct helper' : 'wrapper'} rejects PATH without any absolute entry`, () => {
    const result = runHook([api], '', { cwdCommand: 'node', noAbsolutePath: true, direct });
    assert.equal(result.marker, false);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.args, []);
  });
}

test('absolute PATH metacharacters and newlines remain literal directory bytes', () => {
  const result = runHook([api], '', {
    binName: 'tools ;$(touch injection-marker)\n*',
    strictPath: true,
  });
  assert.equal(result.marker, false);
  assert.equal(result.status, 0);
  assert.deepEqual(result.args.slice(-2), [expectedApiSuite, expectedBenchmark]);
});
