import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { TrustedSourceGit } from '../src/sourceGit.js';
const roots: string[] = [];
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'source-git-')));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
it('executes the pinned real path after the configured symlink is retargeted', () => {
  const root = fixture(),
    original = join(root, 'original'),
    other = join(root, 'other'),
    link = join(root, 'git');
  writeFileSync(original, '#!/bin/sh\nprintf pinned');
  chmodSync(original, 0o700);
  writeFileSync(other, '#!/bin/sh\nprintf substituted');
  chmodSync(other, 0o700);
  symlinkSync(original, link);
  const git = new TrustedSourceGit(root, link);
  unlinkSync(link);
  symlinkSync(other, link);
  expect(git.run(['--version']).toString()).toBe('pinned');
  writeFileSync(original, '#!/bin/sh\nprintf changed');
  expect(() => git.run(['--version'])).toThrow();
});
it('does not execute configured fsmonitor or filters during production source checks', () => {
  const root = fixture(),
    binary = process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git';
  const command = (args: string[]) => execFileSync(binary, args, { cwd: root });
  command(['init', '-q']);
  const marker = join(root, 'executed');
  const monitor = join(root, '.git', 'monitor');
  writeFileSync(monitor, '#!/bin/sh\ntouch ' + marker);
  chmodSync(monitor, 0o700);
  command(['config', 'core.fsmonitor', monitor]);
  const git = new TrustedSourceGit(root, binary);
  git.assertClean();
  expect(existsSync(marker)).toBe(false);
  command(['config', 'filter.fixture.clean', monitor]);
  expect(() => git.assertClean()).toThrow('filters are unsupported');
  expect(existsSync(marker)).toBe(false);
});

function refFixture() {
  const root = fixture();
  const git = new TrustedSourceGit(root, process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git');
  git.run(['init', '-q']);
  git.run(['checkout', '-b', 'task/import']);
  git.run(['commit', '--allow-empty', '-m', 'base']);
  const base = git.run(['rev-parse', 'HEAD']).toString().trim();
  const tree = git.run(['rev-parse', 'HEAD^{tree}']).toString().trim();
  const next = git.run(['commit-tree', tree, '-p', base, '-m', 'next']).toString().trim();
  return { root, git, base, next, ref: 'refs/heads/task/import' };
}
it('publishes an exact-head transaction only after preparing its ref locks', () => {
  const { git, base, next, ref } = refFixture();
  git.updateRef(ref, next, base, Date.now() + 5000);
  expect(git.run(['rev-parse', 'HEAD']).toString().trim()).toBe(next);
  expect(() => git.updateRef(ref, base, base, Date.now() + 5000)).toThrow();
  expect(git.run(['rev-parse', 'HEAD']).toString().trim()).toBe(next);
});
it('rejects an expired ref transaction without changing the branch', () => {
  const { git, base, next, ref } = refFixture();
  expect(() => git.updateRef(ref, next, base, Date.now() - 1)).toThrow('expired');
  expect(git.run(['rev-parse', 'HEAD']).toString().trim()).toBe(base);
});
it('does not wait past authority expiry for a real contested ref lock', () => {
  const { root, git, base, next, ref } = refFixture();
  const lock = join(root, '.git', ref + '.lock');
  writeFileSync(lock, 'another writer');
  expect(() => git.updateRef(ref, next, base, Date.now() + 300)).toThrow();
  unlinkSync(lock);
  expect(git.run(['rev-parse', 'HEAD']).toString().trim()).toBe(base);
});

it('does not send commit when a started transaction cannot prepare before the deadline', () => {
  const root = fixture();
  const binary = join(root, 'delayed-git');
  const seen = join(root, 'commands');
  writeFileSync(
    binary,
    `#!${realpathSync(process.execPath)}
const fs = require('node:fs');
process.stdin.on('data', chunk => { fs.appendFileSync(${JSON.stringify(seen)}, chunk); setTimeout(() => process.stdout.write('prepare: ok\\n'), 2000); });
`,
  );
  chmodSync(binary, 0o700);
  const git = new TrustedSourceGit(root, binary);
  expect(() =>
    git.updateRef('refs/heads/task/import', 'b'.repeat(40), 'a'.repeat(40), Date.now() + 1500),
  ).toThrow('uncertain');
  expect(readFileSync(seen, 'utf8')).toContain('prepare\n');
  expect(readFileSync(seen, 'utf8')).not.toContain('commit\n');
});
it('reports uncertain publication when the commit acknowledgement is lost', () => {
  const root = fixture();
  const binary = join(root, 'ack-lost-git');
  const seen = join(root, 'published');
  writeFileSync(
    binary,
    `#!${realpathSync(process.execPath)}
const fs = require('node:fs');
process.stdin.on('data', chunk => {
 const data = chunk.toString();
 if (data.includes('prepare\\n')) process.stdout.write('prepare: ok\\n');
 if (data.includes('commit\\n')) fs.writeFileSync(${JSON.stringify(seen)}, 'effect-observed');
});
setInterval(()=>{},1000);
`,
  );
  chmodSync(binary, 0o700);
  const git = new TrustedSourceGit(root, binary);
  expect(() =>
    git.updateRef('refs/heads/task/import', 'b'.repeat(40), 'a'.repeat(40), Date.now() + 1500),
  ).toThrow('uncertain');
  expect(readFileSync(seen, 'utf8')).toBe('effect-observed');
});
