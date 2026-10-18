import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

const decoder = new TextDecoder('utf-8', { fatal: true });

function resolveExecutable(name, env) {
  for (const directory of env.PATH.split(delimiter)) {
    // Relative and empty entries could resolve commands from the changed working directory.
    if (!isAbsolute(directory)) continue;
    const candidate = resolve(directory, name);
    try {
      if (!statSync(candidate).isFile()) continue;
      accessSync(candidate, constants.X_OK);
      // Preserve the candidate's symlink name: Corepack uses it to select the package manager.
      return candidate;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error;
    }
  }
  throw new Error('Required executable could not be resolved to an absolute path.');
}

function gitReader(executable, env) {
  return (args) => {
    const result = spawnSync(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.error || result.status !== 0) throw new Error('Git discovery failed.');
    return decoder.decode(result.stdout);
  };
}

function checker(executable, env) {
  return (args) => {
    const result = spawnSync(executable, args, { env, stdio: 'inherit' });
    if (result.error || result.signal || result.status === null) {
      console.error('[pre-push] Unable to complete a required pnpm check.');
      process.exit(1);
    }
    return result.status;
  };
}

function comparePaths(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function packageNames(paths) {
  const directories = new Set();
  for (const path of paths) {
    const match = /^(?:packages|apps)\/[^/]+(?=\/|$)/u.exec(path);
    if (match) directories.add(match[0]);
  }
  const names = new Set();
  for (const directory of [...directories].sort(comparePaths)) {
    let text;
    try {
      text = readFileSync(resolve(directory, 'package.json'), 'utf8');
    } catch (error) {
      // Deleted packages and changed directories without a package manifest have no runnable target.
      if (error.code === 'ENOENT') continue;
      throw new Error('Cannot read an affected package manifest.');
    }
    const manifest = JSON.parse(text);
    const name = manifest?.name;
    // Exact lowercase npm names only: never pnpm selectors, flags or shell syntax.
    const pattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
    if (
      typeof name !== 'string' ||
      name.length > 214 ||
      name.includes('...') ||
      pattern.exec(name)?.[0] !== name
    ) {
      throw new Error('Invalid affected package name.');
    }
    names.add(name);
  }
  return { names: [...names], directoryCount: directories.size };
}

function changedPaths(git) {
  let remote;
  try {
    remote = git(['rev-parse', '--abbrev-ref', '@{upstream}']).trim();
  } catch {
    remote = 'origin/main';
  }
  const output = git(['diff', '--name-only', '-z', '--end-of-options', `${remote}...HEAD`, '--']);
  if (output && !output.endsWith('\0')) throw new Error('Incomplete Git path discovery.');
  return output ? output.slice(0, -1).split('\0') : [];
}

function isolatedEnvironment(git, discoveryEnv) {
  const env = { ...discoveryEnv };
  for (const name of git(['rev-parse', '--local-env-vars']).trim().split(/\s+/u)) {
    if (/^[A-Za-z_]\w*$/u.exec(name)?.[0] !== name) {
      throw new Error('Invalid Git environment discovery.');
    }
    delete env[name];
  }
  return env;
}

function runChecks(names, check) {
  const filters = names.flatMap((name) => ['--filter', name]);
  const others = names.filter((name) => name !== '@agent-platform/api');
  console.log('[pre-push] Running circular dependency check...');
  if (check(['deps:check-cycles'])) {
    console.error('[pre-push] Circular dependency check failed.');
    process.exit(1);
  }
  if (!names.length) {
    console.log(
      '[pre-push] Affected directories have no remaining package manifests, skipping package checks.',
    );
    return;
  }
  for (const command of ['build', 'typecheck']) {
    const status = check([...filters, 'run', command]);
    if (status) process.exit(status);
  }
  if (others.length) {
    const status = check([...others.flatMap((name) => ['--filter', name]), 'run', 'test']);
    if (status) process.exit(status);
  }
  if (names.includes('@agent-platform/api')) runApiChecks(check);
}

function runApiChecks(check) {
  // Match CI: every ordinary API test, then the complete benchmark in a fresh process.
  const options = ['--maxWorkers=1', '--minWorkers=1', '--no-file-parallelism'];
  const ordinary = check([
    '--filter',
    '@agent-platform/api',
    'run',
    'test',
    ...options,
    '--exclude',
    '**/diagnostics.performance.test.ts',
  ]);
  if (ordinary) process.exit(ordinary);
  const benchmark = check([
    '--filter',
    '@agent-platform/api',
    'exec',
    'vitest',
    'run',
    'test/diagnostics.performance.test.ts',
    ...options,
  ]);
  if (benchmark) process.exit(benchmark);
}

function discoveryEnvironment() {
  const path = (process.env.PATH ?? '').split(delimiter).filter(isAbsolute).join(delimiter);
  if (!path) throw new Error('No absolute executable PATH entries.');
  return { ...process.env, PATH: path };
}

function run() {
  const discoveryEnv = discoveryEnvironment();
  const git = gitReader(resolveExecutable('git', discoveryEnv), discoveryEnv);
  const paths = changedPaths(git);
  const env = isolatedEnvironment(git, discoveryEnv);
  const { names, directoryCount } = packageNames(paths);
  if (!directoryCount) {
    console.log('[pre-push] No runnable affected packages detected, skipping checks.');
    return;
  }
  runChecks(names, checker(resolveExecutable('pnpm', env), env));
}

try {
  run();
} catch {
  // Do not echo untrusted manifest/path contents or Git stderr into hook diagnostics.
  console.error('[pre-push] Invalid package or Git discovery; required checks did not complete.');
  process.exitCode = 1;
}
