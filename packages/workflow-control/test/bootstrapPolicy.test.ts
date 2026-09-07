import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { observeBootstrapCandidate, type BootstrapPolicy } from '../src/bootstrapPolicy.js';

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return { ...original, execFileSync: vi.fn(original.execFileSync) };
});

const original = await vi.importActual<typeof import('node:child_process')>('node:child_process');
const roots: string[] = [];
afterEach(() => {
  vi.mocked(execFileSync).mockImplementation(original.execFileSync);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(root: string, args: string[]): string {
  return original
    .execFileSync('/usr/bin/git', ['-C', root, ...args], {
      encoding: 'utf8',
      env: {
        PATH: '/usr/bin:/bin',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.com',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.com',
      },
    })
    .trim();
}

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bootstrap-policy-')));
  roots.push(root);
  const source = join(root, 'source');
  mkdirSync(source);
  git(source, ['init', '-q']);
  git(source, ['switch', '-qc', 'task/policy-test']);
  git(source, ['config', 'core.filemode', 'true']);
  writeFileSync(join(source, 'value.txt'), 'before\n');
  writeFileSync(join(source, 'delete.txt'), 'remove\n');
  git(source, ['add', '.']);
  git(source, ['commit', '-qm', 'baseline']);
  const remoteUrl = join(root, 'remote.git');
  git(source, ['remote', 'add', 'origin', remoteUrl]);
  // This observer reads only checkout identity; complete policy authorization is covered separately.
  const policy = {
    canonicalRoot: source,
    sourceRoot: source,
    gitCommonDirectory: join(source, '.git'),
    initialHeadSha: git(source, ['rev-parse', 'HEAD']),
    ref: 'refs/heads/task/policy-test',
    remoteName: 'origin',
    remoteUrl,
  } as BootstrapPolicy;
  return { source, policy };
}

describe('bootstrap Git identity and independent content comparison', () => {
  it('matches Git tree IDs and the existing manifest without writing the index or objects', () => {
    const { source, policy } = fixture();
    writeFileSync(join(source, 'value.txt'), 'after\n');
    writeFileSync(join(source, 'added.txt'), 'added\n');
    rmSync(join(source, 'delete.txt'));
    const index = readFileSync(join(source, '.git/index'));
    const objects = git(source, ['count-objects', '-v']);
    const observed = observeBootstrapCandidate(policy);
    expect(readFileSync(join(source, '.git/index'))).toEqual(index);
    expect(git(source, ['count-objects', '-v'])).toBe(objects);
    expect(observeBootstrapCandidate(policy)).toEqual(observed);
    expect(observed.manifest).toEqual([
      {
        path: 'added.txt',
        digest: `sha256:${createHash('sha256').update('added\n').digest('hex')}`,
        mode: '100644',
      },
      { path: 'delete.txt', digest: null, mode: null },
      {
        path: 'value.txt',
        digest: `sha256:${createHash('sha256').update('after\n').digest('hex')}`,
        mode: '100644',
      },
    ]);
    const diff = Buffer.from('A\0added.txt\0D\0delete.txt\0M\0value.txt\0');
    expect(observed.diffDigest).toBe(`sha256:${createHash('sha256').update(diff).digest('hex')}`);
    git(source, ['add', '-A']);
    expect(observed.treeSha).toBe(git(source, ['write-tree']));
  });

  it('keeps unchanged bytes out of the manifest after independent SHA-256 comparison', () => {
    const { source, policy } = fixture();
    const observed = observeBootstrapCandidate(policy);
    expect(observed.manifest).toEqual([]);
    expect(observed.treeSha).toBe(git(source, ['rev-parse', 'HEAD^{tree}']));
  });

  it('includes changed bytes even when the Git object ID is equal to the baseline', () => {
    const { source, policy } = fixture();
    const baselineOid = git(source, ['rev-parse', 'HEAD:value.txt']);
    writeFileSync(join(source, 'value.txt'), 'changed bytes\n');
    const replacement = (file: string, args: readonly string[], options: ExecFileSyncOptions) => {
      if (
        args.includes('hash-object') &&
        args.includes('blob') &&
        Buffer.isBuffer(options.input) &&
        options.input.equals(Buffer.from('changed bytes\n'))
      ) {
        return Buffer.from(`${baselineOid}\n`);
      }
      return original.execFileSync(file, args, options);
    };
    vi.mocked(execFileSync).mockImplementation(replacement as typeof execFileSync);
    const observed = observeBootstrapCandidate(policy);
    expect(observed.treeSha).toBe(git(source, ['rev-parse', 'HEAD^{tree}']));
    expect(observed.manifest).toEqual([
      {
        path: 'value.txt',
        digest: `sha256:${createHash('sha256').update('changed bytes\n').digest('hex')}`,
        mode: '100644',
      },
    ]);
  });
});
