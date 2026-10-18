import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDatabase,
  createProject,
  openDatabase,
  updateSettings,
  getGitDeliveryOperation,
  transitionGitDeliveryOperation,
} from '@agent-platform/db';
import { createGitDeliveryService } from '../src/application/gitDelivery/index.js';
import { inspectRemote, synchroniseTracking } from '../src/application/gitDelivery/remote.js';
import { inspectGitDeliveryRepository } from '../src/application/gitDelivery/repository.js';
import type { GitDeliveryAction } from '@agent-platform/contracts';

type GhFixture = {
  executable: string;
  env: Record<string, string>;
  readLedger(): Promise<{ calls: Array<{ args: string[] }>; pullRequests: unknown[] }>;
  setFailureModes(values: Record<string, boolean>): Promise<void>;
  close(): Promise<void>;
};
type Transport = { remoteUrl: string; sshCommand: string; close(): Promise<void> };
const transportModule = new URL(
  '../../../e2e/support/git-delivery/git-transport.mjs',
  import.meta.url,
).href;
const ghModule = new URL('../../../e2e/support/git-delivery/gh-ledger.mjs', import.meta.url).href;
const { createGitTransportFixture } = (await import(transportModule)) as {
  createGitTransportFixture(options: { bareRoot: string }): Promise<Transport>;
};
const { createGhLedgerFixture } = (await import(ghModule)) as {
  createGhLedgerFixture(): Promise<GhFixture>;
};
const git = (root: string, ...args: string[]) =>
  execFileSync('/usr/bin/git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const publish = { kind: 'push', mode: 'publish' } as const;
const pr = {
  kind: 'pull_request',
  baseBranch: 'main',
  title: 'Reviewed delivery',
  body: 'Exact body',
  draft: true,
} as const;

describe('remote Git delivery with real bare Git and inert GitHub boundary', () => {
  let directory: string, repo: string, bare: string, projectId: string;
  let database: ReturnType<typeof openDatabase>, transport: Transport, gh: GhFixture;
  let service: ReturnType<typeof createGitDeliveryService>;
  beforeEach(async () => {
    directory = realpathSync(mkdtempSync(join(tmpdir(), 'git-delivery-remote-')));
    repo = join(directory, 'repo');
    bare = join(directory, 'remote.git');
    execFileSync('/usr/bin/git', ['init', '--bare', bare], { stdio: 'ignore' });
    execFileSync('/usr/bin/git', ['init', '-b', 'feature/test', repo], { stdio: 'ignore' });
    git(repo, 'config', 'user.name', 'Fixture');
    git(repo, 'config', 'user.email', 'fixture@example.invalid');
    writeFileSync(join(repo, 'file.txt'), 'initial');
    git(repo, 'add', '.');
    git(repo, 'commit', '-m', 'initial');
    transport = await createGitTransportFixture({ bareRoot: bare });
    git(repo, 'remote', 'add', 'origin', transport.remoteUrl);
    git(repo, 'config', 'core.sshCommand', transport.sshCommand);
    git(repo, 'push', 'origin', 'HEAD:refs/heads/main');
    gh = await createGhLedgerFixture();
    vi.stubEnv('AGENT_PLATFORM_GH_BINARY', gh.executable);
    for (const [key, value] of Object.entries(gh.env)) vi.stubEnv(key, value);
    database = openDatabase(join(directory, 'state.sqlite'));
    projectId = createProject(database.db, {
      name: 'Remote',
      metadata: {
        backendProjectRoot: repo,
        repositoryRoot: repo,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
      },
    }).id;
    updateSettings(database.db, {
      executionPolicy: { workspaceWrite: 'ask', gitMutation: 'ask', network: 'ask' },
    });
    service = createGitDeliveryService(database.db);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    closeDatabase(database.sqlite);
    await gh.close();
    await transport.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const panel = () => service.panel(projectId);
  const execute = async (action: GitDeliveryAction) => {
    const prepared = await panel().prepare(action);
    return panel().execute(prepared.id, { confirmed: true });
  };
  const remoteHead = () => git(bare, 'rev-parse', 'refs/heads/feature/test');
  it('publishes exactly the reviewed tip and sets accurate upstream/status without tags', async () => {
    git(repo, 'tag', 'unrelated-tag');
    git(repo, 'config', 'push.followTags', 'true');
    const prepared = await panel().prepare(publish);
    expect(prepared.review).toMatchObject({
      remoteName: 'origin',
      remoteRef: 'refs/heads/feature/test',
      repositorySlug: 'fixture/project',
    });
    expect(JSON.stringify(prepared)).not.toContain(repo);
    const receipt = await panel().execute(prepared.id, { confirmed: true });
    expect(receipt.state).toBe('succeeded');
    expect(receipt.result?.warning).toBeUndefined();
    expect(remoteHead()).toBe(git(repo, 'rev-parse', 'HEAD'));
    expect(git(bare, 'tag')).toBe('');
    expect(git(repo, 'rev-parse', '--abbrev-ref', '@{upstream}')).toBe('origin/feature/test');
    expect(git(repo, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}')).toBe('0\t0');
    expect(await panel().execute(prepared.id, { confirmed: true })).toEqual(receipt);
    writeFileSync(join(repo, 'file.txt'), 'next');
    git(repo, 'commit', '-am', 'next');
    expect((await execute({ kind: 'push', mode: 'push' })).state).toBe('succeeded');
    expect(remoteHead()).toBe(git(repo, 'rev-parse', 'HEAD'));
  });
  it('uses the one effective push endpoint while fetch syntax names the same GitHub repository', async () => {
    git(repo, 'config', 'remote.origin.url', 'https://github.com/fixture/project.git');
    git(repo, 'config', 'remote.origin.pushurl', transport.remoteUrl);
    const receipt = await execute(publish);
    expect(receipt.state).toBe('succeeded');
    expect(receipt.result?.warning).toBeUndefined();
    expect(remoteHead()).toBe(git(repo, 'rev-parse', 'HEAD'));
    expect(git(repo, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}')).toBe('0\t0');
  });
  it.each(['tracking', 'configuration'] as const)(
    'keeps proven push success when a concurrent %s change prevents local enrichment',
    async (changed) => {
      const expected = git(repo, 'rev-parse', 'HEAD');
      const other = git(
        repo,
        'commit-tree',
        `${expected}^{tree}`,
        '-p',
        expected,
        '-m',
        'independent object',
      );
      const hook = join(bare, 'hooks', 'post-receive');
      const args =
        changed === 'tracking'
          ? ['update-ref', 'refs/remotes/origin/feature/test', other]
          : ['config', 'branch.feature/test.pushRemote', 'elsewhere'];
      writeFileSync(
        hook,
        `#!/usr/bin/env node\nconst {execFileSync}=require('node:child_process');const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('GIT_'))delete env[k];execFileSync('/usr/bin/git',${JSON.stringify(['-C', repo, ...args])},{env});\n`,
      );
      chmodSync(hook, 0o700);
      const receipt = await execute(publish);
      expect(receipt.state).toBe('succeeded');
      expect(receipt.result).toMatchObject({
        commitSha: expected,
        remoteRef: 'refs/heads/feature/test',
        warning: expect.stringContaining('tracking'),
      });
      expect(remoteHead()).toBe(expected);
      if (changed === 'tracking')
        expect(git(repo, 'rev-parse', 'refs/remotes/origin/feature/test')).toBe(other);
      else expect(git(repo, 'config', 'branch.feature/test.pushRemote')).toBe('elsewhere');
      expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('succeeded');
    },
  );
  it('rejects an endpoint-shaped remote alias before contacting a different repository', async () => {
    git(repo, 'config', `remote.${transport.remoteUrl}.url`, 'git@github.com:other/project.git');
    await expect(panel().prepare(publish)).rejects.toMatchObject({
      code: 'GIT_DELIVERY_REMOTE_UNSUPPORTED',
    });
    expect(git(bare, 'for-each-ref', '--format=%(refname)')).toBe('refs/heads/main');
  });
  it('rejects existing symbolic tracking refs without touching their protected target', async () => {
    git(repo, 'branch', 'main');
    const protectedTip = git(repo, 'rev-parse', 'main');
    git(repo, 'symbolic-ref', 'refs/remotes/origin/feature/test', 'refs/heads/main');
    await expect(panel().prepare(publish)).rejects.toMatchObject({
      code: 'GIT_DELIVERY_REMOTE_UNSUPPORTED',
    });
    expect(git(repo, 'rev-parse', 'main')).toBe(protectedTip);
  });
  it('preserves protected refs if tracking becomes symbolic after the remote effect', async () => {
    git(repo, 'branch', 'main');
    const protectedTip = git(repo, 'rev-parse', 'main');
    writeFileSync(join(repo, 'file.txt'), 'new tip');
    git(repo, 'commit', '-am', 'new tip');
    const hook = join(bare, 'hooks', 'post-receive');
    writeFileSync(
      hook,
      `#!/usr/bin/env node\nconst {execFileSync}=require('node:child_process');const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('GIT_'))delete env[k];execFileSync('/usr/bin/git',${JSON.stringify(['-C', repo, 'symbolic-ref', 'refs/remotes/origin/feature/test', 'refs/heads/main'])},{env});\n`,
    );
    chmodSync(hook, 0o700);
    const receipt = await execute(publish);
    expect(receipt.state).toBe('succeeded');
    expect(receipt.result?.warning).toContain('tracking');
    expect(remoteHead()).toBe(git(repo, 'rev-parse', 'HEAD'));
    expect(git(repo, 'rev-parse', 'main')).toBe(protectedTip);
    expect(git(repo, 'symbolic-ref', 'refs/remotes/origin/feature/test')).toBe('refs/heads/main');
  });
  it.each(['push', 'pull_request'] as const)(
    'a failed optional warning write cannot downgrade durable %s success',
    async (kind) => {
      if (kind === 'pull_request') {
        await execute(publish);
        await gh.setFailureModes({ enrichmentFailure: true });
      } else {
        const hook = join(bare, 'hooks', 'post-receive');
        writeFileSync(
          hook,
          `#!/usr/bin/env node\nconst {execFileSync}=require('node:child_process');const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('GIT_'))delete env[k];execFileSync('/usr/bin/git',${JSON.stringify(['-C', repo, 'config', 'branch.feature/test.pushRemote', 'elsewhere'])},{env});\n`,
        );
        chmodSync(hook, 0o700);
      }
      database.sqlite.exec(
        "CREATE TRIGGER fail_optional_receipt BEFORE UPDATE ON git_delivery_operations WHEN OLD.state = 'succeeded' BEGIN SELECT RAISE(ABORT, 'owned optional write failure'); END;",
      );
      const receipt = await execute(kind === 'push' ? publish : pr);
      expect(receipt.state).toBe('succeeded');
      expect(receipt.result?.warning).toBeDefined();
      const durable = getGitDeliveryOperation(database.db, receipt.id)!.receipt;
      expect(durable.state).toBe('succeeded');
      expect(durable.result).toBeDefined();
      if (kind === 'push') expect(durable.result?.commitSha).toBe(remoteHead());
      else expect(durable.result?.pullRequestUrl).toBe('https://github.com/fixture/project/pull/1');
    },
  );
  it('fresh policy denial after proven push prevents subsequent local tracking/configuration writes', async () => {
    database.sqlite.exec(
      `CREATE TRIGGER deny_bookkeeping AFTER UPDATE ON git_delivery_operations WHEN OLD.state = 'executing' AND NEW.state = 'succeeded' BEGIN UPDATE settings SET value = '"block"' WHERE key = 'executionPolicy.gitMutation'; END;`,
    );
    const receipt = await execute(publish);
    expect(receipt.state).toBe('succeeded');
    expect(receipt.result?.warning).toContain('tracking');
    expect(remoteHead()).toBe(git(repo, 'rev-parse', 'HEAD'));
    expect(
      git(repo, 'for-each-ref', '--format=%(refname)', 'refs/remotes/origin/feature/test'),
    ).toBe('');
    expect(git(repo, 'for-each-ref', '--format=%(upstream)', 'refs/heads/feature/test')).toBe('');
  });
  it.each(['multiple', 'mirror', 'rewrite', 'other-repository', 'push-refspec', 'custom-fetch'])(
    'rejects %s configuration before any push',
    async (kind) => {
      if (kind === 'multiple') {
        git(repo, 'config', '--add', 'remote.origin.pushurl', transport.remoteUrl);
        git(repo, 'config', '--add', 'remote.origin.pushurl', transport.remoteUrl);
      }
      if (kind === 'mirror') git(repo, 'config', 'remote.origin.mirror', 'true');
      if (kind === 'rewrite')
        git(repo, 'config', 'url.git@github.com:.insteadOf', 'https://github.com/');
      if (kind === 'other-repository')
        git(repo, 'config', 'remote.origin.pushurl', 'git@github.com:other/project.git');
      if (kind === 'push-refspec')
        git(repo, 'config', 'remote.origin.push', 'refs/heads/*:refs/heads/*');
      if (kind === 'custom-fetch')
        git(repo, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/custom/*');
      await expect(panel().prepare(publish)).rejects.toMatchObject({
        code: 'GIT_DELIVERY_REMOTE_UNSUPPORTED',
      });
      expect(git(bare, 'for-each-ref', '--format=%(refname)')).toBe('refs/heads/main');
    },
  );
  it('binds changed configuration and HEAD, and block wins before network effects', async () => {
    const prepared = await panel().prepare(publish);
    git(repo, 'config', 'remote.origin.pushurl', 'git@github.com:other/project.git');
    expect((await panel().execute(prepared.id, { confirmed: true })).state).toBe('stale');
    git(repo, 'config', '--unset', 'remote.origin.pushurl');
    const second = await panel().prepare(publish);
    writeFileSync(join(repo, 'file.txt'), 'next');
    git(repo, 'commit', '-am', 'next');
    expect((await panel().execute(second.id, { confirmed: true })).state).toBe('stale');
    const third = await panel().prepare(publish);
    updateSettings(database.db, { executionPolicy: { network: 'block' } });
    expect((await panel().execute(third.id, { confirmed: true })).state).toBe('denied');
    await expect(panel().prepare(publish)).rejects.toMatchObject({ status: 403 });
    expect(git(bare, 'for-each-ref', '--format=%(refname)')).toBe('refs/heads/main');
  });
  it('creates the exact PR once, and preserves success when optional enrichment fails', async () => {
    await execute(publish);
    await gh.setFailureModes({ enrichmentFailure: true });
    const prepared = await panel().prepare(pr);
    const receipt = await panel().execute(prepared.id, { confirmed: true });
    expect(receipt.state).toBe('succeeded');
    expect(receipt.result).toMatchObject({
      pullRequestUrl: 'https://github.com/fixture/project/pull/1',
      pullRequestNumber: 1,
      warning: expect.stringContaining('optional'),
    });
    expect(await panel().execute(prepared.id, { confirmed: true })).toEqual(receipt);
    expect((await gh.readLedger()).calls.filter((x) => x.args[1] === 'create')).toHaveLength(1);
  });
  it('lost create response remains unknown, never replays, and reconciles exact evidence', async () => {
    await execute(publish);
    await gh.setFailureModes({ loseCreateResponseOnce: true });
    const prepared = await panel().prepare(pr);
    const receipt = await panel().execute(prepared.id, { confirmed: true });
    expect(receipt.state).toBe('unknown');
    expect((await panel().execute(prepared.id, { confirmed: true })).state).toBe('unknown');
    await expect(panel().prepare(pr)).rejects.toMatchObject({
      code: 'GIT_DELIVERY_UNKNOWN_PENDING',
    });
    updateSettings(database.db, { executionPolicy: { network: 'block' } });
    expect((await panel().reconcile(prepared.id)).state).toBe('unknown');
    updateSettings(database.db, { executionPolicy: { network: 'ask' } });
    expect((await panel().reconcile(prepared.id)).state).toBe('succeeded');
    expect((await gh.readLedger()).calls.filter((x) => x.args[1] === 'create')).toHaveLength(1);
  });
  it('requires published exact head, real base and working authentication', async () => {
    await expect(panel().prepare(pr)).rejects.toMatchObject({
      code: 'GIT_DELIVERY_PUBLISH_REQUIRED',
    });
    await execute(publish);
    await expect(panel().prepare({ ...pr, baseBranch: 'missing' })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_BASE_MISSING',
    });
    await gh.setFailureModes({ authFailure: true });
    await expect(panel().prepare(pr)).rejects.toMatchObject({
      code: 'GIT_DELIVERY_INSPECTION_FAILED',
    });
    expect((await gh.readLedger()).pullRequests).toHaveLength(0);
  });
  it('tracking CAS does not overwrite an independent tracking update and preserves proven push result', async () => {
    const material = await inspectGitDeliveryRepository(
      repo,
      repo,
      publish,
      AbortSignal.timeout(5000),
    );
    material.remote = await inspectRemote(material, publish, AbortSignal.timeout(5000));
    // An independent tracking change to a different real object must not be overwritten.
    writeFileSync(join(repo, 'file.txt'), 'later');
    git(repo, 'commit', '-am', 'later');
    const other = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'update-ref', material.remote.trackingRef, other);
    expect(await synchroniseTracking(material, publish, AbortSignal.timeout(5000))).toContain(
      'tracking',
    );
    expect(git(repo, 'rev-parse', material.remote.trackingRef)).toBe(other);
  });
  it('push reconciliation uses the stored exact destination and fresh network permission', async () => {
    await execute(publish);
    writeFileSync(join(repo, 'file.txt'), 'next');
    git(repo, 'commit', '-am', 'next');
    const receipt = await execute({ kind: 'push', mode: 'push' });
    const stored = getGitDeliveryOperation(database.db, receipt.id)!;
    transitionGitDeliveryOperation(database.db, receipt.id, 'succeeded', {
      ...stored.receipt,
      state: 'unknown',
    });
    updateSettings(database.db, { executionPolicy: { network: 'block' } });
    expect((await panel().reconcile(receipt.id)).state).toBe('unknown');
    updateSettings(database.db, { executionPolicy: { network: 'ask' } });
    expect((await panel().reconcile(receipt.id)).state).toBe('succeeded');
  });
});
