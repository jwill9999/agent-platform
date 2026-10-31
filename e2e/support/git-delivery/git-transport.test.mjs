import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
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

test('owned remote runs its own hooks whatever the developer global Git configuration says', async () => {
  const root = await mkdtemp(join(tmpdir(), 'git-transport-hooks-'));
  let fixture;
  try {
    const bare = join(root, 'remote.git');
    const work = join(root, 'work');
    const elsewhere = join(root, 'global-hooks');
    const marker = join(root, 'post-receive.ran');
    const globalConfig = join(root, 'global.gitconfig');
    await mkdir(work);
    await mkdir(elsewhere);
    // A developer-wide hooks path, such as shared secret scanning, would replace remote.git/hooks.
    await writeFile(globalConfig, `[core]\n\thooksPath = ${elsewhere}\n`);
    const env = { ...process.env, GIT_CONFIG_GLOBAL: globalConfig };
    const git = (cwd, ...args) =>
      execFileSync('/usr/bin/git', ['-C', cwd, ...args], {
        encoding: 'utf8',
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
      }).trim();
    git(root, 'init', '--bare', bare);
    await writeFile(
      join(bare, 'hooks', 'post-receive'),
      `#!/bin/sh\n: > '${marker.replaceAll("'", "'\\''")}'\n`,
      { mode: 0o700 },
    );
    git(work, 'init', '-b', 'feature/test');
    git(work, 'config', 'user.name', 'Fixture');
    git(work, 'config', 'user.email', 'fixture@example.invalid');
    await writeFile(join(work, 'file'), 'safe fixture\n');
    git(work, 'add', '--', 'file');
    git(work, 'commit', '-m', 'fixture');
    fixture = await createGitTransportFixture({ bareRoot: bare, repository: 'fixture/project' });
    git(work, 'remote', 'add', 'origin', fixture.remoteUrl);
    git(work, 'config', 'core.sshCommand', fixture.sshCommand);
    git(work, 'push', 'origin', 'HEAD:refs/heads/feature/test');
    assert.equal(existsSync(marker), true);
  } finally {
    await fixture?.close();
    await rm(root, { recursive: true, force: true });
  }
});
