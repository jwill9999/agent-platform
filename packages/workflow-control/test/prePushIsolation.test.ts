import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const hook = fileURLToPath(new URL('../../../.husky/pre-push', import.meta.url));
const localNames = execFileSync('git', ['rev-parse', '--local-env-vars'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n');

function isolatedEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
  for (const name of localNames) delete env[name];
  return env;
}

describe('pre-push Git environment isolation', () => {
  it.each([
    { exitCode: 0, fullEnvironment: false },
    { exitCode: 23, fullEnvironment: false },
    { exitCode: 0, fullEnvironment: true },
    { exitCode: 23, fullEnvironment: true },
  ])(
    'preserves state: exit $exitCode, full environment $fullEnvironment',
    ({ exitCode, fullEnvironment }) => {
      const root = mkdtempSync(join(tmpdir(), 'pre-push-isolation-'));
      const env = isolatedEnvironment();
      const repository = join(root, 'repository');
      const worktree = join(root, 'worktree');
      const bin = join(root, 'bin');
      const calls = join(root, 'calls.jsonl');
      mkdirSync(repository);
      mkdirSync(bin);
      const git = (cwd: string, ...args: string[]) =>
        execFileSync('git', args, {
          cwd,
          env,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
      try {
        git(repository, 'init', '-b', 'base');
        git(repository, 'config', 'user.name', 'Hook Fixture');
        git(repository, 'config', 'user.email', 'fixture@example.invalid');
        git(repository, 'config', 'core.hooksPath', '/dev/null');
        mkdirSync(join(repository, 'packages/example'), { recursive: true });
        writeFileSync(
          join(repository, 'packages/example/package.json'),
          '{"name":"@fixture/example"}',
        );
        git(repository, 'add', '.');
        git(repository, 'commit', '-m', 'base');
        git(repository, 'worktree', 'add', '-b', 'task', worktree);
        git(worktree, 'branch', '--set-upstream-to=base');
        writeFileSync(join(worktree, 'packages/example/change.txt'), 'committed change');
        git(worktree, 'add', '.');
        git(worktree, 'commit', '-m', 'task change');
        const gitDir = git(worktree, 'rev-parse', '--absolute-git-dir');
        const config = join(repository, '.git/config');
        const index = join(gitDir, 'index');
        const before = {
          config: readFileSync(config),
          index: readFileSync(index),
          refs: git(repository, 'show-ref'),
          head: readFileSync(join(gitDir, 'HEAD')),
        };
        // A pnpm stand-in executes real temporary-repository initialization at each
        // check boundary. Inherited GIT_DIR used to redirect these into the parent.
        writeFileSync(
          join(bin, 'pnpm'),
          `#!/usr/bin/env node
const { appendFileSync, mkdtempSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const names = JSON.parse(process.env.HOOK_FIXTURE_NAMES);
appendFileSync(process.env.HOOK_FIXTURE_CALLS, JSON.stringify({args:process.argv.slice(2), inherited:names.filter(name => process.env[name] !== undefined)})+'\\n');
const temp = mkdtempSync(join(process.env.HOOK_FIXTURE_ROOT, 'child-'));
execFileSync('git', ['init', '--bare', join(temp, 'bare')], {stdio:'ignore'});
execFileSync('git', ['init', join(temp, 'normal')], {stdio:'ignore'});
process.exit(process.argv.at(-1) === 'test' ? Number(process.env.HOOK_FIXTURE_EXIT) : 0);
`,
          { mode: 0o755 },
        );
        const result = spawnSync('/bin/sh', [hook], {
          cwd: worktree,
          env: {
            ...env,
            PATH: `${bin}${delimiter}${env.PATH ?? ''}`,
            GIT_DIR: gitDir,
            ...(fullEnvironment
              ? {
                  GIT_WORK_TREE: worktree,
                  GIT_INDEX_FILE: index,
                  GIT_COMMON_DIR: join(repository, '.git'),
                }
              : {}),
            HOOK_FIXTURE_NAMES: JSON.stringify(localNames),
            HOOK_FIXTURE_ROOT: root,
            HOOK_FIXTURE_CALLS: calls,
            HOOK_FIXTURE_EXIT: String(exitCode),
          },
          encoding: 'utf8',
          timeout: 20_000,
        });
        expect(result.error).toBeUndefined();
        expect(readFileSync(config)).toEqual(before.config);
        expect(readFileSync(index)).toEqual(before.index);
        expect(git(repository, 'show-ref')).toBe(before.refs);
        expect(readFileSync(join(gitDir, 'HEAD'))).toEqual(before.head);
        expect(result.status, result.stdout + result.stderr).toBe(exitCode);
        const invocations = readFileSync(calls, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        expect(invocations).toEqual([
          { args: ['deps:check-cycles'], inherited: [] },
          ...['build', 'typecheck', 'test'].map((check) => ({
            args: ['--filter', '@fixture/example', 'run', check],
            inherited: [],
          })),
        ]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});
