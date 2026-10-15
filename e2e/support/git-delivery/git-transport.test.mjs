import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitTransportFixture } from './git-transport.mjs';

test('owned SSH boundary preserves real push and remote-ref effects and rejects other commands', async () => {
  const root = await mkdtemp(join(tmpdir(), 'git-transport-test-'));
  let fixture;
  const git = (cwd, ...args) =>
    execFileSync('/usr/bin/git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    }).trim();
  try {
    const bare = join(root, 'remote.git');
    const work = join(root, 'work');
    await mkdir(work);
    git(root, 'init', '--bare', bare);
    git(work, 'init', '-b', 'feature/test');
    git(work, 'config', 'user.name', 'Fixture');
    git(work, 'config', 'user.email', 'fixture@example.invalid');
    await writeFile(join(work, 'file'), 'safe fixture\n');
    git(work, 'add', '--', 'file');
    git(work, 'commit', '-m', 'fixture');
    fixture = await createGitTransportFixture({ bareRoot: bare, repository: 'fixture/project' });
    git(work, 'remote', 'add', 'origin', fixture.remoteUrl);
    git(work, 'config', 'core.sshCommand', fixture.sshCommand);
    git(work, 'config', 'ssh.variant', 'ssh');
    const head = git(work, 'rev-parse', 'HEAD');
    git(
      work,
      'push',
      '--no-follow-tags',
      '--recurse-submodules=no',
      'origin',
      `${head}:refs/heads/feature/test`,
    );
    assert.equal(git(bare, 'rev-parse', 'refs/heads/feature/test'), head);
    assert.equal(
      git(work, 'ls-remote', 'origin', 'refs/heads/feature/test'),
      `${head}\trefs/heads/feature/test`,
    );
    assert.deepEqual(
      (await fixture.ledger()).map((entry) => entry.operation),
      ['receive-pack', 'upload-pack'],
    );
    for (const args of [
      ['git@elsewhere.invalid', "git-upload-pack 'fixture/project.git'"],
      ['git@github.com', "git-receive-pack 'other/project.git'"],
      ['git@github.com', "git-upload-pack 'fixture/project.git'; touch unexpected"],
      ['git@github.com', 'arbitrary command'],
    ]) {
      assert.equal(spawnSync(fixture.executable, args, { timeout: 10000 }).status, 64);
    }
    assert.equal((await fixture.ledger()).length, 2);
  } finally {
    await fixture?.close();
    await rm(root, { recursive: true, force: true });
  }
});
